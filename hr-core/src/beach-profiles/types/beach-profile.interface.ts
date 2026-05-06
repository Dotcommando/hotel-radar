import { Types } from 'mongoose';
import { BEACH_GEOMETRY_KIND } from '../constants/beach-geometry-kind.enum';
import { BEACH_TYPE } from '../constants/beach-type.enum';
import { IBeachGeoJsonGeometry } from './beach-geo-json-geometry.interface';
import { IBeachGeoPoint } from './beach-geo-point.interface';
import { IBeachProfileLifecycle } from './beach-profile-lifecycle.interface';
import { IBeachProfileQuality } from './beach-profile-quality.interface';
import { IBeachProfileSource } from './beach-profile-source.interface';
import { IBeachProfileSourceHashes } from './beach-profile-source-hashes.interface';

export interface IBeachProfile {
  _id: Types.ObjectId;
  source: IBeachProfileSource;
  name: string | null;
  normalizedName: string | null;
  point: IBeachGeoPoint;
  geometry: IBeachGeoJsonGeometry;
  geometryKind: BEACH_GEOMETRY_KIND;
  sourceProperties: Record<string, unknown>;
  sourceHashes: IBeachProfileSourceHashes;
  beachType: BEACH_TYPE;
  quality: IBeachProfileQuality;
  lifecycle: IBeachProfileLifecycle;
  createdAt: Date;
  updatedAt: Date;
}
