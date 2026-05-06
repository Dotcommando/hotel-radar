import { IGeoJsonFeature } from './geo-json-feature.interface';

export interface IGeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: IGeoJsonFeature[];
}
