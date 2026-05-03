import { normalizeHotelCapacity } from './hotel-capacity-normalization.util';

describe('hotelCapacityNormalizationUtil', () => {
  it.each([
    ['AGIA MARINA', 10, 5, 5, 10],
    ['AGIOS ANDRONIKOS', 12, 6, 6, 12],
    ['ARCHONTIKO I MISIRLOU', 10, 3, 3, 10],
    ['ATRATSA MOUNTAIN APARTMENTS', 12, 5, 5, 12],
    ['BYZANTINO', 4, 2, 2, 4],
    ['DEL CONTE', 10, 4, 4, 10],
    ['ELIAKON 1', 6, 2, 2, 6],
    ['ELIAKON 2', 4, 2, 2, 4],
    ['ELIANTHOUSA', 6, 2, 2, 6],
    ['HANI TOU CHRISOMILOU', 2, 1, 1, 2],
    ['LAOURI', 6, 2, 2, 6],
    ['MAISON ELENA', 12, 4, 4, 12],
    ['MARATHO', 8, 4, 4, 8],
    ['MARATHO 2', 6, 3, 3, 6],
    ['PANTHEON', 12, 6, 6, 12],
    ['THEOXENEIA', 6, 3, 3, 6],
    ['TO KASTRI', 8, 3, 3, 8],
    ['TO PALATAKI TIS VASILIKIS', 10, 3, 3, 10],
    ['LOUTRAKI', 12, 6, 6, 12],
    ['HORIO', 4, 2, 2, 4],
  ])(
    'swaps reversed parsed capacity for %s',
    (
      _name,
      parsedRooms,
      parsedBeds,
      expectedRooms,
      expectedBeds,
    ) => {
      expect(
        normalizeHotelCapacity({
          beds: parsedBeds,
          rooms: parsedRooms,
        }),
      ).toEqual({
        beds: expectedBeds,
        rooms: expectedRooms,
      });
    },
  );

  it.each([
    [null, 10],
    [10, null],
    [0, 0],
    [10, 0],
    [0, 10],
  ])('does not swap incomplete or zero capacity rooms=%s beds=%s', (rooms, beds) => {
    expect(
      normalizeHotelCapacity({
        beds,
        rooms,
      }),
    ).toEqual({
      beds,
      rooms,
    });
  });

  it('keeps already valid capacity unchanged', () => {
    expect(
      normalizeHotelCapacity({
        beds: 366,
        rooms: 177,
      }),
    ).toEqual({
      beds: 366,
      rooms: 177,
    });
  });
});
