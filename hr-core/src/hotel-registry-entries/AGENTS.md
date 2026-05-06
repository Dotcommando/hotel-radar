# AGENTS.md

## Scope

These instructions apply to `hr-core/src/hotel-registry-entries`.

## Responsibility

`hotel-registry-entries` owns the `hotel_registry_entries` collection. It converts parsed raw hotels into cleaned official registry rows and removes technical raw duplicates without making final product-facing canonical decisions.

Officially distinct registry rows should remain distinct at this stage unless they are proven technical duplicates of the same registry row.

## Current Document Shape

Registry entries store:

```text
registryKey
status
name.original
name.normalized
name.baseName
name.suffix
establishmentType
location
operator
capacity
contacts
issues
processing
createdAt
updatedAt
```

`registryKey` is generated with `makeHotelRegistryKey` from normalized name, establishment type, district/region, locality, postcode, and address. It does not include capacity, contacts, raw ids, or processing run ids.

`status` is `READY` when there are no hard issues and `BLOCKED` when issues exist. Current hard issues include `missing_name`, `missing_required_identity_fields`, `invalid_capacity`, `conflicting_capacity_between_raw_duplicates`, and `shadow_aggregate_of_numeric_suffix_group`.

## Raw To Registry

`HotelRegistryEntriesService.upsertFromRawHotel`:

- Normalizes name/class through raw hotel utilities.
- Normalizes location and registry contacts.
- Computes `registryKey`.
- Deletes obsolete numeric-class registry artifacts when normalized names change.
- Reuses a strong duplicate registry entry when deterministic identity evidence exists.
- Merges contacts and fills missing location fields conservatively.
- Preserves existing capacity when a duplicate has conflicting complete capacity and records an issue.

The source raw document is linked forward by `raw_hotels.processing.hotelRegistryEntryId`.

## Registry To Candidate Lookups

This feature also owns the database lookups used by Stage 3 grouping:

- `readSafeNumericSuffixGroup`
- `readSafeNumericSuffixArtifactGroup`
- `readSafeCanonicalCandidateGroup`
- `readShadowAggregateNumericSuffixGroup`
- `hasCompatibleNumericSuffixGroup`

Safe grouping requires `READY` entries, no issues, compatible location, meaningful contact overlap, and compatible operator rules. Shared chain/group domains are filtered out as identity evidence.

Shadow aggregate numeric suffix entries are ignored during registry-to-candidates processing when numbered entries represent the safer component set.

## Processing State

`hotel_registry_entries.processing.canonicalHotelCandidateId` is the forward link to `canonical_hotel_candidates._id`. Do not store `rawHotelIds` or `hotelRegistryEntryIds` arrays on later documents.

Blocked registry entries are marked `IGNORED` by the registry-to-candidates processor, not converted into candidates.

## Boundaries

Do not create `canonical_hotels` here.

Do not add fuzzy confidence, relation hints, or LLM-derived merge decisions. If a new grouping pattern is needed, encode it as a deterministic method in this feature or in the candidate builder and add focused tests.
