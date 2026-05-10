# AGENTS.md

## Scope

These instructions apply to the whole repository and all applications inside it.

## Product Context

- This repository contains services for working with hotels in Cyprus.
- `hr-core` is the core service responsible for hotel parsing and hotel database population.
- `hr-core` uses Apify for data collection.
- Deduplication is mandatory for hotel ingestion flows and should be treated as a first-class concern.
- Node.js version must be `24` or higher across the repository.

## Architecture Rules

- Organize code by feature.
- Keep constants and enums inside feature-local `constants/` directories.
- Keep interfaces and other type definitions inside feature-local `types/` directories.
- Prefer small, explicit modules over shared generic abstractions unless reuse is already proven.

## Data Versioning Rules

- `hr-core` data consumed by other projects must be versioned through dataset versions and public data releases.
- MongoDB `_id` is the stable identity for persisted public entities. Do not add separate business identity fields such as `hotelId`, `beachId`, or `edgeId` when `_id` already provides stable identity.
- References between public collections may use fields such as `canonicalHotelId` and `beachProfileId`, but those fields must reference target document `_id` values.
- Public dataset documents know their own `datasetVersion`; they do not know which public release includes them.
- `dataset_versions` documents know one dataset name, one dataset version, lifecycle status, source run IDs, metrics, and timestamps. They are not public releases by themselves.
- `data_releases` documents compose compatible dataset versions into the consumer-facing contract. External projects must depend on `data_releases`, not on "latest" source collection state.
- The versioned source datasets are `canonical_hotels`, `beach_profiles`, and `hotel_beach_access_edges`.
- `canonical_hotels.datasetVersion`, `beach_profiles.datasetVersion`, and `hotel_beach_access_edges.datasetVersion` are independent. Do not increment unrelated datasets just because another dataset changed.
- Dataset versions must be reserved through the data versioning feature before a dataset-producing pipeline writes public data. Do not hardcode runtime writes to `datasetVersion: 1`.
- Existing data may be bootstrapped as version `1`, but new runtime pipeline output must use the next reserved dataset version.
- For mutable full datasets such as `canonical_hotels` and `beach_profiles`, a successful pipeline version must represent a complete readable dataset, not only changed documents.
- For derived edge datasets such as `hotel_beach_access_edges`, the same hotel-beach pair may exist in multiple dataset versions. Unique indexes for edges must include `datasetVersion`.
- `hotel_beach_access_edges` should store one relationship document that can be queried from either side. Do not create duplicate reverse-direction documents for hotel-to-beach and beach-to-hotel reads.
- Publication to consumer databases must use the selected `data_releases` document, copy only the component dataset versions declared by that release, drop old public target collections, recreate them, and rebuild consumer indexes.
- Publication configuration belongs in explicit environment variables such as `DATA_PUBLICATION_MONGODB_URI`, `DATA_PUBLICATION_RELEASE_KEY`, and `DATA_PUBLICATION_RELEASE_VERSION`.
- Versioning script and publication behavior must be covered with focused tests.

## TypeScript Rules

### General

- No `any`.
- Do not use `object` when a precise interface can be defined.
- Avoid `as` casts unless there is no cleaner option.
- Prefer strict typing.
- Minimize unrelated formatting changes.
- Do not add new comments unless explicitly requested.
- Do not remove existing comments unless necessary.

### Mongoose

- This repository uses Mongoose 9.x.
- Do not use deprecated `new: true` in `findOneAndUpdate()` or `findOneAndReplace()` options.
- Use `returnDocument: "after"` instead. Example:

```ts
await model.findOneAndUpdate(filter, update, {
  returnDocument: "after",
});
```

### Interfaces and Enums

- Prefer `interface` over `type` whenever an interface can express the shape.
- Every interface name must start with the `I` prefix. Example: `ISomeInterface`.
- Do not use string-union type aliases when an enum is appropriate.
- Prefer enums in uppercase snake case. Example:

```ts
export enum HOTEL_TYPE {
  HOTEL = "hotel",
  APARTMENT = "apartment",
}
```

- If an enum values array is needed, derive it via `Object.values(...)`. Example:

```ts
const HOTEL_TYPES_ARRAY = Object.values(HOTEL_TYPE);
```

## Control Flow Rules

- Do not use `while (true)`.
- All iteration must have explicit and controlled termination conditions.

## Formatting Rules

- Complex multiline conditions must be formatted like this:

```ts
if (
  condition1
    && condition2
    || condition3
) {
  handleCase();
}
```

- Do not format complex conditions like this:

```ts
if (
  condition1 &&
    condition2 ||
    condition3
) {
  handleCase();
}
```

## Comments

- Comments are allowed only rarely.
- Use comments only when important constraints or conditions are not obvious from the code itself.
- All comments must be in English.
