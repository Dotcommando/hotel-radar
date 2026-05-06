import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { GEO_MATCH_ACTION } from './constants/geo-match-action.enum';
import { CanonicalHotelForGeoMatchNotFoundError } from './errors/canonical-hotel-for-geo-match-not-found.error';
import { GeoHotelManualMatchConflictError } from './errors/geo-hotel-manual-match-conflict.error';
import { GeoHotelMatchInvalidIdError } from './errors/geo-hotel-match-invalid-id.error';
import { GeoMatchingController } from './geo-matching.controller';
import { IManualMatchHotelGeoCandidateResult } from './types/manual-match-hotel-geo-candidate-result.interface';
import { ManualMatchHotelGeoCandidateUseCase } from './use-cases/manual-match-hotel-geo-candidate.use-case';

describe('GeoMatchingController', () => {
  let controller: GeoMatchingController;
  let manualMatchHotelGeoCandidateUseCase: {
    execute: jest.Mock<Promise<IManualMatchHotelGeoCandidateResult>, [unknown]>;
  };

  beforeEach(async () => {
    manualMatchHotelGeoCandidateUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoMatchingController],
      providers: [
        {
          provide: ManualMatchHotelGeoCandidateUseCase,
          useValue: manualMatchHotelGeoCandidateUseCase,
        },
      ],
    }).compile();

    controller = module.get<GeoMatchingController>(GeoMatchingController);
  });

  it('manually matches a canonical hotel to a hotel geo candidate by query ids', async () => {
    const canonicalHotelId = new Types.ObjectId().toString();
    const hotelGeoCandidateId = new Types.ObjectId().toString();
    const resultFixture: IManualMatchHotelGeoCandidateResult = {
      action: GEO_MATCH_ACTION.MANUAL_MATCHED,
      canonicalHotelId,
      canonicalHotelName: 'NICOLAS COLOR',
      hotelGeoCandidateId,
      hotelGeoCandidateName: 'Nicholas Color Hotel',
      hotelGeoCandidateSourceId: 'relation/1',
      ok: true,
    };

    manualMatchHotelGeoCandidateUseCase.execute.mockResolvedValue(resultFixture);

    await expect(
      controller.manualMatchHotelCandidateById({
        canonicalHotelId,
        hotelGeoCandidateId,
      }),
    ).resolves.toEqual(resultFixture);
    expect(manualMatchHotelGeoCandidateUseCase.execute).toHaveBeenCalledWith({
      canonicalHotelId,
      hotelGeoCandidateId,
    });
  });

  it('maps invalid manual match ids to bad request responses', async () => {
    manualMatchHotelGeoCandidateUseCase.execute.mockRejectedValue(
      new GeoHotelMatchInvalidIdError('canonicalHotelId'),
    );

    await expect(
      controller.manualMatchHotelCandidateById({
        canonicalHotelId: 'not-an-id',
        hotelGeoCandidateId: new Types.ObjectId().toString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps missing canonical hotels for manual match to not found responses', async () => {
    manualMatchHotelGeoCandidateUseCase.execute.mockRejectedValue(
      new CanonicalHotelForGeoMatchNotFoundError(new Types.ObjectId().toString()),
    );

    await expect(
      controller.manualMatchHotelCandidateById({
        canonicalHotelId: new Types.ObjectId().toString(),
        hotelGeoCandidateId: new Types.ObjectId().toString(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps manual match conflicts to conflict responses', async () => {
    manualMatchHotelGeoCandidateUseCase.execute.mockRejectedValue(
      new GeoHotelManualMatchConflictError(),
    );

    await expect(
      controller.manualMatchHotelCandidateById({
        canonicalHotelId: new Types.ObjectId().toString(),
        hotelGeoCandidateId: new Types.ObjectId().toString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
