import path from 'path';

interface ICanonicalHotelVerificationDataFixModule {
  applyCanonicalHotelVerificationDataFix: (
    db: IFakeDb,
    options: {
      ObjectId: (value: string) => string;
      now: Date;
    },
  ) => Promise<IDataFixReport>;
  CANONICAL_HOTEL_GEO_SOURCE: {
    MANUAL: string;
  };
  CANONICAL_HOTEL_VERIFICATION_ISSUE: {
    EMAIL_NO_RESPONSE: string;
    GOOGLE_MAPS_NOT_FOUND: string;
  };
  CANONICAL_HOTEL_VERIFICATION_STATUS: {
    LOCATION_UNVERIFIED: string;
    LOCATION_VERIFIED: string;
    UNREVIEWED: string;
  };
  HOTEL_GEO_CANDIDATE_MATCH_STATUS: {
    CONFIRMED: string;
  };
  TARGET_LOCATION_UNVERIFIED_CANONICAL_HOTEL_ID: string;
}

interface IDataFixReport {
  canonicalHotels: {
    confirmedManualMatchMatched: number;
    confirmedManualMatchModified: number;
    manualGeoMatched: number;
    manualGeoModified: number;
    missingBackfillMatched: number;
    missingBackfillModified: number;
    targetMatched: number;
    targetModified: number;
  };
  ok: true;
}

interface IFakeDb {
  collection: (name: string) => IFakeCollection;
}

interface IFakeCollection {
  distinct: (pathValue: string, filter: IFilter) => Promise<unknown[]>;
  updateMany: (filter: IFilter, update: IUpdate) => Promise<IUpdateResult>;
  updateOne: (filter: IFilter, update: IUpdate) => Promise<IUpdateResult>;
}

interface IFilter {
  [pathValue: string]: unknown;
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

const fixModule: ICanonicalHotelVerificationDataFixModule = require(
  path.join(
    process.cwd(),
    'scripts/data-fixes/backfill-canonical-hotel-verification.js',
  ),
);

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

  async distinct(pathValue: string, filter: IFilter): Promise<unknown[]> {
    const keys = new Set<string>();
    const result: unknown[] = [];

    for (const document of this.documents) {
      if (!this.matchesFilter(document, filter)) {
        continue;
      }

      const value = getByPath(document, pathValue);
      const key = JSON.stringify(value);

      if (keys.has(key)) {
        continue;
      }

      keys.add(key);
      result.push(value);
    }

    return result;
  }

  async updateMany(filter: IFilter, update: IUpdate): Promise<IUpdateResult> {
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

    return {
      matchedCount,
      modifiedCount,
    };
  }

  async updateOne(filter: IFilter, update: IUpdate): Promise<IUpdateResult> {
    const document = this.documents.find((item) =>
      this.matchesFilter(item, filter),
    );

    if (document === undefined) {
      return {
        matchedCount: 0,
        modifiedCount: 0,
      };
    }

    return {
      matchedCount: 1,
      modifiedCount: this.applyUpdate(document, update) ? 1 : 0,
    };
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
      if (pathValue === '$or' && Array.isArray(value)) {
        return value.some((item) =>
          this.matchesFilter(document, item as IFilter),
        );
      }

      if (pathValue === '_id') {
        if (this.isInFilter(value)) {
          return value.$in.some((item) => item === document._id);
        }

        return document._id === value;
      }

      const currentValue = getByPath(document, pathValue);

      if (this.isExistsFilter(value)) {
        return value.$exists
          ? currentValue !== undefined
          : currentValue === undefined;
      }

      if (this.isInFilter(value)) {
        return value.$in.some((item) => item === currentValue);
      }

      if (this.isNotEqualFilter(value)) {
        return JSON.stringify(currentValue) !== JSON.stringify(value.$ne);
      }

      return currentValue === value;
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

  private isInFilter(value: unknown): value is {
    $in: unknown[];
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      Array.isArray((value as Record<string, unknown>).$in)
    );
  }

  private isNotEqualFilter(value: unknown): value is {
    $ne: unknown;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      Object.prototype.hasOwnProperty.call(value, '$ne')
    );
  }
}

class FakeDb implements IFakeDb {
  constructor(
    private readonly canonicalHotels: IAnyDocument[],
    private readonly hotelGeoCandidates: IAnyDocument[],
  ) {}

  collection(name: string): IFakeCollection {
    if (name === 'canonical_hotels') {
      return new FakeCollection(this.canonicalHotels);
    }

    if (name === 'hotel_geo_candidates') {
      return new FakeCollection(this.hotelGeoCandidates);
    }

    throw new Error(`Unexpected fake collection: ${name}`);
  }
}

