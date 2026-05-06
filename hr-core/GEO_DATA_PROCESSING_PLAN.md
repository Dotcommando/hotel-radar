# GEO_DATA_PROCESSING_PLAN.md

## Purpose

This document describes the planned processing pipeline for geo data used by `hr-core` in the hotel radar project.

The goal is to import free geo data into MongoDB and use it later for:

- matching external hotel geo objects to `canonical_hotels`;
- storing hotel geo candidates from OSM and later Foursquare OS Places;
- storing beach geometries and beach profiles;
- calculating distances from hotels to beaches and other POI;
- periodically refreshing geo sources and detecting changes.

The current focus is OSM data. Foursquare OS Places will be added later as a separate source.

## Expected source files

The following files are expected to exist in the project:

```txt
hr-core/data/raw/osm/overpass/hotels.geojson
hr-core/data/raw/osm/overpass/beaches.geojson
hr-core/data/raw/osm/geofabrik/cyprus-latest.osm.pbf
hr-core/data/raw/osm/geofabrik/cyprus-latest-free.gpkg/cyprus.gpkg
```

They are all OSM-derived data.

`hr-core/data/raw/osm/overpass` is for manual or API-driven Overpass exports.

`hr-core/data/raw/osm/geofabrik` is for full Geofabrik extracts and Geofabrik-derived GIS files.

`hr-core/data/raw/fsq` is reserved for future Foursquare OS Places exports. OSM/Geofabrik files do not belong there.

## Current file layout

```txt
hr-core/data/raw/osm/
  overpass/
    hotels.geojson
    beaches.geojson

  geofabrik/
    cyprus-latest.osm.pbf
    cyprus-latest-free.gpkg.zip
    cyprus-latest-free.gpkg/
      cyprus.gpkg

hr-core/data/raw/fsq/
  # reserved for future Foursquare OS Places exports
  # example future file:
  # fsq-os-places-cyprus.csv
```

The `.zip` file is optional after extraction, but if it is kept, it should remain under `hr-core/data/raw/osm/geofabrik`.

## Meaning of each source file

### `hr-core/data/raw/osm/overpass/hotels.geojson`

Manual export from Overpass Turbo.

Contains hotel-like OSM objects matching tags such as:

```txt
tourism=hotel
tourism=apartment
tourism=guest_house
tourism=hostel
tourism=resort
```

This file is not the canonical hotel list. It is an external geo candidate list.

Current count observed:

```txt
1358 features
```

This count is expected to differ significantly from the project's approximately 700 canonical hotels. OSM may contain villas, apartments, guest houses, duplicated nodes/polygons, resort components, objects outside the Republic of Cyprus, objects in Northern Cyprus, and other hotel-like entities.

Do not filter Northern Cyprus at import time. The project should keep full-island geo data in MongoDB and classify/filter regions later at product/reporting level.

### `hr-core/data/raw/osm/overpass/beaches.geojson`

Manual export from Overpass Turbo.

Contains OSM beach-like objects such as:

```txt
natural=beach
leisure=beach_resort
```

Current count observed:

```txt
332 features
```

Current geometry distribution observed:

```txt
1 LineString
56 Point
275 Polygon
```

This is good enough for a first import. Most beaches already have polygon geometry.

### `hr-core/data/raw/osm/geofabrik/cyprus-latest.osm.pbf`

Full raw OSM extract for Cyprus from Geofabrik.

This is the future preferred source for repeatable local extraction. It can be processed with tools such as `osmium-tool`.

It should not be parsed first. The current import should start from the smaller Overpass GeoJSON files.

### `hr-core/data/raw/osm/geofabrik/cyprus-latest-free.gpkg/cyprus.gpkg`

GeoPackage generated from the same OSM source family.

This is useful for inspection in QGIS and for experiments via GDAL/OGR tools such as `ogrinfo` and `ogr2ogr`.

It is not the first-choice input for the MongoDB importer. The first-choice input is GeoJSON because it is simpler to process in the NestJS service.

## Should Northern Cyprus be filtered out?

No. At this stage, do not filter it out.

Keep full-island geo data in MongoDB. Later, product features can decide whether to operate on:

