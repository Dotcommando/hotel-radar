import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { basename, isAbsolute, resolve } from 'path';
import { Injectable } from '@nestjs/common';
import { BEACH_GEOMETRY_KIND } from '../../beach-profiles/constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_UPSERT_RESULT } from '../../beach-profiles/constants/beach-profile-upsert-result.enum';
import { BEACH_TYPE } from '../../beach-profiles/constants/beach-type.enum';
import { BeachProfilesService } from '../../beach-profiles/beach-profiles.service';
import { IBeachGeoJsonGeometry } from '../../beach-profiles/types/beach-geo-json-geometry.interface';
import { IBeachGeoPoint } from '../../beach-profiles/types/beach-geo-point.interface';
import { VERSIONED_DATASET } from '../../data-versioning/constants/versioned-dataset.enum';
import { DataVersioningService } from '../../data-versioning/data-versioning.service';
import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { GeoImportRunsService } from '../../geo-import-runs/geo-import-runs.service';
import { IGeoImportRunStats } from '../../geo-import-runs/types/geo-import-run-stats.interface';
import { IGeoImportRunResult } from '../types/geo-import-run-result.interface';

interface IBeachGeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: IBeachGeoJsonGeometry;
}

interface IBeachGeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: IBeachGeoJsonFeature[];
}

@Injectable()
export class GeoJsonBeachProfilesImportService {
  constructor(
    private readonly geoImportRunsService: GeoImportRunsService,
    private readonly beachProfilesService: BeachProfilesService,
    private readonly dataVersioningService: DataVersioningService,
  ) {}

  async importOsmOverpassBeaches(
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
      importKind: GEO_IMPORT_KIND.BEACHES,
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
    });
    const datasetVersion =
      await this.dataVersioningService.reserveNextDatasetVersion({
        dataset: VERSIONED_DATASET.BEACH_PROFILES,
        sourceRunId: run.runId,
      });
    const stats = this.buildEmptyStats();

    try {
      const collection = this.parseFeatureCollection(fileContent);

      for (const feature of collection.features) {
        stats.read += 1;

        try {
          const result = await this.importFeature(
            run._id,
            feature,
            datasetVersion,
          );

          this.incrementUpsertStats(stats, result);
        } catch {
          stats.failed += 1;
        }
      }

      stats.markedStale =
        await this.beachProfilesService.markStaleMissingFromRun(
          run._id,
          GEO_SOURCE_TYPE.OSM,
          GEO_SOURCE_DATASET.OVERPASS_TURBO,
        );

      await this.beachProfilesService.markAllWithDatasetVersion(datasetVersion);
      await this.dataVersioningService.publishDatasetVersion({
        dataset: VERSIONED_DATASET.BEACH_PROFILES,
        version: datasetVersion,
      });
      await this.geoImportRunsService.markCompleted(run._id, stats);

      return {
        importKind: GEO_IMPORT_KIND.BEACHES,
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
        importKind: GEO_IMPORT_KIND.BEACHES,
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
      BeachProfilesService['upsertFromOsmOverpassFeature']
    >[0]['importRunId'],
    feature: IBeachGeoJsonFeature,
    datasetVersion: number,
  ): Promise<BEACH_PROFILE_UPSERT_RESULT> {
    const sourceId = this.readSourceId(feature);
    const name = this.readStringProperty(feature.properties, 'name');

    return this.beachProfilesService.upsertFromOsmOverpassFeature({
      beachType: this.resolveBeachType(feature.properties),
      datasetVersion,
      geometry: feature.geometry,
      geometryHash: this.hashValue(feature.geometry),
      geometryKind: this.resolveGeometryKind(feature.geometry),
      importRunId,
      name,
      normalizedName: this.normalizeName(name),
      point: this.computeRepresentativePoint(feature.geometry),
      propertiesHash: this.hashValue(feature.properties),
      sourceId,
      sourceProperties: feature.properties,
    });
  }

  private parseFeatureCollection(
    fileContent: string,
  ): IBeachGeoJsonFeatureCollection {
    const value: unknown = JSON.parse(fileContent);

    if (!this.isFeatureCollection(value)) {
      throw new Error('GeoJSON file is not a FeatureCollection.');
    }

    return value;
  }

  private isFeatureCollection(
    value: unknown,
  ): value is IBeachGeoJsonFeatureCollection {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      value.type === 'FeatureCollection' &&
      Array.isArray(value.features) &&
      value.features.every((feature) => this.isFeature(feature))
    );
  }

  private isFeature(value: unknown): value is IBeachGeoJsonFeature {
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

  private isGeometry(value: unknown): value is IBeachGeoJsonGeometry {
    return (
      this.isRecord(value) &&
      typeof value.type === 'string' &&
      'coordinates' in value
    );
  }

  private readSourceId(feature: IBeachGeoJsonFeature): string {
    if (typeof feature.id === 'string' || typeof feature.id === 'number') {
      return String(feature.id);
    }

    const propertyId = feature.properties['@id'];

    if (typeof propertyId === 'string' || typeof propertyId === 'number') {
      return String(propertyId);
    }

    throw new Error('GeoJSON feature is missing source id.');
  }

  private resolveGeometryKind(
    geometry: IBeachGeoJsonGeometry,
  ): BEACH_GEOMETRY_KIND {
    if (geometry.type === 'Point' || geometry.type === 'MultiPoint') {
      return BEACH_GEOMETRY_KIND.POINT;
    }

    if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
      return BEACH_GEOMETRY_KIND.LINE;
    }

    return BEACH_GEOMETRY_KIND.AREA;
  }

  private resolveBeachType(properties: Record<string, unknown>): BEACH_TYPE {
    const surface = this.normalizeText(
      this.readStringProperty(properties, 'surface'),
    );

    if (surface.includes('SAND')) {
      return BEACH_TYPE.SAND;
    }

    if (surface.includes('PEBBLE') || surface.includes('GRAVEL')) {
      return BEACH_TYPE.PEBBLE;
    }

    if (surface.includes('ROCK')) {
      return BEACH_TYPE.ROCKY;
    }

    return BEACH_TYPE.UNKNOWN;
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
    geometry: IBeachGeoJsonGeometry,
  ): IBeachGeoPoint {
    const positions: Array<[number, number]> = [];

    this.collectPositions(geometry.coordinates, positions);

    if (positions.length === 0) {
      throw new Error(
        `Cannot compute representative point for ${geometry.type}.`,
      );
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
    const normalized = this.normalizeText(name);

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeText(value: string | null): string {
    return (
      value
        ?.normalize('NFKC')
        .replace(/[.,;:()[\]{}]/g, ' ')
        .replace(/[/\\]/g, ' ')
        .replace(/[-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase() ?? ''
    );
  }

  private incrementUpsertStats(
    stats: IGeoImportRunStats,
    result: BEACH_PROFILE_UPSERT_RESULT,
  ): void {
    if (result === BEACH_PROFILE_UPSERT_RESULT.INSERTED) {
      stats.inserted += 1;
      return;
    }

    if (result === BEACH_PROFILE_UPSERT_RESULT.UPDATED) {
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
        .map(
          (key) => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`,
        )
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
