import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CanonicalHotelCandidatesService } from '../canonical-hotel-candidates/canonical-hotel-candidates.service';
import { CANONICAL_HOTEL_CANDIDATE_STATUS } from '../canonical-hotel-candidates/constants/canonical-hotel-candidate-status.enum';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../canonical-hotel-candidates/constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_KIND } from '../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { ICanonicalHotelCandidate } from '../canonical-hotel-candidates/types/canonical-hotel-candidate.interface';
import { CANONICAL_HOTEL_PROCESSING_ACTION } from '../canonical-hotels/constants/canonical-hotel-processing-action.enum';
import { CANONICAL_HOTEL_REVIEW_REASON } from '../canonical-hotels/constants/canonical-hotel-review-reason.enum';
import { CanonicalHotelsService } from '../canonical-hotels/services/canonical-hotels.service';
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
  markShadowAggregateIgnored: jest.Mock<
    Promise<void>,
    [Types.ObjectId, string]
  >;
  hasCompatibleNumericSuffixGroup: jest.Mock<
    Promise<boolean>,
    [IHotelRegistryEntry]
  >;
  readShadowAggregateNumericSuffixGroup: jest.Mock<
    Promise<{
      numberedEntries: IHotelRegistryEntry[];
      shadowAggregateEntries: IHotelRegistryEntry[];
    } | null>,
    [IHotelRegistryEntry]
  >;
  readSafeCanonicalCandidateGroup: jest.Mock<
    Promise<IHotelRegistryEntry[]>,
    [IHotelRegistryEntry]
  >;
}

interface IHotelProcessingRunsServiceMock {
  complete: jest.Mock<Promise<void>, [string]>;
  fail: jest.Mock<Promise<void>, [string, string]>;
  incrementIgnored: jest.Mock<Promise<void>, [string, number]>;
  incrementProcessed: jest.Mock<Promise<void>, [string, number, number]>;
  incrementReviewRequired: jest.Mock<Promise<void>, [string, number]>;
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
  addCandidatesToCanonicalBatch: jest.Mock<Promise<void>, [unknown]>;
}

interface ICanonicalHotelCandidatesServiceMock {
  claimPendingForRun: jest.Mock<
    Promise<ICanonicalHotelCandidate[]>,
    [string, number]
  >;
  countByProcessingStatus: jest.Mock<
    Promise<number>,
    [HOTEL_PROCESSING_STATUS]
  >;
  markCanonicalFailed: jest.Mock<Promise<void>, [Types.ObjectId, string]>;
  markCanonicalProcessed: jest.Mock<
    Promise<void>,
    [
      Types.ObjectId,
      Types.ObjectId,
      string,
      CANONICAL_HOTEL_PROCESSING_ACTION,
    ]
  >;
  markCanonicalReviewRequired: jest.Mock<
    Promise<void>,
    [
      Types.ObjectId,
      string,
      {
        reason: CANONICAL_HOTEL_REVIEW_REASON;
        candidateCanonicalHotelIds: Types.ObjectId[];
        details: string[];
        createdAt: Date;
        resolvedAt: Date | null;
      },
    ]
  >;
  upsertFromRegistryEntries: jest.Mock<
    Promise<ICanonicalHotelCandidate>,
    [IHotelRegistryEntry[]]
  >;
  upsertAmbiguousBaseCandidate: jest.Mock<
    Promise<ICanonicalHotelCandidate>,
    [IHotelRegistryEntry]
  >;
}