```txt
FULL_ISLAND
REPUBLIC_OF_CYPRUS_ONLY
CUSTOM_REGION
```

This can be represented later by adding region classification fields, not by deleting data at import time.

## MongoDB collections

The first version should create/import into these collections:

```txt
geo_import_runs
hotel_geo_candidates
beach_profiles
```

Later, when Foursquare OS Places and other POI sources are added, add:

```txt
poi_places
hotel_nearby_places
hotel_area_scores
geo_source_change_events
```

Do not import OSM hotel objects directly into `canonical_hotels`.

## Collection: `geo_import_runs`

Purpose: store metadata about every import run.

Recommended shape:

```ts
{
  _id: ObjectId,

  sourceType: "OSM" | "FSQ_OS_PLACES",
  sourceDataset: "OVERPASS_TURBO" | "GEOFABRIK_PBF" | "GEOFABRIK_GPKG" | "FSQ_PORTAL_EXPORT",
  importKind: "HOTELS" | "BEACHES" | "FULL_EXTRACT" | "POI",

  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED",

  filePath: string,
  fileName: string,
  fileSizeBytes: number | null,
  fileSha256: string | null,

  startedAt: Date,
  finishedAt: Date | null,

  stats: {
    read: number,
    inserted: number,
    updated: number,
    unchanged: number,
    markedStale: number,
    failed: number
  },

  error: string | null,

  createdAt: Date,
  updatedAt: Date
}
```

Recommended indexes:

```js
db.geo_import_runs.createIndex({ sourceType: 1, sourceDataset: 1, importKind: 1, startedAt: -1 })
db.geo_import_runs.createIndex({ status: 1, startedAt: -1 })
```

## Collection: `hotel_geo_candidates`

Purpose: store external hotel-like geo objects from OSM and later Foursquare/Google/commercial sources.

These records are candidates for matching to `canonical_hotels`, not canonical hotels themselves.

Recommended shape:

```ts
{
  _id: ObjectId,

  source: {
    type: "OSM" | "FSQ_OS_PLACES" | "GOOGLE_PLACES" | "COMMERCIAL_PROVIDER" | "MANUAL",
    dataset: "OVERPASS_TURBO" | "GEOFABRIK_PBF" | "FSQ_PORTAL_EXPORT" | "GOOGLE_PLACES_API" | "MANUAL_REVIEW",
    id: string,
    importRunId: ObjectId
  },

  canonicalHotelId: ObjectId | null,
  componentId: string | null,

  matchStatus: "UNMATCHED" | "AUTO_MATCHED" | "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED",
  matchReasons: string[],

  name: string | null,
  normalizedName: string | null,

  point: {
    type: "Point",
    coordinates: [number, number]
  },

  geometry: {
    type: "Point" | "LineString" | "Polygon" | "MultiPolygon",
    coordinates: unknown
  },

  sourceProperties: Record<string, unknown>,

  sourceHashes: {
    propertiesHash: string,
    geometryHash: string
  },

  lifecycle: {
    status: "ACTIVE" | "STALE" | "REMOVED_FROM_SOURCE",
    firstSeenAt: Date,
    lastSeenAt: Date,
    notSeenSince: Date | null
  },

  createdAt: Date,
  updatedAt: Date
}
```

Example source object from OSM:

```json
{
  "type": "Feature",
  "properties": {
    "@id": "relation/2677825",
    "fax": "+357 23820280",
    "name": "Sunny Coast Hotel Apts",
    "phone": "+357 23822200",
    "stars": "4",
    "tourism": "hotel",
    "type": "multipolygon",
    "@geometry": "center"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [
      34.0116723,
      35.0542236
    ]
  },
  "id": "relation/2677825"
}
```

Do not store both `sourceProperties` and a full `sourceFeature`. That would duplicate `properties` unnecessarily. Store normalized fields, `sourceProperties`, and `geometry`.

Recommended indexes:

