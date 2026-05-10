import { createRequire } from 'node:module';
import path from 'path';

interface IPublishDataReleaseModule {
  publishDataRelease: (
    sourceDb: IFakeDb,
    targetDb: IFakeDb,
    options: IPublishDataReleaseOptions,
  ) => Promise<IPublishDataReleaseReport>;
}

interface IPublishDataReleaseOptions {
  releaseKey?: string;
  releaseVersion?: number;
}

interface IPublishDataReleaseReport {
  copied: {
    beachProfiles: number;
    canonicalHotels: number;
    dataReleases: number;
    datasetVersions: number;
    hotelBeachAccessEdges: number;
  };
  droppedCollections: string[];
  ok: true;
  release: {
    key: string;
    version: number;
  };
}

interface IFakeDb {
  collection: (name: string) => IFakeCollection;
  createCollection: (name: string) => Promise<IFakeCollection>;
  listCollections: (filter: IFilter) => IFakeListCollectionsCursor;
}

interface IFakeCollection {
  createIndex: (keys: IIndexKeys, options?: IIndexOptions) => Promise<string>;
  documents: IAnyDocument[];
  drop: () => Promise<boolean>;
  find: (filter?: IFilter) => IFakeFindCursor;
  findOne: (filter: IFilter) => Promise<IAnyDocument | null>;
  insertMany: (documents: IAnyDocument[]) => Promise<IInsertManyResult>;
  indexSpecs: IIndexSpec[];
}

interface IFakeFindCursor {
  limit: (value: number) => IFakeFindCursor;
  sort: (value: IIndexKeys) => IFakeFindCursor;
  toArray: () => Promise<IAnyDocument[]>;
}

interface IFakeListCollectionsCursor {
  toArray: () => Promise<ICollectionInfo[]>;
}

interface ICollectionInfo {
  name: string;
}

interface IInsertManyResult {
  insertedCount: number;
}

interface IIndexOptions {
  unique?: boolean;
}

interface IIndexSpec {
  keys: IIndexKeys;
  options?: IIndexOptions;
}

interface IIndexKeys {
  [pathValue: string]: 1 | -1;
}

interface IFilter {
  [pathValue: string]: unknown;
}

interface IAnyDocument {
  _id?: string;
  [pathValue: string]: unknown;
}

let publicationModule: IPublishDataReleaseModule;
const requireScript = createRequire(__filename);

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function isPublishDataReleaseModule(
  value: unknown,
): value is IPublishDataReleaseModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).publishDataRelease === 'function'
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

class FakeFindCursor implements IFakeFindCursor {
  private limitValue: number | null = null;
  private sortValue: IIndexKeys | null = null;

  constructor(private readonly sourceDocuments: IAnyDocument[]) {}

  limit(value: number): IFakeFindCursor {
    this.limitValue = value;

    return this;
  }

  sort(value: IIndexKeys): IFakeFindCursor {
    this.sortValue = value;

    return this;
  }

  toArray(): Promise<IAnyDocument[]> {
    let result = [...this.sourceDocuments];

    if (this.sortValue !== null) {
      const sortEntries = Object.entries(this.sortValue);

      result = result.sort((left, right) => {
        for (const [pathValue, direction] of sortEntries) {
          const leftValue = getByPath(left, pathValue);
          const rightValue = getByPath(right, pathValue);

          if (leftValue === rightValue) {
            continue;
          }

          return (leftValue ?? '') > (rightValue ?? '')
            ? direction
            : -direction;
        }

        return 0;
      });
    }

    if (this.limitValue !== null) {
      result = result.slice(0, this.limitValue);
    }

    return Promise.resolve(deepClone(result));
  }
}

class FakeCollection implements IFakeCollection {
  public readonly indexSpecs: IIndexSpec[] = [];

  constructor(public readonly documents: IAnyDocument[]) {}

  createIndex(keys: IIndexKeys, options?: IIndexOptions): Promise<string> {
    this.indexSpecs.push({
      keys,
      options,
    });

    return Promise.resolve(Object.keys(keys).join('_'));
  }

  drop(): Promise<boolean> {
    this.documents.length = 0;

    return Promise.resolve(true);
  }

  find(filter: IFilter = {}): IFakeFindCursor {
    return new FakeFindCursor(
      this.documents.filter((document) => this.matchesFilter(document, filter)),
    );
  }

  findOne(filter: IFilter): Promise<IAnyDocument | null> {
    const document = this.documents.find((item) =>
      this.matchesFilter(item, filter),
    );

    return Promise.resolve(document === undefined ? null : deepClone(document));
  }

  insertMany(documents: IAnyDocument[]): Promise<IInsertManyResult> {
    this.documents.push(...deepClone(documents));

    return Promise.resolve({
      insertedCount: documents.length,
    });
  }

  private matchesFilter(document: IAnyDocument, filter: IFilter): boolean {
    return Object.entries(filter).every(([pathValue, value]) => {
      return (
        JSON.stringify(getByPath(document, pathValue)) === JSON.stringify(value)
      );
    });
  }
}

