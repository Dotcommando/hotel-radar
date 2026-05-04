export interface ICanonicalHotelSourceState {
  origin: 'gov_registry';
  lastCandidateKey: string;
  lastCandidateBuildRule: string;
  lastCandidateBuildRuleVersion: number;
  lastCandidateSeenAt: Date;
}
