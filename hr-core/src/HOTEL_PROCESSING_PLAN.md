# HOTEL_PROCESSING_PLAN.md

## Purpose

This document describes the hotel processing plan for `hr-core`, a NestJS backend/back-office service for receiving, analyzing and saving hotel data for Cyprus.

The backend owns the ingestion and canonicalization process. Future product services should consume `canonical_hotels` for product-facing hotel data and should not know how the hotel data was obtained, parsed, deduplicated or merged.

The plan is intentionally conservative and minimal. The project is maintained by one developer, so the pipeline must avoid unnecessary hotel-domain entities, vague confidence scores, hidden relation graphs and data kept "just in case".

Main product rule:

```text
Wrong merge is worse than temporary non-merge.
```

If the system cannot deterministically prove that several records are one marketed hotel object, it keeps them separate or sends the case to manual review.

## High-level data flow

The hotel data pipeline has four main domain collections:

```text
raw_hotels
  -> hotel_registry_entries
  -> canonical_hotel_candidates
  -> canonical_hotels
```

The collection numbers are used in this document as stage numbers:

```text
Stage 1: raw_hotels
Stage 2: hotel_registry_entries
Stage 3: canonical_hotel_candidates
Stage 4: canonical_hotels
```

There are three processing transformations:

```text
raw_hotels -> hotel_registry_entries
hotel_registry_entries -> canonical_hotel_candidates
canonical_hotel_candidates -> canonical_hotels
```

There is one operational collection:

```text
hotel_processing_runs
```

`hotel_processing_runs` is not a hotel domain collection. It tracks background stage runs, batch progress and status endpoint responses.

There is one enrichment collection:

```text
hotel_web_sources
```

`hotel_web_sources` is not populated by Stage 4. It is populated later by separate SERP, website crawl, Google Business or manual enrichment processes. Stage 4 stores only the websites/domains declared by the official registry in `canonical_hotels.webPresence`.

The existing PDF parsing endpoint remains unchanged in this iteration:

```text
POST /gov-cy-pdf-hotels/parse
```

The PDF files may be published repeatedly in the future. Therefore Stage 4 must support recurring imports and decide whether each `canonical_hotel_candidates` document creates a new canonical hotel, updates an existing canonical hotel, only marks an existing canonical hotel as seen again, or requires human review.

## Direction of references

Each processed document stores a reference to the document it became in the next level:

```text
raw_hotels.processing.hotelRegistryEntryId
hotel_registry_entries.processing.canonicalHotelCandidateId
canonical_hotel_candidates.processing.canonicalHotelId
```

The next-level documents do not store growing arrays of previous-level ids.

Avoid this direction:

```text
hotel_registry_entries.rawHotelIds
canonical_hotel_candidates.hotelRegistryEntryIds
canonical_hotels.canonicalHotelCandidateIds
```

Reason: `canonical_hotels` must not grow with historical ingestion attempts. Traceability is done through reverse queries:

```ts
db.canonical_hotel_candidates.find({
  "processing.canonicalHotelId": canonicalHotelId,
});

db.hotel_registry_entries.find({
  "processing.canonicalHotelCandidateId": candidateId,
});

db.raw_hotels.find({
  "processing.hotelRegistryEntryId": registryEntryId,
});
```

`canonical_hotels.components` is not trace history. It is a current business snapshot of the marketed hotel object composition.

## Enums

```ts
export enum HOTEL_PROCESSING_STATUS {
  PENDING = "pending",
  CLAIMED = "claimed",
  PROCESSED = "processed",
  FAILED = "failed",
  IGNORED = "ignored",
  REVIEW_REQUIRED = "review_required",
}
```

```ts
export enum HOTEL_REGISTRY_ENTRY_STATUS {
  READY = "ready",
  BLOCKED = "blocked",
}
```

```ts
export enum CANONICAL_HOTEL_CANDIDATE_STATUS {
  READY = "ready",
  BLOCKED = "blocked",
}
```

```ts
export enum CANONICAL_HOTEL_STATUS {
  ACTIVE = "active",
  ARCHIVED = "archived",
}
```

```ts
export enum CANONICAL_HOTEL_KIND {
  SINGLE_PROPERTY = "single_property",
  PROPERTY_COMPLEX = "property_complex",
  DISTRIBUTED_PROPERTY = "distributed_property",
}
```

```ts
export enum HOTEL_CAPACITY_MODE {
  SINGLE_COMPONENT = "single_component",
  SUM_COMPONENTS = "sum_components",
}
```

```ts
export enum HOTEL_GEO_TYPE {
  POINT = "Point",
}
```

```ts
export enum HOTEL_GEO_SOURCE {
  GOOGLE_BUSINESS = "google_business",
  GEOCODED_ADDRESS = "geocoded_address",
  MANUAL = "manual",
}
```

```ts
export enum HOTEL_PROCESSING_STAGE {
  RAW_TO_REGISTRY = "raw_to_registry",
  REGISTRY_TO_CANDIDATES = "registry_to_candidates",
  CANDIDATES_TO_CANONICAL = "candidates_to_canonical",
}
```

```ts
export enum HOTEL_PROCESSING_RUN_STATUS {
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  BLOCKED = "blocked",
}
```

```ts
export enum CANONICAL_HOTEL_PROCESSING_ACTION {
  CREATED = "created",
  UPDATED = "updated",
  SEEN_WITHOUT_CHANGES = "seen_without_changes",
  REVIEW_REQUIRED = "review_required",
}
```

```ts
export enum CANONICAL_HOTEL_REVIEW_REASON {
  MULTIPLE_MATCHES = "multiple_matches",
  WEAK_MATCH = "weak_match",
  CONFLICTING_KIND = "conflicting_kind",
  CONFLICTING_LOCATION = "conflicting_location",
  CONFLICTING_COMPONENTS = "conflicting_components",
  SUSPICIOUS_NAME_CHANGE = "suspicious_name_change",
  MISSING_IDENTITY_FIELDS = "missing_identity_fields",
  AMBIGUOUS_IDENTITY = "ambiguous_identity",
}
```

```ts
export enum HOTEL_WEB_PRESENCE_SOURCE {
  GOV_REGISTRY = "gov_registry",
}
```

```ts
export enum HOTEL_DECLARED_WEBSITE_KIND {
  OWN_WEBSITE = "own_website",
  GROUP_WEBSITE = "group_website",
  AGGREGATOR_OR_PORTAL = "aggregator_or_portal",
  SOCIAL_ONLY = "social_only",
  MISSING = "missing",
  UNKNOWN = "unknown",
}
```

```ts
export enum HOTEL_WEB_SOURCE_STATUS {
  ACTIVE = "active",
  ARCHIVED = "archived",
  IGNORED = "ignored",
}
```

