import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ICanonicalHotelCandidate } from '../../canonical-hotel-candidates/types/canonical-hotel-candidate.interface';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';
import {
  normalizeRegistryPostcode,
  normalizeRegistryText,
} from '../../hotel-registry-entries/utils/hotel-registry-normalization.util';
import { CANONICAL_HOTEL_MODEL_NAME } from '../constants/canonical-hotel-model-name.constant';
import { CANONICAL_HOTEL_PROCESSING_ACTION } from '../constants/canonical-hotel-processing-action.enum';
import { CANONICAL_HOTEL_REVIEW_REASON } from '../constants/canonical-hotel-review-reason.enum';
import { CANONICAL_HOTEL_STATUS } from '../constants/canonical-hotel-status.enum';
import { CANONICAL_HOTEL_VERIFICATION_STATUS } from '../constants/canonical-hotel-verification-status.enum';
import { CanonicalHotelCanonicalNameNotUniqueError } from '../errors/canonical-hotel-canonical-name-not-unique.error';
import {
  IApplyCanonicalHotelCandidateResult,
  ICanonicalHotelCandidateReview,
} from '../types/apply-canonical-hotel-candidate-result.interface';
import { ICanonicalHotel } from '../types/canonical-hotel.interface';
import { ICanonicalHotelSnapshot } from '../types/canonical-hotel-snapshot.interface';
import {
  hasStrongCanonicalHotelIdentity,
  makeCanonicalHotelKey,
} from '../utils/canonical-hotel-key.util';
import { HotelDeclaredWebPresenceService } from './hotel-declared-web-presence.service';

interface ICanonicalHotelQuery<TValue> {
  exec: () => Promise<TValue>;
}

interface ICanonicalHotelModel {
  create: (document: ICanonicalHotel) => Promise<ICanonicalHotel>;
  find: (
    filter: ICanonicalHotelFindFilter,
  ) => ICanonicalHotelQuery<ICanonicalHotel[]>;
  findById: (
    id: Types.ObjectId,
  ) => ICanonicalHotelQuery<ICanonicalHotel | null>;
  findOne: (
    filter: Partial<Pick<ICanonicalHotel, 'canonicalKey'>>,
  ) => ICanonicalHotelQuery<ICanonicalHotel | null>;
  updateOne: (
    filter: Pick<ICanonicalHotel, '_id'>,
    update: { $set: Partial<ICanonicalHotel> },
  ) => ICanonicalHotelQuery<unknown>;
}

interface ICanonicalHotelFindFilter {
  canonicalName?: string;
  kind?: string;
  operator?: string | null;
  'location.address'?: string | null;
  'location.locality'?: string | null;
  'location.postcode'?: string | null;
}

@Injectable()
export class CanonicalHotelsService {
  constructor(
    @InjectModel(CANONICAL_HOTEL_MODEL_NAME)
    private readonly canonicalHotelModel: ICanonicalHotelModel,
    private readonly webPresenceService: HotelDeclaredWebPresenceService,
  ) {}

