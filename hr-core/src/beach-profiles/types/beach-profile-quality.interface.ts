import { BEACH_QUALITY_CONFIDENCE } from '../constants/beach-quality-confidence.enum';
import { BEACH_QUALITY_STATUS } from '../constants/beach-quality-status.enum';

export interface IBeachProfileQuality {
  status: BEACH_QUALITY_STATUS;
  confidence: BEACH_QUALITY_CONFIDENCE;
  reasons: string[];
}
