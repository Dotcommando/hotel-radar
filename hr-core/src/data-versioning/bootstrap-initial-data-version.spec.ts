import { createRequire } from 'node:module';
import path from 'path';

interface IBootstrapInitialDataVersionModule {
  bootstrapInitialDataVersion: (
    db: IFakeDb,
    options: IBootstrapInitialDataVersionOptions,
  ) => Promise<IBootstrapInitialDataVersionReport>;
}

interface IBootstrapInitialDataVersionOptions {
  now: Date;
  releaseKey: string;
}

interface IBootstrapInitialDataVersionReport {
  dataRelease: {
    key: string;
    version: number;
  };
  datasets: {
    beachProfiles: IDataSetBootstrapReport;
    canonicalHotels: IDataSetBootstrapReport;
    hotelBeachAccessEdges: IDataSetBootstrapReport;
  };
  ok: true;
}

interface IDataSetBootstrapReport {
  matched: number;
  modified: number;
  totalVersionDocuments: number;
}

interface IFakeDb {
  collection: (name: string) => IFakeCollection;
}

interface IFakeCollection {
  countDocuments: (filter?: IFilter) => Promise<number>;
  documents: IAnyDocument[];
  replaceOne: (
    filter: IFilter,
    replacement: IAnyDocument,
    options: IReplaceOneOptions,
  ) => Promise<IReplaceOneResult>;
  updateMany: (filter: IFilter, update: IUpdate) => Promise<IUpdateResult>;
}

interface IReplaceOneOptions {
  upsert: boolean;
}

interface IReplaceOneResult {
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
}

interface IUpdate {
  $set: Record<string, unknown>;
}

interface IUpdateResult {
  matchedCount: number;
  modifiedCount: number;
}

interface IFilter {
  [pathValue: string]: unknown;
}

interface IAnyDocument {
  _id?: string;
  [pathValue: string]: unknown;
}

let versioningModule: IBootstrapInitialDataVersionModule;
const requireScript = createRequire(__filename);

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function isBootstrapInitialDataVersionModule(
  value: unknown,
): value is IBootstrapInitialDataVersionModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).bootstrapInitialDataVersion ===
      'function'
  );
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
  constructor(public readonly documents: IAnyDocument[]) {}

  countDocuments(filter: IFilter = {}): Promise<number> {
    return Promise.resolve(
      this.documents.filter((document) => this.matchesFilter(document, filter))
        .length,
    );
  }

  replaceOne(
    filter: IFilter,
    replacement: IAnyDocument,
    options: IReplaceOneOptions,
  ): Promise<IReplaceOneResult> {
    const index = this.documents.findIndex((document) =>
      this.matchesFilter(document, filter),
    );

    if (index >= 0) {
      this.documents[index] = deepClone(replacement);

      return Promise.resolve({
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0,
      });
    }

    if (options.upsert) {
      this.documents.push(deepClone(replacement));

      return Promise.resolve({
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 1,
      });
    }

    return Promise.resolve({
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
    });
  }

  updateMany(filter: IFilter, update: IUpdate): Promise<IUpdateResult> {
    let matchedCount = 0;
    let modifiedCount = 0;

    for (const document of this.documents) {
      if (!this.matchesFilter(document, filter)) {
        continue;
      }

      matchedCount++;

      if (this.applyUpdate(document, update)) {
        modifiedCount++;
      }
    }

    return Promise.resolve({
      matchedCount,
      modifiedCount,
    });
  }

  private applyUpdate(document: IAnyDocument, update: IUpdate): boolean {
    let modified = false;

    for (const [pathValue, nextValue] of Object.entries(update.$set)) {
      const currentValue = getByPath(document, pathValue);

      if (JSON.stringify(currentValue) !== JSON.stringify(nextValue)) {
        setByPath(document, pathValue, deepClone(nextValue));
        modified = true;
      }
    }

    return modified;
  }

  private matchesFilter(document: IAnyDocument, filter: IFilter): boolean {
    return Object.entries(filter).every(([pathValue, value]) => {
      const currentValue = getByPath(document, pathValue);

      if (this.isExistsFilter(value)) {
        return value.$exists
          ? currentValue !== undefined
          : currentValue === undefined;
      }

      if (this.isNotEqualFilter(value)) {
        return JSON.stringify(currentValue) !== JSON.stringify(value.$ne);
      }

      return JSON.stringify(currentValue) === JSON.stringify(value);
    });
  }

  private isExistsFilter(value: unknown): value is {
    $exists: boolean;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Record<string, unknown>).$exists === 'boolean'
    );
  }

  private isNotEqualFilter(value: unknown): value is {
    $ne: unknown;
  } {
    return typeof value === 'object' && value !== null && '$ne' in value;
  }
}

