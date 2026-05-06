import { Injectable } from '@nestjs/common';
import { BeachProfilesService } from '../../beach-profiles/beach-profiles.service';
import { BeachProfileNotFoundError } from '../errors/beach-profile-not-found.error';
import { IGetBeachProfileResult } from '../types/get-beach-profile-result.interface';

@Injectable()
export class GetBeachProfileUseCase {
  constructor(private readonly beachProfilesService: BeachProfilesService) {}

  async execute(id: string): Promise<IGetBeachProfileResult> {
    const beach = await this.beachProfilesService.findById(id);

    if (beach === null) {
      throw new BeachProfileNotFoundError();
    }

    return {
      item: beach,
      ok: true,
    };
  }
}
