import path from 'path';

interface IFixReportCollection {
  found: number;
  modified: number;
  changedIds: string[];
}

interface IFixReport {
  hotelRegistryEntries: IFixReportCollection;
  canonicalHotelCandidates: IFixReportCollection;
}

interface IFixModule {
  applyHotelDataFix: (
    db: IFakeDb,
    options: {
      ObjectId: (value: string) => string;
    },
  ) => Promise<IFixReport>;
}

interface IFakeDb {
  collection: (name: string) => IFakeCollection;
}

interface IFakeCollection {
  findOne: (filter: IIdFilter) => Promise<IAnyDocument | null>;
  updateOne: (
    filter: IIdFilter,
    update: IUpdate,
  ) => Promise<IUpdateResult>;
}

interface IIdFilter {
  _id: string;
}

interface IUpdate {
  $set: Record<string, unknown>;
}

interface IUpdateResult {
  matchedCount: number;
  modifiedCount: number;
}

interface IAnyDocument {
  _id: string;
  [key: string]: unknown;
}

const fixModule: IFixModule = require(path.join(
  process.cwd(),
  'scripts/data-fixes/fix-official-contact-location-data.js',
));

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getByPath(document: IAnyDocument, pathValue: string): unknown {
  const parts = pathValue.split('.');
  let current: unknown = document;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function setByPath(document: IAnyDocument, pathValue: string, value: unknown) {
  const parts = pathValue.split('.');
  let current: Record<string, unknown> = document;

  for (const part of parts.slice(0, -1)) {
    const next = current[part];

    if (typeof next !== 'object' || next === null) {
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

class FakeCollection implements IFakeCollection {
  constructor(private readonly documents: IAnyDocument[]) {}

  async findOne(filter: IIdFilter): Promise<IAnyDocument | null> {
    return (
      this.documents.find((document) => document._id === filter._id) ?? null
    );
  }

  async updateOne(
    filter: IIdFilter,
    update: IUpdate,
  ): Promise<IUpdateResult> {
    const document = await this.findOne(filter);

    if (document === null) {
      return {
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    let modified = false;

    for (const [pathValue, nextValue] of Object.entries(update.$set)) {
      const currentValue = getByPath(document, pathValue);

      if (JSON.stringify(currentValue) !== JSON.stringify(nextValue)) {
        setByPath(document, pathValue, deepClone(nextValue));
        modified = true;
      }
    }

    return {
      matchedCount: 1,
      modifiedCount: modified ? 1 : 0,
    };
  }
}

class FakeDb implements IFakeDb {
  constructor(
    private readonly registryEntries: IAnyDocument[],
    private readonly candidates: IAnyDocument[],
  ) {}

  collection(name: string): IFakeCollection {
    if (name === 'hotel_registry_entries') {
      return new FakeCollection(this.registryEntries);
    }

    if (name === 'canonical_hotel_candidates') {
      return new FakeCollection(this.candidates);
    }

    throw new Error(`Unexpected fake collection: ${name}`);
  }
}

function buildRegistryEntries(): IAnyDocument[] {
  return [
    {
      _id: '69f8712a468ad01eb59c470f',
      contacts: {
        phones: ['+35722422626'],
      },
      createdAt: '2026-05-03T17:15:04.153Z',
      name: {
        original: "STOU KYR' GIANNI",
      },
      processing: {
        runId: 'run-1',
        status: 'processed',
      },
      registryKey: 'registry-key-stou-kyr-gianni',
      updatedAt: '2026-05-03T17:15:04.153Z',
    },
    {
      _id: '69f8712a468ad01eb59c4712',
      contacts: {
        phones: ['+35725432522'],
      },
      createdAt: '2026-05-03T17:15:04.153Z',
      name: {
        original: 'PINE VIEW BOUTIQUE',
      },
      processing: {
        runId: 'run-1',
        status: 'processed',
      },
      registryKey: 'registry-key-pine-view-boutique',
      updatedAt: '2026-05-03T17:15:04.153Z',
    },
    {
      _id: '69f87126468ad01eb59c44f5',
      createdAt: '2026-05-03T17:15:04.153Z',
      location: {
        locality: 'Paralimni',
        postcode: '5297',
      },
      name: {
        original: 'LEONARDO CRYSTAL COVE',
      },
      processing: {
        runId: 'run-1',
        status: 'processed',
      },
      registryKey: 'registry-key-leonardo-crystal-cove',
      updatedAt: '2026-05-03T17:15:04.153Z',
    },
    {
      _id: '69f8712a468ad01eb59c4999',
      contacts: {
        phones: ['+35711111111'],
      },
      createdAt: '2026-05-03T17:15:04.153Z',
      name: {
        original: 'UNRELATED REGISTRY ENTRY',
      },
      processing: {
        runId: 'run-1',
        status: 'processed',
      },
      registryKey: 'registry-key-unrelated',
      updatedAt: '2026-05-03T17:15:04.153Z',
    },
  ];
}

function buildCandidates(): IAnyDocument[] {
  return [
    {
      _id: '69f8713f468ad01eb59c49cd',
      candidateKey: 'candidate-key-stou-kyr-gianni',
      canonicalName: "STOU KYR' GIANNI",
      components: [
        {
          componentKey: 'component-key-stou-kyr-gianni',
          contacts: {
            phones: ['+35722422626'],
          },
          name: "STOU KYR' GIANNI",
        },
      ],
      contacts: {
        phones: ['+35722422626'],
      },
      createdAt: '2026-05-03T17:15:15.278Z',
      processing: {
        runId: null,
        status: 'pending',
      },
      updatedAt: '2026-05-03T17:15:15.278Z',
    },
    {
      _id: '69f8713f468ad01eb59c49d0',
      candidateKey: 'candidate-key-pine-view-boutique',
      canonicalName: 'PINE VIEW BOUTIQUE',
      components: [
        {
          componentKey: 'component-key-pine-view-boutique',
          contacts: {
            phones: ['+35725432522'],
          },
          name: 'PINE VIEW BOUTIQUE',
        },
      ],
      contacts: {
        phones: ['+35725432522'],
      },
      createdAt: '2026-05-03T17:15:15.278Z',
      processing: {
        runId: null,
        status: 'pending',
      },
      updatedAt: '2026-05-03T17:15:15.278Z',
    },
    {
      _id: '69f87139468ad01eb59c47d4',
      candidateKey: 'candidate-key-leonardo-crystal-cove',
      canonicalName: 'LEONARDO CRYSTAL COVE',
      components: [
        {
          componentKey: 'component-key-leonardo-crystal-cove',
          location: {
            locality: 'Paralimni',
            postcode: '5297',
          },
          name: 'LEONARDO CRYSTAL COVE',
        },
      ],
      createdAt: '2026-05-03T17:15:15.278Z',
      location: {
        locality: 'Paralimni',
        postcode: '5297',
      },
      processing: {
        runId: null,
        status: 'pending',
      },
      updatedAt: '2026-05-03T17:15:15.278Z',
    },
    {
      _id: '69f8713f468ad01eb59c4999',
      candidateKey: 'candidate-key-unrelated',
      canonicalName: 'UNRELATED CANDIDATE',
      components: [
        {
          componentKey: 'component-key-unrelated',
          contacts: {
            phones: ['+35711111111'],
          },
          name: 'UNRELATED CANDIDATE',
        },
      ],
      contacts: {
        phones: ['+35711111111'],
      },
      createdAt: '2026-05-03T17:15:15.278Z',
      processing: {
        runId: null,
        status: 'pending',
      },
      updatedAt: '2026-05-03T17:15:15.278Z',
    },
  ];
}

describe('fix official contact and location data script', () => {
  it('updates only targeted data fields and is idempotent', async () => {
    const registryEntries = buildRegistryEntries();
    const candidates = buildCandidates();
    const unrelatedRegistryEntryBefore = deepClone(registryEntries[3]);
    const unrelatedCandidateBefore = deepClone(candidates[3]);
    const db = new FakeDb(registryEntries, candidates);

    const firstReport = await fixModule.applyHotelDataFix(db, {
      ObjectId: (value) => value,
    });

    expect(firstReport).toEqual({
      canonicalHotelCandidates: {
        changedIds: [
          '69f8713f468ad01eb59c49cd',
          '69f8713f468ad01eb59c49d0',
          '69f87139468ad01eb59c47d4',
        ],
        found: 3,
        modified: 3,
      },
      hotelRegistryEntries: {
        changedIds: [
          '69f8712a468ad01eb59c470f',
          '69f8712a468ad01eb59c4712',
          '69f87126468ad01eb59c44f5',
        ],
        found: 3,
        modified: 3,
      },
    });
    expect(registryEntries[0].contacts).toEqual({
      phones: ['+35725422100'],
    });
    expect(registryEntries[1].contacts).toEqual({
      phones: ['+35725583134'],
    });
    expect(registryEntries[2].location).toEqual({
      locality: 'Protaras, Paralimni',
      postcode: '5297',
    });
    expect(candidates[0].contacts).toEqual({
      phones: ['+35725422100'],
    });
    expect(candidates[0].components).toEqual([
      {
        componentKey: 'component-key-stou-kyr-gianni',
        contacts: {
          phones: ['+35725422100'],
        },
        name: "STOU KYR' GIANNI",
      },
    ]);
    expect(candidates[1].contacts).toEqual({
      phones: ['+35725583134'],
    });
    expect(candidates[1].components).toEqual([
      {
        componentKey: 'component-key-pine-view-boutique',
        contacts: {
          phones: ['+35725583134'],
        },
        name: 'PINE VIEW BOUTIQUE',
      },
    ]);
    expect(candidates[2].location).toEqual({
      locality: 'Protaras, Paralimni',
      postcode: '5297',
    });
    expect(candidates[2].components).toEqual([
      {
        componentKey: 'component-key-leonardo-crystal-cove',
        location: {
          locality: 'Protaras, Paralimni',
          postcode: '5297',
        },
        name: 'LEONARDO CRYSTAL COVE',
      },
    ]);
    expect(registryEntries[3]).toEqual(unrelatedRegistryEntryBefore);
    expect(candidates[3]).toEqual(unrelatedCandidateBefore);

    const secondReport = await fixModule.applyHotelDataFix(db, {
      ObjectId: (value) => value,
    });

    expect(secondReport).toEqual({
      canonicalHotelCandidates: {
        changedIds: [],
        found: 3,
        modified: 0,
      },
      hotelRegistryEntries: {
        changedIds: [],
        found: 3,
        modified: 0,
      },
    });
    expect(registryEntries[0].contacts).toEqual({
      phones: ['+35725422100'],
    });
    expect(candidates[0].components).toEqual([
      {
        componentKey: 'component-key-stou-kyr-gianni',
        contacts: {
          phones: ['+35725422100'],
        },
        name: "STOU KYR' GIANNI",
      },
    ]);
    expect(registryEntries[3]).toEqual(unrelatedRegistryEntryBefore);
    expect(candidates[3]).toEqual(unrelatedCandidateBefore);
  });
});
