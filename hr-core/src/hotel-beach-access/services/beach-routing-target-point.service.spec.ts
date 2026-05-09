import { Types } from 'mongoose';
import { BEACH_ACCESS_POINT_CONFIDENCE } from '../../beach-profiles/constants/beach-access-point-confidence.enum';
import { BEACH_ACCESS_POINT_SOURCE } from '../../beach-profiles/constants/beach-access-point-source.enum';
import { BEACH_GEOMETRY_KIND } from '../../beach-profiles/constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../../beach-profiles/constants/beach-profile-lifecycle-status.enum';
import { BEACH_QUALITY_CONFIDENCE } from '../../beach-profiles/constants/beach-quality-confidence.enum';
import { BEACH_QUALITY_STATUS } from '../../beach-profiles/constants/beach-quality-status.enum';
import { BEACH_TYPE } from '../../beach-profiles/constants/beach-type.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE } from '../constants/hotel-beach-access-target-point-source.enum';
import { BeachRoutingTargetPointService } from './beach-routing-target-point.service';
import { GeoDistanceService } from './geo-distance.service';

describe('BeachRoutingTargetPointService', () => {
  let service: BeachRoutingTargetPointService;

  beforeEach(() => {
    service = new BeachRoutingTargetPointService(new GeoDistanceService());
  });

  it('uses curated access points before generated geometry candidates', () => {
    const beach = buildBeach({
      accessPoints: [
        {
          confidence: BEACH_ACCESS_POINT_CONFIDENCE.HIGH,
          createdAt: new Date('2026-05-08T09:00:00.000Z'),
          label: 'Boardwalk',
          point: {
            coordinates: [33.1, 35.1],
            type: 'Point',
          },
          source: BEACH_ACCESS_POINT_SOURCE.MANUAL,
          updatedAt: new Date('2026-05-08T09:00:00.000Z'),
        },
      ],
      geometryKind: BEACH_GEOMETRY_KIND.LINE,
    });

    const points = service.buildTargetPoints(beach, {
      coordinates: [33, 35],
      type: 'Point',
    });

    expect(points).toEqual([
      {
        label: 'Boardwalk',
        point: {
          coordinates: [33.1, 35.1],
          type: 'Point',
        },
        source: HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE.CURATED_ACCESS_POINT,
      },
    ]);
  });

  it('generates line samples when the beach has no curated access points', () => {
    const beach = buildBeach({
      accessPoints: [],
      geometry: {
        coordinates: [
          [33, 35],
          [33.1, 35.1],
          [33.2, 35.2],
          [33.3, 35.3],
          [33.4, 35.4],
        ],
        type: 'LineString',
      },
      geometryKind: BEACH_GEOMETRY_KIND.LINE,
    });

    const points = service.buildTargetPoints(beach, {
      coordinates: [33.05, 35.05],
      type: 'Point',
    });

    expect(points).toHaveLength(5);
    expect(points.every((point) => point.label === null)).toBe(true);
    expect(
      points.every(
        (point) =>
          point.source ===
          HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE.GEOMETRY_LINE_SAMPLE,
      ),
    ).toBe(true);
  });

  it('treats missing accessPoints from aggregate results as an empty array', () => {
    const beach = buildBeach({
      geometry: {
        coordinates: [
          [33, 35],
          [33.1, 35.1],
          [33.2, 35.2],
        ],
        type: 'LineString',
      },
      geometryKind: BEACH_GEOMETRY_KIND.LINE,
    });

    const points = service.buildTargetPoints(beach, {
      coordinates: [33.05, 35.05],
      type: 'Point',
    });

    expect(points).toHaveLength(3);
    expect(points[0].source).toBe(
      HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE.GEOMETRY_LINE_SAMPLE,
    );
  });
});

function buildBeach(params: {
  accessPoints?: [];
  geometry?: {
    coordinates: unknown;
    type: string;
  };
  geometryKind: BEACH_GEOMETRY_KIND;
}) {
  return {
    _id: new Types.ObjectId(),
    ...(params.accessPoints === undefined
      ? {}
      : {
          accessPoints: params.accessPoints,
        }),
    beachType: BEACH_TYPE.UNKNOWN,
    createdAt: new Date('2026-05-08T09:00:00.000Z'),
    geometry:
      params.geometry ??
      ({
        coordinates: [
          [33, 35],
          [33.4, 35.4],
        ],
        type: 'LineString',
      } as const),
    geometryKind: params.geometryKind,
    lifecycle: {
      firstSeenAt: new Date('2026-05-08T09:00:00.000Z'),
      lastSeenAt: new Date('2026-05-08T09:00:00.000Z'),
      notSeenSince: null,
      status: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
    },
    name: 'Beach',
    normalizedName: 'beach',
    point: {
      coordinates: [33, 35],
      type: 'Point',
    },
    quality: {
      confidence: BEACH_QUALITY_CONFIDENCE.MEDIUM,
      reasons: [],
      status: BEACH_QUALITY_STATUS.RAW,
    },
    source: {
      dataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      id: 'way/1',
      importRunId: new Types.ObjectId(),
      type: GEO_SOURCE_TYPE.OSM,
    },
    sourceHashes: {
      geometryHash: 'geometry',
      propertiesHash: 'properties',
    },
    sourceProperties: {},
    updatedAt: new Date('2026-05-08T09:00:00.000Z'),
  };
}
