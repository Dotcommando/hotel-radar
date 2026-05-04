import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