```ts
export enum HOTEL_WEB_SOURCE_KIND {
  HOTEL_WEBSITE = "hotel_website",
  HOTEL_GROUP_WEBSITE = "hotel_group_website",
  OTA_LISTING = "ota_listing",
  TOURISM_PORTAL = "tourism_portal",
  SOCIAL_PROFILE = "social_profile",
  SOCIAL_GROUP = "social_group",
  UNKNOWN = "unknown",
}
```

```ts
export enum HOTEL_WEB_SOURCE_ORIGIN {
  SERP = "serp",
  WEBSITE_CRAWL = "website_crawl",
  GOOGLE_BUSINESS = "google_business",
  MANUAL = "manual",
}
```

```ts
export enum HOTEL_WEB_SOURCE_RELATION_ROLE {
  OWN_WEBSITE = "own_website",
  GROUP_WEBSITE = "group_website",
  OTA_LISTING = "ota_listing",
  TOURISM_PORTAL = "tourism_portal",
  SOCIAL_PROFILE = "social_profile",
  SOCIAL_GROUP = "social_group",
  UNKNOWN = "unknown",
}
```

```ts
export enum HOTEL_WEB_SOURCE_MATCH_STATUS {
  PROPOSED = "proposed",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  REVIEW_REQUIRED = "review_required",
}
```

## Common contracts

```ts
import { ObjectId } from "mongodb";
```

```ts
export interface IHotelLocation {
  district: string | null;
  locality: string | null;
  postcode: string | null;
  address: string | null;
}
```

```ts
export interface IHotelCapacity {
  rooms: number | null;
  beds: number | null;
}
```

```ts
export interface IHotelContacts {
  phones: string[];
  emails: string[];
  websites: string[];
  domains: string[];
}
```

```ts
export interface IGeoPoint {
  type: HOTEL_GEO_TYPE;
  coordinates: [number, number];
}
```

```ts
export interface IHotelGeo {
  point: IGeoPoint | null;
  source: HOTEL_GEO_SOURCE | null;
}
```

```ts
export interface ICanonicalHotelCapacity {
  rooms: number | null;
  beds: number | null;
  mode: HOTEL_CAPACITY_MODE;
}
```

```ts
export interface ICanonicalHotelComponent {
  componentKey: string;
  name: string;
  normalizedName: string;
  establishmentType: string | null;
  location: IHotelLocation;
  contacts: IHotelContacts;
  capacity: IHotelCapacity;
}
```

`ICanonicalHotelComponent` is used both in `canonical_hotel_candidates` and `canonical_hotels`.

A component is a current business component of the marketed hotel object. It is not a reference to `hotel_registry_entries` and must not store `hotelRegistryEntryId`.

`componentKey` is a stable deterministic key inside the marketed object. It can be based on normalized component identity fields:

```text
component-v1|normalizedName|establishmentType|postcode|normalizedAddress
```

The key exists so future geo enrichment can attach a point to a hotel component without storing previous-stage ids in `canonical_hotels`.

## Common processing blocks

Each non-final pipeline collection has a `processing` block pointing to the next level.

```ts
export interface IRawHotelProcessing {
  status: HOTEL_PROCESSING_STATUS;
  runId: string | null;
  claimedAt: Date | null;
  processedAt: Date | null;
  hotelRegistryEntryId: ObjectId | null;
  error: string | null;
}
```

```ts
export interface IHotelRegistryEntryProcessing {
  status: HOTEL_PROCESSING_STATUS;
  runId: string | null;
  claimedAt: Date | null;
  processedAt: Date | null;
  canonicalHotelCandidateId: ObjectId | null;
  error: string | null;
}
```

```ts
export interface ICanonicalHotelCandidateReview {
  reason: CANONICAL_HOTEL_REVIEW_REASON;
  candidateCanonicalHotelIds: ObjectId[];
  details: string[];
  createdAt: Date;
  resolvedAt: Date | null;
}
```

```ts
export interface ICanonicalHotelCandidateProcessing {
  status: HOTEL_PROCESSING_STATUS;
  runId: string | null;
  claimedAt: Date | null;
  processedAt: Date | null;
  canonicalHotelId: ObjectId | null;
  action: CANONICAL_HOTEL_PROCESSING_ACTION | null;
  error: string | null;
  review: ICanonicalHotelCandidateReview | null;
}
```

`claimedAt` is used to recover stale claimed documents after a backend crash.

`REVIEW_REQUIRED` is a terminal processing state for ambiguous business cases. It is not a technical failure. It means the system intentionally did not create or update `canonical_hotels` because doing so could corrupt canonical data.

## Collection 1: `raw_hotels`

### Responsibility

`raw_hotels` stores parsed PDF data as it was extracted from gov.cy PDF files.

This collection may contain:

- Technical duplicates caused by overlapping PDF chunks.
- Partially parsed records.
- Slightly different copies of the same official registry row.
- Source PDF and parsing metadata.

`raw_hotels` is not a canonical layer and must not contain marketing-level hotel decisions.

### Problem solved

Preserve the original parsed data and allow traceability from parsed records to cleaned registry entries.

### Required processing fields

The existing parsed payload can remain as it is. Add or maintain only this processing block:

```ts
export interface IRawHotel {
  _id: ObjectId;
  processing: IRawHotelProcessing;
}
```

### Processing link

`raw_hotels.processing.hotelRegistryEntryId` points to `hotel_registry_entries._id`.

If multiple `raw_hotels` documents are technical duplicates, they all point to the same `hotel_registry_entries` document.

## Collection 2: `hotel_registry_entries`

### Responsibility

`hotel_registry_entries` stores cleaned official registry rows.

This level removes technical raw duplicates but does not merge officially different registry rows.

Examples:

- Two raw copies of `THALASSINES 10` caused by overlap become one `hotel_registry_entries` document.
- `THALASSINES 10`, `THALASSINES 11`, `THALASSINES 12` remain separate `hotel_registry_entries` documents because they are separate official registry rows.

### Problem solved

Separate parsing artifacts from real official registry rows.

### Document shape

```ts
export interface IHotelRegistryEntryName {
  original: string;
  normalized: string;
  baseName: string;
  suffix: string | null;
}
```

```ts
export interface IHotelRegistryEntry {
  _id: ObjectId;
  registryKey: string;
  status: HOTEL_REGISTRY_ENTRY_STATUS;
  name: IHotelRegistryEntryName;
  establishmentType: string | null;
  location: IHotelLocation;
  operator: string | null;
  capacity: IHotelCapacity;
  contacts: IHotelContacts;
  issues: string[];
  processing: IHotelRegistryEntryProcessing;
  createdAt: Date;
  updatedAt: Date;
}
```

