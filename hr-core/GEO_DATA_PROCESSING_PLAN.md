# GEO_DATA_PROCESSING_PLAN.md

## Purpose

This document replaces the earlier geo import plan.

The geo import stage is already implemented and has produced `hotel_geo_candidates`. The next stage is to match those external geo candidates to `canonical_hotels` and write the selected point into `canonical_hotels.geo`.

The first implementation must add two idempotent endpoints:

- automatic matching of many `hotel_geo_candidates` to `canonical_hotels`;
- manual matching of one `hotel_geo_candidates._id` to one `canonical_hotels._id`.

The matching stage must prefer precision over volume, but it should still produce as many automatic matches as possible from strong deterministic signals.

## Current Data State

Observed in the local Docker MongoDB database on 2026-05-06:

```txt
canonical_hotels: 701
hotel_geo_candidates: 1358
canonical_hotels with geo.point: 0
hotel_geo_candidates by matchStatus:
  UNMATCHED: 1358
hotel_geo_candidates by lifecycle.status:
  ACTIVE: 1358
```

Useful current identity coverage:

```txt
canonical_hotels with phone: 697
canonical_hotels with website/domain: 486
hotel_geo_candidates with name: 1148
hotel_geo_candidates with phone/contact: 276
hotel_geo_candidates with website/url: 296
```

`hotel_geo_candidates` OSM `tourism` distribution:

```txt
hotel: 727
apartment: 357
guest_house: 233
hostel: 41
```

Initial deterministic analysis:

```txt
raw exact unique name matches: 125
reduced exact unique name matches: 307
unique phone + compatible name: 98
unique email + compatible name: 42
unique non-shared domain + compatible name: 70
strong contact + compatible name: 117
strict one-to-one proposals after resolving duplicate targets: about 303
```

Extended deterministic analysis:

```txt
safe extension over strict rules: about +30 matches
expected confident automatic matches: about 330-350
expected remaining manual/review workload: not all 350-370 remaining hotels are equally searchable
current first endpoint dry-run result: 313 automatic matches, 68 review suggestions, 977 no signal
```

The current data does not support a reliable target of 500 automatic matches from `canonical_hotels` and `hotel_geo_candidates` alone. Pure fuzzy-name matching adds noise quickly and does not reveal another 150-200 safe matches. The implementation should therefore split outcomes into:

```txt
AUTO_MATCHED_CONFIDENT
  high-confidence one-to-one matches that can write to canonical_hotels.geo automatically.

NEEDS_REVIEW_WITH_SUGGESTION
  plausible matches with candidate/canonical ids, reasons, score, and conflict notes.
  These should reduce manual work by turning raw search into confirmation/rejection.

NO_SIGNAL
  candidates or canonical hotels without enough evidence for a useful suggestion.
```

Additional rules allowed for `AUTO_MATCHED_CONFIDENT`:

```txt
CONTACT_AND_FUZZY_NAME
  phone, non-shared email, or non-shared domain plus a high fuzzy name score.

SHARED_GROUP_CONTACT_AND_STRONG_NAME
  shared group website/email only when the name evidence is strong.

ADDRESS_AND_STRONG_NAME
  postcode, city, or street evidence only as a secondary signal with a strong name.

OSM_DUPLICATE_BEST_CANDIDATE
  choose the best OSM duplicate only when one candidate is strictly stronger by source richness:
  contact fields > website/email > phone > stars > relation/way > node > name-only.
```

Rules that should not be automatic:

```txt
FUZZY_NAME_ONLY below a high threshold
single shared token matches such as GRAND, BEACH, NAPA, PALM, SUN, ROYAL
postcode/city matches where the hotel name signal is weak
ties between OSM duplicates with equal score
matches between different branded properties in the same hotel group
```

Important data quality observations:

- Some OSM objects duplicate the same physical hotel as a relation, way, and node.
- Some canonical hotels receive multiple plausible OSM candidates.
- Some group contacts are shared between different hotels and must not be used as standalone proof.
- Examples of shared or weak domains include `tsokkos.com`, `kanikahotels.com`, `atlanticahotels.com`, `louis-hotels.com`, `louishotels.com`, `leonardo-hotels.com`, `leonardo-hotels-cyprus.com`, `radissonhotels.com`, `marriott.com`, `ihg.com`, `booking.com`, and `expedia.com`.
- Some OSM hotel-like objects are in Northern Cyprus or are villas/apartments/guest houses that do not exist in `canonical_hotels`; they should remain unmatched unless there is a strong canonical identity signal.

