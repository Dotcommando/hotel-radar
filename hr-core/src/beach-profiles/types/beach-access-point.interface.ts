import { BEACH_ACCESS_POINT_CONFIDENCE } from '../constants/beach-access-point-confidence.enum';
import { BEACH_ACCESS_POINT_SOURCE } from '../constants/beach-access-point-source.enum';
import { IBeachGeoPoint } from './beach-geo-point.interface';

export interface IBeachAccessPoint {
  point: IBeachGeoPoint;
  source: BEACH_ACCESS_POINT_SOURCE;
  confidence: BEACH_ACCESS_POINT_CONFIDENCE;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
}
