# AGENTS.md

## Scope

These instructions apply to `hr-core/src/geo-data`.

## Responsibility

`geo-data` owns read-only admin/inspection endpoints for imported geo data.

It does not import files and does not mutate source documents.

Current endpoints:

```text
GET /geo-data/hotel-candidates
GET /geo-data/hotel-candidates/:id
GET /geo-data/hotel-candidates/stats
GET /geo-data/beaches
GET /geo-data/beaches/:id
GET /geo-data/beaches/stats
```

## Current Implementation

Use cases in this feature delegate to:

```text
HotelGeoCandidatesService
BeachProfilesService
```

List endpoints return:

```text
ok
total
limit
offset
items
```

Detail endpoints return:

```text
ok
item
```

Missing detail documents map to:

```text
HOTEL_GEO_CANDIDATE_NOT_FOUND
BEACH_PROFILE_NOT_FOUND
```

Stats endpoints return current aggregate counts from source collections.

## Boundaries

Keep this feature read-only.

Do not add import logic, matching logic, or canonical hotel writes here.

If a future endpoint changes match status, confirms a geo point, or writes `canonical_hotels.geo`, create a separate geo matching feature instead of extending `geo-data`.
