# Data Versioning

## Purpose

`hr-core` produces hotel-related datasets that are consumed by other projects. Those consumers must be able to depend on a known, reproducible set of data instead of whatever documents happen to be current in the database at read time.

The versioning model separates three concerns:

1. Stable entity identity.
2. Independent dataset versions.
3. Public data releases composed from compatible dataset versions.

This allows `canonical_hotels`, `beach_profiles`, and `hotel_beach_access_edges` to evolve through separate pipelines while still exposing a coherent release contract to consumers.

## Core Principles

### Stable Entity Identity

MongoDB `_id` is the stable identity for persisted entities.

For `canonical_hotels`, when a new stage 3 candidate from `canonical_hotel_candidates` is matched to an existing hotel, the existing `canonical_hotels` document is updated instead of creating a new canonical hotel document.

The same principle applies to other persisted entities:

- `canonical_hotels._id` identifies a canonical hotel.
- `beach_profiles._id` identifies a beach profile.
- `hotel_beach_access_edges._id` identifies an access edge document.

No additional identity field such as `hotelId`, `beachId`, or `edgeId` is required when `_id` already provides stable identity.

References between collections may still use fields such as `hotelId` and `beachId`, but those fields should reference the target document `_id`. They are not separate business identifiers.

### Dataset Versions Are Independent

Each dataset has its own version sequence.

Examples of datasets:

- `canonical_hotels`
- `beach_profiles`
- `hotel_beach_access_edges`

If only canonical hotels change, only the `canonical_hotels` dataset version must change. Beach profiles and hotel-beach access edges do not need new dataset versions unless their own data has changed or must be rebuilt because of the hotel changes.

This avoids forcing unrelated collections to receive a new version number when their contents are unchanged.

### Releases Compose Dataset Versions

A public data release is a consumer-facing snapshot that declares which dataset versions are compatible and should be consumed together.

Consumers should depend on a `data_releases` document, not on "latest documents" in individual collections.

A release may combine independently versioned datasets, for example:

- `canonical_hotels` dataset version `12`
- `beach_profiles` dataset version `4`
- `hotel_beach_access_edges` dataset version `7`

The release is the external contract. Dataset versions are internal building blocks used to form that contract.

## Collections and Responsibilities

## `dataset_versions`

The `dataset_versions` collection records the lifecycle and metadata of each dataset version.

Each document represents one version of one dataset.

Example:

```js
{
  _id: ObjectId("..."),
  dataset: "canonical_hotels",
  version: 12,
  status: "published",
  sourceRunIds: [
    ObjectId("...")
  ],
  metrics: {
    total: 1842,
    manuallyChecked: 320,
    verified: 210,
    withoutGeo: 47,
    duplicatesMerged: 18
  },
  createdAt: ISODate("2026-05-09T00:00:00.000Z"),
  publishedAt: ISODate("2026-05-09T00:30:00.000Z")
}
```

Responsibilities:

- Knows the dataset name.
- Knows the dataset version number.
- Knows the status of that dataset version.
- Knows source runs or pipeline runs used to produce the version.
- Knows metrics for that dataset version.
- May know validation results for that dataset version.

Non-responsibilities:

- Does not represent a public release by itself.
- Does not need to know which projects consume the data.
- Does not need to contain full copies of dataset documents.
- Does not need to force other datasets to increment their versions.

Recommended statuses:

```js
"draft"
"validating"
"published"
"rejected"
"deprecated"
```

## `data_releases`

The `data_releases` collection is the public contract for consumers.

Each document represents one coherent release made from specific dataset versions.

Example:

```js
{
  _id: ObjectId("..."),
  version: 5,
  key: "2026.05.09-1",
  status: "published",
  components: {
    canonicalHotels: {
      datasetVersion: 12
    },
    beachProfiles: {
      datasetVersion: 4
    },
    hotelBeachAccessEdges: {
      datasetVersion: 7
    }
  },
  metrics: {
    hotels: 1842,
    beaches: 173,
    hotelBeachEdges: 9210,
    manuallyCheckedHotels: 320,
    verifiedHotels: 210,
    hotelsWithoutGeo: 47
  },
  notes: "Updated canonical hotel deduplication and geo verification.",
  createdAt: ISODate("2026-05-09T01:00:00.000Z"),
  publishedAt: ISODate("2026-05-09T01:15:00.000Z")
}
```

Responsibilities:

- Knows the public release version.
- Knows the public release key.
- Knows which dataset versions are part of the release.
- Knows release-level metrics.
- Knows whether the release is published, deprecated, or rejected.
- Provides a stable contract for external projects.

Non-responsibilities:

- Does not store the actual hotel, beach, or edge documents.
- Does not replace dataset-level versioning.
- Does not require individual dataset documents to know release membership.
- Does not imply that all datasets were rebuilt at the same time.

Consumers should use the release as their entry point, for example:

```txt
DATA_RELEASE=2026.05.09-1
```

Then the consumer resolves the release to component dataset versions and queries the corresponding collections using those dataset versions.

## `canonical_hotels`

The `canonical_hotels` collection stores canonical hotel documents.

Each document knows its own dataset version.

Example:

```js
{
  _id: ObjectId("..."),
  name: "Example Hotel",
  geo: {
    lat: 34.755,
    lng: 32.421
  },
  verificationStatus: "VERIFIED",
  datasetVersion: 12
}
```

Responsibilities:

- Knows the canonical hotel data.
- Knows the stable `_id` of the hotel.
- Knows the `canonical_hotels` dataset version it belongs to.
- Knows hotel-level verification and geo status.

Non-responsibilities:

- Does not know which public data releases include it.
- Does not know which consumer projects use it.
- Does not know beach profile versioning.
- Does not know hotel-beach access edge versioning.
- Does not need a separate `hotelId` field if `_id` is stable.

