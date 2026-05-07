import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { GEO_MATCH_ACTION } from './constants/geo-match-action.enum';
import { CanonicalHotelForGeoMatchNotFoundError } from './errors/canonical-hotel-for-geo-match-not-found.error';
import { GeoHotelManualGeoConflictError } from './errors/geo-hotel-manual-geo-conflict.error';
import { GeoHotelManualGeoInvalidQueryError } from './errors/geo-hotel-manual-geo-invalid-query.error';
import { GeoHotelManualMatchConflictError } from './errors/geo-hotel-manual-match-conflict.error';
import { GeoHotelMatchInvalidIdError } from './errors/geo-hotel-match-invalid-id.error';
import { GeoMatchingController } from './geo-matching.controller';
import { IManualMatchHotelGeoCandidateResult } from './types/manual-match-hotel-geo-candidate-result.interface';
import { ISetManualCanonicalHotelGeoResult } from './types/set-manual-canonical-hotel-geo-result.interface';
import { ManualMatchHotelGeoCandidateUseCase } from './use-cases/manual-match-hotel-geo-candidate.use-case';
import { SetManualCanonicalHotelGeoUseCase } from './use-cases/set-manual-canonical-hotel-geo.use-case';

describe('GeoMatchingController', () => {
  let controller: GeoMatchingController;
  let manualMatchHotelGeoCandidateUseCase: {
    execute: jest.Mock<Promise<IManualMatchHotelGeoCandidateResult>, [unknown]>;
  };
  let setManualCanonicalHotelGeoUseCase: {
    execute: jest.Mock<Promise<ISetManualCanonicalHotelGeoResult>, [unknown]>;
  };

  beforeEach(async () => {
    manualMatchHotelGeoCandidateUseCase = {
      execute: jest.fn(),
    };
    setManualCanonicalHotelGeoUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoMatchingController],
      providers: [
        {
          provide: ManualMatchHotelGeoCandidateUseCase,
          useValue: manualMatchHotelGeoCandidateUseCase,
        },
        {
          provide: SetManualCanonicalHotelGeoUseCase,
          useValue: setManualCanonicalHotelGeoUseCase,
        },
      ],
    }).compile();

    controller = module.get<GeoMatchingController>(GeoMatchingController);
  });

  it('sets manual canonical hotel geo by query id and Google coordinates', async () => {
    const canonicalHotelId = new Types.ObjectId().toString();
    const resultFixture: ISetManualCanonicalHotelGeoResult = {
      action: GEO_MATCH_ACTION.MANUAL_GEO_SET,
      canonicalHotelId,
      canonicalHotelName: 'GATE TWENTY TWO BOUTIQUE',
      geo: {
        point: {
          coordinates: [33.3634435, 35.1696808],
          type: 'Point',
        },
        source: 'manual',
      },
      ok: true,
    };

    setManualCanonicalHotelGeoUseCase.execute.mockResolvedValue(resultFixture);

    await expect(
      controller.setManualCanonicalHotelGeo({
        canonicalHotelId,
        lat: '35.1696808',
        lng: '33.3634435',
      }),
    ).resolves.toEqual(resultFixture);
    expect(setManualCanonicalHotelGeoUseCase.execute).toHaveBeenCalledWith({
      canonicalHotelId,
      lat: '35.1696808',
      lng: '33.3634435',
    });
  });

  it('maps invalid manual canonical hotel geo coordinates to bad request responses', async () => {
    setManualCanonicalHotelGeoUseCase.execute.mockRejectedValue(
      new GeoHotelManualGeoInvalidQueryError('lat'),
    );

    await expect(
      controller.setManualCanonicalHotelGeo({
        canonicalHotelId: new Types.ObjectId().toString(),
        lat: '95',
        lng: '33.3634435',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps manual canonical hotel geo conflicts to conflict responses', async () => {
    setManualCanonicalHotelGeoUseCase.execute.mockRejectedValue(
      new GeoHotelManualGeoConflictError(),
    );

    await expect(
      controller.setManualCanonicalHotelGeo({
        canonicalHotelId: new Types.ObjectId().toString(),
        lat: '35.1696808',
        lng: '33.3634435',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
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
