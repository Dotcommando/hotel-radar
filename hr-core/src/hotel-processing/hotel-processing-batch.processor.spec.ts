import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CanonicalHotelCandidatesService } from '../canonical-hotel-candidates/canonical-hotel-candidates.service';
import { CANONICAL_HOTEL_CANDIDATE_STATUS } from '../canonical-hotel-candidates/constants/canonical-hotel-candidate-status.enum';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../canonical-hotel-candidates/constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_KIND } from '../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { ICanonicalHotelCandidate } from '../canonical-hotel-candidates/types/canonical-hotel-candidate.interface';
import { HotelRegistryEntriesService } from '../hotel-registry-entries/hotel-registry-entries.service';
import { HOTEL_REGISTRY_ENTRY_STATUS } from '../hotel-registry-entries/constants/hotel-registry-entry-status.enum';
import { IHotelRegistryEntry } from '../hotel-registry-entries/types/hotel-registry-entry.interface';
import { RawHotelsService } from '../raw-hotels/raw-hotels.service';
import { HOTEL_PROCESSING_STAGE } from './constants/hotel-processing-stage.enum';
import { HOTEL_PROCESSING_STATUS } from './constants/hotel-processing-status.enum';
import { HotelProcessingBatchProcessor } from './hotel-processing-batch.processor';
import { HotelProcessingQueueService } from './hotel-processing-queue.service';
import { HotelProcessingRunsService } from './hotel-processing-runs.service';

interface IRawHotelsServiceMock {
  countByProcessingStatus: jest.Mock<
    Promise<number>,
    [HOTEL_PROCESSING_STATUS]
  >;
  claimPendingForRun: jest.Mock<Promise<unknown[]>, [string, number]>;
}

interface IHotelRegistryEntriesServiceMock {
  claimPendingForRun: jest.Mock<
    Promise<IHotelRegistryEntry[]>,
    [string, number]
  >;
  countByProcessingStatus: jest.Mock<
    Promise<number>,
    [HOTEL_PROCESSING_STATUS]
  >;
  markFailed: jest.Mock<Promise<void>, [Types.ObjectId, string]>;
  markIgnored: jest.Mock<Promise<void>, [Types.ObjectId, string]>;
  markProcessed: jest.Mock<
    Promise<void>,
    [Types.ObjectId, Types.ObjectId, string]
  >;
  readSafeNumericSuffixGroup: jest.Mock<
    Promise<IHotelRegistryEntry[]>,
    [IHotelRegistryEntry]
  >;
}

interface IHotelProcessingRunsServiceMock {
  complete: jest.Mock<Promise<void>, [string]>;
  fail: jest.Mock<Promise<void>, [string, string]>;
  incrementIgnored: jest.Mock<Promise<void>, [string, number]>;
  incrementProcessed: jest.Mock<Promise<void>, [string, number, number]>;
  markRunning: jest.Mock<Promise<void>, [string, number]>;
}

interface IHotelProcessingQueueServiceMock {
  addRawToRegistryBatch: jest.Mock<Promise<void>, [unknown]>;
  addRegistryToCandidatesBatch: jest.Mock<
    Promise<void>,
    [
      {
        runId: string;
        stage: HOTEL_PROCESSING_STAGE;
        batchNo: number;
        batchSize: number;
      },
    ]
  >;
}

interface ICanonicalHotelCandidatesServiceMock {
  upsertFromRegistryEntries: jest.Mock<
    Promise<ICanonicalHotelCandidate>,
    [IHotelRegistryEntry[]]
  >;
}

function buildRegistryEntry(
  overrides: Partial<IHotelRegistryEntry>,
): IHotelRegistryEntry {
  return {
    _id: new Types.ObjectId(),
    capacity: {
      beds: 10,
      rooms: 5,
    },
    contacts: {
      domains: ['example.com'],
      emails: ['info@example.com'],
      phones: ['+35711111111'],
      websites: ['https://www.example.com/'],
    },
    createdAt: new Date('2026-05-02T10:00:00.000Z'),
    establishmentType: 'HOTELS',
    issues: [],
    location: {
      address: '1 Example Street',
      district: 'Pafos',
      locality: 'Pafos',
      postcode: '8042',
    },
    name: {
      baseName: 'EXAMPLE',
      normalized: 'EXAMPLE',
      original: 'EXAMPLE',
      suffix: null,
    },
    operator: 'Example Ltd',
    processing: {
      canonicalHotelCandidateId: null,
      claimedAt: null,
      error: null,
      processedAt: null,
      runId: null,
      status: HOTEL_PROCESSING_STATUS.CLAIMED,
    },
    registryKey: 'registry-key',
    status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
    updatedAt: new Date('2026-05-02T10:00:00.000Z'),
    ...overrides,
  };
}

function buildCandidate(candidateId: Types.ObjectId): ICanonicalHotelCandidate {
  return {
    _id: candidateId,
    build: {
      issues: [],
      rule: 'single_registry_entry',
      ruleVersion: 1,
    },
    candidateKey: 'candidate-key',
    canonicalName: 'EXAMPLE',
    capacity: {
      beds: 10,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 5,
    },
    components: [],
    contacts: {
      domains: [],
      emails: [],
      phones: [],
      websites: [],
    },
    createdAt: new Date('2026-05-02T10:00:00.000Z'),
    kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
    location: {
      address: null,
      district: null,
      locality: null,
      postcode: null,
    },
    operator: null,
    processing: {
      canonicalHotelId: null,
      claimedAt: null,
      error: null,
      processedAt: null,
      runId: null,
      status: HOTEL_PROCESSING_STATUS.PENDING,
    },
    status: CANONICAL_HOTEL_CANDIDATE_STATUS.READY,
    updatedAt: new Date('2026-05-02T10:00:00.000Z'),
  };
}

