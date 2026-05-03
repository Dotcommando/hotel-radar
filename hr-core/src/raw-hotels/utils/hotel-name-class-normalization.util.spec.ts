import { normalizeHotelNameAndClass } from './hotel-name-class-normalization.util';

describe('normalizeHotelNameAndClass', () => {
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
