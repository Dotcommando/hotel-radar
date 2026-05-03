import {
  cleanHotelName,
  normalizeHotelNameAndClass,
} from './hotel-name-class-normalization.util';

describe('cleanHotelName', () => {
  it.each([
    ["DANIEL'S B'", "DANIEL'S"],
    ["SOME HOTEL A'", 'SOME HOTEL'],
    ["SOME HOTEL C'", 'SOME HOTEL'],
    ['ABC HOTEL', 'ABC HOTEL'],
    ['HOTEL BOUTIQUE', 'HOTEL BOUTIQUE'],
    ["B' HOUSE", "B' HOUSE"],
  ])('cleans only trailing Cyprus class suffix from %s', (name, expected) => {
    expect(cleanHotelName(name)).toBe(expected);
  });
});

describe('normalizeHotelNameAndClass', () => {
  it('cleans trailing Cyprus class suffix before saving hotel name', () => {
    expect(
      normalizeHotelNameAndClass({
        classRaw: null,
        name: "DANIEL'S B'",
      }),
    ).toEqual({
      classRaw: null,
      name: "DANIEL'S",
      nameNormalized: "DANIEL'S",
    });
  });

  it('keeps a numeric classRaw token as a hotel name suffix when class is already lost', () => {
    expect(
      normalizeHotelNameAndClass({
        classRaw: '2',
        name: 'PALATAKIA',
      }),
    ).toEqual({
      classRaw: null,
      name: 'PALATAKIA 2',
      nameNormalized: 'PALATAKIA 2',
    });
  });

  it.each([
    ['PALATAKIA', '2', 'PALATAKIA 2'],
    ['PALATAKIA', '3', 'PALATAKIA 3'],
    ['THALASSINES', '10', 'THALASSINES 10'],
  ])(
    'moves numeric suffix %s %s from classRaw into the normalized name',
    (name, classRaw, expectedName) => {
      expect(
        normalizeHotelNameAndClass({
          classRaw,
          name,
        }),
      ).toMatchObject({
        classRaw: null,
        name: expectedName,
        nameNormalized: expectedName,
      });
    },
  );

  it('does not damage names that already include the numeric suffix', () => {
    expect(
      normalizeHotelNameAndClass({
        classRaw: 'N/A',
        name: 'PALATAKIA 2',
      }),
    ).toEqual({
      classRaw: 'N/A',
      name: 'PALATAKIA 2',
      nameNormalized: 'PALATAKIA 2',
    });
  });
});
