export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface IHotelGeo {
  point: IGeoPoint | null;
  source: string | null;
}
