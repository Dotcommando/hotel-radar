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

## TypeScript Rules

### General

- No `any`.
- Do not use `object` when a precise interface can be defined.
- Avoid `as` casts unless there is no cleaner option.
- Prefer strict typing.
- Minimize unrelated formatting changes.
- Do not add new comments unless explicitly requested.
- Do not remove existing comments unless necessary.

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
