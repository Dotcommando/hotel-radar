# AGENTS.md

## Scope

These instructions apply to `hr-core/src/beach-profiles`.

## Responsibility

`beach-profiles` owns the `beach_profiles` collection.

Beaches are first-class product geo entities, not generic POI. They will later support hotel distance, beach access, beach quality, and destination analysis.

## Current Document Shape

Beach profiles store:

```text
source
name
normalizedName
point
geometry
geometryKind
sourceProperties
sourceHashes
beachType
accessPoints
quality
lifecycle
createdAt
updatedAt
```

`geometryKind` is one of:

```text
POINT
LINE
AREA
```

`beachType` is currently derived conservatively from source properties and defaults to `UNKNOWN`.

New imported beaches start with:

```text
quality.status = RAW
quality.confidence = MEDIUM
lifecycle.status = ACTIVE
```

`accessPoints` are optional curated or imported real beach entry points. Generated route target points from hotel beach access computation must not be stored here.

## Current Import Behavior

OSM Overpass beach imports upsert by:

```text
source.type
source.dataset
source.id
```

Existing records update `lastSeenAt` and latest import run id. Geometry/properties/name/point/classification fields are replaced only when hashes change.

Records not seen in the latest import are marked `STALE`, not deleted.

## Read API Support

`BeachProfilesService` supports:

- list by filters;
- count by filters;
- find by id;
- stats for total, names, geometry kind, lifecycle status, quality status, and beach type.

List filters currently support:

```text
sourceType
sourceDataset
lifecycleStatus
geometryKind
q
limit
offset
```

## Boundaries

Do not store beaches as `hotel_geo_candidates`.

Do not collapse beach polygons or points into generic POI in this feature. Future generic POI can be separate, while beaches remain product-level geo entities.

Do not delete beaches that disappear from a later source file.

Do not persist generated hotel-beach-access routing target candidates to `accessPoints`. They belong only in derived computation results.
