# HOTEL_PROCESSING_PLAN.md

## Purpose

This document describes the current hotel processing plan for `hr-core`, a NestJS backend/back-office service for receiving, analyzing and saving hotel data for Cyprus.

The backend owns the ingestion and canonicalization process. Future product services should consume only `canonical_hotels` and should not know how the hotel data was obtained, parsed, deduplicated or merged.

The plan is intentionally conservative and minimal. The project is maintained by one developer, so the pipeline must avoid unnecessary hotel-domain entities, vague confidence scores, hidden relation graphs and data kept "just in case".

Main product rule:

```text
Wrong merge is worse than temporary non-merge.
```

If the system cannot deterministically prove that several records are one marketed hotel object, it keeps them separate.

## High-level data flow

The hotel data pipeline has four domain collections:

```text
raw_hotels
  -> hotel_registry_entries
  -> canonical_hotel_candidates
  -> canonical_hotels
```

There is one operational collection:

```text
hotel_processing_runs
```

`hotel_processing_runs` is not a hotel domain collection. It tracks background stage runs, batch progress and status endpoint responses.

The existing PDF parsing endpoint remains unchanged in this iteration:

```text
POST /gov-cy-pdf-hotels/parse
```

It already produced the initial `raw_hotels` data. The current priority is to build the next processing stages.

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

## Enums

```ts
export enum HOTEL_PROCESSING_STATUS {
  PENDING = "pending",
  CLAIMED = "claimed",
  PROCESSED = "processed",
  FAILED = "failed",
  IGNORED = "ignored",
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

## Common processing blocks

Each non-final domain collection has a `processing` block pointing to the next level.

```ts
import { ObjectId } from "mongodb";

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
export interface ICanonicalHotelCandidateProcessing {
  status: HOTEL_PROCESSING_STATUS;
  runId: string | null;
  claimedAt: Date | null;
  processedAt: Date | null;
  canonicalHotelId: ObjectId | null;
  error: string | null;
}
```

`claimedAt` is used to recover stale claimed documents after a backend crash.

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

### Minimal document shape

```ts
export interface IHotelRegistryEntryName {
  original: string;
  normalized: string;
  baseName: string;
  suffix: string | null;
}
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

### Safe grouping examples

`THALASSINES 10`, `THALASSINES 11`, `THALASSINES 12` may become one `PROPERTY_COMPLEX` candidate if they share:

- Same `baseName`.
- Numeric/unit suffixes.
- Same postcode/locality context.
- Same contact set or strongly matching contacts.
- Same operator where available.

`NISSIANA` hotel and `NISSIANA` hotel apartments may become one `PROPERTY_COMPLEX` candidate if they share:

- Same normalized name.
- Same address/postcode/locality.
- Same contacts.
- Same operator where available.

### Non-grouping examples

`CHRISTABELLE` and `CHRISTABELLE ANNEX` should remain separate candidates by default.

Reason: the official source says they are separate registry rows, likely separate buildings or accommodation objects. The system does not need a special relation entity for this. Keeping them separate is safe.

Different Hilton, Marriott, Leonardo, Radisson, Tsokkos, Atlantica or Kanika properties must remain separate unless there is a deterministic property-level rule proving they are one marketed object. A shared chain/group website is not enough.

### Minimal document shape

```ts
export interface ICanonicalHotelComponent {
  name: string;
  establishmentType: string | null;
  rooms: number | null;
  beds: number | null;
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

`components` is business composition, not trace history. It stores the component names and capacity that form this candidate. It does not store previous-level ids.

Do not store:

```text
confidence
possibleRelatedCandidateIds
relationHints
sameComplexMaybe
llmReasoning
hotelRegistryEntryIds
```

If the implementation needs to see which registry entries became this candidate, use reverse lookup:

```ts
db.hotel_registry_entries.find({
  "processing.canonicalHotelCandidateId": candidateId,
});
```

### Processing link

`canonical_hotel_candidates.processing.canonicalHotelId` points to `canonical_hotels._id`.

## Collection 4: `canonical_hotels`

### Responsibility

`canonical_hotels` stores final product-facing hotel objects.

Future services should consume this collection and should not know about raw parsing, registry dedupe or candidate building.

### Problem solved

Provide a stable, marketing-oriented hotel dataset for search, enrichment, SEO, nearby places, Google Business matching, Booking matching and other future services.

### Final-stage decisions

The final stage has only two successful outcomes:

```text
Create a new canonical hotel.
Update an existing canonical hotel.
```

If exactly one existing canonical hotel matches the candidate by deterministic rules, update it.

If no existing canonical hotel matches, create a new one.

If multiple existing canonical hotels match, fail the candidate processing and store an error. Do not guess.

### Minimal document shape

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
export interface ICanonicalHotel {
  _id: ObjectId;
  canonicalKey: string;
  status: CANONICAL_HOTEL_STATUS;
  kind: CANONICAL_HOTEL_KIND;
  canonicalName: string;
  location: IHotelLocation;
  geo: IHotelGeo;
  operator: string | null;
  contacts: IHotelContacts;
  capacity: ICanonicalHotelCapacity;
  components: ICanonicalHotelComponent[];
  createdAt: Date;
  updatedAt: Date;
}
```

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