## Existing Model Constraints

`hotel_geo_candidates` already has the fields needed for matching:

```ts
canonicalHotelId: ObjectId | null
componentId: string | null
matchStatus: "UNMATCHED" | "AUTO_MATCHED" | "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED"
matchReasons: string[]
point: GeoJSON Point
source: {
  type: string
  dataset: string
  id: string
  importRunId: ObjectId
}
sourceProperties: Record<string, unknown>
```

`canonical_hotels.geo` currently has this minimal shape:

```ts
{
  point: GeoJSON Point | null
  source: string | null
}
```

The first matching implementation should use the existing shape instead of expanding the schema.

Recommended `canonical_hotels.geo.source` value:

```txt
hotel_geo_candidate:<hotel_geo_candidates._id>
```

The full provider identity stays on the linked `hotel_geo_candidates` document. This keeps the canonical hotel document small and makes idempotency checks straightforward.

## Endpoint 1: Automatic Matching

### Route

```txt
POST /geo-data/hotel-candidates/match/auto
```

This route belongs under `geo-data` because the existing geo read endpoints are already there:

```txt
GET /geo-data/hotel-candidates
GET /geo-data/hotel-candidates/stats
GET /geo-data/hotel-candidates/:id
```

### Request Body

First version can accept an empty body.

Optional future-safe body:

```json
{
  "dryRun": false,
  "limit": 0
}
```

`dryRun` may be implemented immediately if it is cheap, but it is not required for the first endpoint. If implemented, `dryRun: true` must return the same decision report without database writes.

`limit: 0` means no explicit limit. If a positive limit is provided, process only that many eligible candidates in deterministic sort order.

### Response

Recommended response shape:

```json
{
  "ok": true,
  "dryRun": false,
  "stats": {
    "eligibleCandidates": 1358,
    "autoMatched": 313,
    "alreadyMatched": 0,
    "needsReview": 68,
    "skippedConfirmed": 0,
    "skippedRejected": 0,
    "skippedStale": 0,
    "noDeterministicMatch": 977,
    "conflicts": 0
  },
  "matches": [
    {
      "hotelGeoCandidateId": "string",
      "canonicalHotelId": "string",
      "action": "AUTO_MATCHED",
      "reasons": ["CONTACT_AND_COMPATIBLE_NAME"],
      "score": 100
    }
  ],
  "conflicts": [],
  "reviewSuggestions": [
    {
      "hotelGeoCandidateId": "string",
      "canonicalHotelId": "string",
      "action": "NEEDS_REVIEW",
      "reasons": ["REDUCED_EXACT_NAME"],
      "score": 60
    }
  ]
}
```

The response should include enough per-match detail for manual spot checks. `reviewSuggestions` is intentionally separate from `matches`: those candidates have a plausible proposal but are not safe enough to write automatically.

### Eligibility

Automatic matching should consider:

- `lifecycle.status = ACTIVE`;
- `matchStatus = UNMATCHED`;
- existing `AUTO_MATCHED` records only for idempotency verification or safe recomputation.

Automatic matching must skip:

- `CONFIRMED`, because manual confirmation is stronger than automation;
- `REJECTED`;
- stale or removed source objects;
- candidates without a valid point;
- candidates where the target canonical hotel already has a different confirmed or auto match.

### Matching Signals

Build normalized candidate identity from:

- `hotel_geo_candidates.name`;
- `hotel_geo_candidates.normalizedName`;
- `sourceProperties.name`;
- `sourceProperties["name:en"]`;
- `sourceProperties.official_name`;
- `sourceProperties.alt_name`.

Build candidate contacts from:

- `sourceProperties.phone`;
- `sourceProperties["contact:phone"]`;
- `sourceProperties.email`;
- `sourceProperties["contact:email"]`;
- `sourceProperties.website`;
- `sourceProperties["contact:website"]`;
- `sourceProperties.url`.

Build canonical identity from:

- `canonicalName`;
- `components.name`;
- `contacts.phones`;
- `contacts.emails`;
- `contacts.domains`;
- `contacts.websites`;
- `webPresence.domains`;
- `webPresence.websites`;
- component-level contacts, if available.

