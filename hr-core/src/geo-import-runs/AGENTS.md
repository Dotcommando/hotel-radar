# AGENTS.md

## Scope

These instructions apply to `hr-core/src/geo-import-runs`.

## Responsibility

`geo-import-runs` owns the `geo_import_runs` collection and durable metadata for geo import executions.

It is the geo equivalent of a run ledger, not a source data collection.

## Current Document Shape

Geo import runs store:

```text
runId
sourceType
sourceDataset
importKind
status
filePath
fileName
fileSizeBytes
fileSha256
startedAt
finishedAt
stats
error
createdAt
updatedAt
```

`stats` stores:

```text
read
inserted
updated
unchanged
markedStale
failed
```

Current statuses are:

```text
PENDING
RUNNING
COMPLETED
FAILED
```

Current implemented imports create runs directly as `RUNNING`.

## Service Rules

`GeoImportRunsService` creates running runs, finds runs by `runId`, lists recent runs, and marks runs completed or failed.

`runId` is deterministic enough for operator readability and includes timestamp, dataset, and import kind. It must not be used as the MongoDB primary key.

Do not store imported feature payloads in this collection. Source payloads belong in `hotel_geo_candidates` or `beach_profiles`.
