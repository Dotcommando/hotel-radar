import { Types } from 'mongoose';
import { HOTEL_BEACH_ACCESS_EDGE_STATUS } from '../constants/hotel-beach-access-edge-status.enum';
import { IGeoPoint } from './geo-point.interface';
import { IHotelBeachAccessRoute } from './hotel-beach-access-route.interface';

export interface IHotelBeachAccessEdge {
  _id: Types.ObjectId;
  canonicalHotelId: Types.ObjectId;
  beachProfileId: Types.ObjectId;
  hotelPoint: IGeoPoint;
  beachPoint: IGeoPoint;
  straightDistanceMeters: number;
  walkingDistanceMeters: number | null;
  walkingDurationSeconds: number | null;
  bestRoute: IHotelBeachAccessRoute | null;
  routeAlternatives: IHotelBeachAccessRoute[];
  status: HOTEL_BEACH_ACCESS_EDGE_STATUS;
  error: string | null;
  computedAt: Date;
  runId: string;
  algorithmVersion: string;
  createdAt: Date;
  updatedAt: Date;
}
