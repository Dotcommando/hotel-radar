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
verification
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

## Status Semantics

`canonical_hotels.status` is a lifecycle control field, not a display-only label.

Current statuses:

- `ACTIVE`: the canonical hotel is current and eligible for product-facing use, geo worklists, auto matching, and manual geo matching.
- `PERMANENTLY_CLOSED`: the real hotel is known to be closed permanently. Keep the document so future ingestion runs do not recreate it as a new active hotel.
- `DUPLICATE`: the document is a known duplicate of another canonical hotel. Keep the document so future ingestion runs do not recreate the duplicate as a new active hotel.

Non-active statuses must not be silently reactivated by Stage 4. When an incoming candidate deterministically matches an existing `PERMANENTLY_CLOSED` or `DUPLICATE` canonical hotel, preserve its status while updating allowed current facts and seen/source timestamps.

Product-facing reads, geo matching, geo worklists, auto matching, and manual geo endpoints should treat only `ACTIVE` canonical hotels as eligible unless a workflow explicitly exists for reviewing or restoring non-active hotels.

Hotel beach access computation may read `ACTIVE` canonical hotels with `geo.point`, but it must not write hotel facts or beach access results into `canonical_hotels`.

Deleting a closed or duplicate canonical hotel is usually wrong: the next ingestion run can recreate it from the source registry. Prefer marking `status` as `PERMANENTLY_CLOSED` or `DUPLICATE`.

## Verification Semantics

`canonical_hotels.verification` records the current verification state of accepted hotel facts, especially location and geo confidence. It is not a lifecycle control field.

`status` answers whether the canonical hotel document itself is active, closed, or a duplicate. `verification.status` answers whether the accepted hotel location has been reviewed or remains unresolved. Do not use `verification.status` to close, duplicate, hide, or restore a canonical hotel; use `canonical_hotels.status` for lifecycle decisions.

Current verification statuses:

- `UNREVIEWED`: location verification has not been reviewed yet.
- `LOCATION_VERIFIED`: the hotel location has been confirmed by manual geo assignment or confirmed matching.
- `LOCATION_UNVERIFIED`: the hotel location cannot currently be confirmed. Geo matching and geo worklists should not treat this hotel as eligible until verification changes.

Current verification issues:

- `GOOGLE_MAPS_NOT_FOUND`: Google Maps did not find a usable hotel match.
- `EMAIL_NO_RESPONSE`: email verification was attempted but did not receive a response.
- `NO_EMAIL_FOR_VERIFICATION`: no email is available for verification.

`verification.updatedAt` should be set when verification changes and remain `null` for the default `UNREVIEWED` state.

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

Fact updates must not overwrite `status`.

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
