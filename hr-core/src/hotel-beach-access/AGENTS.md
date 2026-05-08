# AGENTS.md

## Scope

These instructions apply to `hr-core/src/hotel-beach-access`.

## Responsibility

`hotel-beach-access` owns derived hotel-to-beach walking access data.

This feature owns:

- `hotel_beach_access_runs`
- `hotel_beach_access_run_items`
- `hotel_beach_access_edges`
- the `hotel-beach-access` BullMQ queue
- on-demand beach access computation endpoints
- read endpoints for hotel-to-beaches and beach-to-hotels results

## Data Boundaries

`canonical_hotels` remains the source of truth for hotel facts.

`beach_profiles` remains the source of truth for beach facts.

`hotel_beach_access_edges` stores recomputable derived data for a specific hotel and beach pair. Re-running the computation may overwrite existing edges by `canonicalHotelId + beachProfileId`.

Do not write hotel facts to `canonical_hotels` from this module.

Do not write generated routing target points to `beach_profiles`.

## Computation Direction

The first computation pass is hotel-centric:

```text
active canonical hotel with geo
  -> 20 nearest active beach_profiles
  -> hotel_beach_access_edges
```

The stored edge data is bidirectional and supports:

```text
GET /hotel-beach-access/hotels/:canonicalHotelId/beaches
GET /hotel-beach-access/beaches/:beachProfileId/hotels
```

If strict beach-centric completeness is required later, add a separate completion pass instead of changing the meaning of existing edges.

## Runs

Only one run may be active at a time.

Active statuses are:

```text
QUEUED
RUNNING
```

The run schema must keep a partial unique index over `activeLock` so parallel starts cannot race and a queued run cannot coexist with a running run.

Progress is computed from run stats with one decimal place. Do not report `100.0` unless the run status is `COMPLETED`.

## Run Items

Each run item represents one canonical hotel in one run.

Claim pending items with bounded loops and `findOneAndUpdate(..., { returnDocument: 'after' })`.

Do not use `while (true)`.

## Routing Target Points

If a beach has curated `accessPoints`, route to those first.

If a beach has no curated access points, generate temporary routing target points from `beach_profiles.geometry`.

Generated target points are computation details only. Store their provenance on edges, not in `beach_profiles`.

## Routing Provider

Domain code should depend on the walking route provider interface, not a concrete external provider.

The initial straight-line provider is a placeholder implementation. Replace it with OSRM, GraphHopper, Google, or another provider behind the same interface when real walking routes are available.
