import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import {
  hasStrongCanonicalHotelIdentity,
  makeCanonicalHotelKey,
} from './canonical-hotel-key.util';

describe('makeCanonicalHotelKey', () => {
  it('builds a stable key from canonicalName and location without persisted normalizedName', () => {
    expect(
      makeCanonicalHotelKey({
        canonicalName: 'Amyth of Nicosia Boutique',
        kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
        location: {
          address: '29 Patriarchou Grigoriou',
          district: 'NICOSIA',
          locality: 'Nicosia',
          postcode: '1016',
        },
        operator: 'Thanos Heritage Nicosia Hotels Ltd',
      }),
    ).toBe(
      'chv1|single_property|AMYTH OF NICOSIA BOUTIQUE|NICOSIA|NICOSIA|1016|29 PATRIARCHOU GRIGORIOU',
    );
  });

  it('does not include mutable capacity or candidate identifiers', () => {
    const key = makeCanonicalHotelKey({
      canonicalName: 'Pine View Boutique',
      kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
      location: {
        address: null,
        district: 'LIMASSOL',
        locality: 'Saittas',
        postcode: '4748',
      },
      operator: 'Pine View Ltd',
    });

    expect(key).toBe(
      'chv1|single_property|PINE VIEW BOUTIQUE|LIMASSOL|SAITTAS|4748|PINE VIEW LTD',
    );
    expect(key).not.toContain('rooms');
    expect(key).not.toContain('beds');
    expect(key).not.toContain('candidate');
  });

  it('accepts address and operator as strong identity when postcode is missing', () => {
    const params = {
      canonicalName: 'NISSIBLU BEACH',
      kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
      location: {
        address: '75C, Nissi Avenue',
        district: 'AGIA NAPA',
        locality: 'Ayia Napa',
        postcode: null,
      },
      operator: 'T.& E. Tofinis Estates Ltd',
    };

    expect(hasStrongCanonicalHotelIdentity(params)).toBe(true);
    expect(makeCanonicalHotelKey(params)).toBe(
      'chv1|single_property|NISSIBLU BEACH|AGIA NAPA|AYIA NAPA|address_operator|75C NISSI AVENUE|T AND E TOFINIS ESTATES LTD',
    );
  });

  it('accepts location and strong contact when postcode, address and operator are missing', () => {
    expect(
      hasStrongCanonicalHotelIdentity({
        canonicalName: 'MORFEAS KAKOPETRIA',
        contacts: {
          domains: [],
          emails: ['anninoschrysanthou@gmail.com'],
          phones: ['+35797759363'],
          websites: [],
        },
        kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
        location: {
          address: null,
          district: 'HILL RESORTS - KAKOPETRIA',
          locality: 'Kakopetria, Nicosia',
          postcode: null,
        },
        operator: null,
      }),
    ).toBe(true);
  });
});
