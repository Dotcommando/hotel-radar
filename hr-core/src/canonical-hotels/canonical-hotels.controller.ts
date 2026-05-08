import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CanonicalHotelCanonicalNameNotUniqueError } from './errors/canonical-hotel-canonical-name-not-unique.error';
import { CanonicalHotelsService } from './services/canonical-hotels.service';
import { IGetCanonicalHotelResult } from './types/get-canonical-hotel-result.interface';

@Controller('canonical-hotels')
export class CanonicalHotelsController {
  constructor(
    private readonly canonicalHotelsService: CanonicalHotelsService,
  ) {}

  @Get('by-id')
  async getCanonicalHotelByQueryId(
    @Query('id') id: string | undefined,
  ): Promise<IGetCanonicalHotelResult> {
    if (id === undefined || id.trim().length === 0) {
      throw new BadRequestException({
        code: 'CANONICAL_HOTEL_ID_REQUIRED',
        message: 'Canonical hotel id is required.',
        ok: false,
      });
    }

    const canonicalHotelId = id.trim();

    if (!this.isValidObjectId(canonicalHotelId)) {
      throw new BadRequestException({
        code: 'INVALID_CANONICAL_HOTEL_ID',
        message: 'Canonical hotel id must be a valid ObjectId.',
        ok: false,
      });
    }

    const canonicalHotel =
      await this.canonicalHotelsService.findById(canonicalHotelId);

    if (canonicalHotel === null) {
      throw new NotFoundException({
        code: 'CANONICAL_HOTEL_NOT_FOUND',
        message: 'Canonical hotel was not found.',
        ok: false,
      });
    }

    return {
      canonicalHotel,
      ok: true,
    };
  }

  @Get('by-canonical-name')
  async getCanonicalHotelByCanonicalName(
    @Query('canonicalName') canonicalName: string | undefined,
  ): Promise<IGetCanonicalHotelResult> {
    if (canonicalName === undefined || canonicalName.trim().length === 0) {
      throw new BadRequestException({
        code: 'CANONICAL_HOTEL_CANONICAL_NAME_REQUIRED',
        message: 'Canonical hotel canonicalName is required.',
        ok: false,
      });
    }

    try {
      const canonicalHotel =
        await this.canonicalHotelsService.findUniqueByCanonicalName(
          canonicalName.trim(),
        );

      if (canonicalHotel === null) {
        throw new NotFoundException({
          code: 'CANONICAL_HOTEL_NOT_FOUND',
          message: 'Canonical hotel was not found.',
          ok: false,
        });
      }

      return {
        canonicalHotel,
        ok: true,
      };
    } catch (error) {
      if (error instanceof CanonicalHotelCanonicalNameNotUniqueError) {
        throw new ConflictException({
          code: 'CANONICAL_HOTEL_CANONICAL_NAME_NOT_UNIQUE',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  private isValidObjectId(value: string): boolean {
    return (
      Types.ObjectId.isValid(value) &&
      new Types.ObjectId(value).toString() === value.toLowerCase()
    );
  }
}
