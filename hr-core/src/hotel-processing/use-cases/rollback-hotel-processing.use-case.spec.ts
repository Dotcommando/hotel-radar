import { Types } from 'mongoose';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { HOTEL_PROCESSING_STATUS } from '../constants/hotel-processing-status.enum';
import { HotelProcessingActiveRunExistsError } from '../errors/hotel-processing-active-run-exists.error';
import { HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE } from '../constants/hotel-processing-rollback-target-stage.enum';
import { HotelProcessingNoRollbackRunFoundError } from '../errors/hotel-processing-no-rollback-run-found.error';
import { RollbackHotelProcessingUseCase } from './rollback-hotel-processing.use-case';

const RAW_TO_REGISTRY_RUN_ID = '2026-05-03T17-15-04-raw-to-registry';
const REGISTRY_TO_CANDIDATES_RUN_ID =
  '2026-05-03T17-15-15-registry-to-candidates';
const PREVIOUS_RAW_TO_REGISTRY_RUN_ID = '2026-05-02T17-15-04-raw-to-registry';
const PREVIOUS_REGISTRY_TO_CANDIDATES_RUN_ID =
  '2026-05-02T17-15-15-registry-to-candidates';

interface IFixtureCandidate {
  _id: Types.ObjectId;
  canonicalName: string;
  componentCount: number;
}

interface IFixtureRegistryEntry {
  _id: Types.ObjectId;
  originalName: string;
  processing: {
    canonicalHotelCandidateId: Types.ObjectId | null;
    claimedAt: Date | null;
    error: string | null;
    processedAt: Date | null;
    runId: string | null;
    status: HOTEL_PROCESSING_STATUS;
  };
}

interface IFixtureRawHotel {
  _id: Types.ObjectId;
  name: string;
  processing: {
    claimedAt: Date | null;
    error: string | null;
    hotelRegistryEntryId: Types.ObjectId | null;
    processedAt: Date | null;
    runId: string | null;
    status: HOTEL_PROCESSING_STATUS;
  };
}

interface IRawHotelsServiceFake {
  countByProcessingRunId(runId: string): Promise<number>;
  findProcessingRunIds(): Promise<(string | null)[]>;
  readRollbackBatchByProcessingRunId(
    runId: string,
    limit: number,
  ): Promise<IFixtureRawHotel[]>;
  resetProcessingByIds(ids: Types.ObjectId[]): Promise<number>;
}

interface IHotelRegistryEntriesServiceFake {
  countByProcessingRunId(runId: string): Promise<number>;
  deleteManyByIds(ids: Types.ObjectId[]): Promise<number>;
  findProcessingRunIds(): Promise<(string | null)[]>;
  readRollbackBatchByProcessingRunId(
    runId: string,
    limit: number,
  ): Promise<IFixtureRegistryEntry[]>;
  resetProcessingByIds(ids: Types.ObjectId[]): Promise<number>;
}

interface ICanonicalHotelCandidatesServiceFake {
  deleteManyByIds(ids: Types.ObjectId[]): Promise<number>;
}

interface IHotelProcessingRunsServiceFake {
  hasActiveRun(stage: HOTEL_PROCESSING_STAGE): Promise<boolean>;
}