describe('backfill canonical hotel verification script', () => {
  it('backfills verification, marks manual geo as verified, and marks target as unverified', async () => {
    const now = new Date('2026-05-08T09:00:00.000Z');
    const canonicalHotels = [
      {
        _id: '69f8842f878f7fca1f7e0a9c',
        canonicalName: 'MANUAL GEO HOTEL',
        geo: {
          source: fixModule.CANONICAL_HOTEL_GEO_SOURCE.MANUAL,
        },
      },
      {
        _id: '69f8842f878f7fca1f7e0a9d',
        canonicalName: 'UNREVIEWED HOTEL',
        geo: {
          source: null,
        },
      },
      {
        _id: '69f8842f878f7fca1f7e0a9e',
        canonicalName: 'EXISTING UNVERIFIED HOTEL',
        geo: {
          source: null,
        },
        verification: {
          issues: [
            fixModule.CANONICAL_HOTEL_VERIFICATION_ISSUE.EMAIL_NO_RESPONSE,
          ],
          status:
            fixModule.CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED,
          updatedAt: '2026-05-07T09:00:00.000Z',
        },
      },
      {
        _id: '69f8842f878f7fca1f7e0a9f',
        canonicalName: 'CONFIRMED MANUAL MATCH HOTEL',
        geo: {
          source: 'hotel_geo_candidate:69fae6928833ac8ce429d21d',
        },
      },
      {
        _id: fixModule.TARGET_LOCATION_UNVERIFIED_CANONICAL_HOTEL_ID,
        canonicalName: 'TARGET HOTEL',
        geo: {
          source: null,
        },
      },
    ];
    const hotelGeoCandidates = [
      {
        _id: '69fae6928833ac8ce429d21d',
        canonicalHotelId: '69f8842f878f7fca1f7e0a9f',
        matchStatus: fixModule.HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED,
      },
    ];
    const db = new FakeDb(canonicalHotels, hotelGeoCandidates);

    const report = await fixModule.applyCanonicalHotelVerificationDataFix(db, {
      ObjectId: (value) => value,
      now,
    });

    expect(report).toEqual({
      canonicalHotels: {
        confirmedManualMatchMatched: 1,
        confirmedManualMatchModified: 1,
        manualGeoMatched: 1,
        manualGeoModified: 1,
        missingBackfillMatched: 4,
        missingBackfillModified: 4,
        targetMatched: 1,
        targetModified: 1,
      },
      ok: true,
    });
    expect(canonicalHotels[0].verification).toEqual({
      issues: [],
      status: fixModule.CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_VERIFIED,
      updatedAt: now.toISOString(),
    });
    expect(canonicalHotels[1].verification).toEqual({
      issues: [],
      status: fixModule.CANONICAL_HOTEL_VERIFICATION_STATUS.UNREVIEWED,
      updatedAt: null,
    });
    expect(canonicalHotels[2].verification).toEqual({
      issues: [fixModule.CANONICAL_HOTEL_VERIFICATION_ISSUE.EMAIL_NO_RESPONSE],
      status: fixModule.CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED,
      updatedAt: '2026-05-07T09:00:00.000Z',
    });
    expect(canonicalHotels[3].verification).toEqual({
      issues: [],
      status: fixModule.CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_VERIFIED,
      updatedAt: now.toISOString(),
    });
    expect(canonicalHotels[4].verification).toEqual({
      issues: [
        fixModule.CANONICAL_HOTEL_VERIFICATION_ISSUE.GOOGLE_MAPS_NOT_FOUND,
        fixModule.CANONICAL_HOTEL_VERIFICATION_ISSUE.EMAIL_NO_RESPONSE,
      ],
      status: fixModule.CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED,
      updatedAt: now.toISOString(),
    });
  });

  it('is idempotent after the first application', async () => {
    const now = new Date('2026-05-08T09:00:00.000Z');
    const canonicalHotels = [
      {
        _id: fixModule.TARGET_LOCATION_UNVERIFIED_CANONICAL_HOTEL_ID,
        canonicalName: 'TARGET HOTEL',
        geo: {
          source: null,
        },
      },
    ];
    const db = new FakeDb(canonicalHotels, []);

    await fixModule.applyCanonicalHotelVerificationDataFix(db, {
      ObjectId: (value) => value,
      now,
    });
    const secondReport = await fixModule.applyCanonicalHotelVerificationDataFix(
      db,
      {
        ObjectId: (value) => value,
        now,
      },
    );

    expect(secondReport.canonicalHotels.missingBackfillModified).toBe(0);
    expect(secondReport.canonicalHotels.targetModified).toBe(0);
  });
});
