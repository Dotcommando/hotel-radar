import { Types } from 'mongoose';
import { BEACH_GEOMETRY_KIND } from '../constants/beach-geometry-kind.enum';
import { BEACH_TYPE } from '../constants/beach-type.enum';
import { IBeachGeoJsonGeometry } from './beach-geo-json-geometry.interface';
import { IBeachGeoPoint } from './beach-geo-point.interface';

export interface IUpsertOsmOverpassBeachProfile {
  importRunId: Types.ObjectId;
  sourceId: string;
  name: string | null;
  normalizedName: string | null;
  point: IBeachGeoPoint;
  geometry: IBeachGeoJsonGeometry;
  geometryKind: BEACH_GEOMETRY_KIND;
  beachType: BEACH_TYPE;
  sourceProperties: Record<string, unknown>;
  propertiesHash: string;
  geometryHash: string;
  datasetVersion: number;
}