If needed later, the model can be extended with `geo.area`, but not now.

### Field notes

`canonicalKey` is the idempotency key for future updates.

`components` is the current business composition of the hotel object. It should be replaced or updated from the latest accepted candidate and must not become a growing history array.

Do not store:

```text
canonicalHotelCandidateIds
hotelRegistryEntryIds
rawHotelIds
allPreviousVersions
confidence
possibleDuplicates
```

Traceability is done through reverse lookups from previous levels.

## Operational collection: `hotel_processing_runs`

### Responsibility

`hotel_processing_runs` tracks lifecycle and progress of stage runs.

This collection is required because one run consists of many BullMQ batch jobs. A status endpoint must be able to return final run status even after all queue jobs are completed.

### Problem solved

Provides a durable back-office view of processing runs independent of individual BullMQ batch jobs.

### Minimal document shape

```ts
export interface IHotelProcessingRunStats {
  total: number;
  processed: number;
  failed: number;
  ignored: number;
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

## Processing orchestration

### BullMQ direction

Use BullMQ for background batch processing of the new stages.

BullMQ is responsible for:

- Running stage batches outside the HTTP request lifecycle.
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

Reason: the initial dataset has around 774 objects. A batch size of 50 gives about 16 batches per full stage, which is small enough for safe retries and simple enough for a solo-maintained project.

Each batch job:

1. Claims up to 50 pending source documents.
2. Processes the claimed documents.
3. Updates per-document `processing` fields.
4. Updates `hotel_processing_runs` counters.
5. Checks whether pending source documents remain.
6. Schedules the next batch job only if pending source documents remain.
7. Completes the run when no pending source documents remain.

### Stage barriers

Stages are sequential, not streaming.

Do not run stages in parallel as a pipeline.

Rule:

```text
The next stage can start only after the previous stage has fully completed.
```

Reason: some candidate-building logic needs the full previous-level dataset. For example, `THALASSINES 10`, `THALASSINES 11`, `THALASSINES 12` must be visible together before creating a grouped `PROPERTY_COMPLEX` candidate. If the next stage starts too early, it can create incomplete candidates and push wrong data into `canonical_hotels`.

Required barriers:

```text
registry_to_candidates can start only after raw_to_registry is complete.
candidates_to_canonical can start only after registry_to_candidates is complete.
```

A previous stage is complete only when:

- There is no active run for the previous stage with status `QUEUED` or `RUNNING`.
- There are no previous-level source documents with `processing.status` equal to `PENDING`, `CLAIMED` or `FAILED`.
- All previous-level source documents are either `PROCESSED` or `IGNORED`.

`FAILED` documents block the next stage. If a document should not participate in the pipeline, it must be explicitly marked as `IGNORED`.

### Stale claimed recovery

Before starting a run or batch, recover stale claimed source documents.

A stale claimed document is a document with:

```text
processing.status = CLAIMED
processing.claimedAt older than the configured stale timeout
```

For the new non-LLM stages, start with a stale timeout of 30 minutes.

Recovery action:

```text
CLAIMED -> PENDING
runId -> null
claimedAt -> null
error -> optional recovery note or null
```

## Endpoints to create

### Start raw to registry stage

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

### Start registry to candidates stage

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

If previous stage is not complete, return `409 Conflict`.

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
    "failed": 2
  }
}
```

### Start candidates to canonical stage

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

If previous stage is not complete, return `409 Conflict`.

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
    "failed": 0
  }
}
```

### Get run status

```text
GET /hotel-processing/runs/:runId
```

Responsibility:

- Return durable run state from `hotel_processing_runs`.
- Optionally include recalculated source document counters for the run's stage.

Response example:

```json
{
  "ok": true,
  "runId": "2026-05-02T18-30-00-raw-to-registry",
  "stage": "raw_to_registry",
  "status": "running",
  "batchSize": 50,
  "stats": {
    "total": 774,
    "processed": 300,
    "failed": 0,
    "ignored": 0
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

## Stage implementation details

### Stage 1: `raw_hotels -> hotel_registry_entries`

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

### Stage 2: `hotel_registry_entries -> canonical_hotel_candidates`

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
- Set each registry entry's `processing.canonicalHotelCandidateId`.
- Set each registry entry's `processing.status = PROCESSED`.

Do not create relation documents.

Do not store weak relation hints.

Do not use LLM in this stage in the initial implementation.

If a pattern is unclear, keep registry entries separate.

### Stage 3: `canonical_hotel_candidates -> canonical_hotels`

Input collection:

```text
canonical_hotel_candidates
```

Output collection:

```text
canonical_hotels
```

Processing:

- Claim up to 50 `canonical_hotel_candidates` with `processing.status = PENDING`.
- For each candidate, find deterministic match in `canonical_hotels`.
- If exactly one match exists, update it.
- If no match exists, create a new canonical hotel.
- If multiple matches exist, fail candidate processing.
- Set candidate's `processing.canonicalHotelId`.
- Set candidate's `processing.status = PROCESSED`.

The only successful outcomes are:

```text
Create new canonical hotel.
Update existing canonical hotel.
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

Do not use LLM in the initial implementation of these new stages.

If a case is unclear:

```text
Keep candidates separate.
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
