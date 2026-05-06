import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { GEO_MATCH_REASON } from '../constants/geo-match-reason.enum';

export interface IAutoMatchHotelGeoCandidateResultItem {
  action: GEO_MATCH_ACTION;
  canonicalHotelId: string;
  canonicalHotelName: string;
  hotelGeoCandidateId: string;
  hotelGeoCandidateName: string | null;
  hotelGeoCandidateSourceId: string;
  reasons: GEO_MATCH_REASON[];
  score: number;
}

export interface IAutoMatchHotelGeoCandidatesStats {
  alreadyMatched: number;
  autoMatched: number;
  conflicts: number;
  eligibleCandidates: number;
  needsReview: number;
  noDeterministicMatch: number;
  skippedConfirmed: number;
  skippedRejected: number;
  skippedStale: number;
}

export interface IAutoMatchHotelGeoCandidatesResult {
  conflicts: IAutoMatchHotelGeoCandidateResultItem[];
  dryRun: boolean;
  matches: IAutoMatchHotelGeoCandidateResultItem[];
  ok: true;
  reviewSuggestions: IAutoMatchHotelGeoCandidateResultItem[];
  stats: IAutoMatchHotelGeoCandidatesStats;
}
