# AGENTS.md

## Scope

These instructions apply to `hr-core/src/raw-hotels`.

## Responsibility

`raw-hotels` owns the `raw_hotels` collection. It stores parsed gov.cy PDF hotel records plus source-file metadata and processing state.

This is not a canonical layer. Do not add marketing-level hotel decisions, canonical grouping, candidate logic, or final merge decisions here.

## Current Implementation

`RawHotelsService` supports two creation paths:

- `createMany` inserts built raw hotel documents.
- `upsertManyByStrictHotelDedupeKeyAndSourceFileName` performs technical deduplication and should be preferred for recurring parsed PDF imports.

The upsert path normalizes capacity and name/class fields, then stores these derived identity fields:

```text
nameNormalized
nameMatchKey
strictHotelDedupeKey
addressMergeDedupeKey
```

Technical dedupe is conservative and source-file aware:

- Complementary address records can merge when one copy has an address and the other does not.
- Strong duplicate candidates require capacity, postcode, operator, normalized name, compatible address, and meaningful contact overlap.
- Shared chain/group domains are not strong domain identity evidence.
- Reversed rooms/beds duplicates can be deleted when the incoming capacity proves the earlier key obsolete.
- Strict upsert is keyed by `sourceFile.filename` and `strictHotelDedupeKey`.

## Processing State

`raw_hotels.processing` contains:

```text
status
runId
claimedAt
processedAt
hotelRegistryEntryId
error
```

`processing.hotelRegistryEntryId` is the forward link to `hotel_registry_entries._id`. Do not add `rawHotelIds` to registry entries.

Batch helpers initialize missing processing blocks, recover stale claims, claim pending documents in bounded batches, mark successful documents as `PROCESSED`, and mark technical failures as `FAILED`.

## Boundaries

Keep raw dedupe focused on parsing artifacts and repeated PDF imports. Do not use raw records to decide marketed hotel complexes. That decision belongs in `hotel-registry-entries` lookup rules and `canonical-hotel-candidates` candidate building.

When adding raw identity logic, keep constants in `raw-hotels/constants`, interfaces in `raw-hotels/types`, and reusable normalization logic in `raw-hotels/utils`.
