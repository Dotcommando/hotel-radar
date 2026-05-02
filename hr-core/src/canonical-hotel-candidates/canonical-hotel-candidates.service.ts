import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IHotelRegistryEntry } from '../hotel-registry-entries/types/hotel-registry-entry.interface';
import { CANONICAL_HOTEL_CANDIDATE_MODEL_NAME } from './constants/canonical-hotel-candidate-model-name.constant';
import { ICanonicalHotelCandidate } from './types/canonical-hotel-candidate.interface';
import { CanonicalHotelCandidateBuilderService } from './services/canonical-hotel-candidate-builder.service';

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
}
