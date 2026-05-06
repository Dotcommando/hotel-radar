import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { basename, isAbsolute, resolve } from 'path';
import { Injectable } from '@nestjs/common';
import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { GeoImportRunsService } from '../../geo-import-runs/geo-import-runs.service';
import { IGeoImportRunStats } from '../../geo-import-runs/types/geo-import-run-stats.interface';
import { HOTEL_GEO_CANDIDATE_UPSERT_RESULT } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-upsert-result.enum';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { IHotelGeoJsonGeometry } from '../../hotel-geo-candidates/types/hotel-geo-json-geometry.interface';
import { IHotelGeoPoint } from '../../hotel-geo-candidates/types/hotel-geo-point.interface';
import { IGeoImportRunResult } from '../types/geo-import-run-result.interface';
import { IGeoJsonFeature } from '../types/geo-json-feature.interface';
import { IGeoJsonFeatureCollection } from '../types/geo-json-feature-collection.interface';

@Injectable()
export class GeoJsonHotelCandidatesImportService {
  constructor(
    private readonly geoImportRunsService: GeoImportRunsService,
    private readonly hotelGeoCandidatesService: HotelGeoCandidatesService,
  ) {}

  async importOsmOverpassHotels(
    filePath: string,
  ): Promise<IGeoImportRunResult> {
    const absolutePath = this.resolveFilePath(filePath);
    const fileContent = await fs.readFile(absolutePath, 'utf8');
    const fileStats = await fs.stat(absolutePath);
    const fileSha256 = this.hashString(fileContent);
    const run = await this.geoImportRunsService.createRunningRun({
      fileName: basename(filePath),
      filePath,
      fileSha256,
      fileSizeBytes: fileStats.size,
      importKind: GEO_IMPORT_KIND.HOTELS,
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
    });
    const stats = this.buildEmptyStats();

    try {
      const collection = this.parseFeatureCollection(fileContent);

      for (const feature of collection.features) {
        stats.read += 1;

        try {
          const result = await this.importFeature(run._id, feature);

          this.incrementUpsertStats(stats, result);
        } catch {
          stats.failed += 1;
        }
      }

      stats.markedStale =
        await this.hotelGeoCandidatesService.markStaleMissingFromRun(
          run._id,
          GEO_SOURCE_TYPE.OSM,
          GEO_SOURCE_DATASET.OVERPASS_TURBO,
        );

      await this.geoImportRunsService.markCompleted(run._id, stats);

      return {
        importKind: GEO_IMPORT_KIND.HOTELS,
        ok: true,
        runId: run.runId,
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
        stats,
        status: GEO_IMPORT_RUN_STATUS.COMPLETED,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown geo import error';

      await this.geoImportRunsService.markFailed(run._id, message, stats);

      return {
        importKind: GEO_IMPORT_KIND.HOTELS,
        ok: false,
        runId: run.runId,
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
        stats,
        status: GEO_IMPORT_RUN_STATUS.FAILED,
      };
    }
  }

  private async importFeature(
    importRunId: Parameters<
      HotelGeoCandidatesService['upsertFromOsmOverpassFeature']
    >[0]['importRunId'],
    feature: IGeoJsonFeature,
  ): Promise<HOTEL_GEO_CANDIDATE_UPSERT_RESULT> {
    const sourceId = this.readSourceId(feature);
    const name = this.readStringProperty(feature.properties, 'name');
    const point = this.computeRepresentativePoint(feature.geometry);

    return this.hotelGeoCandidatesService.upsertFromOsmOverpassFeature({
      geometry: feature.geometry,
      geometryHash: this.hashValue(feature.geometry),
      importRunId,
      name,
      normalizedName: this.normalizeName(name),
      point,
      propertiesHash: this.hashValue(feature.properties),
      sourceId,
      sourceProperties: feature.properties,
    });
  }

  private parseFeatureCollection(
    fileContent: string,
  ): IGeoJsonFeatureCollection {
    const value: unknown = JSON.parse(fileContent);

    if (!this.isFeatureCollection(value)) {
      throw new Error('GeoJSON file is not a FeatureCollection.');
    }

    return value;
  }

  private isFeatureCollection(
    value: unknown,
  ): value is IGeoJsonFeatureCollection {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      value.type === 'FeatureCollection' &&
      Array.isArray(value.features) &&
      value.features.every((feature) => this.isFeature(feature))
    );
  }