  async findById(id: string): Promise<ICanonicalHotel | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.canonicalHotelModel.findById(new Types.ObjectId(id)).exec();
  }

  async findUniqueByCanonicalName(
    canonicalName: string,
  ): Promise<ICanonicalHotel | null> {
    const hotels = await this.canonicalHotelModel
      .find({
        canonicalName,
      })
      .exec();

    if (hotels.length > 1) {
      throw new CanonicalHotelCanonicalNameNotUniqueError(canonicalName);
    }

    return hotels[0] ?? null;
  }

  async applyCandidate(
    candidate: ICanonicalHotelCandidate,
  ): Promise<IApplyCanonicalHotelCandidateResult> {
    if (!hasStrongCanonicalHotelIdentity(candidate)) {
      return this.buildReviewResult(
        CANONICAL_HOTEL_REVIEW_REASON.MISSING_IDENTITY_FIELDS,
        [],
        ['Candidate does not have enough canonical identity fields.'],
      );
    }

    const snapshot = this.buildSnapshot(candidate, new Date());
    const matches = await this.findDeterministicMatches(snapshot);

    if (matches.length === 0) {
      const created = await this.canonicalHotelModel.create({
        ...snapshot,
        _id: new Types.ObjectId(),
        createdAt: snapshot.source.lastCandidateSeenAt,
        firstSeenAt: snapshot.source.lastCandidateSeenAt,
        geo: {
          point: null,
          source: null,
        },
        issues: [],
        lastSeenAt: snapshot.source.lastCandidateSeenAt,
        status: CANONICAL_HOTEL_STATUS.ACTIVE,
        updatedAt: snapshot.source.lastCandidateSeenAt,
        verification: {
          issues: [],
          status: CANONICAL_HOTEL_VERIFICATION_STATUS.UNREVIEWED,
          updatedAt: null,
        },
      });

      return {
        action: CANONICAL_HOTEL_PROCESSING_ACTION.CREATED,
        canonicalHotelId: created._id,
        review: null,
      };
    }

    if (matches.length > 1) {
      return this.buildReviewResult(
        CANONICAL_HOTEL_REVIEW_REASON.MULTIPLE_MATCHES,
        matches.map(({ _id }) => _id),
        ['Multiple deterministic canonical hotel matches found.'],
      );
    }

    const existing = matches[0];
    const review = this.compareForReview(existing, snapshot);

    if (review !== null) {
      return review;
    }

    const factsChanged = !this.areHotelFactsEqual(existing, snapshot);
    const updateFields = factsChanged
      ? this.buildFactUpdateFields(existing, snapshot)
      : this.buildSeenOnlyUpdateFields(snapshot);

    await this.canonicalHotelModel
      .updateOne(
        {
          _id: existing._id,
        },
        {
          $set: updateFields,
        },
      )
      .exec();

    return {
      action: factsChanged
        ? CANONICAL_HOTEL_PROCESSING_ACTION.UPDATED
        : CANONICAL_HOTEL_PROCESSING_ACTION.SEEN_WITHOUT_CHANGES,
      canonicalHotelId: existing._id,
      review: null,
    };
  }

  private async findDeterministicMatches(
    snapshot: ICanonicalHotelSnapshot,
  ): Promise<ICanonicalHotel[]> {
    const exact = await this.canonicalHotelModel
      .findOne({
        canonicalKey: snapshot.canonicalKey,
      })
      .exec();

    if (exact !== null) {
      return [exact];
    }

    const identityMatches = await this.canonicalHotelModel
      .find({
        canonicalName: snapshot.canonicalName,
        kind: snapshot.kind,
      })
      .exec();

    return this.uniqueHotels(
      identityMatches.filter((hotel) =>
        this.isCompatibleDeterministicMatch(hotel, snapshot),
      ),
    );
  }

  private buildSnapshot(
    candidate: ICanonicalHotelCandidate,
    seenAt: Date,
  ): ICanonicalHotelSnapshot {
    return {
      canonicalKey: makeCanonicalHotelKey(candidate),
      canonicalName: candidate.canonicalName,
      capacity: candidate.capacity,
      components: candidate.components,
      contacts: this.normalizeContacts(candidate.contacts),
      kind: candidate.kind,
      location: candidate.location,
      operator: candidate.operator,
      source: {
        lastCandidateBuildRule: candidate.build.rule,
        lastCandidateBuildRuleVersion: candidate.build.ruleVersion,
        lastCandidateKey: candidate.candidateKey,
        lastCandidateSeenAt: seenAt,
        origin: 'gov_registry',
      },
      webPresence: this.webPresenceService.build(candidate.contacts),
    };
  }

  private compareForReview(
    existing: ICanonicalHotel,
    snapshot: ICanonicalHotelSnapshot,
  ): IApplyCanonicalHotelCandidateResult | null {
    if (existing.kind !== snapshot.kind) {
      return this.buildReviewResult(
        CANONICAL_HOTEL_REVIEW_REASON.CONFLICTING_KIND,
        [existing._id],
        ['Existing canonical hotel kind conflicts with candidate kind.'],
      );
    }

    if (this.hasLocationConflict(existing.location, snapshot.location)) {
      return this.buildReviewResult(
        CANONICAL_HOTEL_REVIEW_REASON.CONFLICTING_LOCATION,
        [existing._id],
        ['Existing canonical hotel location conflicts with candidate location.'],
      );
    }

    if (this.hasComponentConflict(existing, snapshot)) {
      return this.buildReviewResult(
        CANONICAL_HOTEL_REVIEW_REASON.CONFLICTING_COMPONENTS,
        [existing._id],
        ['Existing canonical hotel components conflict with candidate components.'],
      );
    }

    return null;
  }

  private hasLocationConflict(
    existing: IHotelLocation,
    candidate: IHotelLocation,
  ): boolean {
    return (['address', 'locality', 'postcode'] as const).some((field) => {
      const left = this.normalizeLocationField(field, existing[field]);
      const right = this.normalizeLocationField(field, candidate[field]);

      return left.length > 0 && right.length > 0 && left !== right;
    });
  }

  private hasComponentConflict(
    existing: ICanonicalHotel,
    snapshot: ICanonicalHotelSnapshot,
  ): boolean {
    if (existing.components.length === 0) {
      return false;
    }

    const existingKeys = existing.components.map(({ componentKey }) => componentKey);
    const snapshotKeys = snapshot.components.map(({ componentKey }) => componentKey);

    return !this.areStringArraysEqual(existingKeys, snapshotKeys);
  }

  private isCompatibleDeterministicMatch(
    existing: ICanonicalHotel,
    snapshot: ICanonicalHotelSnapshot,
  ): boolean {
    if (existing.kind !== snapshot.kind) {
      return false;
    }

    return (
      this.hasSameLocationField(
        existing.location.address,
        snapshot.location.address,
        'address',
      ) ||
      this.hasSameLocationField(
        existing.location.postcode,
        snapshot.location.postcode,
        'postcode',
      ) ||
      this.hasSameOperator(existing.operator, snapshot.operator) ||
      this.hasStrongContactOverlap(existing.contacts, snapshot.contacts)
    );
  }

  private areHotelFactsEqual(
    existing: ICanonicalHotel,
    snapshot: ICanonicalHotelSnapshot,
  ): boolean {
    return (
      this.stableStringify(existing.capacity) ===
        this.stableStringify(snapshot.capacity) &&
      this.stableStringify(existing.contacts) ===
        this.stableStringify(snapshot.contacts) &&
      this.stableStringify(existing.location) ===
        this.stableStringify(snapshot.location) &&
      this.stableStringify(existing.components) ===
        this.stableStringify(snapshot.components) &&
      this.stableStringify(existing.webPresence) ===
        this.stableStringify(snapshot.webPresence) &&
      (existing.operator ?? '') === (snapshot.operator ?? '') &&
      existing.canonicalName === snapshot.canonicalName
    );
  }

  private buildFactUpdateFields(
    existing: ICanonicalHotel,
    snapshot: ICanonicalHotelSnapshot,
  ): Partial<ICanonicalHotel> {
    return {
      canonicalKey: snapshot.canonicalKey,
      canonicalName: snapshot.canonicalName,
      capacity: snapshot.capacity,
      components: snapshot.components,
      contacts: snapshot.contacts,
      lastSeenAt: snapshot.source.lastCandidateSeenAt,
      location: this.mergeLocation(existing.location, snapshot.location),
      operator: snapshot.operator ?? existing.operator,
      source: snapshot.source,
      updatedAt: snapshot.source.lastCandidateSeenAt,
      webPresence: snapshot.webPresence,
    };
  }

  private buildSeenOnlyUpdateFields(
    snapshot: ICanonicalHotelSnapshot,
  ): Partial<ICanonicalHotel> {
    return {
      lastSeenAt: snapshot.source.lastCandidateSeenAt,
      source: snapshot.source,
      updatedAt: snapshot.source.lastCandidateSeenAt,
    };
  }

  private buildReviewResult(
    reason: CANONICAL_HOTEL_REVIEW_REASON,
    candidateCanonicalHotelIds: Types.ObjectId[],
    details: string[],
  ): IApplyCanonicalHotelCandidateResult {
    const review: ICanonicalHotelCandidateReview = {
      candidateCanonicalHotelIds,
      createdAt: new Date(),
      details,
      reason,
      resolvedAt: null,
    };

    return {
      action: CANONICAL_HOTEL_PROCESSING_ACTION.REVIEW_REQUIRED,
      canonicalHotelId: null,
      review,
    };
  }

  private mergeLocation(
    existing: IHotelLocation,
    candidate: IHotelLocation,
  ): IHotelLocation {
    return {
      address: existing.address ?? candidate.address,
      district: existing.district ?? candidate.district,
      locality: existing.locality ?? candidate.locality,
      postcode: existing.postcode ?? candidate.postcode,
    };
  }

  private normalizeContacts(contacts: IHotelContacts): IHotelContacts {
    return {
      domains: this.uniqueSorted(contacts.domains),
      emails: this.uniqueSorted(contacts.emails),
      phones: this.uniqueSorted(contacts.phones),
      websites: this.uniqueSorted(contacts.websites),
    };
  }

  private hasStrongContactOverlap(
    left: IHotelContacts,
    right: IHotelContacts,
  ): boolean {
    return (
      left.phones.some((phone) => right.phones.includes(phone)) ||
      left.emails.some((email) => right.emails.includes(email))
    );
  }

  private hasSameOperator(left: string | null, right: string | null): boolean {
    const normalizedLeft = normalizeRegistryText(left);
    const normalizedRight = normalizeRegistryText(right);

    return (
      normalizedLeft.length > 0 &&
      normalizedRight.length > 0 &&
      normalizedLeft === normalizedRight
    );
  }

  private hasSameLocationField(
    left: string | null,
    right: string | null,
    field: keyof Pick<IHotelLocation, 'address' | 'postcode'>,
  ): boolean {
    const normalizedLeft = this.normalizeLocationField(field, left);
    const normalizedRight = this.normalizeLocationField(field, right);

    return (
      normalizedLeft.length > 0 &&
      normalizedRight.length > 0 &&
      normalizedLeft === normalizedRight
    );
  }

  private uniqueHotels(hotels: ICanonicalHotel[]): ICanonicalHotel[] {
    const seenIds = new Set<string>();
    const uniqueHotels: ICanonicalHotel[] = [];

    for (const hotel of hotels) {
      const hotelId = hotel._id.toString();

      if (!seenIds.has(hotelId)) {
        seenIds.add(hotelId);
        uniqueHotels.push(hotel);
      }
    }

    return uniqueHotels;
  }

  private normalizeLocationField(
    field: keyof Pick<IHotelLocation, 'address' | 'locality' | 'postcode'>,
    value: string | null,
  ): string {
    if (field === 'postcode') {
      return normalizeRegistryPostcode(value);
    }

    return normalizeRegistryText(value);
  }

  private areStringArraysEqual(left: string[], right: string[]): boolean {
    return this.stableStringify([...left].sort()) === this.stableStringify([...right].sort());
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(value);
  }
}
