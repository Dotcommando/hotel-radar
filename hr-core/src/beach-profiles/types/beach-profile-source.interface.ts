import { Types } from 'mongoose';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';

export interface IBeachProfileSource {
  type: GEO_SOURCE_TYPE;
  dataset: GEO_SOURCE_DATASET;
  id: string;
  importRunId: Types.ObjectId;
}
