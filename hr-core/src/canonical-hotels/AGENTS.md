# AGENTS.md

## Scope

These instructions apply to `hr-core/src/canonical-hotels`.

## Responsibility

`canonical-hotels` owns the `canonical_hotels` collection and the final application of a canonical hotel candidate.

This is the product-facing hotel layer. It should contain current accepted hotel facts, not ingestion history.

## Current Document Shape

Canonical hotels store:

```text
canonicalKey
status
kind
canonicalName
location
geo
operator
contacts
webPresence
capacity
components
source
issues
firstSeenAt
lastSeenAt
createdAt
updatedAt
```

The current implementation does not store a separate `normalizedName` field in `canonical_hotels`.

Do not add history arrays such as `canonicalHotelCandidateIds`, `hotelRegistryEntryIds`, `rawHotelIds`, `allPreviousVersions`, or `possibleDuplicates`.

## Applying Candidates

`CanonicalHotelsService.applyCandidate` is the Stage 4 entry point.

The current implementation does not validate `candidate.status` before applying a candidate. If blocked-candidate behavior matters, add an explicit check instead of assuming the processor skips blocked candidates.

Current flow:

1. Reject weak candidate identity with `REVIEW_REQUIRED` and `MISSING_IDENTITY_FIELDS`.
2. Build a canonical snapshot from the candidate.
3. Find deterministic matches by exact `canonicalKey`, then by exact `canonicalName` plus compatible deterministic identity checks.
4. Create a new canonical hotel when no match exists.
5. Mark `REVIEW_REQUIRED` for multiple matches, conflicting kind, conflicting location, or conflicting component keys.
6. Update an existing hotel when facts changed.
7. Mark as `SEEN_WITHOUT_CHANGES` when only seen/source timestamps need updating.

`geo` is initialized as `{ point: null, source: null }` on creation and is not overwritten by Stage 4 updates.

## Canonical Key

`makeCanonicalHotelKey` uses normalized `canonicalName`, `kind`, location fields, operator, and the first strong contact when needed.

The key must not include candidate ids, registry ids, raw ids, room counts, bed counts, run ids, or timestamps.

`hasStrongCanonicalHotelIdentity` currently allows identity from combinations of name plus postcode/address, postcode/operator, address/operator, address/contact, postcode/contact, operator/contact, or district/locality/contact.

## Fact Updates

When facts change, the implementation replaces current accepted snapshot fields from the candidate:

```text
canonicalKey
canonicalName
capacity
components
contacts
location
operator
source
webPresence
lastSeenAt
updatedAt
```

Location is merged conservatively by filling missing existing fields from the candidate. Conflicting non-empty address, locality, or postcode requires review before update.

Component conflicts are detected by comparing component keys. Do not append historical components.

## Web Presence

`HotelDeclaredWebPresenceService` builds `webPresence` only from official candidate contacts.

Current classifications are:

- `MISSING` with `missing_website`.
- `GROUP_WEBSITE` with `declared_group_website`.
- `AGGREGATOR_OR_PORTAL` with `declared_aggregator_or_portal`.
- `SOCIAL_ONLY` with `declared_social_only`.
- `OWN_WEBSITE` for other declared websites/domains.

Stage 4 does not write `hotel_web_sources`.

## Review Policy

Use `REVIEW_REQUIRED` for ambiguous business decisions. Do not modify `canonical_hotels` in that outcome.

Use `FAILED` only for technical failures raised by the processing batch.

Do not merge hotels only because they share a group domain, OTA domain, social domain, operator, or weak contact signal. Add deterministic matching rules only with focused tests around `canonical-hotels/services` or `canonical-hotels/utils`.
