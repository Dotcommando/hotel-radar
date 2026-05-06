# AGENTS.md

## Scope

These instructions apply to `hr-core/src/canonical-hotel-candidates`.

## Responsibility

`canonical-hotel-candidates` owns the `canonical_hotel_candidates` collection. It prepares deterministic marketed-hotel candidates from registry entries without writing final canonical hotels.

The default rule is one `hotel_registry_entry` becomes one `canonical_hotel_candidate`. Group multiple registry entries only through explicit safe rules.

## Current Document Shape

Candidate documents store:

```text
candidateKey
status
kind
canonicalName
location
operator
contacts
capacity
components
build
processing
createdAt
updatedAt
```

The current implementation does not store a separate top-level `normalizedName` field in candidates.

`components[]` stores current business composition snapshots with:

```text
componentKey
name
normalizedName
establishmentType
location
contacts
capacity
```

Do not add `hotelRegistryEntryIds` to candidates. Traceability comes from reverse querying `hotel_registry_entries.processing.canonicalHotelCandidateId`.

## Candidate Builder

`CanonicalHotelCandidateBuilderService.buildFromRegistryEntries` currently supports these deterministic rules:

- `single_registry_entry`
- `numeric_suffix_group`
- `same_name_multi_type_same_contacts`
- `same_name_same_type_strong_identity_prefer_best_location`
- `same_name_same_type_same_contacts_prefer_best_location`

Numeric suffix artifact grouping can also build a `numeric_suffix_group` candidate after removing the artifact-like base component from the component set.

Candidate keys are deterministic and do not include registry entry ids. Examples include:

```text
ccv1|single|{registryKey}
ccv1|group|numeric_suffix|{groupingKey}
ccv1|group|{rule}|{normalizedName}|{postcode}|{address}|{contactsKey}
```

`componentKey` is deterministic from normalized component identity fields and must not include previous-stage ids.

## Grouping Policy

Grouped candidates must require strong deterministic evidence such as compatible normalized/base names, compatible postcode/locality/address context, meaningful contact overlap, and compatible operator rules.

Do not group candidates by shared chain/group website alone. Shared domains are not strong identity evidence.

If the registry processor detects a base entry that ambiguously overlaps an existing numeric suffix group, `upsertAmbiguousBaseCandidate` creates a `BLOCKED` candidate with `ambiguous_base_candidate_matches_numeric_suffix_group` in `build.issues`.

Current claiming logic filters by `processing.status`, not by candidate `status`, so a `BLOCKED` candidate can still be claimed while its processing status is `PENDING`. Do not assume candidate `status` is enforced by the queue processor unless the implementation is changed.

## Processing State

`canonical_hotel_candidates.processing.canonicalHotelId` is the forward link to `canonical_hotels._id`.

Stage 4 uses:

```text
processing.action
processing.review
processing.status
```

to record `CREATED`, `UPDATED`, `SEEN_WITHOUT_CHANGES`, or `REVIEW_REQUIRED` outcomes.

## Boundaries

Do not create or update `canonical_hotels` in this feature. Use `CanonicalHotelsService.applyCandidate` for final canonicalization.

Do not add confidence fields, relation hints, previous-stage id arrays, or LLM runtime decisions.
