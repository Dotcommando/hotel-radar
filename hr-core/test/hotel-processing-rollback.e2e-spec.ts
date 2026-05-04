import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { CanonicalHotelCandidatesService } from '../src/canonical-hotel-candidates/canonical-hotel-candidates.service';
import { HotelRegistryEntriesService } from '../src/hotel-registry-entries/hotel-registry-entries.service';
import { RawHotelsService } from '../src/raw-hotels/raw-hotels.service';
import { HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE } from '../src/hotel-processing/constants/hotel-processing-rollback-target-stage.enum';
import { HOTEL_PROCESSING_STAGE } from '../src/hotel-processing/constants/hotel-processing-stage.enum';
import { HOTEL_PROCESSING_STATUS } from '../src/hotel-processing/constants/hotel-processing-status.enum';
import { HotelProcessingController } from '../src/hotel-processing/hotel-processing.controller';
import { HotelProcessingRunsService } from '../src/hotel-processing/hotel-processing-runs.service';
import { GetHotelProcessingRunUseCase } from '../src/hotel-processing/use-cases/get-hotel-processing-run.use-case';
import { RollbackHotelProcessingUseCase } from '../src/hotel-processing/use-cases/rollback-hotel-processing.use-case';
import { StartRawToRegistryRunUseCase } from '../src/hotel-processing/use-cases/start-raw-to-registry-run.use-case';
import { StartRegistryToCandidatesRunUseCase } from '../src/hotel-processing/use-cases/start-registry-to-candidates-run.use-case';

const RAW_TO_REGISTRY_RUN_ID = '2026-05-03T17-15-04-raw-to-registry';
const REGISTRY_TO_CANDIDATES_RUN_ID =
  '2026-05-03T17-15-15-registry-to-candidates';

interface IE2eCandidate {
  _id: Types.ObjectId;
  canonicalName: string;
}

interface IE2eRegistryEntry {
  _id: Types.ObjectId;
  processing: {
    canonicalHotelCandidateId: Types.ObjectId | null;
    claimedAt: Date | null;
    error: string | null;
    processedAt: Date | null;
    runId: string | null;
    status: HOTEL_PROCESSING_STATUS;
  };
}

interface IE2eRawHotel {
  _id: Types.ObjectId;
  processing: {
    claimedAt: Date | null;
    error: string | null;
    hotelRegistryEntryId: Types.ObjectId | null;
    processedAt: Date | null;
    runId: string | null;
    status: HOTEL_PROCESSING_STATUS;
  };
}

