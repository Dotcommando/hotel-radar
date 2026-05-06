# AGENTS.md

## Scope

These instructions apply to all files under `hr-core`.

## Service Role

`hr-core` is the NestJS backend/back-office service that parses Cyprus hotel source data, deduplicates it, and promotes it through the hotel ingestion pipeline.

The implemented hotel processing pipeline is:

```text
raw_hotels
  -> hotel_registry_entries
  -> canonical_hotel_candidates
  -> canonical_hotels
```

Future product-facing services should read `canonical_hotels` and should not depend on how hotel data was parsed, deduplicated, grouped, reviewed, or merged.

## Pipeline Ownership

- `raw-hotels` owns parsed PDF hotel records and technical raw deduplication.
- `hotel-registry-entries` owns cleaned official registry rows and registry-level grouping lookups.
- `canonical-hotel-candidates` owns deterministic candidate documents built from registry entries.
- `canonical-hotels` owns final product-facing canonical hotels and candidate apply logic.
- `hotel-processing` owns BullMQ orchestration, run records, processing state transitions, and rollback between early stages.

## Processing Direction

Traceability is stored from each source stage to the next stage:

```text
raw_hotels.processing.hotelRegistryEntryId
hotel_registry_entries.processing.canonicalHotelCandidateId
canonical_hotel_candidates.processing.canonicalHotelId
```

Do not add growing reverse-reference arrays such as `rawHotelIds`, `hotelRegistryEntryIds`, or `canonicalHotelCandidateIds` to later-stage hotel documents. Use reverse queries through the processing fields instead.

`canonical_hotels.components` and `canonical_hotel_candidates.components` are current business composition snapshots, not trace history.

## Orchestration

Hotel processing uses the `hotel-processing` BullMQ queue and MongoDB `hotel_processing_runs` as the durable source of run state.

Implemented run endpoints:

```text
POST /hotel-processing/runs/raw-to-registry
POST /hotel-processing/runs/registry-to-candidates
POST /hotel-processing/runs/candidates-to-canonical
POST /hotel-processing/runs/candidates-to-canonical/retry-review-required
GET  /hotel-processing/runs/:runId
POST /hotel-processing/rollback/stage-2
POST /hotel-processing/rollback/stage-1
```

The implemented batch size is `HOTEL_PROCESSING_BATCH_SIZE` and defaults to `50`. Batch processors claim pending source documents with bounded `for` loops and `findOneAndUpdate(..., { returnDocument: 'after' })`.

Before each start use case, the relevant source collection initializes missing processing blocks and recovers stale `CLAIMED` documents using `HOTEL_PROCESSING_STALE_CLAIM_TIMEOUT_MS`.

Current stage barriers are not identical to the original plan:

- `registry_to_candidates` verifies that `raw_to_registry` has no `PENDING`, `CLAIMED`, or `FAILED` raw documents.
- `candidates_to_canonical` currently checks active candidate-to-canonical runs and pending/review-required candidates, but it does not currently verify that `registry_to_candidates` is fully completed.

Do not assume a barrier exists unless the corresponding start use case enforces it.

## Run Outcomes

Use `FAILED` only for technical failures such as broken invariants, database errors, or unexpected exceptions.

Use `REVIEW_REQUIRED` for ambiguous final canonicalization decisions that could corrupt canonical data. Review-required candidates are terminal for a normal candidates-to-canonical run and can be retried through `/hotel-processing/runs/candidates-to-canonical/retry-review-required`.

## Rollback

Rollback is implemented only for early pipeline stages:

- `stage-2` resets registry entries from the latest registry-to-candidates run and deletes the target candidate documents referenced by those entries.
- `stage-1` can roll back the latest raw-to-registry run, and also rolls back a later registry-to-candidates run when needed.

Rollback does not currently undo writes to `canonical_hotels`.

## Data Boundaries

Stage 4 writes `canonical_hotels` and `canonical_hotel_candidates.processing`. It does not create `hotel_web_sources`.

Official gov registry websites are stored in canonical hotel contacts and `webPresence`. Discovered SERP, crawl, Google Business, social, OTA, or manually reviewed web resources belong in a separate enrichment feature when that feature exists.

## Merge Policy

The product rule is:

```text
Wrong merge is worse than temporary non-merge.
```

Do not merge hotels based only on weak signals such as a shared chain/group website, same operator, same phone, same email, same short name, same locality, same establishment type, or an `ANNEX` suffix. Add deterministic rules only when they are encoded in feature-local services and covered by focused tests.

Do not add runtime LLM confidence fields or vague relation hints such as `confidence`, `llmConfidence`, `maybeSameHotel`, or `probablyRelated`.