Normalization rules:

- uppercase names;
- normalize Unicode with NFKC;
- replace `&` with `AND`;
- remove punctuation;
- collapse whitespace;
- create two name forms:
  - raw normalized form;
  - reduced form with generic words removed, such as `HOTEL`, `HOTELS`, `APARTMENT`, `APARTMENTS`, `APTS`, `RESORT`, `VILLAGE`, `SUITES`, `BOUTIQUE`, `HOSTEL`, `GUEST HOUSE`, `BEACH`, `SPA`.
- normalize phone numbers to digit-only Cyprus format where possible;
- normalize website values to host names without `www.`;
- ignore known shared/group domains for domain-only evidence;
- ignore emails whose domain is a known shared/group domain for email-only evidence.

### Automatic Match Rules

Use a deterministic scoring model. A candidate can be auto-matched only when it has exactly one top canonical target and that canonical target has exactly one top geo candidate.

Recommended first scoring:

```txt
100 CONTACT_AND_COMPATIBLE_NAME
  exact phone, non-shared email, or non-shared domain matches one canonical hotel,
  and candidate/canonical names are compatible after reduced normalization.

80 RAW_EXACT_NAME
  raw normalized candidate name exactly equals canonical hotel name or component name,
  and the match is unique.

60 REDUCED_EXACT_NAME
  reduced candidate name exactly equals reduced canonical hotel or component name,
  and both sides are one-to-one after conflict resolution.
```

Do not auto-match on:

- phone only without name compatibility;
- email only if the email domain is shared by a hotel group;
- domain only if the domain is shared by a hotel group;
- reduced name when multiple OSM candidates target the same canonical hotel with the same score;
- contacts that point to one canonical hotel while the name strongly points to another.

### Duplicate Target Resolution

For each canonical hotel, collect all candidate proposals.

Auto-match only the single highest scoring candidate if:

- it is the only proposal with the highest score;
- the candidate itself has only one highest scoring canonical target;
- the canonical hotel has no existing different geo match;
- `canonical_hotels.geo.point` is `null` or already points to the same `hotel_geo_candidate:<id>` source.

If multiple candidates tie for the same canonical hotel, leave them unmatched or mark them `NEEDS_REVIEW` with a conflict reason.

Examples observed in current data:

```txt
OLYMPIC LAGOON RESORT:
  relation/2679724 has contact + name evidence
  way/1049729831 has reduced-name evidence
  auto-match the relation, keep the weaker duplicate unmatched/review.

GRECIAN PARK:
  two OSM ways have contact + name evidence with the same score
  do not auto-match; needs manual review.

AVANTI:
  Avanti Hotel and Avanti Village both reduce to AVANTI
  do not auto-match on reduced name alone.
```

### Write Behavior

For every accepted automatic match:

Update `hotel_geo_candidates`:

```ts
canonicalHotelId = canonicalHotel._id
componentId = componentKey or null
matchStatus = AUTO_MATCHED
matchReasons = [
  "AUTO_MATCH",
  "CONTACT_AND_COMPATIBLE_NAME" | "RAW_EXACT_NAME" | "REDUCED_EXACT_NAME",
  "SCORE:<number>"
]
updatedAt = now
```

Update `canonical_hotels`:

```ts
geo.point = hotelGeoCandidate.point
geo.source = "hotel_geo_candidate:<hotelGeoCandidateId>"
updatedAt = now
```

Use `returnDocument: "after"` for any `findOneAndUpdate()` call.

Do not overwrite a canonical hotel geo point if:

- `geo.source` references a different candidate;
- another active candidate is already `AUTO_MATCHED` or `CONFIRMED` to that canonical hotel;
- the existing match status is `CONFIRMED`.

### Idempotency

Running automatic matching repeatedly must not change the result after the first successful run.

Idempotent cases:

- candidate is already `AUTO_MATCHED` to the same canonical hotel and canonical `geo.source` already references the same candidate: count as `alreadyMatched`;
- canonical hotel already has the same geo source and point: no-op;
- candidate has no deterministic match: no-op;
- candidate is `CONFIRMED`: skip, never downgrade;
- candidate is `REJECTED`: skip.

If recomputation finds a different target for an existing `AUTO_MATCHED` candidate, do not move it automatically. Mark the candidate as `NEEDS_REVIEW` or report a conflict.

