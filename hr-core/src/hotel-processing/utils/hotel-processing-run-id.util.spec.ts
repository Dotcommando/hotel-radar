import {
  findLatestHotelProcessingRunId,
  isHotelProcessingRunIdSameOrAfter,
} from './hotel-processing-run-id.util';

describe('hotel processing run id utils', () => {
  it('finds the latest run id by timestamp prefix', () => {
    expect(
      findLatestHotelProcessingRunId([
        '2026-05-03T17-15-04-raw-to-registry',
        '2026-05-03T17-15-15-registry-to-candidates',
        '2026-05-02T19-00-00-registry-to-candidates',
      ]),
    ).toBe('2026-05-03T17-15-15-registry-to-candidates');
  });

  it('ignores null and malformed run ids', () => {
    expect(
      findLatestHotelProcessingRunId([
        null,
        'not-a-run-id',
        '2026-05-02T19-00-00-registry-to-candidates',
      ]),
    ).toBe('2026-05-02T19-00-00-registry-to-candidates');
  });

  it('returns null when there are no valid run ids', () => {
    expect(findLatestHotelProcessingRunId([null, 'bad-run-id'])).toBeNull();
  });

  it('checks whether one run id timestamp is same or after another', () => {
    expect(
      isHotelProcessingRunIdSameOrAfter(
        '2026-05-03T17-15-15-registry-to-candidates',
        '2026-05-03T17-15-04-raw-to-registry',
      ),
    ).toBe(true);
    expect(
      isHotelProcessingRunIdSameOrAfter(
        '2026-05-02T17-15-15-registry-to-candidates',
        '2026-05-03T17-15-04-raw-to-registry',
      ),
    ).toBe(false);
  });
});