function id(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function buildCandidates(): IE2eCandidate[] {
  return [
    ['69f782a3468ad01eb59c41ac', 'NISSIANA'],
    ['69f782a4468ad01eb59c41f5', 'TSOKKOS HOLIDAY'],
    ['69f782a4468ad01eb59c4206', 'MARIA'],
    ['69f782a3468ad01eb59c4179', 'AMYTH OF NICOSIA BOUTIQUE'],
    ['69f782a3468ad01eb59c417a', 'HILTON NICOSIA'],
    ['69f782a3468ad01eb59c417b', 'THE LANDMARK NICOSIA'],
    ['69f782a3468ad01eb59c417c', 'CLASSIC'],
    ['69f782a3468ad01eb59c417d', 'CLEOPATRA'],
    ['69f782a3468ad01eb59c417e', 'CASTELLI'],
    ['69f782a3468ad01eb59c417f', 'CENTRUM'],
    ['69f782a3468ad01eb59c4180', 'MAP BOUTIQUE'],
    ['69f782a3468ad01eb59c4181', 'SEMELI'],
  ].map(([candidateId, canonicalName]) => ({
    _id: id(candidateId),
    canonicalName,
  }));
}

function buildRegistryEntries(): IE2eRegistryEntry[] {
  return [
    ['69f78298468ad01eb59c3e96', '69f782a3468ad01eb59c4179'],
    ['69f78298468ad01eb59c3e97', '69f782a3468ad01eb59c417a'],
    ['69f78298468ad01eb59c3e98', '69f782a3468ad01eb59c417b'],
    ['69f78298468ad01eb59c3e99', '69f782a3468ad01eb59c417c'],
    ['69f78298468ad01eb59c3e9a', '69f782a3468ad01eb59c417d'],
    ['69f78298468ad01eb59c3e9b', '69f782a3468ad01eb59c417e'],
    ['69f78298468ad01eb59c3e9c', '69f782a3468ad01eb59c417f'],
    ['69f78298468ad01eb59c3e9d', '69f782a3468ad01eb59c4180'],
    ['69f78298468ad01eb59c3e9e', '69f782a3468ad01eb59c4181'],
    ['69f78298468ad01eb59c3ec9', '69f782a3468ad01eb59c41ac'],
    ['69f78298468ad01eb59c3ef6', '69f782a3468ad01eb59c41ac'],
    ['69f78299468ad01eb59c3f13', '69f782a4468ad01eb59c41f5'],
    ['69f78299468ad01eb59c3f18', '69f782a4468ad01eb59c41f5'],
    ['69f78299468ad01eb59c3f25', '69f782a4468ad01eb59c4206'],
    ['69f78299468ad01eb59c3f26', '69f782a4468ad01eb59c4206'],
  ].map(([registryEntryId, candidateId]) => ({
    _id: id(registryEntryId),
    processing: {
      canonicalHotelCandidateId: id(candidateId),
      claimedAt: null,
      error: null,
      processedAt: new Date('2026-05-03T17:15:15.290Z'),
      runId: REGISTRY_TO_CANDIDATES_RUN_ID,
      status: HOTEL_PROCESSING_STATUS.PROCESSED,
    },
  }));
}

function buildRawHotels(): IE2eRawHotel[] {
  return [
    ['69f77aaa468ad01eb59c3bb0', '69f78298468ad01eb59c3e96'],
    ['69f77aaa468ad01eb59c3bb1', '69f78298468ad01eb59c3e97'],
    ['69f77aaa468ad01eb59c3bb2', '69f78298468ad01eb59c3e98'],
    ['69f77aaa468ad01eb59c3bb3', '69f78298468ad01eb59c3e99'],
    ['69f77aaa468ad01eb59c3bb4', '69f78298468ad01eb59c3e9a'],
    ['69f77aaa468ad01eb59c3bb5', '69f78298468ad01eb59c3e9b'],
    ['69f77aaa468ad01eb59c3bb6', '69f78298468ad01eb59c3e9c'],
    ['69f77aaa468ad01eb59c3bb7', '69f78298468ad01eb59c3e9d'],
    ['69f77aaa468ad01eb59c3bb8', '69f78298468ad01eb59c3e9e'],
    ['69f77b27468ad01eb59c3be3', '69f78298468ad01eb59c3ec9'],
    ['69f77b8f468ad01eb59c3c10', '69f78298468ad01eb59c3ef6'],
    ['69f77bfa468ad01eb59c3c2d', '69f78299468ad01eb59c3f13'],
    ['69f77bfa468ad01eb59c3c32', '69f78299468ad01eb59c3f18'],
    ['69f77c28468ad01eb59c3c3f', '69f78299468ad01eb59c3f25'],
    ['69f77c28468ad01eb59c3c40', '69f78299468ad01eb59c3f26'],
  ].map(([rawHotelId, registryEntryId]) => ({
    _id: id(rawHotelId),
    processing: {
      claimedAt: null,
      error: null,
      hotelRegistryEntryId: id(registryEntryId),
      processedAt: new Date('2026-05-03T17:15:04.162Z'),
      runId: RAW_TO_REGISTRY_RUN_ID,
      status: HOTEL_PROCESSING_STATUS.PROCESSED,
    },
  }));
}

class RawHotelsServiceFake {
  constructor(private readonly rawHotels: IE2eRawHotel[]) {}

  async findProcessingRunIds(): Promise<(string | null)[]> {
    return this.rawHotels.map(({ processing }) => processing.runId);
  }

  async countByProcessingRunId(runId: string): Promise<number> {
    return this.rawHotels.filter(
      ({ processing }) => processing.runId === runId,
    ).length;
  }

  async readRollbackBatchByProcessingRunId(
    runId: string,
    limit: number,
  ): Promise<IE2eRawHotel[]> {
    return this.rawHotels
      .filter(({ processing }) => processing.runId === runId)
      .slice(0, limit);
  }

  async resetProcessingByIds(ids: Types.ObjectId[]): Promise<number> {
    const idSet = new Set(ids.map((rawHotelId) => rawHotelId.toString()));

    for (const rawHotel of this.rawHotels) {
      if (idSet.has(rawHotel._id.toString())) {
        rawHotel.processing = {
          claimedAt: null,
          error: null,
          hotelRegistryEntryId: null,
          processedAt: null,
          runId: null,
          status: HOTEL_PROCESSING_STATUS.PENDING,
        };
      }
    }

    return idSet.size;
  }
}

class HotelRegistryEntriesServiceFake {
  constructor(private readonly registryEntries: IE2eRegistryEntry[]) {}

  async findProcessingRunIds(): Promise<(string | null)[]> {
    return this.registryEntries.map(({ processing }) => processing.runId);
  }

  async countByProcessingRunId(runId: string): Promise<number> {
    return this.registryEntries.filter(
      ({ processing }) => processing.runId === runId,
    ).length;
  }

  async readRollbackBatchByProcessingRunId(
    runId: string,
    limit: number,
  ): Promise<IE2eRegistryEntry[]> {
    return this.registryEntries
      .filter(({ processing }) => processing.runId === runId)
      .slice(0, limit);
  }

  async resetProcessingByIds(ids: Types.ObjectId[]): Promise<number> {
    const idSet = new Set(
      ids.map((registryEntryId) => registryEntryId.toString()),
    );

    for (const registryEntry of this.registryEntries) {
      if (idSet.has(registryEntry._id.toString())) {
        registryEntry.processing = {
          canonicalHotelCandidateId: null,
          claimedAt: null,
          error: null,
          processedAt: null,
          runId: null,
          status: HOTEL_PROCESSING_STATUS.PENDING,
        };
      }
    }

    return idSet.size;
  }

  async deleteManyByIds(ids: Types.ObjectId[]): Promise<number> {
    const idSet = new Set(
      ids.map((registryEntryId) => registryEntryId.toString()),
    );
    const originalLength = this.registryEntries.length;

    for (let index = this.registryEntries.length - 1; index >= 0; index -= 1) {
      if (idSet.has(this.registryEntries[index]._id.toString())) {
        this.registryEntries.splice(index, 1);
      }
    }

    return originalLength - this.registryEntries.length;
  }
}

class CanonicalHotelCandidatesServiceFake {
  constructor(private readonly candidates: IE2eCandidate[]) {}

  async deleteManyByIds(ids: Types.ObjectId[]): Promise<number> {
    const idSet = new Set(ids.map((candidateId) => candidateId.toString()));
    const originalLength = this.candidates.length;

    for (let index = this.candidates.length - 1; index >= 0; index -= 1) {
      if (idSet.has(this.candidates[index]._id.toString())) {
        this.candidates.splice(index, 1);
      }
    }

    return originalLength - this.candidates.length;
  }
}

describe('Hotel processing rollback (e2e)', () => {
  let app: INestApplication<App>;
  let candidates: IE2eCandidate[];
  let registryEntries: IE2eRegistryEntry[];
  let rawHotels: IE2eRawHotel[];

  beforeEach(async () => {
    candidates = buildCandidates();
    registryEntries = buildRegistryEntries();
    rawHotels = buildRawHotels();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HotelProcessingController],
      providers: [
        RollbackHotelProcessingUseCase,
        {
          provide: RawHotelsService,
          useValue: new RawHotelsServiceFake(rawHotels),
        },
        {
          provide: HotelRegistryEntriesService,
          useValue: new HotelRegistryEntriesServiceFake(registryEntries),
        },
        {
          provide: CanonicalHotelCandidatesService,
          useValue: new CanonicalHotelCandidatesServiceFake(candidates),
        },
        {
          provide: HotelProcessingRunsService,
          useValue: {
            hasActiveRun: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: StartRawToRegistryRunUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: StartRegistryToCandidatesRunUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: GetHotelProcessingRunUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rolls back stage 3 and stage 2 through the HTTP endpoint', async () => {
    await request(app.getHttpServer())
      .post('/hotel-processing/rollback/stage-1')
      .expect(200)
      .expect({
        ok: true,
        steps: [
          {
            deletedTargetDocuments: 12,
            resetSourceDocuments: 15,
            runId: REGISTRY_TO_CANDIDATES_RUN_ID,
            stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
          },
          {
            deletedTargetDocuments: 15,
            resetSourceDocuments: 15,
            runId: RAW_TO_REGISTRY_RUN_ID,
            stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
          },
        ],
        targetStage: HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_1,
      });

    expect(candidates).toHaveLength(0);
    expect(registryEntries).toHaveLength(0);
    expect(
      rawHotels.every(
        ({ processing }) =>
          processing.status === HOTEL_PROCESSING_STATUS.PENDING &&
          processing.runId === null &&
          processing.hotelRegistryEntryId === null,
      ),
    ).toBe(true);
  });

  it('rolls back stage 2 through the stage 1 endpoint when stage 3 was already rolled back', async () => {
    candidates.length = 0;
    registryEntries.forEach((registryEntry) => {
      registryEntry.processing = {
        canonicalHotelCandidateId: null,
        claimedAt: null,
        error: null,
        processedAt: null,
        runId: null,
        status: HOTEL_PROCESSING_STATUS.PENDING,
      };
    });

    await request(app.getHttpServer())
      .post('/hotel-processing/rollback/stage-1')
      .expect(200)
      .expect({
        ok: true,
        steps: [
          {
            deletedTargetDocuments: 15,
            resetSourceDocuments: 15,
            runId: RAW_TO_REGISTRY_RUN_ID,
            stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
          },
        ],
        targetStage: HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_1,
      });

    expect(candidates).toHaveLength(0);
    expect(registryEntries).toHaveLength(0);
    expect(
      rawHotels.every(
        ({ processing }) =>
          processing.status === HOTEL_PROCESSING_STATUS.PENDING &&
          processing.runId === null &&
          processing.hotelRegistryEntryId === null,
      ),
    ).toBe(true);
  });
});