```js
db.hotel_geo_candidates.createIndex({ "source.type": 1, "source.dataset": 1, "source.id": 1 }, { unique: true })
db.hotel_geo_candidates.createIndex({ point: "2dsphere" })
db.hotel_geo_candidates.createIndex({ canonicalHotelId: 1, componentId: 1, matchStatus: 1 })
db.hotel_geo_candidates.createIndex({ normalizedName: 1 })
db.hotel_geo_candidates.createIndex({ matchStatus: 1, updatedAt: -1 })
```

## Collection: `beach_profiles`

Purpose: store beaches as first-class product entities.

Beaches should not be treated as ordinary POI only. They are important for future hotel analysis: nearest beach, walking distance, beach access score, family friendliness, beach type, facilities, and tourist positioning.

Recommended shape:

```ts
{
  _id: ObjectId,

  source: {
    type: "OSM" | "CYPRUS_OPEN_DATA" | "MANUAL",
    dataset: "OVERPASS_TURBO" | "GEOFABRIK_PBF" | "MANUAL_REVIEW",
    id: string,
    importRunId: ObjectId
  },

  name: string | null,
  normalizedName: string | null,

  point: {
    type: "Point",
    coordinates: [number, number]
  },

  geometry: {
    type: "Point" | "LineString" | "Polygon" | "MultiPolygon",
    coordinates: unknown
  },

  geometryKind: "POINT" | "LINE" | "AREA",

  sourceProperties: Record<string, unknown>,

  sourceHashes: {
    propertiesHash: string,
    geometryHash: string
  },

  beachType: "SAND" | "PEBBLE" | "ROCKY" | "MIXED" | "UNKNOWN",

  quality: {
    status: "RAW" | "NORMALIZED" | "NEEDS_REVIEW" | "VERIFIED",
    confidence: "LOW" | "MEDIUM" | "HIGH",
    reasons: string[]
  },

  lifecycle: {
    status: "ACTIVE" | "STALE" | "REMOVED_FROM_SOURCE",
    firstSeenAt: Date,
    lastSeenAt: Date,
    notSeenSince: Date | null
  },

  createdAt: Date,
  updatedAt: Date
}
```

Recommended indexes:

```js
db.beach_profiles.createIndex({ "source.type": 1, "source.dataset": 1, "source.id": 1 }, { unique: true })
db.beach_profiles.createIndex({ point: "2dsphere" })
db.beach_profiles.createIndex({ geometryKind: 1 })
db.beach_profiles.createIndex({ normalizedName: 1 })
db.beach_profiles.createIndex({ "quality.status": 1, updatedAt: -1 })
```

A `geometry` 2dsphere index may be added later if needed:

```js
db.beach_profiles.createIndex({ geometry: "2dsphere" })
```

For the first version, indexing `point` is enough.

## What to store in `canonical_hotels`

Do not copy the whole external geo object into `canonical_hotels`.

Store only the selected geo summary and a reference to the selected source candidate.

Recommended shape:

```ts
geo: {
  status: "MISSING" | "NEEDS_REVIEW" | "CONFIRMED",

  point: {
    type: "Point",
    coordinates: [number, number]
  } | null,

  source: {
    type: "OSM" | "FSQ_OS_PLACES" | "GOOGLE_PLACES" | "COMMERCIAL_PROVIDER" | "MANUAL" | null,
    dataset: string | null,
    id: string | null,
    candidateId: ObjectId | null
  },

  sourceSnapshot: {
    name: string | null,
    properties: Record<string, unknown>
  } | null,

  sourceCandidateChanged: boolean,
  needsGeoReview: boolean,

  updatedAt: Date | null
}
```

`sourceSnapshot.properties` should be a compact selected snapshot, not the entire raw OSM feature. The full raw-ish data remains in `hotel_geo_candidates`.

For hotel components, use the same idea inside each component's `geo` field.

## Import logic for OSM Overpass hotel candidates

Input file:

```txt
hr-core/data/raw/osm/overpass/hotels.geojson
```

Import target:

```txt
hotel_geo_candidates
```

For each GeoJSON feature:

1. Read `feature.id` or `feature.properties["@id"]` as `source.id`.
2. Read `feature.properties.name` as `name`.
3. Normalize name into `normalizedName`.
4. Store `feature.geometry` as `geometry`.
5. Compute a representative `point`:
   - if geometry is `Point`, use it directly;
   - if geometry is `Polygon` or `MultiPolygon`, use centroid or representative point;
   - if geometry came from Overpass as `@geometry=center`, use that point as the first version.
