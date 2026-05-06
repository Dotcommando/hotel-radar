import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';

export interface IManualMatchHotelGeoCandidateResult {
  action: GEO_MATCH_ACTION;
  canonicalHotelId: string;
  canonicalHotelName: string;
  hotelGeoCandidateId: string;
  hotelGeoCandidateName: string | null;
  hotelGeoCandidateSourceId: string;
  ok: true;
}
