import { IHotelCapacityFields } from '../types/hotel-capacity-fields.interface';

export function normalizeHotelCapacity(
  capacity: IHotelCapacityFields,
): IHotelCapacityFields {
  if (
    capacity.rooms !== null
      && capacity.beds !== null
      && capacity.rooms > 0
      && capacity.beds > 0
      && capacity.beds < capacity.rooms
  ) {
    return {
      beds: capacity.rooms,
      rooms: capacity.beds,
    };
  }

  return capacity;
}