class FakeDb implements IFakeDb {
  private readonly collections = new Map<string, FakeCollection>();

  public readonly droppedCollections: string[] = [];

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

  createCollection(name: string): Promise<IFakeCollection> {
    const collection = new FakeCollection([]);
    this.collections.set(name, collection);

    return Promise.resolve(collection);
  }

  listCollections(filter: IFilter): IFakeListCollectionsCursor {
    const name = typeof filter.name === 'string' ? filter.name : null;
    const hasCollection = name !== null && this.collections.has(name);

    return {
      toArray: (): Promise<ICollectionInfo[]> =>
        Promise.resolve(
          hasCollection && name !== null
            ? [
                {
                  name,
                },
              ]
            : [],
        ),
    };
  }

  async dropCollection(name: string): Promise<boolean> {
    const collection = this.collections.get(name);

    if (collection === undefined) {
      return false;
    }

    this.droppedCollections.push(name);
    await collection.drop();
    this.collections.delete(name);

    return true;
  }
}

describe('publish data release script', () => {
  beforeAll(() => {
    const importedModule: unknown = requireScript(
      path.join(
        process.cwd(),
        'scripts/data-versioning/publish-data-release.js',
      ),
    );

    if (!isPublishDataReleaseModule(importedModule)) {
      throw new Error('Invalid publish data release module.');
    }

    publicationModule = importedModule;
  });

  it('recreates target collections with only the selected release data', async () => {
    const sourceDb = new FakeDb({
      beach_profiles: [
        {
          _id: 'beach-v1',
          datasetVersion: 1,
        },
        {
          _id: 'beach-v2',
          datasetVersion: 2,
        },
      ],
      canonical_hotels: [
        {
          _id: 'hotel-v1',
          datasetVersion: 1,
        },
        {
          _id: 'hotel-v2',
          datasetVersion: 2,
        },
      ],
      data_releases: [
        {
          _id: 'release-1',
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
          status: 'published',
          version: 1,
        },
      ],
      dataset_versions: [
        {
          _id: 'hotels-version-1',
          dataset: 'canonical_hotels',
          version: 1,
        },
        {
          _id: 'beaches-version-1',
          dataset: 'beach_profiles',
          version: 1,
        },
        {
          _id: 'edges-version-1',
          dataset: 'hotel_beach_access_edges',
          version: 1,
        },
      ],
      hotel_beach_access_edges: [
        {
          _id: 'edge-v1',
          canonicalHotelId: 'hotel-v1',
          beachProfileId: 'beach-v1',
          datasetVersion: 1,
        },
        {
          _id: 'edge-v2',
          canonicalHotelId: 'hotel-v2',
          beachProfileId: 'beach-v2',
          datasetVersion: 2,
        },
      ],
    });
    const targetDb = new FakeDb({
      beach_profiles: [
        {
          _id: 'old-beach',
        },
      ],
      canonical_hotels: [
        {
          _id: 'old-hotel',
        },
      ],
      data_releases: [
        {
          _id: 'old-release',
        },
      ],
      dataset_versions: [
        {
          _id: 'old-dataset-version',
        },
      ],
      hotel_beach_access_edges: [
        {
          _id: 'old-edge',
        },
      ],
    });

    const report = await publicationModule.publishDataRelease(
      sourceDb,
      targetDb,
      {
        releaseKey: 'initial-v1',
      },
    );

    expect(report).toEqual({
      copied: {
        beachProfiles: 1,
        canonicalHotels: 1,
        dataReleases: 1,
        datasetVersions: 3,
        hotelBeachAccessEdges: 1,
      },
      droppedCollections: [
        'canonical_hotels',
        'beach_profiles',
        'hotel_beach_access_edges',
        'dataset_versions',
        'data_releases',
      ],
      ok: true,
      release: {
        key: 'initial-v1',
        version: 1,
      },
    });
    expect(targetDb.collection('canonical_hotels').documents).toEqual([
      {
        _id: 'hotel-v1',
        datasetVersion: 1,
      },
    ]);
    expect(targetDb.collection('beach_profiles').documents).toEqual([
      {
        _id: 'beach-v1',
        datasetVersion: 1,
      },
    ]);
    expect(targetDb.collection('hotel_beach_access_edges').documents).toEqual([
      {
        _id: 'edge-v1',
        canonicalHotelId: 'hotel-v1',
        beachProfileId: 'beach-v1',
        datasetVersion: 1,
      },
    ]);
    expect(targetDb.collection('hotel_beach_access_edges').indexSpecs).toEqual(
      expect.arrayContaining([
        {
          keys: {
            canonicalHotelId: 1,
            datasetVersion: 1,
          },
        },
        {
          keys: {
            beachProfileId: 1,
            datasetVersion: 1,
          },
        },
        {
          keys: {
            canonicalHotelId: 1,
            beachProfileId: 1,
            datasetVersion: 1,
          },
          options: {
            unique: true,
          },
        },
      ]),
    );
  });
});
