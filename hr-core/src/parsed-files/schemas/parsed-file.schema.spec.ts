import { parsedFileSchema } from './parsed-file.schema';

describe('parsedFileSchema', () => {
  it('stores parsed file fields in the parsed_files collection', () => {
    expect(parsedFileSchema.get('collection')).toBe('parsed_files');

    const filenamePath = parsedFileSchema.path('filename');
    const parsedAtPath = parsedFileSchema.path('parsedAt');
    const recordsCountPath = parsedFileSchema.path('recordsCount');

    expect(filenamePath).toBeDefined();
    expect(parsedAtPath).toBeDefined();
    expect(recordsCountPath).toBeDefined();
    expect(filenamePath.instance).toBe('String');
    expect(parsedAtPath.instance).toBe('Date');
    expect(recordsCountPath.instance).toBe('Number');
    expect(filenamePath.isRequired).toBeTruthy();
    expect(parsedAtPath.isRequired).toBeTruthy();
    expect(recordsCountPath.isRequired).toBeTruthy();
  });
});
