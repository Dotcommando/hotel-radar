import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../canonical-hotel-candidates/constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_KIND } from '../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { CANONICAL_HOTEL_STATUS } from './constants/canonical-hotel-status.enum';
import { HOTEL_DECLARED_WEBSITE_KIND } from './constants/hotel-declared-website-kind.enum';
import { HOTEL_WEB_PRESENCE_SOURCE } from './constants/hotel-web-presence-source.enum';
import { CanonicalHotelCanonicalNameNotUniqueError } from './errors/canonical-hotel-canonical-name-not-unique.error';
import { CanonicalHotelsService } from './services/canonical-hotels.service';
import { ICanonicalHotel } from './types/canonical-hotel.interface';
import { CanonicalHotelsController } from './canonical-hotels.controller';

describe('CanonicalHotelsController', () => {
  let controller: CanonicalHotelsController;
  let canonicalHotelsService: {
    findById: jest.Mock<Promise<ICanonicalHotel | null>, [string]>;
    findUniqueByCanonicalName: jest.Mock<
      Promise<ICanonicalHotel | null>,
      [string]
    >;
  };

  beforeEach(async () => {
    canonicalHotelsService = {
      findById: jest.fn(),
      findUniqueByCanonicalName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CanonicalHotelsController],
      providers: [
        {
          provide: CanonicalHotelsService,
          useValue: canonicalHotelsService,
        },
      ],
    }).compile();

    controller = module.get<CanonicalHotelsController>(
      CanonicalHotelsController,
    );
  });

  it('returns canonical hotel by query id', async () => {
    const hotel = buildCanonicalHotelFixture();
    canonicalHotelsService.findById.mockResolvedValue(hotel);

    await expect(
      controller.getCanonicalHotelByQueryId(hotel._id.toString()),
    ).resolves.toEqual({
      canonicalHotel: hotel,
      ok: true,
    });
    expect(canonicalHotelsService.findById).toHaveBeenCalledWith(
      hotel._id.toString(),
    );
  });

  it('rejects missing canonical hotel query id', async () => {
    await expect(
      controller.getCanonicalHotelByQueryId(''),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(canonicalHotelsService.findById).not.toHaveBeenCalled();
  });

  it('rejects invalid canonical hotel query id', async () => {
    await expect(
      controller.getCanonicalHotelByQueryId('not-an-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(canonicalHotelsService.findById).not.toHaveBeenCalled();
  });

  it('maps missing canonical hotel by id to not found', async () => {
    canonicalHotelsService.findById.mockResolvedValue(null);

    await expect(
      controller.getCanonicalHotelByQueryId(
        new Types.ObjectId('69f88432878f7fca1f7e0c16').toString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns canonical hotel by canonical name', async () => {
    const hotel = buildCanonicalHotelFixture({
      canonicalName: 'TSOKKOS GARDENS',
    });
    canonicalHotelsService.findUniqueByCanonicalName.mockResolvedValue(hotel);

    await expect(
      controller.getCanonicalHotelByCanonicalName('TSOKKOS GARDENS'),
    ).resolves.toEqual({
      canonicalHotel: hotel,
      ok: true,
    });
    expect(
      canonicalHotelsService.findUniqueByCanonicalName,
    ).toHaveBeenCalledWith('TSOKKOS GARDENS');
  });

  it('rejects missing canonical name', async () => {
    await expect(
      controller.getCanonicalHotelByCanonicalName(' '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      canonicalHotelsService.findUniqueByCanonicalName,
    ).not.toHaveBeenCalled();
  });

  it('maps missing canonical hotel by canonical name to not found', async () => {
    canonicalHotelsService.findUniqueByCanonicalName.mockResolvedValue(null);

    await expect(
      controller.getCanonicalHotelByCanonicalName('UNKNOWN'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps non-unique canonical name to conflict', async () => {
    canonicalHotelsService.findUniqueByCanonicalName.mockRejectedValue(
      new CanonicalHotelCanonicalNameNotUniqueError('TSOKKOS GARDENS'),
    );

    await expect(
      controller.getCanonicalHotelByCanonicalName('TSOKKOS GARDENS'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

function buildCanonicalHotelFixture(
  overrides: Partial<ICanonicalHotel> = {},
): ICanonicalHotel {
  const now = new Date('2026-05-08T09:00:00.000Z');
  const canonicalName = overrides.canonicalName ?? 'CANONICAL HOTEL';

  return {
    _id: new Types.ObjectId('69f88432878f7fca1f7e0c16'),
    canonicalKey: `chv1|${canonicalName}`,
    canonicalName,
    capacity: {
      beds: 10,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 5,
    },
    components: [],
    contacts: {
      domains: [],
      emails: [],
      phones: [],
      websites: [],
    },
    createdAt: now,
    firstSeenAt: now,
    geo: {
      point: null,
      source: null,
    },
    issues: [],
    kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
    lastSeenAt: now,
    location: {
      address: null,
      district: null,
      locality: null,
      postcode: null,
    },
    operator: null,
    source: {
      lastCandidateBuildRule: 'single_registry_entry',
      lastCandidateBuildRuleVersion: 1,
      lastCandidateKey: `ccv1|${canonicalName}`,
      lastCandidateSeenAt: now,
      origin: 'gov_registry',
    },
    status: CANONICAL_HOTEL_STATUS.ACTIVE,
    updatedAt: now,
    webPresence: {
      declaredWebsiteKind: HOTEL_DECLARED_WEBSITE_KIND.MISSING,
      domains: [],
      hasDeclaredWebsite: false,
      issues: [],
      source: HOTEL_WEB_PRESENCE_SOURCE.GOV_REGISTRY,
      websites: [],
    },
    ...overrides,
  };
}
