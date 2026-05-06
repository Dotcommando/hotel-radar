# AGENTS.md

## Scope

These instructions apply to `hr-core/src/hotel-geo-candidates`.

## Responsibility

`hotel-geo-candidates` owns the `hotel_geo_candidates` collection.

These documents are external hotel-like geo source objects from OSM and later other providers. They are candidates for matching, not canonical hotels.

## Current Document Shape

Hotel geo candidates store:

```text
source
canonicalHotelId
componentId
matchStatus
matchReasons
name
normalizedName
point
geometry
sourceProperties
sourceHashes
lifecycle
createdAt
updatedAt
```

`source` contains source type, dataset, source id, and latest import run id.

`sourceHashes` contains `propertiesHash` and `geometryHash`.

`lifecycle` contains `ACTIVE`, `STALE`, or `REMOVED_FROM_SOURCE` state plus first/last seen timestamps.

## Current Import Behavior

OSM Overpass hotel imports upsert by:

```text
source.type
source.dataset
source.id
```

New records start as:

```text
matchStatus = UNMATCHED
canonicalHotelId = null
componentId = null
lifecycle.status = ACTIVE
```

Existing records update `lastSeenAt` and latest import run id. Geometry/properties/name/point are replaced only when hashes change.

Records not seen in the latest import are marked `STALE`, not deleted.

## Read API Support

`HotelGeoCandidatesService` supports:

- list by filters;
- count by filters;
- find by id;
- stats for total, names, phones, websites, tourism tag, lifecycle status, and match status.

List filters currently support:

```text
sourceType
sourceDataset
lifecycleStatus
matchStatus
q
limit
offset
```

## Boundaries

Do not write to `canonical_hotels` from this feature.

Do not treat imported OSM objects as verified hotel locations. Matching and confirmation must be added as a separate conservative workflow.

Do not delete source documents just because they disappear from a later source file.
