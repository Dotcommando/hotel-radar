import { Injectable } from '@nestjs/common';
import { ICanonicalHotel } from '../../canonical-hotels/types/canonical-hotel.interface';
import { IHotelGeoCandidate } from '../../hotel-geo-candidates/types/hotel-geo-candidate.interface';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { GEO_MATCH_REASON } from '../constants/geo-match-reason.enum';
import { GEO_MATCH_SCORE } from '../constants/geo-match-score.constant';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { IAutoMatchHotelGeoCandidatesRequest } from '../types/auto-match-hotel-geo-candidates-request.interface';
import {
  IAutoMatchHotelGeoCandidateResultItem,
  IAutoMatchHotelGeoCandidatesResult,
  IAutoMatchHotelGeoCandidatesStats,
} from '../types/auto-match-hotel-geo-candidates-result.interface';
import {
  extractDomain,
  getGeoMatchEmailDomain,
  getGeoMatchNameTokens,
  isSharedHotelDomain,
  normalizeGeoMatchEmail,
  normalizeGeoMatchNameRaw,
  normalizeGeoMatchNameReduced,
  normalizeGeoMatchPhone,
} from '../utils/geo-match-normalization.util';
import { isCanonicalHotelEligibleForGeoMatching } from '../utils/canonical-hotel-geo-eligibility.util';

interface IGeoMatchIdentity {
  domains: Set<string>;
  emails: Set<string>;
  phones: Set<string>;
  rawNames: string[];
  reducedNames: string[];
  sharedDomains: Set<string>;
  sharedEmails: Set<string>;
  strongDomains: Set<string>;
  strongEmails: Set<string>;
  tokens: string[];
}

interface IGeoMatchAddress {
  city: string | null;
  postcode: string | null;
  street: string | null;
}

interface IGeoMatchCandidateIndex {
  address: IGeoMatchAddress;
  document: IHotelGeoCandidate;
  identity: IGeoMatchIdentity;
}

interface IGeoMatchHotelIndex {
  address: IGeoMatchAddress;
  componentId: string | null;
  document: ICanonicalHotel;
  identity: IGeoMatchIdentity;
}

interface IGeoMatchProposal {
  candidate: IGeoMatchCandidateIndex;
  componentId: string | null;
  hotel: IGeoMatchHotelIndex;
  reasons: GEO_MATCH_REASON[];
  score: number;
}

interface IGeoMatchNameScore {
  isCompatible: boolean;
  isFuzzyStrong: boolean;
  isRawExact: boolean;
  isReducedExact: boolean;
  isVeryStrong: boolean;
  score: number;
}

@Injectable()
export class AutoMatchHotelGeoCandidatesUseCase {
  constructor(private readonly repository: GeoHotelMatchingRepository) {}

  async execute(
    request: IAutoMatchHotelGeoCandidatesRequest = {},
  ): Promise<IAutoMatchHotelGeoCandidatesResult> {
    const dryRun = this.parseBoolean(request.dryRun);
    const limit = this.parseLimit(request.limit);
    const [hotels, candidates] = await Promise.all([
      this.repository.listCanonicalHotelsForGeoMatching(),
      this.repository.listHotelGeoCandidatesForAutoMatching(limit),
    ]);
    const hotelIndexes = hotels
      .filter((hotel) => this.isActiveCanonicalHotel(hotel))
      .map((hotel) => this.buildHotelIndex(hotel));
    const candidateIndexes = candidates.map((candidate) =>
      this.buildCandidateIndex(candidate),
    );
    const proposals = this.buildProposals(candidateIndexes, hotelIndexes);
    const acceptedProposals = this.resolveAcceptedProposals(proposals);
    const acceptedCandidateIds = new Set(
      acceptedProposals.map((proposal) =>
        proposal.candidate.document._id.toString(),
      ),
    );
    const proposedCandidateIds = new Set(
      proposals.map((proposal) => proposal.candidate.document._id.toString()),
    );
    const stats = this.buildInitialStats(candidates.length);
    const matches: IAutoMatchHotelGeoCandidateResultItem[] = [];
    const conflicts: IAutoMatchHotelGeoCandidateResultItem[] = [];
    const reviewSuggestions = this.buildReviewSuggestions(
      proposals,
      acceptedCandidateIds,
    );

    for (const proposal of acceptedProposals) {
      const item = this.buildResultItem(
        proposal,
        GEO_MATCH_ACTION.AUTO_MATCHED,
      );

      if (dryRun) {
        stats.autoMatched++;
        matches.push(item);
        continue;
      }

      const action = await this.repository.applyAutoMatch({
        canonicalHotelId: proposal.hotel.document._id,
        componentId: proposal.componentId,
        hotelGeoCandidateId: proposal.candidate.document._id,
        point: proposal.candidate.document.point,
        reasons: proposal.reasons,
        score: proposal.score,
      });

      if (action === GEO_MATCH_ACTION.CONFLICT) {
        stats.conflicts++;
        conflicts.push(this.buildResultItem(proposal, action));
      } else if (action === GEO_MATCH_ACTION.ALREADY_MATCHED) {
        stats.alreadyMatched++;
        matches.push(this.buildResultItem(proposal, action));
      } else {
        stats.autoMatched++;
        matches.push(this.buildResultItem(proposal, action));
      }
    }

    stats.needsReview = Array.from(proposedCandidateIds).filter(
      (id) => !acceptedCandidateIds.has(id),
    ).length;
    stats.noDeterministicMatch =
      candidates.length - acceptedCandidateIds.size - stats.needsReview;

    return {
      conflicts,
      dryRun,
      matches,
      ok: true,
      reviewSuggestions,
      stats,
    };
  }

