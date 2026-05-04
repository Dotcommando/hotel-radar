import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CANONICAL_HOTEL_PROCESSING_ACTION } from '../canonical-hotels/constants/canonical-hotel-processing-action.enum';
import { ICanonicalHotelCandidateReview } from '../canonical-hotels/types/apply-canonical-hotel-candidate-result.interface';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import { IHotelRegistryEntry } from '../hotel-registry-entries/types/hotel-registry-entry.interface';
import { CANONICAL_HOTEL_CANDIDATE_MODEL_NAME } from './constants/canonical-hotel-candidate-model-name.constant';
import { ICanonicalHotelCandidate } from './types/canonical-hotel-candidate.interface';
import { CanonicalHotelCandidateBuilderService } from './services/canonical-hotel-candidate-builder.service';
import { ICreateCanonicalHotelCandidate } from './types/create-canonical-hotel-candidate.interface';

@Injectable()
export class CanonicalHotelCandidatesService {
  constructor(
    @InjectModel(CANONICAL_HOTEL_CANDIDATE_MODEL_NAME)
    private readonly canonicalHotelCandidateModel: Model<ICanonicalHotelCandidate>,
    private readonly canonicalHotelCandidateBuilderService: CanonicalHotelCandidateBuilderService,
  ) {}

  async upsertFromRegistryEntries(
    entries: IHotelRegistryEntry[],
  ): Promise<ICanonicalHotelCandidate> {
    const candidateFields =
      this.canonicalHotelCandidateBuilderService.buildFromRegistryEntries(
        entries,
      );

    await this.deleteObsoleteSingleCandidates(
      entries,
      candidateFields.candidateKey,
    );

    return this.upsertCandidateFields(candidateFields);
  }

  async upsertAmbiguousBaseCandidate(
    entry: IHotelRegistryEntry,
  ): Promise<ICanonicalHotelCandidate> {
    const candidateFields =
      this.canonicalHotelCandidateBuilderService.buildAmbiguousBaseCandidate(
        entry,
      );

    return this.upsertCandidateFields(candidateFields);
  }