describe('HotelProcessingBatchProcessor registry-to-candidates', () => {
  let rawHotelsService: IRawHotelsServiceMock;
  let hotelRegistryEntriesService: IHotelRegistryEntriesServiceMock;
  let hotelProcessingRunsService: IHotelProcessingRunsServiceMock;
  let hotelProcessingQueueService: IHotelProcessingQueueServiceMock;
  let canonicalHotelCandidatesService: ICanonicalHotelCandidatesServiceMock;
  let processor: HotelProcessingBatchProcessor;

  beforeEach(async () => {
    rawHotelsService = {
      claimPendingForRun: jest.fn(),
      countByProcessingStatus: jest.fn(),
    };
    hotelRegistryEntriesService = {
      claimPendingForRun: jest.fn(),
      countByProcessingStatus: jest.fn(),
      markFailed: jest.fn(),
      markIgnored: jest.fn(),
      markProcessed: jest.fn(),
      readSafeNumericSuffixGroup: jest.fn(),
    };
    hotelProcessingRunsService = {
      complete: jest.fn(),
      fail: jest.fn(),
      incrementIgnored: jest.fn(),
      incrementProcessed: jest.fn(),
      markRunning: jest.fn(),
    };
    hotelProcessingQueueService = {
      addRawToRegistryBatch: jest.fn(),
      addRegistryToCandidatesBatch: jest.fn(),
    };
    canonicalHotelCandidatesService = {
      upsertFromRegistryEntries: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HotelProcessingBatchProcessor,
        {
          provide: RawHotelsService,
          useValue: rawHotelsService,
        },
        {
          provide: HotelRegistryEntriesService,
          useValue: hotelRegistryEntriesService,
        },
        {
          provide: HotelProcessingRunsService,
          useValue: hotelProcessingRunsService,
        },
        {
          provide: HotelProcessingQueueService,
          useValue: hotelProcessingQueueService,
        },
        {
          provide: CanonicalHotelCandidatesService,
          useValue: canonicalHotelCandidatesService,
        },
      ],
    }).compile();

    processor = module.get<HotelProcessingBatchProcessor>(
      HotelProcessingBatchProcessor,
    );
  });

  it('creates candidates for ready entries, ignores blocked entries, and completes when no pending entries remain', async () => {
    const blockedEntry = buildRegistryEntry({
      issues: ['invalid_capacity'],
      status: HOTEL_REGISTRY_ENTRY_STATUS.BLOCKED,
    });
    const groupedEntryOne = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 10',
        original: 'THALASSINES 10',
        suffix: '10',
      },
      registryKey: 'thalassines-10',
    });
    const groupedEntryTwo = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 11',
        original: 'THALASSINES 11',
        suffix: '11',
      },
      registryKey: 'thalassines-11',
    });
    const candidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([
      blockedEntry,
      groupedEntryOne,
      groupedEntryTwo,
    ]);
    hotelRegistryEntriesService.readSafeNumericSuffixGroup.mockResolvedValue([
      groupedEntryOne,
      groupedEntryTwo,
    ]);
    canonicalHotelCandidatesService.upsertFromRegistryEntries.mockResolvedValue(
      buildCandidate(candidateId),
    );
    hotelRegistryEntriesService.countByProcessingStatus.mockResolvedValue(0);

    await processor.processRegistryToCandidatesBatch({
      batchNo: 1,
      batchSize: 50,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    });

    expect(hotelRegistryEntriesService.markIgnored).toHaveBeenCalledWith(
      blockedEntry._id,
      'Registry entry is blocked: invalid_capacity',
    );
    expect(
      canonicalHotelCandidatesService.upsertFromRegistryEntries,
    ).toHaveBeenCalledTimes(1);
    expect(
      canonicalHotelCandidatesService.upsertFromRegistryEntries,
    ).toHaveBeenCalledWith([groupedEntryOne, groupedEntryTwo]);
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      groupedEntryOne._id,
      candidateId,
      'run-1',
    );
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      groupedEntryTwo._id,
      candidateId,
      'run-1',
    );
    expect(hotelProcessingRunsService.incrementProcessed).toHaveBeenCalledWith(
      'run-1',
      2,
      0,
    );
    expect(hotelProcessingRunsService.incrementIgnored).toHaveBeenCalledWith(
      'run-1',
      1,
    );
    expect(hotelProcessingRunsService.complete).toHaveBeenCalledWith('run-1');
  });

  it('queues the next batch while pending registry entries remain', async () => {
    const entry = buildRegistryEntry({});
    const candidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([entry]);
    hotelRegistryEntriesService.readSafeNumericSuffixGroup.mockResolvedValue([
      entry,
    ]);
    canonicalHotelCandidatesService.upsertFromRegistryEntries.mockResolvedValue(
      buildCandidate(candidateId),
    );
    hotelRegistryEntriesService.countByProcessingStatus.mockResolvedValue(12);

    await processor.processRegistryToCandidatesBatch({
      batchNo: 2,
      batchSize: 50,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    });

    expect(
      hotelProcessingQueueService.addRegistryToCandidatesBatch,
    ).toHaveBeenCalledWith({
      batchNo: 3,
      batchSize: 50,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    });
    expect(hotelProcessingRunsService.complete).not.toHaveBeenCalled();
  });
});