  private buildInitialStats(
    eligibleCandidates: number,
  ): IAutoMatchHotelGeoCandidatesStats {
    return {
      alreadyMatched: 0,
      autoMatched: 0,
      conflicts: 0,
      eligibleCandidates,
      needsReview: 0,
      noDeterministicMatch: 0,
      skippedConfirmed: 0,
      skippedRejected: 0,
      skippedStale: 0,
    };
  }

  private isActiveCanonicalHotel(hotel: ICanonicalHotel): boolean {
    return isCanonicalHotelEligibleForGeoMatching(hotel);
  }

  private buildProposals(
    candidates: IGeoMatchCandidateIndex[],
    hotels: IGeoMatchHotelIndex[],
  ): IGeoMatchProposal[] {
    const proposals: IGeoMatchProposal[] = [];

    for (const candidate of candidates) {
      for (const hotel of hotels) {
        const proposal = this.buildProposal(candidate, hotel);

        if (proposal !== null) {
          proposals.push(proposal);
        }
      }
    }

    return proposals;
  }

  private resolveAcceptedProposals(
    proposals: IGeoMatchProposal[],
  ): IGeoMatchProposal[] {
    const proposalsByCandidate = this.groupProposalsById(
      proposals,
      (proposal) => proposal.candidate.document._id.toString(),
    );
    const proposalsByHotel = this.groupProposalsById(proposals, (proposal) =>
      proposal.hotel.document._id.toString(),
    );

    return proposals.filter((proposal) => {
      const candidateTop = this.getUniqueTopProposal(
        proposalsByCandidate.get(proposal.candidate.document._id.toString()) ??
          [],
      );
      const hotelTop = this.getUniqueTopProposal(
        proposalsByHotel.get(proposal.hotel.document._id.toString()) ?? [],
      );

      return candidateTop === proposal && hotelTop === proposal;
    });
  }

  private buildReviewSuggestions(
    proposals: IGeoMatchProposal[],
    acceptedCandidateIds: Set<string>,
  ): IAutoMatchHotelGeoCandidateResultItem[] {
    const bestProposalByCandidateId = new Map<string, IGeoMatchProposal>();

    for (const proposal of proposals) {
      const candidateId = proposal.candidate.document._id.toString();

      if (acceptedCandidateIds.has(candidateId)) {
        continue;
      }

      const existing = bestProposalByCandidateId.get(candidateId);

      if (
        existing === undefined ||
        proposal.score > existing.score ||
        (proposal.score === existing.score &&
          this.getCandidateSourceRichness(proposal.candidate.document) >
            this.getCandidateSourceRichness(existing.candidate.document))
      ) {
        bestProposalByCandidateId.set(candidateId, proposal);
      }
    }

    return Array.from(bestProposalByCandidateId.values()).map((proposal) =>
      this.buildResultItem(proposal, GEO_MATCH_ACTION.NEEDS_REVIEW),
    );
  }

  private groupProposalsById(
    proposals: IGeoMatchProposal[],
    getId: (proposal: IGeoMatchProposal) => string,
  ): Map<string, IGeoMatchProposal[]> {
    const result = new Map<string, IGeoMatchProposal[]>();

    for (const proposal of proposals) {
      const id = getId(proposal);
      const group = result.get(id) ?? [];
      group.push(proposal);
      result.set(id, group);
    }

    return result;
  }