### Field notes

`registryKey` is an idempotency key for technical dedupe. It must not include `rooms` or `beds`, because capacity can change in future gov.cy data.

`issues` stores only hard processing problems such as:

```text
missing_name
missing_required_identity_fields
conflicting_capacity_between_raw_duplicates
```

Do not store confidence scores.

Do not store `rawHotelIds`. Use reverse lookup from `raw_hotels.processing.hotelRegistryEntryId`.

### Processing link

`hotel_registry_entries.processing.canonicalHotelCandidateId` points to `canonical_hotel_candidates._id`.

## Collection 3: `canonical_hotel_candidates`

### Responsibility

`canonical_hotel_candidates` stores prepared marketing-level candidates that can later become final `canonical_hotels`.

This level translates official registry logic into product hotel logic, but still does not write directly into the final canonical collection.

### Problem solved

Prepare safe, deterministic candidates for final canonical matching and creation/update.

### Default rule

By default:

```text
One hotel_registry_entry -> one canonical_hotel_candidate.
```

Group multiple registry entries into one candidate only when the rule is deterministic and safe.

### Required Stage 3 change

Stage 3 must store component-level location and contacts inside `components`.

Old component shape is not enough:

```ts
export interface ICanonicalHotelComponentOld {
  name: string;
  establishmentType: string | null;
  rooms: number | null;
  beds: number | null;
}
```

New component shape must be used:

```ts
export interface ICanonicalHotelComponent {
  componentKey: string;
  name: string;
  normalizedName: string;
  establishmentType: string | null;
  location: IHotelLocation;
  contacts: IHotelContacts;
  capacity: IHotelCapacity;
}
```

Reason: multi-component marketed objects need one product-facing top-level location, but future geo enrichment may need to match a geolocation to each component separately. Components such as numbered villas, grouped hotel + hotel apartments, or distributed agrotourism houses may have their own address/contact context.

Stage 3 must build components from the `hotel_registry_entries` that formed the candidate:

- `componentKey` is deterministic and does not contain previous-stage ids.
- `name` comes from `hotel_registry_entries.name.original` or another accepted display name.
- `normalizedName` comes from `hotel_registry_entries.name.normalized`.
- `establishmentType` comes from `hotel_registry_entries.establishmentType`.
- `location` comes from `hotel_registry_entries.location`.
- `contacts` comes from `hotel_registry_entries.contacts`.
- `capacity.rooms` and `capacity.beds` come from `hotel_registry_entries.capacity`.

Stage 3 still must not store `hotelRegistryEntryIds` in the candidate. Traceability remains available through reverse lookup:

```ts
db.hotel_registry_entries.find({
  "processing.canonicalHotelCandidateId": candidateId,
});
```

### Safe grouping examples

`THALASSINES 10`, `THALASSINES 11`, `THALASSINES 12` may become one `PROPERTY_COMPLEX` candidate if they share:

- Same `baseName`.
- Numeric/unit suffixes.
- Same postcode/locality context.
- Same contact set or strongly matching contacts.
- Same operator where available.

Each THALASSINES unit must still be present in `components[]` with its own `location`, `contacts` and `capacity` snapshot.

`NISSIANA` hotel and `NISSIANA` hotel apartments may become one `PROPERTY_COMPLEX` candidate if they share:

- Same normalized name.
- Same address/postcode/locality.
- Same contacts.
- Same operator where available.

Both official rows must still be present in `components[]`.

### Non-grouping examples

`CHRISTABELLE` and `CHRISTABELLE ANNEX` should remain separate candidates by default.

Reason: the official source says they are separate registry rows, likely separate buildings or accommodation objects. The system does not need a special relation entity for this. Keeping them separate is safe.

Different Hilton, Marriott, Leonardo, Radisson, Tsokkos, Atlantica or Kanika properties must remain separate unless there is a deterministic property-level rule proving they are one marketed object. A shared chain/group website is not enough.

### Document shape

```ts
export interface ICanonicalHotelCandidateBuild {
  rule: string;
  ruleVersion: number;
  issues: string[];
}
```

```ts
export interface ICanonicalHotelCandidate {
  _id: ObjectId;
  candidateKey: string;
  status: CANONICAL_HOTEL_CANDIDATE_STATUS;
  kind: CANONICAL_HOTEL_KIND;
  canonicalName: string;
  normalizedName: string;
  location: IHotelLocation;
  operator: string | null;
  contacts: IHotelContacts;
  capacity: ICanonicalHotelCapacity;
  components: ICanonicalHotelComponent[];
  build: ICanonicalHotelCandidateBuild;
  processing: ICanonicalHotelCandidateProcessing;
  createdAt: Date;
  updatedAt: Date;
}
```

### Top-level location and contacts in candidates

`location` is the representative official location for the marketed object.

For `SINGLE_PROPERTY`, it should be the same as the only component location.

For `PROPERTY_COMPLEX`, it should be the common or best representative location shared by the grouped components. Do not lose component locations.

For `DISTRIBUTED_PROPERTY`, it may be district/locality/postcode without a precise address if the object is distributed across a village or area.

`contacts` is the union of official contacts from all components:

- normalize phones, emails, websites and domains;
- remove duplicates;
- sort deterministically;
- keep official declared websites even when they are group websites or aggregators.

### Field notes

`candidateKey` is the candidate-level idempotency key.

For single-entry candidates it can be based on the registry key or normalized identity fields.

For safe grouped candidates it should be based on the deterministic grouping rule, for example:

```text
baseName + postcode + normalized contact set + operator
```

`kind` describes the marketing nature of the hotel object:

- `SINGLE_PROPERTY`: one marketed hotel/accommodation property.
- `PROPERTY_COMPLEX`: several official registry rows that form one marketed property or complex.
- `DISTRIBUTED_PROPERTY`: one marketed property distributed across a village/area, usually traditional houses/agrotourism.

`capacity.mode` describes only how capacity was calculated:

- `SINGLE_COMPONENT`: capacity came from one registry entry.
- `SUM_COMPONENTS`: capacity was summed from grouped components.

`kind` and `capacity.mode` must not be treated as the same concept.

`components` is business composition, not trace history. It stores the component snapshots that form this candidate. It does not store previous-level ids.

Do not store:

```text
confidence
possibleRelatedCandidateIds
relationHints
sameComplexMaybe
llmReasoning
hotelRegistryEntryIds
```

### Processing link

`canonical_hotel_candidates.processing.canonicalHotelId` points to `canonical_hotels._id`.

## Collection 4: `canonical_hotels`

### Responsibility

`canonical_hotels` stores final product-facing hotel objects.