class FakeDb implements IFakeDb {
  private readonly collections = new Map<string, FakeCollection>();

  constructor(seed: Record<string, IAnyDocument[]>) {
    for (const [name, documents] of Object.entries(seed)) {
      this.collections.set(name, new FakeCollection(documents));
    }
  }

  collection(name: string): IFakeCollection {
    const collection = this.collections.get(name);

    if (collection !== undefined) {
      return collection;
    }

    const createdCollection = new FakeCollection([]);
    this.collections.set(name, createdCollection);

    return createdCollection;
  }
}

describe('bootstrap initial data version script', () => {
  beforeAll(() => {
    const importedModule: unknown = requireScript(
      path.join(
        process.cwd(),
        'scripts/data-versioning/bootstrap-initial-data-version.js',
      ),
    );

    if (!isBootstrapInitialDataVersionModule(importedModule)) {
      throw new Error('Invalid bootstrap initial data version module.');
    }

    versioningModule = importedModule;
  });

  it('marks existing public data documents as version 1 and creates metadata', async () => {
    const now = new Date('2026-05-09T10:00:00.000Z');
    const db = new FakeDb({
      beach_profiles: [
        {
          _id: 'beach-1',
        },
      ],
      canonical_hotels: [
        {
          _id: 'hotel-1',
          geo: {
            point: null,
          },
          verification: {
            status: 'location_verified',
          },
        },
        {
          _id: 'hotel-2',
          datasetVersion: 3,
          geo: {
            point: {
              coordinates: [1, 2],
              type: 'Point',
            },
          },
          verification: {
            status: 'unreviewed',
          },
        },
      ],
      hotel_beach_access_edges: [
        {
          _id: 'edge-1',
        },
      ],
    });

    const report = await versioningModule.bootstrapInitialDataVersion(db, {
      now,
      releaseKey: 'initial-v1',
    });

    expect(report).toEqual({
      dataRelease: {
        key: 'initial-v1',
        version: 1,
      },
      datasets: {
        beachProfiles: {
          matched: 1,
          modified: 1,
          totalVersionDocuments: 1,
        },
        canonicalHotels: {
          matched: 1,
          modified: 1,
          totalVersionDocuments: 1,
        },
        hotelBeachAccessEdges: {
          matched: 1,
          modified: 1,
          totalVersionDocuments: 1,
        },
      },
      ok: true,
    });
    expect(db.collection('canonical_hotels').documents[0].datasetVersion).toBe(
      1,
    );
    expect(db.collection('canonical_hotels').documents[1].datasetVersion).toBe(
      3,
    );
    expect(db.collection('dataset_versions').documents).toHaveLength(3);
    expect(db.collection('data_releases').documents).toEqual([
      expect.objectContaining({
        components: {
          beachProfiles: {
            datasetVersion: 1,
          },
          canonicalHotels: {
            datasetVersion: 1,
          },
          hotelBeachAccessEdges: {
            datasetVersion: 1,
          },
        },
        key: 'initial-v1',
        version: 1,
      }),
    ]);
  });

  it('is idempotent after existing documents have dataset versions', async () => {
    const now = new Date('2026-05-09T10:00:00.000Z');
    const db = new FakeDb({
      beach_profiles: [
        {
          _id: 'beach-1',
        },
      ],
      canonical_hotels: [
        {
          _id: 'hotel-1',
        },
      ],
      hotel_beach_access_edges: [
        {
          _id: 'edge-1',
        },
      ],
    });

    await versioningModule.bootstrapInitialDataVersion(db, {
      now,
      releaseKey: 'initial-v1',
    });
    const secondReport = await versioningModule.bootstrapInitialDataVersion(
      db,
      {
        now,
        releaseKey: 'initial-v1',
      },
    );

    expect(secondReport.datasets.canonicalHotels.modified).toBe(0);
    expect(secondReport.datasets.beachProfiles.modified).toBe(0);
    expect(secondReport.datasets.hotelBeachAccessEdges.modified).toBe(0);
    expect(db.collection('dataset_versions').documents).toHaveLength(3);
    expect(db.collection('data_releases').documents).toHaveLength(1);
  });
});
