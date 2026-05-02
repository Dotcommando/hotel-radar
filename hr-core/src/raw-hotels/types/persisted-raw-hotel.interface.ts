import { Types } from 'mongoose';
import { IRawHotel } from './raw-hotel.interface';

export interface IPersistedRawHotel extends IRawHotel {
  _id: Types.ObjectId;
}