Future services should consume this collection and should not know about raw parsing, registry dedupe or candidate building.

### Problem solved

Provide a stable, marketing-oriented hotel dataset for search, enrichment, SEO, nearby places, Google Business matching, Booking matching and other future services.

### Document shape

```ts
export interface IHotelDeclaredWebPresence {
  source: HOTEL_WEB_PRESENCE_SOURCE;
  websites: string[];
  domains: string[];
  hasDeclaredWebsite: boolean;
  declaredWebsiteKind: HOTEL_DECLARED_WEBSITE_KIND;
  issues: string[];
}
```

```ts
export interface ICanonicalHotelSourceState {
  origin: "gov_registry";
  lastCandidateKey: string;
  lastCandidateBuildRule: string;
  lastCandidateBuildRuleVersion: number;
  lastCandidateSeenAt: Date;
}
```

```ts
export interface ICanonicalHotel {
  _id: ObjectId;
  canonicalKey: string;
  status: CANONICAL_HOTEL_STATUS;
  kind: CANONICAL_HOTEL_KIND;
  canonicalName: string;
  normalizedName: string;
  location: IHotelLocation;
  geo: IHotelGeo;
  operator: string | null;
  contacts: IHotelContacts;
  webPresence: IHotelDeclaredWebPresence;
  capacity: ICanonicalHotelCapacity;
  components: ICanonicalHotelComponent[];
  source: ICanonicalHotelSourceState;
  issues: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Field responsibility

`canonicalKey` is the canonical-level idempotency key for future updates. It must not include rooms, beds or candidate ids.

`canonicalName` is the product-facing hotel name.

`normalizedName` is used for deterministic matching and indexing.

`location` is the representative official location of the marketed hotel object.

For a single property, it is usually the same as the only component location.

For a property complex, it is the common or best official representative location. Component-level locations remain in `components[].location`.

For a distributed property, it may contain only district/locality/postcode if exact address is not meaningful.

`geo` stores only one primary product-facing point. Stage 4 does not geocode and does not populate geo points from SERP. If no reliable point is known, `geo.point = null` and `geo.source = null`.

`contacts` stores current official declared contacts from the latest accepted candidate. It is a top-level union of official component contacts.

`webPresence` stores only websites/domains declared in official gov registry data. It does not store SERP results. Group websites such as `tsokkos.com`, `atlanticahotels.com` or `kanikahotels.com` must be preserved here if the official source declared them.

`capacity` stores the current accepted capacity snapshot from the latest accepted candidate.

`components` stores current component snapshots. It should be replaced or updated from the latest accepted candidate and must not become a growing history array.

`source` stores only current source state. It is not a history array.

`firstSeenAt` is when this canonical hotel was first created from official data.

`lastSeenAt` is when this canonical hotel was last seen in an accepted candidate from a PDF import.

`updatedAt` changes when the document is written. For `SEEN_WITHOUT_CHANGES`, the implementation may update `lastSeenAt`, `source.lastCandidateSeenAt` and `updatedAt`, but must not alter hotel facts.

### Geo storage

Store coordinates as GeoJSON `Point`.

GeoJSON coordinate order is:

```text
[longitude, latitude]
```

Do not store a bounding polygon or four-point area in the current version.

Reason:

- Most enrichment sources provide a single point.
- Nearby search usually needs a point.
- Property polygons are hard to collect and maintain.
- For distributed properties, a polygon can be misleading.

If needed later, the model can be extended with a separate geo enrichment collection, for example `hotel_geo_points`, where points may be attached either to the whole hotel or to a component via `componentKey`.

Possible future shape:

```ts
export interface IHotelGeoPoint {
  _id: ObjectId;
  hotelId: ObjectId;
  componentKey: string | null;
  point: IGeoPoint;
  source: HOTEL_GEO_SOURCE;
  createdAt: Date;
  updatedAt: Date;
}
```

This future collection is not part of the current implementation.

### Do not store

Do not store these fields in `canonical_hotels`:

```text
canonicalHotelCandidateIds
hotelRegistryEntryIds
rawHotelIds
allPreviousVersions
confidence
possibleDuplicates
```

Traceability is done through reverse lookups from previous levels.

## Enrichment collection: `hotel_web_sources`

### Responsibility

`hotel_web_sources` stores normalized web resources discovered outside the official registry data.

Examples:

- SERP results.
- Crawled websites.
- Google Business URLs.
- Facebook pages.
- Facebook groups.
- Instagram profiles.
- OTA listings.
- Tourism portal listings.
- Manually accepted or rejected web resources.

### Important boundary

`hotel_web_sources` is not populated by Stage 4.

Stage 4 reads only `canonical_hotel_candidates` and writes only `canonical_hotels` plus `canonical_hotel_candidates.processing`.

Official registry websites stay in:

```text
canonical_hotels.contacts.websites
canonical_hotels.contacts.domains
canonical_hotels.webPresence
```

SERP/crawl/manual enrichment results go to:

```text
hotel_web_sources
```

This separation is intentional. It preserves the difference between:

```text
What the hotel officially declared about itself.
What the system discovered on the web.
```

### Document shape

```ts
export interface IHotelWebSourceUrl {
  original: string;
  normalized: string;
  domain: string;
  rootDomain: string;
  path: string;
}
```

```ts
export interface IHotelWebSourceClassification {
  kind: HOTEL_WEB_SOURCE_KIND;
  isAggregator: boolean;
  isHotelSpecific: boolean | null;
  rule: string;
  ruleVersion: number;
  manuallyReviewed: boolean;
  reviewedAt: Date | null;
}
```

```ts
export interface IHotelWebSourceDiscovery {
  origin: HOTEL_WEB_SOURCE_ORIGIN;
  query: string | null;
  provider: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}
