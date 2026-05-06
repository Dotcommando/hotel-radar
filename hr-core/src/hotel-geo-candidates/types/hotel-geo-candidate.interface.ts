import { Types } from 'mongoose';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../constants/hotel-geo-candidate-match-status.enum';
import { IHotelGeoCandidateLifecycle } from './hotel-geo-candidate-lifecycle.interface';
import { IHotelGeoCandidateSource } from './hotel-geo-candidate-source.interface';
import { IHotelGeoCandidateSourceHashes } from './hotel-geo-candidate-source-hashes.interface';
import { IHotelGeoJsonGeometry } from './hotel-geo-json-geometry.interface';
import { IHotelGeoPoint } from './hotel-geo-point.interface';

export interface IHotelGeoCandidate {
  _id: Types.ObjectId;
  source: IHotelGeoCandidateSource;
  canonicalHotelId: Types.ObjectId | null;
  componentId: string | null;
  matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS;
  matchReasons: string[];
  name: string | null;
  normalizedName: string | null;
  point: IHotelGeoPoint;
  geometry: IHotelGeoJsonGeometry;
  sourceProperties: Record<string, unknown>;
  sourceHashes: IHotelGeoCandidateSourceHashes;
  lifecycle: IHotelGeoCandidateLifecycle;
  createdAt: Date;
  updatedAt: Date;
}