  private isFeature(value: unknown): value is IGeoJsonFeature {
    if (!this.isRecord(value) || value.type !== 'Feature') {
      return false;
    }

    return (
      (typeof value.id === 'string' ||
        typeof value.id === 'number' ||
        value.id === undefined) &&
      this.isRecord(value.properties) &&
      this.isGeometry(value.geometry)
    );
  }

  private isGeometry(value: unknown): value is IHotelGeoJsonGeometry {
    return (
      this.isRecord(value) &&
      typeof value.type === 'string' &&
      'coordinates' in value
    );
  }

  private readSourceId(feature: IGeoJsonFeature): string {
    if (typeof feature.id === 'string' || typeof feature.id === 'number') {
      return String(feature.id);
    }

    const propertyId = feature.properties['@id'];

    if (typeof propertyId === 'string' || typeof propertyId === 'number') {
      return String(propertyId);
    }

    throw new Error('GeoJSON feature is missing source id.');
  }

  private readStringProperty(
    properties: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = properties[key];

    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  private computeRepresentativePoint(
    geometry: IHotelGeoJsonGeometry,
  ): IHotelGeoPoint {
    const positions: Array<[number, number]> = [];

    this.collectPositions(geometry.coordinates, positions);

    if (positions.length === 0) {
      throw new Error(`Cannot compute representative point for ${geometry.type}.`);
    }

    const sums = positions.reduce(
      (accumulator, [longitude, latitude]) => ({
        latitude: accumulator.latitude + latitude,
        longitude: accumulator.longitude + longitude,
      }),
      {
        latitude: 0,
        longitude: 0,
      },
    );

    return {
      coordinates: [
        sums.longitude / positions.length,
        sums.latitude / positions.length,
      ],
      type: 'Point',
    };
  }

  private collectPositions(
    value: unknown,
    positions: Array<[number, number]>,
  ): void {
    if (!Array.isArray(value)) {
      return;
    }

    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      positions.push([value[0], value[1]]);
      return;
    }

    for (const item of value) {
      this.collectPositions(item, positions);
    }
  }

  private normalizeName(name: string | null): string | null {
    const normalized =
      name
        ?.normalize('NFKC')
        .replace(/[.,;:()[\]{}]/g, ' ')
        .replace(/[/\\]/g, ' ')
        .replace(/[-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase() ?? '';

    return normalized.length > 0 ? normalized : null;
  }

  private incrementUpsertStats(
    stats: IGeoImportRunStats,
    result: HOTEL_GEO_CANDIDATE_UPSERT_RESULT,
  ): void {
    if (result === HOTEL_GEO_CANDIDATE_UPSERT_RESULT.INSERTED) {
      stats.inserted += 1;
      return;
    }

    if (result === HOTEL_GEO_CANDIDATE_UPSERT_RESULT.UPDATED) {
      stats.updated += 1;
      return;
    }

    stats.unchanged += 1;
  }

  private buildEmptyStats(): IGeoImportRunStats {
    return {
      failed: 0,
      inserted: 0,
      markedStale: 0,
      read: 0,
      unchanged: 0,
      updated: 0,
    };
  }

  private hashValue(value: unknown): string {
    return this.hashString(this.stableStringify(value));
  }

  private hashString(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (this.isRecord(value)) {
      return `{${Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`)
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private resolveFilePath(filePath: string): string {
    return isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