```

```ts
export interface IHotelWebSourceRelatedHotel {
  hotelId: ObjectId;
  role: HOTEL_WEB_SOURCE_RELATION_ROLE;
  matchStatus: HOTEL_WEB_SOURCE_MATCH_STATUS;
  evidence: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
}
```

```ts
export interface IHotelWebSource {
  _id: ObjectId;
  sourceKey: string;
  status: HOTEL_WEB_SOURCE_STATUS;
  url: IHotelWebSourceUrl;
  classification: IHotelWebSourceClassification;
  discovery: IHotelWebSourceDiscovery;
  relatedHotels: IHotelWebSourceRelatedHotel[];
  relatedHotelCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Relation direction

Store relations inside `hotel_web_sources.relatedHotels`.

Do not create a separate relation collection now.

Do not store a plain duplicated `hotelIds` array unless a future performance issue proves it is necessary.

Reason: `relatedHotels` preserves relation metadata such as role, match status and evidence. A multikey index on `relatedHotels.hotelId` is enough for the expected dataset size.

Common queries:

```ts
db.hotel_web_sources.find({
  "relatedHotels.hotelId": hotelId,
});
```

```ts
db.hotel_web_sources.find({
  "url.rootDomain": "tsokkos.com",
});
```

```ts
db.hotel_web_sources.find({
  "classification.isAggregator": true,
});
```

### URL normalization

Use these URL normalization rules:

- lower-case host;
- remove tracking params such as `utm_*`, `fbclid`, `gclid`;
- normalize trailing slash;
- keep path, do not strip it;
- compute `rootDomain` using a public suffix aware library such as `tldts`, not by naive split, because domains like `com.cy` must be handled correctly.

`sourceKey` format:

```text
hwsv1|url|normalizedUrl
```

Example:

```text
hwsv1|url|https://www.tsokkos.com/
```

### Classification notes

Known shared hotel group domains should be classified as `HOTEL_GROUP_WEBSITE`, `isAggregator = true`, `isHotelSpecific = false`.

Examples:

```text
tsokkos.com
atlanticahotels.com
kanikahotels.com
leonardo-hotels.com
leonardo-hotels-cyprus.com
marismarehotels.com
apapouishotels.com
cyprotelshotels.com
hotelbrain.com
```

Known OTA/metasearch/listing domains should be classified as `OTA_LISTING`, `isAggregator = true`, `isHotelSpecific = false`.

Social domains should become `SOCIAL_PROFILE` or `SOCIAL_GROUP` when URL shape allows classification. Otherwise use `UNKNOWN`.

If URL cannot be classified safely, use `UNKNOWN` and do not guess.

`hotel_web_sources` must not be used as a hotel merge rule. Shared web resources can support enrichment and sales signals, but they do not prove that two hotels are one marketed object.

### Indexes

```ts
db.hotel_web_sources.createIndex({ sourceKey: 1 }, { unique: true });
db.hotel_web_sources.createIndex({ "url.normalized": 1 });
db.hotel_web_sources.createIndex({ "url.rootDomain": 1 });
db.hotel_web_sources.createIndex({ "classification.kind": 1 });
db.hotel_web_sources.createIndex({ "classification.isAggregator": 1 });
db.hotel_web_sources.createIndex({ "relatedHotels.hotelId": 1 });
db.hotel_web_sources.createIndex({ "relatedHotels.matchStatus": 1 });
db.hotel_web_sources.createIndex({ "discovery.origin": 1 });
```

## Operational collection: `hotel_processing_runs`

### Responsibility

`hotel_processing_runs` tracks lifecycle and progress of processing runs.

This collection is required because one run consists of many BullMQ batch jobs. A status endpoint must be able to return final run status even after all queue jobs are completed.

### Problem solved

Provides a durable back-office view of processing runs independent of individual BullMQ batch jobs.

### Document shape

```ts
export interface IHotelProcessingRunStats {
  total: number;
  processed: number;
  failed: number;
  ignored: number;
  reviewRequired: number;
}
```

```ts
export interface IHotelProcessingRun {
  _id: ObjectId;
  runId: string;
  stage: HOTEL_PROCESSING_STAGE;
  status: HOTEL_PROCESSING_RUN_STATUS;
  batchSize: number;
  stats: IHotelProcessingRunStats;
  currentBatch: number;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Run status rules

`QUEUED`: run was created and first batch job was queued.

`RUNNING`: at least one batch started.

`COMPLETED`: no pending source documents remain, and there are no failed source documents for this run/stage.

`FAILED`: processing failed at the run level or one or more documents failed and the stage cannot continue.

`BLOCKED`: run was not started because a stage barrier failed.

For `CANDIDATES_TO_CANONICAL`, `REVIEW_REQUIRED` candidate documents should count as `reviewRequired`, not `failed`. A run may complete with review-required documents if all non-reviewable technical work finished successfully.

## Processing orchestration

### BullMQ direction

Use BullMQ for background batch processing of the new transformations.

BullMQ is responsible for:

- Running transformation batches outside the HTTP request lifecycle.
- Persisting queued jobs in Redis.
- Retrying failed jobs where appropriate.
- Handling stalled jobs.
- Limiting concurrency.

MongoDB remains the source of truth for:

- Per-document processing state.
- Stage run lifecycle.
- Traceability between pipeline levels.

Use one queue:

```text
hotel-processing
```

Use stage-specific job names:

```text
raw_to_registry_batch
registry_to_candidates_batch
candidates_to_canonical_batch
```

Job data shape:

```ts
export interface IHotelProcessingBatchJobData {
  runId: string;
  stage: HOTEL_PROCESSING_STAGE;
  batchNo: number;
  batchSize: number;
}
```

### Batch model

Use this model:

```text
1 BullMQ job = 1 batch of up to 50 source documents.
```

Batch size:

```text
50
```

Reason: the initial dataset has around 774 objects. A batch size of 50 gives about 16 batches per full transformation, which is small enough for safe retries and simple enough for a solo-maintained project.

Each batch job:

1. Claims up to 50 pending source documents.
2. Processes the claimed documents.
3. Updates per-document `processing` fields.
4. Updates `hotel_processing_runs` counters.
5. Checks whether pending source documents remain.
6. Schedules the next batch job only if pending source documents remain.
7. Completes the run when no pending source documents remain.

### Stage barriers

Transformations are sequential, not streaming.

Do not run transformations in parallel as a pipeline.

Rule:

```text
The next transformation can start only after the previous transformation has fully completed.
```

Reason: some candidate-building logic needs the full previous-level dataset. For example, `THALASSINES 10`, `THALASSINES 11`, `THALASSINES 12` must be visible together before creating a grouped `PROPERTY_COMPLEX` candidate. If the next transformation starts too early, it can create incomplete candidates and push wrong data into `canonical_hotels`.

Required barriers:

```text
registry_to_candidates can start only after raw_to_registry is complete.
candidates_to_canonical can start only after registry_to_candidates is complete.
```

A previous transformation is complete only when:

- There is no active run for the previous transformation with status `QUEUED` or `RUNNING`.
- There are no previous-level source documents with `processing.status` equal to `PENDING`, `CLAIMED` or `FAILED`.
- All previous-level source documents are either `PROCESSED`, `IGNORED` or `REVIEW_REQUIRED` where review is allowed for that transformation.

For `raw_to_registry` and `registry_to_candidates`, `REVIEW_REQUIRED` should normally not be used. If such documents exist, they should block the next transformation until explicitly resolved or ignored.

For `candidates_to_canonical`, `REVIEW_REQUIRED` is an accepted terminal state because Stage 4 is the final canonicalization decision point.

`FAILED` documents block the next transformation. If a document should not participate in the pipeline, it must be explicitly marked as `IGNORED`.

### Stale claimed recovery

Before starting a run or batch, recover stale claimed source documents.

A stale claimed document is a document with:

```text
processing.status = CLAIMED
processing.claimedAt older than the configured stale timeout
```

For the new non-LLM transformations, start with a stale timeout of 30 minutes.

Recovery action:

```text
CLAIMED -> PENDING
runId -> null
claimedAt -> null
error -> optional recovery note or null
```

## Endpoints to create

### Start raw to registry transformation

```text
POST /hotel-processing/runs/raw-to-registry
```

Responsibility:

- Recover stale claimed `raw_hotels` documents.
- Ensure there is no active `raw_to_registry` run.
- Create a new `hotel_processing_runs` document.
- Queue the first `raw_to_registry_batch` BullMQ job.
- Return `runId`.

Response example:

```json
{
  "ok": true,
  "runId": "2026-05-02T18-30-00-raw-to-registry",
  "stage": "raw_to_registry",
  "status": "queued",
  "batchSize": 50
}
```

### Start registry to candidates transformation

```text
POST /hotel-processing/runs/registry-to-candidates
```

Responsibility:

- Recover stale claimed `hotel_registry_entries` documents.
- Verify that `raw_to_registry` is fully completed.
- Ensure there is no active `registry_to_candidates` run.
- Create a new `hotel_processing_runs` document.
- Queue the first `registry_to_candidates_batch` BullMQ job.
- Return `runId`.

If previous transformation is not complete, return `409 Conflict`.

Response example for blocked start:

```json
{
  "ok": false,
  "code": "PREVIOUS_STAGE_NOT_COMPLETED",
  "message": "Cannot start registry_to_candidates because raw_to_registry is not fully completed.",
  "details": {
    "blockingStage": "raw_to_registry",
    "pending": 120,
    "claimed": 0,
    "failed": 2,
    "reviewRequired": 0
  }
}
```

### Start candidates to canonical transformation

```text
POST /hotel-processing/runs/candidates-to-canonical
```

Responsibility:

- Recover stale claimed `canonical_hotel_candidates` documents.
- Verify that `registry_to_candidates` is fully completed.
- Ensure there is no active `candidates_to_canonical` run.
- Create a new `hotel_processing_runs` document.
- Queue the first `candidates_to_canonical_batch` BullMQ job.
- Return `runId`.

If previous transformation is not complete, return `409 Conflict`.

Response example for blocked start:

```json
{
  "ok": false,
  "code": "PREVIOUS_STAGE_NOT_COMPLETED",
  "message": "Cannot start candidates_to_canonical because registry_to_candidates is not fully completed.",
  "details": {
    "blockingStage": "registry_to_candidates",
    "pending": 15,
    "claimed": 0,
    "failed": 0,
    "reviewRequired": 0
  }
}
```

### Get run status

```text
GET /hotel-processing/runs/:runId
```

Responsibility:

- Return durable run state from `hotel_processing_runs`.
- Optionally include recalculated source document counters for the run's transformation.

Response example:

```json
{
  "ok": true,
  "runId": "2026-05-02T18-30-00-candidates-to-canonical",
  "stage": "candidates_to_canonical",
  "status": "running",
  "batchSize": 50,
  "stats": {
    "total": 774,
    "processed": 300,
    "failed": 0,
    "ignored": 0,
    "reviewRequired": 3
  },
  "currentBatch": 6,
  "startedAt": "2026-05-02T18:30:00.000Z",
  "finishedAt": null,
  "error": null
}
```

If run is not found:

```json
{
  "ok": false,
  "code": "RUN_NOT_FOUND",
  "message": "Hotel processing run was not found."
}
```

## Transformation implementation details

## Transformation 1: `raw_hotels -> hotel_registry_entries`

Input collection:

```text
raw_hotels
```

Output collection:

```text
hotel_registry_entries
```

Processing:

- Claim up to 50 `raw_hotels` with `processing.status = PENDING`.
- Normalize name, address, phones, emails, websites, domains and operator.
- Compute `registryKey`.
- Upsert `hotel_registry_entries` by `registryKey`.
- Merge technical duplicate data conservatively.
- Set each raw document's `processing.hotelRegistryEntryId`.
- Set each raw document's `processing.status = PROCESSED`.

Do not create canonical candidates here.

## Transformation 2: `hotel_registry_entries -> canonical_hotel_candidates`

Input collection:

```text
hotel_registry_entries
```

Output collection:

```text
canonical_hotel_candidates
```

Processing:

- Claim up to 50 `hotel_registry_entries` with `processing.status = PENDING`.
- Use deterministic rules to create one candidate per registry entry by default.
- Create grouped candidates only for safe deterministic cases.
- Set `kind` to `SINGLE_PROPERTY`, `PROPERTY_COMPLEX` or `DISTRIBUTED_PROPERTY`.
- Set `capacity.mode` to `SINGLE_COMPONENT` or `SUM_COMPONENTS`.
- Build `components[]` with component-level `location`, `contacts` and `capacity`.
- Build top-level `contacts` as the normalized union of component contacts.
- Build top-level `location` as the representative official location.
- Set each registry entry's `processing.canonicalHotelCandidateId`.
- Set each registry entry's `processing.status = PROCESSED`.

Do not create relation documents.

Do not store weak relation hints.

Do not use LLM in this transformation in the initial implementation.

If a pattern is unclear, keep registry entries separate.

## Transformation 3 / Stage 4: `canonical_hotel_candidates -> canonical_hotels`

Input collection:

```text
canonical_hotel_candidates
```

Output collection:

```text
canonical_hotels
```

This transformation is the final canonicalization step. It must support recurring future PDF imports.

For each candidate it must decide one of these outcomes:

```text
Create a new canonical hotel.
Update an existing canonical hotel.
Mark an existing canonical hotel as seen without meaningful hotel changes.
Mark the candidate as requiring human review.
```

### Successful and review outcomes

`CREATED`: no deterministic existing canonical hotel was found, and the candidate has enough identity fields to create a new canonical hotel safely.

`UPDATED`: exactly one deterministic existing canonical hotel was found, and the accepted candidate changes meaningful hotel facts such as capacity, components, contacts, webPresence, operator or fillable location fields.

`SEEN_WITHOUT_CHANGES`: exactly one deterministic existing canonical hotel was found, and the candidate does not change meaningful hotel facts. Update only `lastSeenAt`, `source.lastCandidateSeenAt`, `source.lastCandidateKey` and normal timestamps.

`REVIEW_REQUIRED`: the system cannot safely decide whether to create or update. Do not modify `canonical_hotels` in this case.

### Processing flow

For each pending `canonical_hotel_candidates` document:

1. Claim the candidate.
2. Validate candidate status and required identity fields.
3. Build a canonical snapshot from the candidate.
4. Compute `canonicalKey` if the identity is strong enough.
5. Search for existing `canonical_hotels` by deterministic match tiers.
6. Decide `CREATED`, `UPDATED`, `SEEN_WITHOUT_CHANGES` or `REVIEW_REQUIRED`.
7. Create or update `canonical_hotels` only for safe outcomes.
8. Update `canonical_hotel_candidates.processing`.

### Canonical snapshot building

Use these fields from `canonical_hotel_candidates`:

- `canonicalName`
- `normalizedName`
- `kind`
- `location`
- `operator`
- `contacts`
- `capacity`
- `components`
- `build.rule`
- `build.ruleVersion`
- `candidateKey`

Do not reverse lookup `hotel_registry_entries` in Stage 4 to reconstruct component addresses. Stage 3 must already store component-level `location` and `contacts` inside `candidate.components[]`.

Build `webPresence` from candidate official contacts:

```ts
function buildDeclaredWebPresence(contacts: IHotelContacts): IHotelDeclaredWebPresence;
```

Rules:

- `source = HOTEL_WEB_PRESENCE_SOURCE.GOV_REGISTRY`.
- `websites = contacts.websites`.
- `domains = contacts.domains`.
- `hasDeclaredWebsite = websites.length > 0`.
- `declaredWebsiteKind = MISSING` when there are no websites/domains.
- `declaredWebsiteKind = GROUP_WEBSITE` when all declared websites are known shared hotel group domains.
- `declaredWebsiteKind = AGGREGATOR_OR_PORTAL` when declared websites are known OTA/listing/tourism portal domains.
- `declaredWebsiteKind = SOCIAL_ONLY` when declared websites are only social URLs.
- `declaredWebsiteKind = OWN_WEBSITE` when at least one declared website is likely hotel-specific and no stronger negative rule applies.
- `declaredWebsiteKind = UNKNOWN` when websites exist but cannot be classified safely.

Examples of `webPresence.issues`:

```text
missing_website
declared_group_website
declared_aggregator_or_portal
declared_social_only
multiple_unclassified_websites
```

Do not write official declared websites to `hotel_web_sources` in Stage 4.

### Canonical key

`canonicalKey` must be deterministic and stable across recurring PDF imports.

It must not contain:

```text
candidate id
registry id
raw id
rooms
beds
processing run id
createdAt
updatedAt
```

Preferred key when address is present:

```text
chv1|kind|normalizedName|district|locality|postcode|normalizedAddress
```

Fallback when address is missing but operator is present:

```text
chv1|kind|normalizedName|district|locality|postcode|operator
```

Fallback when address and operator are missing:

```text
chv1|kind|normalizedName|district|locality|postcode
```

If the fallback key is too weak, do not create or update automatically. Mark the candidate as `REVIEW_REQUIRED` with reason `MISSING_IDENTITY_FIELDS` or `AMBIGUOUS_IDENTITY`.

### Deterministic match tiers

Search existing `canonical_hotels` using deterministic tiers.

Tier 1:

```text
Exact canonicalKey.
```

Tier 2:

```text
Exact normalizedName + exact postcode + exact normalized address + compatible kind.
```

Tier 3:

```text
Exact normalizedName + same postcode/locality + same operator + at least one strong contact overlap.
```

Strong contact overlap means phone or email.

Do not treat shared group domain as strong identity evidence.

Domains such as these must not merge hotels by themselves:

```text
tsokkos.com
atlanticahotels.com
kanikahotels.com
louishotels.com
leonardo-hotels.com
radissonhotels.com
```

Tier 4:

```text
Any weak or ambiguous match must become REVIEW_REQUIRED.
```

If no match exists and identity is strong enough, create.

If exactly one match exists, compare and update or mark as seen.

If multiple matches exist, do not guess. Mark as `REVIEW_REQUIRED` with reason `MULTIPLE_MATCHES`.

### Create policy

When creating a new canonical hotel:

- Insert all snapshot fields.
- Set `status = ACTIVE`.
- Set `geo.point = null` and `geo.source = null`.
- Set `firstSeenAt = now`.
- Set `lastSeenAt = now`.
- Set `createdAt = now`.
- Set `updatedAt = now`.
- Set source state from the candidate.
- Set candidate processing:
  - `status = PROCESSED`.
  - `action = CREATED`.
  - `canonicalHotelId = created _id`.
  - `processedAt = now`.
  - `review = null`.

### Update policy

When updating an existing canonical hotel, use conservative merge.

`canonicalName`:

- Keep existing name when the new name is only a weaker or shorter variant.
- Update only when normalized identity is the same and the new display name is clearly better by deterministic rule.
- If the name looks like a suspicious identity change, mark as `REVIEW_REQUIRED` with reason `SUSPICIOUS_NAME_CHANGE`.

`kind`:

- If kind is the same, keep/update normally.
- If kind changes, mark as `REVIEW_REQUIRED` with reason `CONFLICTING_KIND` unless there is an explicit deterministic rule that allows the change.

`location`:

- Do not replace non-null existing fields with null candidate fields.
- Fill null existing fields from non-null candidate fields.
- If candidate provides a different non-null postcode/address/locality, mark as `REVIEW_REQUIRED` with reason `CONFLICTING_LOCATION` unless deterministic same-object rules allow the change.
- Do not degrade a manually improved location with weaker registry data.

`geo`:

- Do not overwrite `geo` in Stage 4.
- Stage 4 does not geocode.
- Stage 4 must preserve existing `geo` values.

`operator`:

- Fill null existing operator from non-null candidate operator.
- If both are non-null and different, update only if deterministic normalization proves they are the same entity.
- Otherwise keep existing and add an issue or send to review if the operator conflict affects identity.

`contacts`:

- Treat candidate contacts as current official declared contacts.
- Normalize and sort phones, emails, websites and domains.
- Keep official declared websites even if they are group websites or aggregators.
- Do not delete old contacts automatically unless the project later introduces separate current/historical contact storage.
- For the current implementation, prefer replacing top-level official contacts with the latest accepted candidate union after normalization, unless this would erase manually curated data.

`webPresence`:

- Rebuild from current accepted candidate contacts.
- Preserve declared group websites as declared official data.
- Do not create or update `hotel_web_sources` here.

`capacity`:

- Update from candidate when candidate capacity is non-null and valid.
- If capacity changes, action must be `UPDATED`.
- Do not use capacity for identity matching.

`components`:

- Replace component snapshot with candidate-derived `components[]` when candidate build rule is deterministic.
- If component count or component identity changes in a way that contradicts existing canonical composition, mark as `REVIEW_REQUIRED` with reason `CONFLICTING_COMPONENTS`.
- Do not append historical components.

`source`:

- Always update `source.lastCandidateKey`, `source.lastCandidateBuildRule`, `source.lastCandidateBuildRuleVersion` and `source.lastCandidateSeenAt` for accepted candidates.

`lastSeenAt`:

- Always update for accepted candidates.

`updatedAt`:

- Update when the document is written.
- For `SEEN_WITHOUT_CHANGES`, only timestamp/source fields should change.

### Seen without changes policy

If the candidate matches exactly one canonical hotel and all meaningful hotel facts are equal after normalization:

- Do not change canonical hotel facts.
- Update `lastSeenAt`.
- Update `source.lastCandidateKey`.
- Update `source.lastCandidateSeenAt`.
- Let `updatedAt` change if the persistence layer updates it automatically.
- Set candidate processing:
  - `status = PROCESSED`.
  - `action = SEEN_WITHOUT_CHANGES`.
  - `canonicalHotelId = existing _id`.
  - `processedAt = now`.
  - `review = null`.

### Review required policy

Mark candidate as review-required when automatic create/update could corrupt canonical data.

Examples:

- Multiple existing canonical hotels match.
- Existing match is weak.
- Candidate has missing identity fields.
- Candidate canonical key fallback is too weak.
- Name change looks like a different hotel.
- Location conflicts with existing canonical hotel.
- Component composition conflicts with existing canonical hotel.
- Kind conflicts with existing canonical hotel.

Do not modify `canonical_hotels` when candidate becomes `REVIEW_REQUIRED`.

Set candidate processing:

```ts
processing.status = HOTEL_PROCESSING_STATUS.REVIEW_REQUIRED;
processing.action = CANONICAL_HOTEL_PROCESSING_ACTION.REVIEW_REQUIRED;
processing.canonicalHotelId = null;
processing.processedAt = now;
processing.error = null;
processing.review = {
  reason,
  candidateCanonicalHotelIds,
  details,
  createdAt: now,
  resolvedAt: null,
};
```

### Technical failure policy

Use `FAILED` only for technical failures such as database errors, invalid schema, unexpected exceptions or broken invariants.

Do not use `FAILED` for ambiguous business decisions. Use `REVIEW_REQUIRED`.

### Stage 4 pseudocode

```text
for each pending canonical_hotel_candidate:
  claim candidate
  snapshot = buildCanonicalSnapshot(candidate)