## Endpoint 2: Manual Match by Id

### Route

```txt
POST /geo-data/hotel-candidates/match/manual
```

### Request Body

```json
{
  "hotelGeoCandidateId": "69fae6928833ac8ce429d20d",
  "canonicalHotelId": "69f88430878f7fca1f7e0ac6",
  "componentId": null
}
```

`componentId` is optional. If provided, it must match one of `canonical_hotels.components.componentKey`.

Do not add a `force` flag in the first implementation. The first endpoint should be conservative and refuse overwrites. A forced rematch can be added later as a separate explicit endpoint or a reviewed extension.

### Success Response

```json
{
  "ok": true,
  "action": "CONFIRMED",
  "hotelGeoCandidateId": "string",
  "canonicalHotelId": "string",
  "componentId": null,
  "canonicalGeoSource": "hotel_geo_candidate:string",
  "idempotent": false
}
```

Repeated same request after a successful manual match:

```json
{
  "ok": true,
  "action": "ALREADY_CONFIRMED",
  "hotelGeoCandidateId": "string",
  "canonicalHotelId": "string",
  "componentId": null,
  "canonicalGeoSource": "hotel_geo_candidate:string",
  "idempotent": true
}
```

### Write Behavior

For a new manual match:

Update `hotel_geo_candidates`:

```ts
canonicalHotelId = canonicalHotel._id
componentId = provided componentId or null
matchStatus = CONFIRMED
matchReasons = ["MANUAL_MATCH"]
updatedAt = now
```

Update `canonical_hotels`:

```ts
geo.point = hotelGeoCandidate.point
geo.source = "hotel_geo_candidate:<hotelGeoCandidateId>"
updatedAt = now
```

Manual matching may upgrade an existing `AUTO_MATCHED` candidate to `CONFIRMED` if it points to the same canonical hotel.

Manual matching must not silently move:

- one candidate from one canonical hotel to another;
- one canonical hotel from one candidate to another;
- a rejected candidate back into matched state;
- a stale/removed source object into a canonical hotel.

### Error Cases

Invalid ObjectId format:

```txt
400 INVALID_HOTEL_GEO_CANDIDATE_ID
400 INVALID_CANONICAL_HOTEL_ID
```

Missing documents:

```txt
404 HOTEL_GEO_CANDIDATE_NOT_FOUND
404 CANONICAL_HOTEL_NOT_FOUND
```

Invalid component:

```txt
400 CANONICAL_HOTEL_COMPONENT_NOT_FOUND
```

Candidate is not active:

```txt
409 HOTEL_GEO_CANDIDATE_NOT_ACTIVE
```

Candidate is rejected:

```txt
409 HOTEL_GEO_CANDIDATE_REJECTED
```

Candidate already points to another canonical hotel:

```txt
409 HOTEL_GEO_CANDIDATE_ALREADY_MATCHED
```

Canonical hotel already has another active matched candidate:

```txt
409 CANONICAL_HOTEL_ALREADY_HAS_GEO_MATCH
```

Canonical hotel `geo.source` references another candidate:

```txt
409 CANONICAL_HOTEL_GEO_SOURCE_CONFLICT
```

Canonical hotel already has a geo point from an unknown/non-candidate source:

```txt
409 CANONICAL_HOTEL_GEO_ALREADY_SET
```

Candidate point is missing or invalid:

```txt
409 HOTEL_GEO_CANDIDATE_POINT_INVALID
```

### Manual Idempotency

The manual endpoint is idempotent only for the exact same desired state.

Return `ALREADY_CONFIRMED` when all of these are true:

- candidate `canonicalHotelId` equals the requested canonical hotel id;
- candidate `componentId` equals the requested component id or both are `null`;
- candidate `matchStatus = CONFIRMED`;
- canonical hotel `geo.source = hotel_geo_candidate:<candidateId>`;
- canonical hotel `geo.point` equals the candidate point.

If candidate and canonical hotel are partially inconsistent, return a conflict instead of guessing which side to trust.

## Service Design

Add a new feature-local module:

```txt
hr-core/src/geo-matching/
```

Recommended structure:

```txt
hr-core/src/geo-matching/
  constants/
    geo-match-action.enum.ts
    geo-match-error-code.enum.ts
    geo-match-reason.enum.ts
    geo-match-score.constant.ts
    shared-hotel-domain.constant.ts
  errors/
  types/
  utils/
    geo-match-normalization.util.ts
    geo-match-source.util.ts
  use-cases/
    auto-match-hotel-geo-candidates.use-case.ts
    manual-match-hotel-geo-candidate.use-case.ts
  geo-matching.module.ts
```

The controller can stay in `geo-data` to keep public geo endpoints grouped together, or a small `GeoMatchingController` can be added with the same `/geo-data/hotel-candidates/match/*` route prefix. Prefer the option with the smallest clean integration.

Needed service additions:

- `HotelGeoCandidatesService.findActiveMatchesByCanonicalHotelId(...)`;
- `HotelGeoCandidatesService.listAutoMatchEligibleCandidates(...)`;
- `HotelGeoCandidatesService.markAutoMatched(...)`;
- `HotelGeoCandidatesService.markConfirmed(...)`;
- `HotelGeoCandidatesService.markNeedsReview(...)`, if review marking is implemented;
- `CanonicalHotelsService.findById(...)`;
- `CanonicalHotelsService.listGeoMatchIndexData(...)`;
- `CanonicalHotelsService.setGeoFromCandidateIfEmptyOrSame(...)`.

Keep matching constants and normalization helpers inside `geo-matching`, not in shared generic folders.

## Tests

Use TDD.

### Automatic Matching Tests

Cover:

- matches by strong contact + compatible name;
- matches by raw exact unique name;
- matches by reduced exact unique name only when one-to-one;
- skips group/shared domain-only evidence;
- skips group/shared email-only evidence;
- refuses duplicate canonical target ties;
- chooses the highest scoring single candidate when one proposal is clearly stronger;
- skips `CONFIRMED`;
- skips `REJECTED`;
- skips stale candidates;
- does not overwrite existing canonical geo from another candidate;
- repeated run returns `alreadyMatched` and performs no state-changing writes;
- recomputation conflict for an existing `AUTO_MATCHED` candidate does not silently move it.

### Manual Matching Tests

Cover:

- successful new manual match;
- repeated same request returns `ALREADY_CONFIRMED`;
- invalid candidate id format;
- invalid canonical id format;
- missing candidate;
- missing canonical hotel;
- invalid `componentId`;
- candidate already matched to a different canonical hotel;
- canonical hotel already has another matched candidate;
- canonical hotel `geo.source` references another candidate;
- candidate is `REJECTED`;
- candidate is stale or removed;
- candidate has invalid point;
- upgrades same-target `AUTO_MATCHED` to `CONFIRMED`.

### Controller Tests

Cover HTTP mapping:

- success responses;
- `400` validation errors;
- `404` not found errors;
- `409` conflict errors.

## Postman

Update `hr-core/postman-api/Hotel Radar.postman_collection.json` with:

```txt
POST {{baseUrl}}/geo-data/hotel-candidates/match/auto
POST {{baseUrl}}/geo-data/hotel-candidates/match/manual
```

Include example bodies for:

- automatic match with `{ "dryRun": true }`;
- automatic match with `{ "dryRun": false }`;
- manual match with `hotelGeoCandidateId`, `canonicalHotelId`, and `componentId: null`.

## Implementation Progress

1. DONE Add failing unit tests for normalization and matching decision rules.
2. DONE Implement `geo-matching` normalization utilities and shared-domain filtering.
3. DONE Add repository methods needed to build a canonical hotel match index and candidate list.
4. DONE Add automatic matching use case with dry-run-capable decision reporting.
5. DONE Add automatic matching endpoint.
6. DONE Add automatic matching Postman requests.
7. DONE Run targeted tests for the automatic matching endpoint.
8. DONE Verify `POST /geo-data/hotel-candidates/match/auto` via Docker dry-run.
9. NEXT Stop for manual testing.
10. TODO Add failing tests for manual matching.
11. TODO Implement manual matching use case and conflict errors.
12. TODO Add manual matching endpoint.
13. TODO Add manual matching Postman request.
14. TODO Run the targeted test suite.
15. TODO Run the full `hr-core` test suite after the existing missing-script test fixture is restored.

## Open Policy Decision

The first implementation should not support forced overwrite.

If a canonical hotel or candidate is already matched differently, the endpoint should return a `409` conflict and force the user to inspect the data. A later reviewed endpoint can support explicit unmatch/rematch if needed.