6. Store `feature.properties` as `sourceProperties`.
7. Compute `propertiesHash` and `geometryHash`.
8. Upsert by `{ source.type, source.dataset, source.id }`.
9. New records start with:

```ts
matchStatus: "UNMATCHED"
canonicalHotelId: null
componentId: null
lifecycle.status: "ACTIVE"
```

Do not auto-update `canonical_hotels` during import. Matching is a separate stage.

## Import logic for OSM beaches

Input file:

```txt
hr-core/data/raw/osm/overpass/beaches.geojson
```

Import target:

```txt
beach_profiles
```

For each GeoJSON feature:

1. Read `feature.id` or `feature.properties["@id"]` as `source.id`.
2. Read `feature.properties.name` as `name` if present.
3. Normalize name into `normalizedName` if present.
4. Store full `feature.geometry` as `geometry`.
5. Compute `geometryKind`:
   - `Point` -> `POINT`;
   - `LineString` or `MultiLineString` -> `LINE`;
   - `Polygon` or `MultiPolygon` -> `AREA`.
6. Compute representative `point`:
   - for `Point`, use it directly;
   - for `LineString`, use midpoint or centroid;
   - for `Polygon`/`MultiPolygon`, use centroid or representative point.
7. Store `feature.properties` as `sourceProperties`.
8. Compute `propertiesHash` and `geometryHash`.
9. Upsert by `{ source.type, source.dataset, source.id }`.
10. New records start with:

```ts
quality.status: "RAW"
quality.confidence: "MEDIUM"
lifecycle.status: "ACTIVE"
```

## Periodic update plan

Periodic update should be planned from the beginning.

Geo data changes over time:

- hotels can be added or removed from OSM;
- POI can open and close;
- beach geometry can change;
- one beach can be split into two;
- one object can keep the old name while another new object appears nearby;
- source tags can be enriched or removed.

The import process should not simply delete and recreate everything.

Recommended process:

```txt
new import file -> create geo_import_run -> read features -> upsert by source id -> mark missing old records as STALE -> write import stats
```

For every source entity, keep:

```txt
firstSeenAt
lastSeenAt
notSeenSince
lifecycle.status
propertiesHash
geometryHash
```

If an object exists in MongoDB but is not present in the latest import:

1. Do not delete it.
2. Set `lifecycle.status = "STALE"`.
3. Set `lifecycle.notSeenSince` if it was not already set.
4. If it is missing across several later imports, set `REMOVED_FROM_SOURCE`.

If geometry changes:

- update `geometry` and `point` in the source collection;
- update `geometryHash`;
- for beaches, set `quality.status = "NEEDS_REVIEW"` if the geometry changed significantly;
- for confirmed hotel matches, do not silently change `canonical_hotels.geo` without review.

If a confirmed hotel geo candidate changes, set on `canonical_hotels.geo`:

```ts
sourceCandidateChanged: true
needsGeoReview: true
```

The confirmed canonical hotel point should not be blindly overwritten by a source update.

## Matching stage

Matching is separate from import.

Input:

```txt
canonical_hotels
hotel_geo_candidates
```

Output:

```txt
hotel_geo_candidates.canonicalHotelId
hotel_geo_candidates.componentId
hotel_geo_candidates.matchStatus
hotel_geo_candidates.matchReasons
canonical_hotels.geo
```

Initial match statuses:

```txt
UNMATCHED
AUTO_MATCHED
NEEDS_REVIEW
CONFIRMED
REJECTED
```

Matching signals:

```txt
normalized name similarity
locality/address similarity
phone match
website/domain match
star/category sanity check
component/resort naming
existing geo distance if available
```

The first version can import candidates only. Matching can be implemented after basic stats are visible.

## Future Foursquare OS Places import

Foursquare OS Places should use `hr-core/data/raw/fsq`, not `hr-core/data/raw/osm`.

Expected future file example:

```txt
hr-core/data/raw/fsq/fsq-os-places-cyprus.csv
```

Foursquare can later feed:

```txt
hotel_geo_candidates
poi_places
```

It should not replace OSM. It should complement OSM, especially for commercial POI such as restaurants, cafes, shops, salons, pharmacies, attractions, and services.

## Future general POI collection

When Foursquare OS Places and broader OSM POI imports are added, create:

```txt
poi_places
```

Purpose:

```txt
restaurants
cafes
supermarkets
pharmacies
hair salons
ATMs
parking
attractions
bus stops
shops
```

Beaches should remain in `beach_profiles` as first-class entities.

A later derived collection can combine hotels, beaches, and POI for calculations:

```txt
hotel_nearby_places
hotel_area_scores
```

## Processing PBF and GPKG later

The current MongoDB import should start from:

```txt
hr-core/data/raw/osm/overpass/hotels.geojson
hr-core/data/raw/osm/overpass/beaches.geojson
```

The following files are not first-step import inputs:

```txt
hr-core/data/raw/osm/geofabrik/cyprus-latest.osm.pbf
hr-core/data/raw/osm/geofabrik/cyprus-latest-free.gpkg/cyprus.gpkg
```

They should be kept for later.

### PBF later

Use `osmium-tool` to extract repeatable local GeoJSON from the PBF.

Example future flow:

```txt
cyprus-latest.osm.pbf -> osmium tags-filter -> filtered.osm.pbf -> osmium export -> filtered.geojson -> MongoDB import
```

This is useful when the project should stop depending on manual Overpass Turbo exports.

### GPKG later

Use QGIS for visual inspection.

Use GDAL/OGR tools for exploration:

```txt
ogrinfo
ogr2ogr
```

The GPKG is useful for GIS inspection and experiments, but it is not the preferred first input for the NestJS importer.

## Implementation roadmap

Implement geo data processing as a separate domain pipeline, not as another
stage inside the existing hotel ingestion pipeline.

Reason: geo imports manage external spatial source data, source lifecycle,
hash-based source changes and later hotel matching. They should not be coupled
to `raw_hotels -> hotel_registry_entries -> canonical_hotel_candidates ->
canonical_hotels` processing runs.

### Step 1: Base geo models

Create feature-local modules for:

```txt
geo-import-runs
hotel-geo-candidates
beach-profiles
```

Optionally create `geo-data-processing` as the orchestration/controller feature
that coordinates import use cases.

Add feature-local enums/constants for:

```txt
source type
source dataset
import kind
import status
lifecycle status
hotel geo match status
geometry kind
beach quality status
beach quality confidence
```

Create Mongoose schemas and indexes for:

```txt
geo_import_runs
hotel_geo_candidates
beach_profiles
```

Keep interfaces under feature-local `types/` directories and constants/enums
under feature-local `constants/` directories.

### Step 2: Shared GeoJSON import core

Implement a small reusable GeoJSON import core for local files.

Responsibilities:

1. Read a GeoJSON `FeatureCollection` from a local file path.
2. Validate that every processed feature has `feature.id` or
   `feature.properties["@id"]`.
3. Normalize the feature name when present.
4. Store the source geometry.
5. Compute a representative `Point`.
6. Store `sourceProperties`.
7. Compute `propertiesHash` and `geometryHash`.
8. Upsert by `{ source.type, source.dataset, source.id }`.
9. Update `geo_import_runs.stats`.

For the first implementation, support only Overpass GeoJSON files. Do not parse
PBF or GPKG yet.

### Step 3: OSM hotel candidate import

Import:

```txt
hr-core/data/raw/osm/overpass/hotels.geojson
```

into:

```txt
hotel_geo_candidates
```

New records start as:

```txt
matchStatus = UNMATCHED
canonicalHotelId = null
componentId = null
lifecycle.status = ACTIVE
```

This step must not write to `canonical_hotels`.

### Step 4: OSM beach import

Import:

```txt
hr-core/data/raw/osm/overpass/beaches.geojson
```

into:

```txt
beach_profiles
```

Beach import additionally computes:

```txt
geometryKind
beachType
quality.status
quality.confidence
```

For the first version, imported beaches can start with:

```txt
quality.status = RAW
quality.confidence = MEDIUM
lifecycle.status = ACTIVE
```