  async deleteManyByIds(ids: Types.ObjectId[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.canonicalHotelCandidateModel
      .deleteMany({
        _id: {
          $in: ids,
        },
      })
      .exec();

    return result.deletedCount ?? 0;
  }

  async initializeMissingProcessing(): Promise<number> {
    const result = await this.canonicalHotelCandidateModel
      .updateMany(
        {
          processing: {
            $exists: false,
          },
        },
        {
          $set: {
            processing: this.buildDefaultProcessing(),
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  async recoverStaleClaimedDocuments(staleBefore: Date): Promise<number> {
    const result = await this.canonicalHotelCandidateModel
      .updateMany(
        {
          'processing.claimedAt': {
            $lt: staleBefore,
          },
          'processing.status': HOTEL_PROCESSING_STATUS.CLAIMED,
        },
        {
          $set: {
            'processing.action': null,
            'processing.canonicalHotelId': null,
            'processing.claimedAt': null,
            'processing.error': null,
            'processing.review': null,
            'processing.runId': null,
            'processing.status': HOTEL_PROCESSING_STATUS.PENDING,
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  async countByProcessingStatus(
    status: HOTEL_PROCESSING_STATUS,
  ): Promise<number> {
    return this.canonicalHotelCandidateModel
      .countDocuments({
        'processing.status': status,
      })
      .exec();
  }

  async resetReviewRequiredToPending(): Promise<number> {
    const result = await this.canonicalHotelCandidateModel
      .updateMany(
        {
          'processing.status': HOTEL_PROCESSING_STATUS.REVIEW_REQUIRED,
        },
        {
          $set: {
            'processing.action': null,
            'processing.canonicalHotelId': null,
            'processing.claimedAt': null,
            'processing.error': null,
            'processing.processedAt': null,
            'processing.review': null,
            'processing.runId': null,
            'processing.status': HOTEL_PROCESSING_STATUS.PENDING,
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  async claimPendingForRun(
    runId: string,
    batchSize: number,
  ): Promise<ICanonicalHotelCandidate[]> {
    const claimedAt = new Date();
    const claimedCandidates: ICanonicalHotelCandidate[] = [];

    for (let index = 0; index < batchSize; index += 1) {
      const candidate = await this.canonicalHotelCandidateModel
        .findOneAndUpdate(
          {
            'processing.status': HOTEL_PROCESSING_STATUS.PENDING,
          },
          {
            $set: {
              'processing.claimedAt': claimedAt,
              'processing.error': null,
              'processing.runId': runId,
              'processing.status': HOTEL_PROCESSING_STATUS.CLAIMED,
            },
          },
          {
            returnDocument: 'after',
            sort: {
              _id: 1,
            },
          },
        )
        .exec();

      if (candidate === null) {
        break;
      }

      claimedCandidates.push(candidate);
    }

    return claimedCandidates;
  }

  async markCanonicalProcessed(
    candidateId: Types.ObjectId,
    canonicalHotelId: Types.ObjectId,
    runId: string,
    action: CANONICAL_HOTEL_PROCESSING_ACTION,
  ): Promise<void> {
    await this.canonicalHotelCandidateModel
      .updateOne(
        {
          _id: candidateId,
        },
        {
          $set: {
            'processing.action': action,
            'processing.canonicalHotelId': canonicalHotelId,
            'processing.claimedAt': null,
            'processing.error': null,
            'processing.processedAt': new Date(),
            'processing.review': null,
            'processing.runId': runId,
            'processing.status': HOTEL_PROCESSING_STATUS.PROCESSED,
          },
        },
      )
      .exec();
  }

  async markCanonicalReviewRequired(
    candidateId: Types.ObjectId,
    runId: string,
    review: ICanonicalHotelCandidateReview,
  ): Promise<void> {
    await this.canonicalHotelCandidateModel
      .updateOne(
        {
          _id: candidateId,
        },
        {
          $set: {
            'processing.action':
              CANONICAL_HOTEL_PROCESSING_ACTION.REVIEW_REQUIRED,
            'processing.canonicalHotelId': null,
            'processing.claimedAt': null,
            'processing.error': null,
            'processing.processedAt': new Date(),
            'processing.review': review,
            'processing.runId': runId,
            'processing.status': HOTEL_PROCESSING_STATUS.REVIEW_REQUIRED,
          },
        },
      )
      .exec();
  }

  async markCanonicalFailed(
    candidateId: Types.ObjectId,
    error: string,
  ): Promise<void> {
    await this.canonicalHotelCandidateModel
      .updateOne(
        {
          _id: candidateId,
        },
        {
          $set: {
            'processing.claimedAt': null,
            'processing.error': error,
            'processing.processedAt': new Date(),
            'processing.status': HOTEL_PROCESSING_STATUS.FAILED,
          },
        },
      )
      .exec();
  }

  private async upsertCandidateFields(
    candidateFields: ICreateCanonicalHotelCandidate,
  ): Promise<ICanonicalHotelCandidate> {
    const now = new Date();

    await this.canonicalHotelCandidateModel
      .updateOne(
        {
          candidateKey: candidateFields.candidateKey,
        },
        {
          $set: {
            ...candidateFields,
            processing: this.buildDefaultProcessing(),
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        {
          upsert: true,
        },
      )
      .exec();

    const candidate = await this.canonicalHotelCandidateModel
      .findOne({
        candidateKey: candidateFields.candidateKey,
      })
      .exec();

    if (candidate === null) {
      throw new Error(
        `Failed to upsert canonical hotel candidate: ${candidateFields.candidateKey}`,
      );
    }

    return candidate;
  }

  private buildDefaultProcessing(): ICanonicalHotelCandidate['processing'] {
    return {
      action: null,
      canonicalHotelId: null,
      claimedAt: null,
      error: null,
      processedAt: null,
      review: null,
      runId: null,
      status: HOTEL_PROCESSING_STATUS.PENDING,
    };
  }

  private async deleteObsoleteSingleCandidates(
    entries: IHotelRegistryEntry[],
    nextCandidateKey: string,
  ): Promise<void> {
    if (entries.length < 2) {
      return;
    }

    const obsoleteCandidateKeys = entries
      .map(({ registryKey }) => `ccv1|single|${registryKey}`)
      .filter((candidateKey) => candidateKey !== nextCandidateKey);

    if (obsoleteCandidateKeys.length === 0) {
      return;
    }

    await this.canonicalHotelCandidateModel
      .deleteMany({
        candidateKey: {
          $in: obsoleteCandidateKeys,
        },
      })
      .exec();
  }
}