  private getUniqueTopProposal(
    proposals: IGeoMatchProposal[],
  ): IGeoMatchProposal | null {
    const sorted = [...proposals].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (
        this.getCandidateSourceRichness(right.candidate.document) -
        this.getCandidateSourceRichness(left.candidate.document)
      );
    });

    if (sorted.length === 0) {
      return null;
    }

    if (sorted.length === 1) {
      return sorted[0];
    }

    const first = sorted[0];
    const second = sorted[1];

    if (
      first.score === second.score &&
      this.getCandidateSourceRichness(first.candidate.document) ===
        this.getCandidateSourceRichness(second.candidate.document)
    ) {
      return null;
    }

    return first;
  }

  private buildProposal(
    candidate: IGeoMatchCandidateIndex,
    hotel: IGeoMatchHotelIndex,
  ): IGeoMatchProposal | null {
    const nameScore = this.scoreNames(candidate.identity, hotel.identity);
    const hasStrongContact =
      this.hasIntersection(candidate.identity.phones, hotel.identity.phones) ||
      this.hasIntersection(
        candidate.identity.strongEmails,
        hotel.identity.strongEmails,
      ) ||
      this.hasIntersection(
        candidate.identity.strongDomains,
        hotel.identity.strongDomains,
      );
    const hasSharedContact =
      this.hasIntersection(
        candidate.identity.sharedEmails,
        hotel.identity.sharedEmails,
      ) ||
      this.hasIntersection(
        candidate.identity.sharedDomains,
        hotel.identity.sharedDomains,
      );

    if (hasStrongContact && nameScore.isCompatible) {
      return {
        candidate,
        componentId: hotel.componentId,
        hotel,
        reasons: [GEO_MATCH_REASON.CONTACT_AND_COMPATIBLE_NAME],
        score: GEO_MATCH_SCORE.CONTACT_AND_COMPATIBLE_NAME,
      };
    }

    if (hasStrongContact && nameScore.isFuzzyStrong) {
      return {
        candidate,
        componentId: hotel.componentId,
        hotel,
        reasons: [GEO_MATCH_REASON.CONTACT_AND_FUZZY_NAME],
        score: GEO_MATCH_SCORE.CONTACT_AND_FUZZY_NAME,
      };
    }

    if (hasSharedContact && nameScore.isVeryStrong) {
      return {
        candidate,
        componentId: hotel.componentId,
        hotel,
        reasons: [GEO_MATCH_REASON.SHARED_GROUP_CONTACT_AND_STRONG_NAME],
        score: GEO_MATCH_SCORE.SHARED_GROUP_CONTACT_AND_STRONG_NAME,
      };
    }

    if (
      nameScore.isVeryStrong &&
      this.hasAddressMatch(candidate.address, hotel.address)
    ) {
      return {
        candidate,
        componentId: hotel.componentId,
        hotel,
        reasons: [GEO_MATCH_REASON.ADDRESS_AND_STRONG_NAME],
        score: GEO_MATCH_SCORE.ADDRESS_AND_STRONG_NAME,
      };
    }

    if (nameScore.isRawExact) {
      return {
        candidate,
        componentId: hotel.componentId,
        hotel,
        reasons: [GEO_MATCH_REASON.RAW_EXACT_NAME],
        score: GEO_MATCH_SCORE.RAW_EXACT_NAME,
      };
    }

    if (nameScore.isReducedExact) {
      return {
        candidate,
        componentId: hotel.componentId,
        hotel,
        reasons: [GEO_MATCH_REASON.REDUCED_EXACT_NAME],
        score: GEO_MATCH_SCORE.REDUCED_EXACT_NAME,
      };
    }

    return null;
  }

  private buildCandidateIndex(
    candidate: IHotelGeoCandidate,
  ): IGeoMatchCandidateIndex {
    const sourceProperties = candidate.sourceProperties;
    const names = [
      candidate.name,
      candidate.normalizedName,
      this.readStringProperty(sourceProperties, 'name'),
      this.readStringProperty(sourceProperties, 'name:en'),
      this.readStringProperty(sourceProperties, 'official_name'),
      this.readStringProperty(sourceProperties, 'alt_name'),
      this.readStringProperty(sourceProperties, 'brand'),
      this.readStringProperty(sourceProperties, 'operator'),
    ];

    return {
      address: {
        city: this.normalizeAddressText(
          this.readStringProperty(sourceProperties, 'addr:city'),
        ),
        postcode: this.normalizePostcode(
          this.readStringProperty(sourceProperties, 'addr:postcode'),
        ),
        street: this.normalizeAddressText(
          this.readStringProperty(sourceProperties, 'addr:street'),
        ),
      },
      document: candidate,
      identity: this.buildIdentity(
        names,
        [
          this.readStringProperty(sourceProperties, 'phone'),
          this.readStringProperty(sourceProperties, 'contact:phone'),
        ],
        [
          this.readStringProperty(sourceProperties, 'email'),
          this.readStringProperty(sourceProperties, 'contact:email'),
        ],
        [
          this.readStringProperty(sourceProperties, 'website'),
          this.readStringProperty(sourceProperties, 'contact:website'),
          this.readStringProperty(sourceProperties, 'url'),
        ],
      ),
    };
  }

  private buildHotelIndex(hotel: ICanonicalHotel): IGeoMatchHotelIndex {
    const names = [
      hotel.canonicalName,
      ...hotel.components.map((component) => component.name),
    ];
    const contacts = [
      hotel.contacts,
      ...hotel.components.map((component) => component.contacts),
    ];
    const webPresenceDomains = [
      ...hotel.webPresence.domains,
      ...hotel.webPresence.websites,
    ];

    return {
      address: {
        city: this.normalizeAddressText(hotel.location.locality),
        postcode: this.normalizePostcode(hotel.location.postcode),
        street: this.normalizeAddressText(hotel.location.address),
      },
      componentId: null,
      document: hotel,
      identity: this.buildIdentity(
        names,
        contacts.flatMap((contact) => contact.phones),
        contacts.flatMap((contact) => contact.emails),
        [
          ...contacts.flatMap((contact) => [
            ...contact.domains,
            ...contact.websites,
          ]),
          ...webPresenceDomains,
        ],
      ),
    };
  }

  private buildIdentity(
    names: Array<string | null | undefined>,
    phones: Array<string | null | undefined>,
    emails: Array<string | null | undefined>,
    domains: Array<string | null | undefined>,
  ): IGeoMatchIdentity {
    const rawNames = this.uniqueStrings(names.map(normalizeGeoMatchNameRaw));
    const reducedNames = this.uniqueStrings(
      names.map(normalizeGeoMatchNameReduced),
    );
    const normalizedPhones = new Set(
      phones.map(normalizeGeoMatchPhone).filter((value) => value.length > 0),
    );
    const normalizedEmails = new Set(
      emails.map(normalizeGeoMatchEmail).filter((value) => value.length > 0),
    );
    const normalizedDomains = new Set(
      domains.map(extractDomain).filter((value) => value.length > 0),
    );

    return {
      domains: normalizedDomains,
      emails: normalizedEmails,
      phones: normalizedPhones,
      rawNames,
      reducedNames,
      sharedDomains: new Set(
        Array.from(normalizedDomains).filter(isSharedHotelDomain),
      ),
      sharedEmails: new Set(
        Array.from(normalizedEmails).filter((email) =>
          isSharedHotelDomain(getGeoMatchEmailDomain(email)),
        ),
      ),
      strongDomains: new Set(
        Array.from(normalizedDomains).filter(
          (domain) => !isSharedHotelDomain(domain),
        ),
      ),
      strongEmails: new Set(
        Array.from(normalizedEmails).filter(
          (email) => !isSharedHotelDomain(getGeoMatchEmailDomain(email)),
        ),
      ),
      tokens: reducedNames.flatMap(getGeoMatchNameTokens),
    };
  }

  private scoreNames(
    candidate: IGeoMatchIdentity,
    hotel: IGeoMatchIdentity,
  ): IGeoMatchNameScore {
    const rawExact = candidate.rawNames.some((candidateName) =>
      hotel.rawNames.includes(candidateName),
    );
    const reducedExact = candidate.reducedNames.some((candidateName) =>
      hotel.reducedNames.includes(candidateName),
    );
    let score = rawExact || reducedExact ? 1 : 0;

    for (const candidateName of candidate.reducedNames) {
      for (const hotelName of hotel.reducedNames) {
        score = Math.max(score, this.scoreStrings(candidateName, hotelName));
        score = Math.max(
          score,
          this.scoreTokenContainment(candidateName, hotelName),
        );
      }
    }

    return {
      isCompatible:
        rawExact ||
        reducedExact ||
        candidate.reducedNames.some((candidateName) =>
          hotel.reducedNames.some(
            (hotelName) =>
              candidateName.includes(hotelName) ||
              hotelName.includes(candidateName),
          ),
        ),
      isFuzzyStrong: score >= 0.72,
      isRawExact: rawExact,
      isReducedExact: reducedExact,
      isVeryStrong: score >= 0.82,
      score,
    };
  }

  private scoreStrings(left: string, right: string): number {
    if (left.length === 0 || right.length === 0) {
      return 0;
    }

    if (left === right) {
      return 1;
    }

    if (left.includes(right) || right.includes(left)) {
      return (
        Math.min(left.length, right.length) /
        Math.max(left.length, right.length)
      );
    }

    return (
      1 -
      this.computeEditDistance(left, right) /
        Math.max(left.length, right.length)
    );
  }

  private scoreTokenContainment(left: string, right: string): number {
    const leftTokens = new Set(getGeoMatchNameTokens(left));
    const rightTokens = new Set(getGeoMatchNameTokens(right));

    if (leftTokens.size === 0 || rightTokens.size === 0) {
      return 0;
    }

    let intersection = 0;

    for (const token of leftTokens) {
      if (rightTokens.has(token)) {
        intersection++;
      }
    }

    return intersection / Math.min(leftTokens.size, rightTokens.size);
  }

  private computeEditDistance(left: string, right: string): number {
    const previous = Array.from(
      {
        length: right.length + 1,
      },
      (_, index) => index,
    );
    const current = Array.from(
      {
        length: right.length + 1,
      },
      () => 0,
    );

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
      current[0] = leftIndex;

      for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
        const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
        current[rightIndex] = Math.min(
          current[rightIndex - 1] + 1,
          previous[rightIndex] + 1,
          previous[rightIndex - 1] + cost,
        );
      }

      for (let index = 0; index <= right.length; index++) {
        previous[index] = current[index];
      }
    }

    return previous[right.length];
  }

  private getCandidateSourceRichness(candidate: IHotelGeoCandidate): number {
    const sourceProperties = candidate.sourceProperties;
    let score = 0;

    if (this.readStringProperty(sourceProperties, 'phone') !== null) {
      score += 30;
    }

    if (this.readStringProperty(sourceProperties, 'email') !== null) {
      score += 25;
    }

    if (this.readStringProperty(sourceProperties, 'website') !== null) {
      score += 20;
    }

    if (this.readStringProperty(sourceProperties, 'stars') !== null) {
      score += 10;
    }

    if (candidate.source.id.startsWith('relation/')) {
      score += 8;
    } else if (candidate.source.id.startsWith('way/')) {
      score += 5;
    }

    return score;
  }

  private hasAddressMatch(
    candidate: IGeoMatchAddress,
    hotel: IGeoMatchAddress,
  ): boolean {
    if (
      candidate.postcode !== null &&
      hotel.postcode !== null &&
      candidate.postcode === hotel.postcode
    ) {
      return true;
    }

    if (
      candidate.street !== null &&
      hotel.street !== null &&
      (candidate.street === hotel.street ||
        candidate.street.includes(hotel.street) ||
        hotel.street.includes(candidate.street))
    ) {
      return true;
    }

    return (
      candidate.city !== null &&
      hotel.city !== null &&
      candidate.city === hotel.city
    );
  }

  private buildResultItem(
    proposal: IGeoMatchProposal,
    action: GEO_MATCH_ACTION,
  ): IAutoMatchHotelGeoCandidateResultItem {
    return {
      action,
      canonicalHotelId: proposal.hotel.document._id.toString(),
      canonicalHotelName: proposal.hotel.document.canonicalName,
      hotelGeoCandidateId: proposal.candidate.document._id.toString(),
      hotelGeoCandidateName: proposal.candidate.document.name,
      hotelGeoCandidateSourceId: proposal.candidate.document.source.id,
      reasons: proposal.reasons,
      score: proposal.score,
    };
  }

  private hasIntersection(left: Set<string>, right: Set<string>): boolean {
    for (const value of left) {
      if (right.has(value)) {
        return true;
      }
    }

    return false;
  }

  private uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.length > 0)));
  }

  private readStringProperty(
    sourceProperties: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = sourceProperties[key];

    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private normalizeAddressText(value: string | null): string | null {
    const normalized = normalizeGeoMatchNameRaw(value);

    return normalized.length > 0 ? normalized : null;
  }

  private normalizePostcode(value: string | null): string | null {
    const normalized = String(value ?? '').trim();

    return normalized.length > 0 ? normalized : null;
  }

  private parseBoolean(value: boolean | string | undefined): boolean {
    return value === true || value === 'true';
  }

  private parseLimit(value: number | string | undefined): number {
    if (value === undefined || value === '') {
      return 0;
    }

    const parsed =
      typeof value === 'number' ? value : Number.parseInt(value, 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
}