function id(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function buildRealisticCandidates(): IFixtureCandidate[] {
  const rows: Array<[string, string, number]> = [
    ['69f782a3468ad01eb59c41ac', 'NISSIANA', 2],
    ['69f782a4468ad01eb59c41f5', 'TSOKKOS HOLIDAY', 2],
    ['69f782a4468ad01eb59c4206', 'MARIA', 2],
    ['69f782a3468ad01eb59c4179', 'AMYTH OF NICOSIA BOUTIQUE', 1],
    ['69f782a3468ad01eb59c417a', 'HILTON NICOSIA', 1],
    ['69f782a3468ad01eb59c417b', 'THE LANDMARK NICOSIA', 1],
    ['69f782a3468ad01eb59c417c', 'CLASSIC', 1],
    ['69f782a3468ad01eb59c417d', 'CLEOPATRA', 1],
    ['69f782a3468ad01eb59c417e', 'CASTELLI', 1],
    ['69f782a3468ad01eb59c417f', 'CENTRUM', 1],
    ['69f782a3468ad01eb59c4180', 'MAP BOUTIQUE', 1],
    ['69f782a3468ad01eb59c4181', 'SEMELI', 1],
  ];

  return rows.map(([candidateId, canonicalName, componentCount]) => ({
    _id: id(candidateId),
    canonicalName,
    componentCount,
  }));
}

function buildRealisticRegistryEntries(): IFixtureRegistryEntry[] {
  const rows: Array<[string, string, string]> = [
    [
      '69f78298468ad01eb59c3e96',
      'AMYTH OF NICOSIA BOUTIQUE',
      '69f782a3468ad01eb59c4179',
    ],
    ['69f78298468ad01eb59c3e97', 'HILTON NICOSIA', '69f782a3468ad01eb59c417a'],
    [
      '69f78298468ad01eb59c3e98',
      'THE LANDMARK NICOSIA',
      '69f782a3468ad01eb59c417b',
    ],
    ['69f78298468ad01eb59c3e99', 'CLASSIC', '69f782a3468ad01eb59c417c'],
    ['69f78298468ad01eb59c3e9a', 'CLEOPATRA', '69f782a3468ad01eb59c417d'],
    ['69f78298468ad01eb59c3e9b', 'CASTELLI', '69f782a3468ad01eb59c417e'],
    ['69f78298468ad01eb59c3e9c', 'CENTRUM', '69f782a3468ad01eb59c417f'],
    ['69f78298468ad01eb59c3e9d', 'MAP BOUTIQUE', '69f782a3468ad01eb59c4180'],
    ['69f78298468ad01eb59c3e9e', 'SEMELI', '69f782a3468ad01eb59c4181'],
    ['69f78298468ad01eb59c3ec9', 'NISSIANA', '69f782a3468ad01eb59c41ac'],
    ['69f78298468ad01eb59c3ef6', 'NISSIANA', '69f782a3468ad01eb59c41ac'],
    [
      '69f78299468ad01eb59c3f13',
      'TSOKKOS HOLIDAY NO. 1',
      '69f782a4468ad01eb59c41f5',
    ],
    [
      '69f78299468ad01eb59c3f18',
      'TSOKKOS HOLIDAY NO. 2',
      '69f782a4468ad01eb59c41f5',
    ],
    ['69f78299468ad01eb59c3f25', 'MARIA', '69f782a4468ad01eb59c4206'],
    ['69f78299468ad01eb59c3f26', 'MARIA 2', '69f782a4468ad01eb59c4206'],
  ];

  return rows.map(([registryEntryId, originalName, candidateId]) => ({
    _id: id(registryEntryId),
    originalName,
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

function buildRealisticRawHotels(): IFixtureRawHotel[] {
  const rows: Array<[string, string, string]> = [
    [
      '69f77aaa468ad01eb59c3bb0',
      'AMYTH OF NICOSIA BOUTIQUE',
      '69f78298468ad01eb59c3e96',
    ],
    ['69f77aaa468ad01eb59c3bb1', 'HILTON NICOSIA', '69f78298468ad01eb59c3e97'],
    [
      '69f77aaa468ad01eb59c3bb2',
      'THE LANDMARK NICOSIA',
      '69f78298468ad01eb59c3e98',
    ],
    ['69f77aaa468ad01eb59c3bb3', 'CLASSIC', '69f78298468ad01eb59c3e99'],
    ['69f77aaa468ad01eb59c3bb4', 'CLEOPATRA', '69f78298468ad01eb59c3e9a'],
    ['69f77aaa468ad01eb59c3bb5', 'CASTELLI', '69f78298468ad01eb59c3e9b'],
    ['69f77aaa468ad01eb59c3bb6', 'CENTRUM', '69f78298468ad01eb59c3e9c'],
    ['69f77aaa468ad01eb59c3bb7', 'MAP BOUTIQUE', '69f78298468ad01eb59c3e9d'],
    ['69f77aaa468ad01eb59c3bb8', 'SEMELI', '69f78298468ad01eb59c3e9e'],
    ['69f77b27468ad01eb59c3be3', 'NISSIANA', '69f78298468ad01eb59c3ec9'],
    ['69f77b8f468ad01eb59c3c10', 'NISSIANA', '69f78298468ad01eb59c3ef6'],
    [
      '69f77bfa468ad01eb59c3c2d',
      'TSOKKOS HOLIDAY NO. 1',
      '69f78299468ad01eb59c3f13',
    ],
    [
      '69f77bfa468ad01eb59c3c32',
      'TSOKKOS HOLIDAY NO. 2',
      '69f78299468ad01eb59c3f18',
    ],
    ['69f77c28468ad01eb59c3c3f', 'MARIA', '69f78299468ad01eb59c3f25'],
    ['69f77c28468ad01eb59c3c40', 'MARIA 2', '69f78299468ad01eb59c3f26'],
  ];

  return rows.map(([rawHotelId, name, registryEntryId]) => ({
    _id: id(rawHotelId),
    name,
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

function buildPreviousRegistryEntry(): IFixtureRegistryEntry {
  return {
    _id: id('69f78298468ad01eb59c3999'),
    originalName: 'OLDER REGISTRY ENTRY',
    processing: {
      canonicalHotelCandidateId: id('69f782a3468ad01eb59c4999'),
      claimedAt: null,
      error: null,
      processedAt: new Date('2026-05-02T17:15:15.290Z'),
      runId: PREVIOUS_REGISTRY_TO_CANDIDATES_RUN_ID,
      status: HOTEL_PROCESSING_STATUS.PROCESSED,
    },
  };
}

function buildPreviousRawHotel(): IFixtureRawHotel {
  return {
    _id: id('69f77aaa468ad01eb59c3999'),
    name: 'OLDER RAW HOTEL',
    processing: {
      claimedAt: null,
      error: null,
      hotelRegistryEntryId: id('69f78298468ad01eb59c3999'),
      processedAt: new Date('2026-05-02T17:15:04.162Z'),
      runId: PREVIOUS_RAW_TO_REGISTRY_RUN_ID,
      status: HOTEL_PROCESSING_STATUS.PROCESSED,
    },
  };
}

class RawHotelsServiceFake implements IRawHotelsServiceFake {
  constructor(private readonly rawHotels: IFixtureRawHotel[]) {}

  async findProcessingRunIds(): Promise<(string | null)[]> {
    return this.rawHotels.map(({ processing }) => processing.runId);
  }

  async countByProcessingRunId(runId: string): Promise<number> {
    return this.rawHotels.filter(({ processing }) => processing.runId === runId)
      .length;
  }

  async readRollbackBatchByProcessingRunId(
    runId: string,
    limit: number,
  ): Promise<IFixtureRawHotel[]> {
    return this.rawHotels
      .filter(({ processing }) => processing.runId === runId)
      .slice(0, limit);
  }

  async resetProcessingByIds(ids: Types.ObjectId[]): Promise<number> {
    const idSet = new Set(ids.map((rawHotelId) => rawHotelId.toString()));
    let modified = 0;

    for (const rawHotel of this.rawHotels) {
      if (!idSet.has(rawHotel._id.toString())) {
        continue;
      }

      rawHotel.processing = {
        claimedAt: null,
        error: null,
        hotelRegistryEntryId: null,
        processedAt: null,
        runId: null,
        status: HOTEL_PROCESSING_STATUS.PENDING,
      };
      modified += 1;
    }

    return modified;
  }
}

class HotelRegistryEntriesServiceFake implements IHotelRegistryEntriesServiceFake {
  constructor(private readonly registryEntries: IFixtureRegistryEntry[]) {}

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
  ): Promise<IFixtureRegistryEntry[]> {
    return this.registryEntries
      .filter(({ processing }) => processing.runId === runId)
      .slice(0, limit);
  }

  async resetProcessingByIds(ids: Types.ObjectId[]): Promise<number> {
    const idSet = new Set(
      ids.map((registryEntryId) => registryEntryId.toString()),
    );
    let modified = 0;

    for (const registryEntry of this.registryEntries) {
      if (!idSet.has(registryEntry._id.toString())) {
        continue;
      }

      registryEntry.processing = {
        canonicalHotelCandidateId: null,
        claimedAt: null,
        error: null,
        processedAt: null,
        runId: null,
        status: HOTEL_PROCESSING_STATUS.PENDING,
      };
      modified += 1;
    }

    return modified;
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

class CanonicalHotelCandidatesServiceFake implements ICanonicalHotelCandidatesServiceFake {
  constructor(private readonly candidates: IFixtureCandidate[]) {}

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

class HotelProcessingRunsServiceFake implements IHotelProcessingRunsServiceFake {
  constructor(private readonly activeStages: Set<HOTEL_PROCESSING_STAGE>) {}

  async hasActiveRun(stage: HOTEL_PROCESSING_STAGE): Promise<boolean> {
    return this.activeStages.has(stage);
  }
}

describe('RollbackHotelProcessingUseCase', () => {
  let candidates: IFixtureCandidate[];
  let registryEntries: IFixtureRegistryEntry[];
  let rawHotels: IFixtureRawHotel[];
  let useCase: RollbackHotelProcessingUseCase;

  beforeEach(() => {
    candidates = [
      ...buildRealisticCandidates(),
      {
        _id: id('69f782a3468ad01eb59c4999'),
        canonicalName: 'OLDER CANDIDATE',
        componentCount: 1,
      },
    ];
    registryEntries = [
      ...buildRealisticRegistryEntries(),
      buildPreviousRegistryEntry(),
    ];
    rawHotels = [...buildRealisticRawHotels(), buildPreviousRawHotel()];
    useCase = new RollbackHotelProcessingUseCase(
      new RawHotelsServiceFake(rawHotels),
      new HotelRegistryEntriesServiceFake(registryEntries),
      new CanonicalHotelCandidatesServiceFake(candidates),
      new HotelProcessingRunsServiceFake(new Set()),
    );
  });

  it('rolls back latest stage 3 to stage 2 using realistic linked entities', async () => {
    const result = await useCase.execute(
      HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_2,
    );

    expect(result).toEqual({
      ok: true,
      steps: [
        {
          deletedTargetDocuments: 12,
          resetSourceDocuments: 15,
          runId: REGISTRY_TO_CANDIDATES_RUN_ID,
          stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
        },
      ],
      targetStage: HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_2,
    });
    expect(candidates.map(({ canonicalName }) => canonicalName)).toEqual([
      'OLDER CANDIDATE',
    ]);
    expect(
      registryEntries.filter(
        ({ processing }) => processing.runId === REGISTRY_TO_CANDIDATES_RUN_ID,
      ).length,
    ).toBe(0);
    expect(
      registryEntries.find(
        ({ originalName }) => originalName === 'AMYTH OF NICOSIA BOUTIQUE',
      )?.processing,
    ).toEqual({
      canonicalHotelCandidateId: null,
      claimedAt: null,
      error: null,
      processedAt: null,
      runId: null,
      status: HOTEL_PROCESSING_STATUS.PENDING,
    });
    expect(
      registryEntries.find(
        ({ originalName }) => originalName === 'OLDER REGISTRY ENTRY',
      )?.processing.runId,
    ).toBe(PREVIOUS_REGISTRY_TO_CANDIDATES_RUN_ID);
  });

  it('rolls back latest stage 3 and then latest stage 2 when target is stage 1', async () => {
    const result = await useCase.execute(
      HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_1,
    );

    expect(result.steps).toEqual([
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
    ]);
    expect(candidates.map(({ canonicalName }) => canonicalName)).toEqual([
      'OLDER CANDIDATE',
    ]);
    expect(registryEntries.map(({ originalName }) => originalName)).toEqual([
      'OLDER REGISTRY ENTRY',
    ]);
    expect(
      rawHotels.find(({ name }) => name === 'AMYTH OF NICOSIA BOUTIQUE')
        ?.processing,
    ).toEqual({
      claimedAt: null,
      error: null,
      hotelRegistryEntryId: null,
      processedAt: null,
      runId: null,
      status: HOTEL_PROCESSING_STATUS.PENDING,
    });
    expect(
      rawHotels.find(({ name }) => name === 'OLDER RAW HOTEL')?.processing
        .runId,
    ).toBe(PREVIOUS_RAW_TO_REGISTRY_RUN_ID);
  });

  it('rolls back stage 2 when target is stage 1 and stage 3 was already rolled back', async () => {
    candidates.length = 0;
    registryEntries.forEach((registryEntry) => {
      if (
        registryEntry.processing.runId !== REGISTRY_TO_CANDIDATES_RUN_ID
      ) {
        return;
      }

      registryEntry.processing = {
        canonicalHotelCandidateId: null,
        claimedAt: null,
        error: null,
        processedAt: null,
        runId: null,
        status: HOTEL_PROCESSING_STATUS.PENDING,
      };
    });

    const result = await useCase.execute(
      HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_1,
    );

    expect(result.steps).toEqual([
      {
        deletedTargetDocuments: 15,
        resetSourceDocuments: 15,
        runId: RAW_TO_REGISTRY_RUN_ID,
        stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      },
    ]);
    expect(registryEntries.map(({ originalName }) => originalName)).toEqual([
      'OLDER REGISTRY ENTRY',
    ]);
    expect(
      rawHotels.filter(
        ({ processing }) => processing.runId === RAW_TO_REGISTRY_RUN_ID,
      ),
    ).toHaveLength(0);
  });

  it('blocks rollback when any processing run is active', async () => {
    useCase = new RollbackHotelProcessingUseCase(
      new RawHotelsServiceFake(rawHotels),
      new HotelRegistryEntriesServiceFake(registryEntries),
      new CanonicalHotelCandidatesServiceFake(candidates),
      new HotelProcessingRunsServiceFake(
        new Set([HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES]),
      ),
    );

    await expect(
      useCase.execute(HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_2),
    ).rejects.toBeInstanceOf(HotelProcessingActiveRunExistsError);
  });

  it('fails when no latest rollback run id can be found', async () => {
    registryEntries.forEach((registryEntry) => {
      registryEntry.processing.runId = null;
    });

    await expect(
      useCase.execute(HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_2),
    ).rejects.toEqual(
      new HotelProcessingNoRollbackRunFoundError(
        HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
      ),
    );
  });
});