When an existing hotel is updated in a new dataset version, the document keeps the same `_id` and receives the new `datasetVersion`.

## `beach_profiles`

The `beach_profiles` collection stores beach documents.

Each document knows its own dataset version.

Example:

```js
{
  _id: ObjectId("..."),
  name: "Example Beach",
  geo: {
    lat: 34.982,
    lng: 34.001
  },
  datasetVersion: 4
}
```

Responsibilities:

- Knows the beach profile data.
- Knows the stable `_id` of the beach profile.
- Knows the `beach_profiles` dataset version it belongs to.
- Knows beach-level validation and metadata.

Non-responsibilities:

- Does not know which public data releases include it.
- Does not know which consumer projects use it.
- Does not know canonical hotel versioning.
- Does not know hotel-beach access edge versioning.
- Does not need a separate `beachId` field if `_id` is stable.

## `hotel_beach_access_edges`

The `hotel_beach_access_edges` collection stores access relationships between hotels and beaches.

The edge should be stored once and queried from either side:

- Hotel to beaches.
- Beach to hotels.

Separate documents for "hotel to beach" and "beach to hotel" are not required when both directions describe the same relationship.

Example:

```js
{
  _id: ObjectId("..."),
  hotelId: ObjectId("..."),
  beachId: ObjectId("..."),
  datasetVersion: 7,
  dependsOn: {
    canonicalHotelsVersion: 12,
    beachProfilesVersion: 4
  },
  walkingDistanceMeters: 780,
  walkingDurationSeconds: 690,
  accessStatus: "ACCESSIBLE"
}
```

Responsibilities:

- Knows the edge data.
- Knows its own stable `_id`.
- Knows the referenced hotel `_id`.
- Knows the referenced beach `_id`.
- Knows the `hotel_beach_access_edges` dataset version it belongs to.
- Knows which source dataset versions were used to calculate or validate the edge.

Non-responsibilities:

- Does not know which public data releases include it.
- Does not know which consumer projects use it.
- Does not store duplicated hotel or beach profile documents.
- Does not require separate reverse-direction duplicate documents.

If access characteristics differ by direction, the edge may store directional data inside one document:

```js
{
  _id: ObjectId("..."),
  hotelId: ObjectId("..."),
  beachId: ObjectId("..."),
  datasetVersion: 7,
  directions: {
    hotelToBeach: {
      durationSeconds: 620,
      difficulty: "EASY"
    },
    beachToHotel: {
      durationSeconds: 810,
      difficulty: "MODERATE"
    }
  }
}
```

## Querying By Release

Consumers should not query unversioned latest data.

Recommended flow:

1. Read a published `data_releases` document by `key` or `version`.
2. Resolve component dataset versions from `components`.
3. Query each dataset using its own `datasetVersion`.

Example release:

```js
{
  key: "2026.05.09-1",
  components: {
    canonicalHotels: {
      datasetVersion: 12
    },
    beachProfiles: {
      datasetVersion: 4
    },
    hotelBeachAccessEdges: {
      datasetVersion: 7
    }
  }
}
```

Example reads:

```js
db.canonical_hotels.find({
  datasetVersion: 12
});

db.beach_profiles.find({
  datasetVersion: 4
});

db.hotel_beach_access_edges.find({
  datasetVersion: 7
});
```

For hotel-to-beach access:

```js
db.hotel_beach_access_edges.find({
  hotelId: ObjectId("..."),
  datasetVersion: 7
});
```

For beach-to-hotel access:

```js
db.hotel_beach_access_edges.find({
  beachId: ObjectId("..."),
  datasetVersion: 7
});
```

## Rebuild Rules

### When Only Hotels Change

If only `canonical_hotels` changes:

- Create a new `canonical_hotels` dataset version.
- Do not create a new `beach_profiles` dataset version.
- Rebuild `hotel_beach_access_edges` only if the hotel changes affect access calculations or edge validity.
- Create a new `data_releases` document if consumers should receive the updated hotel data.

### When Only Beaches Change

If only `beach_profiles` changes:

- Create a new `beach_profiles` dataset version.
- Do not create a new `canonical_hotels` dataset version.
- Rebuild `hotel_beach_access_edges` only if the beach changes affect access calculations or edge validity.
- Create a new `data_releases` document if consumers should receive the updated beach data.

### When Access Edges Change

If only `hotel_beach_access_edges` changes:

- Create a new `hotel_beach_access_edges` dataset version.
- Keep the same hotel and beach dataset versions in the release if their data did not change.
- Record the source dataset versions in `dependsOn`.
- Create a new `data_releases` document if consumers should receive the updated access data.

## Recommended Indexes

For `dataset_versions`:

```js
{ dataset: 1, version: 1 }
{ dataset: 1, status: 1, createdAt: -1 }
```

For `data_releases`:

```js
{ key: 1 }
{ version: 1 }
{ status: 1, publishedAt: -1 }
```

For `canonical_hotels`:

```js
{ datasetVersion: 1 }
```

For `beach_profiles`:

```js
{ datasetVersion: 1 }
```

For `hotel_beach_access_edges`:

```js
{ hotelId: 1, datasetVersion: 1 }
{ beachId: 1, datasetVersion: 1 }
{ hotelId: 1, beachId: 1, datasetVersion: 1 }
{ datasetVersion: 1 }
```

## Summary

Documents in data collections know their own dataset version and stable identity. They do not know public release membership.

`dataset_versions` documents know the lifecycle, source runs, and metrics of one dataset version. They do not define the consumer-facing contract by themselves.

`data_releases` documents define the consumer-facing contract by composing compatible dataset versions. External projects should depend on releases, not on individual collection latest states.

