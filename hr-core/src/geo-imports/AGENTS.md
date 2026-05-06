# AGENTS.md

## Scope

These instructions apply to `hr-core/src/geo-imports`.

## Responsibility

`geo-imports` owns admin import endpoints and import use cases for local geo source files.

It orchestrates imports into source collections, but it does not own the source collection schemas themselves.

Current endpoints:

```text
POST /geo-imports/runs/osm-overpass/hotels
POST /geo-imports/runs/osm-overpass/beaches
GET  /geo-imports/runs
GET  /geo-imports/runs/:runId
```

## Current Implementation

`GeoJsonHotelCandidatesImportService` imports:

```text
data/raw/osm/overpass/hotels.geojson
```

into `hotel_geo_candidates`.

`GeoJsonBeachProfilesImportService` imports:

```text
data/raw/osm/overpass/beaches.geojson
```

into `beach_profiles`.

Both import services:

- create a `geo_import_runs` document in `RUNNING` status;
- read local GeoJSON `FeatureCollection` files;
- require `feature.id` or `feature.properties["@id"]` as source id;
- store source properties and geometry;
- compute `propertiesHash`, `geometryHash`, and file sha256;
- compute a representative point from geometry coordinates;
- upsert target source documents by source identity;
- mark documents missing from the latest import as `STALE`;
- complete or fail the import run with stats.

## Boundaries

Do not write to `canonical_hotels` during import.

Do not perform hotel matching here. Matching belongs to a later geo matching feature and should be separate from raw source imports.

Do not parse PBF or GPKG in the current implementation. Current import support is Overpass GeoJSON only.

Keep source-specific import logic explicit. Avoid abstracting OSM and future FSQ/Google imports together until reuse is proven.
