import { normalizeHotelLocation } from './hotel-location-normalization.util';

describe('hotelLocationNormalizationUtil', () => {
  it.each([
    [
      '25, Hadjiefstathiou Street 8220, Chloraka',
      '8220',
      'Chloraka',
      '25, Hadjiefstathiou Street',
    ],
    [
      '3, Theas Aphrodites Avenue 8204, Geroskipou',
      '8204',
      'Geroskipou',
      '3, Theas Aphrodites Avenue',
    ],
    ['Poseidonos Avenue 8042, Pafos', '8042', 'Pafos', 'Poseidonos Avenue'],
    ['Poseidon Avenue 8042 Pafos', '8042', 'Pafos', 'Poseidon Avenue'],
    [
      'Chr. Papanikopoulou Street, 8820, Polis',
      '8820',
      'Polis',
      'Chr. Papanikopoulou Street',
    ],
  ])(
    'removes duplicated postal line from address %s',
    (address, postcode, locality, expectedAddress) => {
      expect(
        normalizeHotelLocation({
          address,
          locality,
          postcode,
        }),
      ).toEqual({
        address: expectedAddress,
        locality,
        postcode,
      });
    },
  );

  it('moves postcode from address when address contains only postcode and known locality', () => {
    expect(
      normalizeHotelLocation({
        address: '7731 Skarinou',
        locality: 'Skarinou',
        postcode: null,
      }),
    ).toEqual({
      address: null,
      locality: 'Skarinou',
      postcode: '7731',
    });
  });

  it('clears address when it repeats recognized postcode and locality only', () => {
    expect(
      normalizeHotelLocation({
        address: '8700, Drouseia',
        locality: 'Drouseia',
        postcode: '8700',
      }),
    ).toEqual({
      address: null,
      locality: 'Drouseia',
      postcode: '8700',
    });
  });

  it('does not change a clean street address with separate postcode and locality', () => {
    expect(
      normalizeHotelLocation({
        address: '77 Agias Theklas Avenue',
        locality: 'Sotera',
        postcode: '5391',
      }),
    ).toEqual({
      address: '77 Agias Theklas Avenue',
      locality: 'Sotera',
      postcode: '5391',
    });
  });

  it('does not remove a mismatching trailing postal line', () => {
    expect(
      normalizeHotelLocation({
        address: 'Lofou 4716, Limassol',
        locality: 'Neo Chorion',
        postcode: '8852',
      }),
    ).toEqual({
      address: 'Lofou 4716, Limassol',
      locality: 'Neo Chorion',
      postcode: '8852',
    });
  });

  it('does not treat a street-like value after four digits as locality', () => {
    expect(
      normalizeHotelLocation({
        address: '8042 Poseidonos Avenue',
        locality: null,
        postcode: null,
      }),
    ).toEqual({
      address: '8042 Poseidonos Avenue',
      locality: null,
      postcode: null,
    });
  });

  it('does not treat a street-like value after a known postcode as locality', () => {
    expect(
      normalizeHotelLocation({
        address: '8042 Poseidonos Avenue',
        locality: null,
        postcode: '8042',
      }),
    ).toEqual({
      address: '8042 Poseidonos Avenue',
      locality: null,
      postcode: '8042',
    });
  });
});