interface ICanonicalHotelsServiceMock {
  applyCandidate: jest.Mock<
    Promise<{
      action: CANONICAL_HOTEL_PROCESSING_ACTION;
      canonicalHotelId: Types.ObjectId | null;
      review: {
        reason: CANONICAL_HOTEL_REVIEW_REASON;
        candidateCanonicalHotelIds: Types.ObjectId[];
        details: string[];
        createdAt: Date;
        resolvedAt: Date | null;
      } | null;
    }>,
    [ICanonicalHotelCandidate]
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
      action: null,
      canonicalHotelId: null,
      claimedAt: null,
      error: null,
      processedAt: null,
      review: null,
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
  let canonicalHotelsService: ICanonicalHotelsServiceMock;
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
      markShadowAggregateIgnored: jest.fn(),
      hasCompatibleNumericSuffixGroup: jest.fn(),
      readShadowAggregateNumericSuffixGroup: jest.fn(),
      readSafeCanonicalCandidateGroup: jest.fn(),
    };
    hotelProcessingRunsService = {
      complete: jest.fn(),
      fail: jest.fn(),
      incrementIgnored: jest.fn(),
      incrementProcessed: jest.fn(),
      incrementReviewRequired: jest.fn(),
      markRunning: jest.fn(),
    };
    hotelProcessingQueueService = {
      addCandidatesToCanonicalBatch: jest.fn(),
      addRawToRegistryBatch: jest.fn(),
      addRegistryToCandidatesBatch: jest.fn(),
    };
    canonicalHotelCandidatesService = {
      claimPendingForRun: jest.fn(),
      countByProcessingStatus: jest.fn(),
      markCanonicalFailed: jest.fn(),
      markCanonicalProcessed: jest.fn(),
      markCanonicalReviewRequired: jest.fn(),
      upsertAmbiguousBaseCandidate: jest.fn(),
      upsertFromRegistryEntries: jest.fn(),
    };
    canonicalHotelsService = {
      applyCandidate: jest.fn(),
    };
    hotelRegistryEntriesService.readShadowAggregateNumericSuffixGroup.mockResolvedValue(
      null,
    );
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
        {
          provide: CanonicalHotelsService,
          useValue: canonicalHotelsService,
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
    hotelRegistryEntriesService.hasCompatibleNumericSuffixGroup.mockResolvedValue(
      false,
    );
    hotelRegistryEntriesService.readSafeCanonicalCandidateGroup.mockResolvedValue(
      [groupedEntryOne, groupedEntryTwo],
    );
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

  it('updates already processed grouped siblings without counting them in current run stats', async () => {
    const pendingEntry = buildRegistryEntry({
      establishmentType: 'HOTEL APARTMENTS',
      registryKey: 'nissiana-apartments',
    });
    const previouslyProcessedEntry = buildRegistryEntry({
      establishmentType: 'HOTELS',
      processing: {
        canonicalHotelCandidateId: new Types.ObjectId(),
        claimedAt: null,
        error: null,
        processedAt: new Date('2026-05-03T09:00:00.000Z'),
        runId: 'previous-run',
        status: HOTEL_PROCESSING_STATUS.PROCESSED,
      },
      registryKey: 'nissiana-hotel',
    });
    const candidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([
      pendingEntry,
    ]);
    hotelRegistryEntriesService.readSafeCanonicalCandidateGroup.mockResolvedValue(
      [previouslyProcessedEntry, pendingEntry],
    );
    hotelRegistryEntriesService.hasCompatibleNumericSuffixGroup.mockResolvedValue(
      false,
    );
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

    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      previouslyProcessedEntry._id,
      candidateId,
      'run-1',
    );
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      pendingEntry._id,
      candidateId,
      'run-1',
    );
    expect(hotelProcessingRunsService.incrementProcessed).toHaveBeenCalledWith(
      'run-1',
      1,
      0,
    );
  });

  it('queues the next batch while pending registry entries remain', async () => {
    const entry = buildRegistryEntry({});
    const candidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([entry]);
    hotelRegistryEntriesService.hasCompatibleNumericSuffixGroup.mockResolvedValue(
      false,
    );
    hotelRegistryEntriesService.readSafeCanonicalCandidateGroup.mockResolvedValue(
      [entry],
    );
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

  it('creates a blocked candidate for an ambiguous base entry matching a numeric suffix group', async () => {
    const entry = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      registryKey: 'thalassines-base',
    });
    const candidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([entry]);
    hotelRegistryEntriesService.readSafeCanonicalCandidateGroup.mockResolvedValue(
      [entry],
    );
    hotelRegistryEntriesService.hasCompatibleNumericSuffixGroup.mockResolvedValue(
      true,
    );
    canonicalHotelCandidatesService.upsertAmbiguousBaseCandidate.mockResolvedValue(
      buildCandidate(candidateId),
    );
    hotelRegistryEntriesService.countByProcessingStatus.mockResolvedValue(0);

    await processor.processRegistryToCandidatesBatch({
      batchNo: 1,
      batchSize: 50,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    });

    expect(
      canonicalHotelCandidatesService.upsertAmbiguousBaseCandidate,
    ).toHaveBeenCalledWith(entry);
    expect(
      canonicalHotelCandidatesService.upsertFromRegistryEntries,
    ).not.toHaveBeenCalled();
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      entry._id,
      candidateId,
      'run-1',
    );
  });

  it('marks only PALATAKIA business suffix components with the grouped candidate id', async () => {
    const secondEntry = buildRegistryEntry({
      capacity: {
        beds: 10,
        rooms: 5,
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA 2',
        original: 'PALATAKIA 2',
        suffix: '2',
      },
      registryKey: 'palatakia-2-apartments',
    });
    const thirdEntry = buildRegistryEntry({
      capacity: {
        beds: 8,
        rooms: 4,
      },
      establishmentType: 'TRADITIONAL HOUSES - HOTELS',
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA 3',
        original: 'PALATAKIA 3',
        suffix: '3',
      },
      registryKey: 'palatakia-3-hotels',
    });
    const candidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([
      thirdEntry,
    ]);
    hotelRegistryEntriesService.readSafeCanonicalCandidateGroup.mockResolvedValue(
      [secondEntry, thirdEntry],
    );
    hotelRegistryEntriesService.hasCompatibleNumericSuffixGroup.mockResolvedValue(
      false,
    );
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

    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      secondEntry._id,
      candidateId,
      'run-1',
    );
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      thirdEntry._id,
      candidateId,
      'run-1',
    );
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledTimes(2);
    expect(
      canonicalHotelCandidatesService.upsertAmbiguousBaseCandidate,
    ).not.toHaveBeenCalled();
  });

  it('keeps standalone THALASSINES on a single candidate and numeric entries on grouped candidate', async () => {
    const baseEntry = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      registryKey: 'thalassines-base',
    });
    const numericEntryOne = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 2',
        original: 'THALASSINES 2',
        suffix: '2',
      },
      registryKey: 'thalassines-2',
    });
    const numericEntryTwo = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 7',
        original: 'THALASSINES 7',
        suffix: '7',
      },
      registryKey: 'thalassines-7',
    });
    const singleCandidateId = new Types.ObjectId();
    const groupCandidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([
      baseEntry,
      numericEntryOne,
    ]);
    hotelRegistryEntriesService.readSafeCanonicalCandidateGroup
      .mockResolvedValueOnce([baseEntry])
      .mockResolvedValueOnce([numericEntryOne, numericEntryTwo]);
    hotelRegistryEntriesService.hasCompatibleNumericSuffixGroup.mockResolvedValue(
      false,
    );
    canonicalHotelCandidatesService.upsertFromRegistryEntries
      .mockResolvedValueOnce(buildCandidate(singleCandidateId))
      .mockResolvedValueOnce(buildCandidate(groupCandidateId));
    hotelRegistryEntriesService.countByProcessingStatus.mockResolvedValue(0);

    await processor.processRegistryToCandidatesBatch({
      batchNo: 1,
      batchSize: 50,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    });

    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      baseEntry._id,
      singleCandidateId,
      'run-1',
    );
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      numericEntryOne._id,
      groupCandidateId,
      'run-1',
    );
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      numericEntryTwo._id,
      groupCandidateId,
      'run-1',
    );
    expect(
      canonicalHotelCandidatesService.upsertAmbiguousBaseCandidate,
    ).not.toHaveBeenCalled();
  });

  it('ignores THALASSINES shadow aggregate and creates only the numbered group candidate', async () => {
    const aggregateEntry = buildRegistryEntry({
      capacity: {
        beds: 64,
        rooms: 11,
      },
      contacts: {
        domains: ['thalassines.com'],
        emails: ['reservations@thalassines.com'],
        phones: ['+35723744866'],
        websites: ['https://www.thalassines.com/'],
      },
      location: {
        address: '77, Agias Theklas Avenue',
        district: 'AGIA NAPA',
        locality: 'Agia Napa',
        postcode: '5391',
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      registryKey: 'thalassines-aggregate',
    });
    const numberedEntries = ['2', '7', '8'].map((suffix) =>
      buildRegistryEntry({
        capacity: {
          beds: 6,
          rooms: 1,
        },
        contacts: {
          domains: ['thalassines.com'],
          emails: ['admin@thalassines.com'],
          phones: ['+35723744866'],
          websites: ['https://www.thalassines.com/'],
        },
        location: {
          address: '77 Agias Theklas Avenue',
          district: 'SOTERA',
          locality: 'Sotera',
          postcode: '5391',
        },
        name: {
          baseName: 'THALASSINES',
          normalized: `THALASSINES ${suffix}`,
          original: `THALASSINES ${suffix}`,
          suffix,
        },
        registryKey: `thalassines-${suffix}`,
      }),
    );
    const candidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([
      aggregateEntry,
    ]);
    hotelRegistryEntriesService.readShadowAggregateNumericSuffixGroup.mockResolvedValue(
      {
        numberedEntries,
        shadowAggregateEntries: [aggregateEntry],
      },
    );
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

    expect(
      canonicalHotelCandidatesService.upsertFromRegistryEntries,
    ).toHaveBeenCalledWith(numberedEntries);
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledTimes(3);

    for (const numberedEntry of numberedEntries) {
      expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
        numberedEntry._id,
        candidateId,
        'run-1',
      );
    }

    expect(
      hotelRegistryEntriesService.markShadowAggregateIgnored,
    ).toHaveBeenCalledWith(
      aggregateEntry._id,
      'Ignored as shadow aggregate of numeric suffix group: THALASSINES postcode 5391 address 77, Agias Theklas Avenue',
    );
    expect(hotelProcessingRunsService.incrementIgnored).toHaveBeenCalledWith(
      'run-1',
      1,
    );
    expect(
      canonicalHotelCandidatesService.upsertAmbiguousBaseCandidate,
    ).not.toHaveBeenCalled();
  });

  it('marks LITO base and numeric suffix rows with one grouped candidate id', async () => {
    const baseEntry = buildRegistryEntry({
      name: {
        baseName: 'LITO',
        normalized: 'LITO',
        original: 'LITO',
        suffix: null,
      },
      registryKey: 'lito-base',
    });
    const secondEntry = buildRegistryEntry({
      name: {
        baseName: 'LITO',
        normalized: 'LITO 2',
        original: 'LITO 2',
        suffix: '2',
      },
      registryKey: 'lito-2',
    });
    const thirdEntry = buildRegistryEntry({
      name: {
        baseName: 'LITO',
        normalized: 'LITO 3',
        original: 'LITO 3',
        suffix: '3',
      },
      registryKey: 'lito-3',
    });
    const candidateId = new Types.ObjectId();

    hotelRegistryEntriesService.claimPendingForRun.mockResolvedValue([
      baseEntry,
    ]);
    hotelRegistryEntriesService.readSafeCanonicalCandidateGroup.mockResolvedValue(
      [secondEntry, thirdEntry, baseEntry],
    );
    hotelRegistryEntriesService.hasCompatibleNumericSuffixGroup.mockResolvedValue(
      false,
    );
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

    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      baseEntry._id,
      candidateId,
      'run-1',
    );
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      secondEntry._id,
      candidateId,
      'run-1',
    );
    expect(hotelRegistryEntriesService.markProcessed).toHaveBeenCalledWith(
      thirdEntry._id,
      candidateId,
      'run-1',
    );
    expect(
      canonicalHotelCandidatesService.upsertAmbiguousBaseCandidate,
    ).not.toHaveBeenCalled();
  });

  it('processes candidates into canonical hotels and completes when no pending candidates remain', async () => {
    const candidate = buildCandidate(new Types.ObjectId());
    const canonicalHotelId = new Types.ObjectId();

    canonicalHotelCandidatesService.claimPendingForRun.mockResolvedValue([
      candidate,
    ]);
    canonicalHotelsService.applyCandidate.mockResolvedValue({
      action: CANONICAL_HOTEL_PROCESSING_ACTION.CREATED,
      canonicalHotelId,
      review: null,
    });
    canonicalHotelCandidatesService.countByProcessingStatus.mockResolvedValue(
      0,
    );

    await processor.processCandidatesToCanonicalBatch({
      batchNo: 1,
      batchSize: 50,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.CANDIDATES_TO_CANONICAL,
    });

    expect(canonicalHotelsService.applyCandidate).toHaveBeenCalledWith(
      candidate,
    );
    expect(
      canonicalHotelCandidatesService.markCanonicalProcessed,
    ).toHaveBeenCalledWith(
      candidate._id,
      canonicalHotelId,
      'run-1',
      CANONICAL_HOTEL_PROCESSING_ACTION.CREATED,
    );
    expect(hotelProcessingRunsService.incrementProcessed).toHaveBeenCalledWith(
      'run-1',
      1,
      0,
    );
    expect(hotelProcessingRunsService.complete).toHaveBeenCalledWith('run-1');
  });

  it('marks candidates as review-required without failing the run', async () => {
    const candidate = buildCandidate(new Types.ObjectId());
    const review = {
      candidateCanonicalHotelIds: [],
      createdAt: new Date('2026-05-04T08:00:00.000Z'),
      details: ['Candidate does not have enough canonical identity fields.'],
      reason: CANONICAL_HOTEL_REVIEW_REASON.MISSING_IDENTITY_FIELDS,
      resolvedAt: null,
    };

    canonicalHotelCandidatesService.claimPendingForRun.mockResolvedValue([
      candidate,
    ]);
    canonicalHotelsService.applyCandidate.mockResolvedValue({
      action: CANONICAL_HOTEL_PROCESSING_ACTION.REVIEW_REQUIRED,
      canonicalHotelId: null,
      review,
    });
    canonicalHotelCandidatesService.countByProcessingStatus.mockResolvedValue(
      0,
    );

    await processor.processCandidatesToCanonicalBatch({
      batchNo: 1,
      batchSize: 50,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.CANDIDATES_TO_CANONICAL,
    });

    expect(
      canonicalHotelCandidatesService.markCanonicalReviewRequired,
    ).toHaveBeenCalledWith(candidate._id, 'run-1', review);
    expect(
      hotelProcessingRunsService.incrementReviewRequired,
    ).toHaveBeenCalledWith('run-1', 1);
    expect(hotelProcessingRunsService.fail).not.toHaveBeenCalled();
    expect(hotelProcessingRunsService.complete).toHaveBeenCalledWith('run-1');
  });
});