  if snapshot identity is too weak:
    mark candidate as REVIEW_REQUIRED
    continue

  canonicalKey = computeCanonicalKey(snapshot)
  matches = findCanonicalMatches(snapshot, canonicalKey)

  if matches.length == 0:
    create canonical_hotel from snapshot
    mark candidate as PROCESSED / CREATED
    continue

  if matches.length > 1:
    mark candidate as REVIEW_REQUIRED / MULTIPLE_MATCHES
    continue

  existing = matches[0]
  comparison = compareSnapshot(existing, snapshot)

  if comparison.requiresReview:
    mark candidate as REVIEW_REQUIRED with comparison reason
    continue

  if comparison.hasMeaningfulChanges:
    update existing canonical_hotel using conservative merge policy
    mark candidate as PROCESSED / UPDATED
    continue

  update existing canonical_hotel seen/source timestamps only
  mark candidate as PROCESSED / SEEN_WITHOUT_CHANGES
```

### Canonical hotel indexes

```ts
db.canonical_hotels.createIndex({ canonicalKey: 1 }, { unique: true });
db.canonical_hotels.createIndex({ normalizedName: 1 });
db.canonical_hotels.createIndex({ kind: 1 });
db.canonical_hotels.createIndex({ "location.postcode": 1 });
db.canonical_hotels.createIndex({ "location.locality": 1 });
db.canonical_hotels.createIndex({ "location.district": 1 });
db.canonical_hotels.createIndex({ "contacts.phones": 1 });
db.canonical_hotels.createIndex({ "contacts.emails": 1 });
db.canonical_hotels.createIndex({ "contacts.domains": 1 });
db.canonical_hotels.createIndex({ "webPresence.domains": 1 });
db.canonical_hotels.createIndex({ lastSeenAt: 1 });
```

## Initial deterministic candidate rules

Start with a small rule set.

### `single_registry_entry`

Input:

```text
One hotel_registry_entry
```

Output:

```text
One SINGLE_PROPERTY candidate
```

Capacity mode:

```text
SINGLE_COMPONENT
```

Component behavior:

```text
One component with the registry entry's location, contacts and capacity.
```

### `numbered_units_same_base_same_contacts`

Input:

```text
Multiple registry entries with same baseName, numeric/unit suffixes, same postcode/locality context and same contacts/operator context.
```

Example:

```text
THALASSINES 10
THALASSINES 11
THALASSINES 12
THALASSINES 13
```

Output:

```text
One PROPERTY_COMPLEX candidate
```

Capacity mode:

```text
SUM_COMPONENTS
```

Component behavior:

```text
One component per registry entry, each with its own location, contacts and capacity.
```

### `same_name_multi_type_same_contacts`

Input:

```text
Multiple registry entries with same normalized name, different establishmentType, same address/postcode/locality and same contacts/operator context.
```

Examples:

```text
NISSIANA hotel + NISSIANA hotel apartments
NATURA BEACH hotel + NATURA BEACH tourist villas
```

Output:

```text
One PROPERTY_COMPLEX candidate
```

Capacity mode:

```text
SUM_COMPONENTS
```

Component behavior:

```text
One component per registry entry, each with its own establishment type, location, contacts and capacity.
```

## Non-rules

The following must not create grouped candidates by themselves:

```text
Same chain/group domain only.
Same operator only.
Same phone only.
Same email only.
Same short name only.
Same establishmentType only.
Same city/locality only.
ANNEX suffix only.
```

Shared chain or group domains such as `tsokkos.com`, `atlanticahotels.com`, `kanikahotels.com`, `louishotels.com`, `leonardo-hotels.com`, `radissonhotels.com` do not prove that two hotels are one marketed object.

## LLM usage

Do not use LLM in the initial implementation of these new transformations.

If a case is unclear:

```text
Keep candidates separate or mark final-stage candidate as REVIEW_REQUIRED.
```

The project can use LLM later as a development assistant to discover new deterministic rules, but not as a runtime source of vague confidence.

No fields like this:

```text
confidence
llmConfidence
maybeSameHotel
probablyRelated
```

Experience should be accumulated in code rules and `build.rule` / `build.ruleVersion`, not in fuzzy runtime decisions.