### Step 5: Source lifecycle updates

Every import run should compare the latest source ids and hashes with existing
documents for the same source type, dataset and import kind.

Rules:

- New source ids are inserted as `ACTIVE`.
- Existing source ids update `lastSeenAt`.
- Hash changes update the stored source document and increment updated stats.
- Missing old source ids are marked `STALE`.
- Do not delete records that disappeared from the source.
- Keep `REMOVED_FROM_SOURCE` for a later version after several import cycles can
  be evaluated.

If a confirmed hotel geo candidate changes later, do not silently overwrite
`canonical_hotels.geo`. Mark the canonical hotel geo summary as changed and
requiring review.

### Step 6: Read-only inspection endpoints

Add read-only endpoints in the first version so imports can be inspected before
matching is implemented.

The importer should expose:

```txt
run list
run detail
hotel candidate list
hotel candidate detail
hotel candidate stats
beach list
beach detail
beach stats
```

### Step 7: Hotel geo matching

Implement matching only after the import data quality is visible.

Matching input:

```txt
canonical_hotels
hotel_geo_candidates
```

Matching output:

```txt
hotel_geo_candidates.canonicalHotelId
hotel_geo_candidates.componentId
hotel_geo_candidates.matchStatus
hotel_geo_candidates.matchReasons
canonical_hotels.geo
```

The first matching version should be conservative and review-driven. It should
not merge or confirm hotel geo points from weak signals.

## Suggested admin endpoints

Recommended first version:

```txt
DONE POST /geo-imports/runs/osm-overpass/hotels
DONE POST /geo-imports/runs/osm-overpass/beaches
DONE GET  /geo-imports/runs
DONE GET  /geo-imports/runs/:runId

GET  /geo-data/hotel-candidates
GET  /geo-data/hotel-candidates/:id
DONE GET  /geo-data/hotel-candidates/stats

GET  /geo-data/beaches
GET  /geo-data/beaches/:id
GET  /geo-data/beaches/stats
```

Recommended list filters:

```txt
sourceType
sourceDataset
lifecycleStatus
matchStatus
q
limit
offset
```

Example:

```txt
GET /geo-data/hotel-candidates?sourceType=OSM&sourceDataset=OVERPASS_TURBO&matchStatus=UNMATCHED&q=anassa&limit=50&offset=0
```

Later matching endpoints:

```txt
POST /geo-matching/runs/osm-hotel-candidates
GET  /geo-matching/runs/:runId
GET  /geo-matching/review/hotel-candidates
POST /geo-matching/hotel-candidates/:id/confirm
POST /geo-matching/hotel-candidates/:id/reject
```

Later source endpoints:

```txt
POST /geo-imports/runs/osm-geofabrik/extract-hotels
POST /geo-imports/runs/osm-geofabrik/extract-beaches
POST /geo-imports/runs/fsq/cyprus
```

## Minimal first implementation scope

The recommended first implementation scope is:

1. DONE Verify that the expected source files exist at the paths listed in this
   document.
2. DONE Create `geo_import_runs` collection and indexes.
3. DONE Create `hotel_geo_candidates` collection and indexes.
4. DONE Create `beach_profiles` collection and indexes.
5. DONE Implement import from `hotels.geojson` into `hotel_geo_candidates`.
6. DONE Implement import from `beaches.geojson` into `beach_profiles`.
7. DONE Add duplicate-safe upsert by source id.
8. DONE Add import stats.
9. DONE Add lifecycle fields and hash comparison.
10. Add read-only list/detail/stats endpoints.
11. DONE Do not implement hotel matching yet.

## Immediate next step

The next practical task is not matching.

The next practical task is importing these two files into MongoDB:

```txt
hr-core/data/raw/osm/overpass/hotels.geojson
hr-core/data/raw/osm/overpass/beaches.geojson
```

After import, generate stats:

```txt
hotel_geo_candidates count by tourism tag
hotel_geo_candidates count with name
hotel_geo_candidates count with phone
hotel_geo_candidates count with website
beach_profiles count by geometryKind
beach_profiles count with name
```

Only after that should the project proceed to hotel matching and beach accessibility calculations.
