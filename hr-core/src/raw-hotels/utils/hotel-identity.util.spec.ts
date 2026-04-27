import {
  makeNameMatchKey,
  makeSoftHotelDuplicateCandidateKey,
  makeStrictHotelDedupeKey,
  normalizeHotelName,
} from './hotel-identity.util';

describe('hotelIdentityUtil', () => {
  it('normalizes hotel names with trailing class markers removed', () => {
    expect(normalizeHotelName('THE SENDAL BOUTIQUE N/A')).toBe('THE SENDAL BOUTIQUE');
    expect(normalizeHotelName('ALTIUS BOUTIQUE 2*')).toBe('ALTIUS BOUTIQUE');
    expect(normalizeHotelName('C & A C\'')).toBe('C AND A');
    expect(normalizeHotelName('TSOKKOS HOLIDAY NO. 1 B\'')).toBe('TSOKKOS HOLIDAY NO 1');
  });

  it('keeps meaningful trailing name parts intact', () => {
    expect(normalizeHotelName('THE SENDAL BOUTIQUE')).toBe('THE SENDAL BOUTIQUE');
    expect(normalizeHotelName('ALTIUS BOUTIQUE')).toBe('ALTIUS BOUTIQUE');
    expect(normalizeHotelName('NATURA BEACH')).toBe('NATURA BEACH');
    expect(normalizeHotelName('SUNRISE GARDENS')).toBe('SUNRISE GARDENS');
    expect(normalizeHotelName('THALASSINES 10')).toBe('THALASSINES 10');
  });

  it('builds a soft name match key from the normalized hotel name', () => {
    expect(makeNameMatchKey('THE SENDAL BOUTIQUE')).toBe('SENDAL');
    expect(makeNameMatchKey('ALTIUS BOUTIQUE 2*')).toBe('ALTIUS');
    expect(makeNameMatchKey('NATURA BEACH')).toBe('NATURA BEACH');
  });

  it('builds strict and soft dedupe keys from hotel identity fields', () => {
    const hotel = {
      beds: 366,
      contacts: {
        phones: ['+357 26 888 000'],
      },
      name: 'THE SENDAL BOUTIQUE N/A',
      nameNormalized: 'THE SENDAL BOUTIQUE N/A',
      postcode: ' 8852 ',
      rooms: 177,
    };

    expect(makeStrictHotelDedupeKey(hotel)).toBe('THE SENDAL BOUTIQUE|8852|+35726888000|177|366');
    expect(makeSoftHotelDuplicateCandidateKey(hotel)).toBe('SENDAL|8852|+35726888000|177|366');
  });
});
