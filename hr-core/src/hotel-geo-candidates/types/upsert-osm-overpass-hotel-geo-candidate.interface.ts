import { Types } from 'mongoose';
import { IHotelGeoJsonGeometry } from './hotel-geo-json-geometry.interface';
import { IHotelGeoPoint } from './hotel-geo-point.interface';

export interface IUpsertOsmOverpassHotelGeoCandidate {
  importRunId: Types.ObjectId;
  sourceId: string;
  name: string | null;
  normalizedName: string | null;
  point: IHotelGeoPoint;
  geometry: IHotelGeoJsonGeometry;
  sourceProperties: Record<string, unknown>;
  propertiesHash: string;
  geometryHash: string;
}
