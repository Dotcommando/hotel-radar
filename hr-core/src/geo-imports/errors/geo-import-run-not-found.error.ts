export class GeoImportRunNotFoundError extends Error {
  constructor() {
    super('Geo import run was not found.');
  }
}
