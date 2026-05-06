export class BeachProfileNotFoundError extends Error {
  constructor() {
    super('Beach profile was not found.');
  }
}
