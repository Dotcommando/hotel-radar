import { IHotelGeoJsonGeometry } from '../../hotel-geo-candidates/types/hotel-geo-json-geometry.interface';

export interface IGeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: IHotelGeoJsonGeometry;
}
