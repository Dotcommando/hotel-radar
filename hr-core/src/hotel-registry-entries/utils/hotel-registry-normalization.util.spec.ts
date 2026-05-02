import {
  makeHotelRegistryKey,
  normalizeRegistryDomains,
  splitAndNormalizeRegistryPhones,
  splitRegistryNameSuffix,
} from './hotel-registry-normalization.util';

describe('hotelRegistryNormalizationUtil', () => {
  it('builds registry keys without capacity fields', () => {
    const firstKey = makeHotelRegistryKey({
      address: '77 Agias Theklas Avenue',
      establishmentType: 'TOURIST VILLAS',
      locality: 'Sotera',
      nameNormalized: 'THALASSINES 10',
      postcode: '5391',
      region: 'SOTERA',
    });
    const secondKey = makeHotelRegistryKey({
      address: '77, Agias Theklas Avenue',
      establishmentType: 'TOURIST VILLAS',
      locality: 'Sotera',
      nameNormalized: 'THALASSINES 10',
      postcode: '5391',
      region: 'SOTERA',
    });

    expect(firstKey).toBe(secondKey);
    expect(firstKey).toBe(
      'rkv1|THALASSINES 10|TOURIST VILLAS|SOTERA|SOTERA|5391|77 AGIAS THEKLAS AVENUE',
    );
  });

  it('keeps official numbered rows separate', () => {
    const thalassines10Key = makeHotelRegistryKey({
      address: '77 Agias Theklas Avenue',
      establishmentType: 'TOURIST VILLAS',
      locality: 'Sotera',
      nameNormalized: 'THALASSINES 10',
      postcode: '5391',
      region: 'SOTERA',
    });
    const thalassines11Key = makeHotelRegistryKey({
      address: '77 Agias Theklas Avenue',
      establishmentType: 'TOURIST VILLAS',
      locality: 'Sotera',
      nameNormalized: 'THALASSINES 11',
      postcode: '5391',
      region: 'SOTERA',
    });

    expect(thalassines10Key).not.toBe(thalassines11Key);
  });

  it('extracts numeric suffixes for later candidate grouping', () => {
    expect(splitRegistryNameSuffix('THALASSINES 10')).toEqual({
      baseName: 'THALASSINES',
      suffix: '10',
    });
    expect(splitRegistryNameSuffix('NISSIANA')).toEqual({
      baseName: 'NISSIANA',
      suffix: null,
    });
  });

  it('splits comma-separated phone strings and normalizes domains', () => {
    expect(
      splitAndNormalizeRegistryPhones(['+357 23 721 045, 24 828 528']),
    ).toEqual(['+35723721045', '24828528']);
    expect(
      normalizeRegistryDomains(['www.Example.com', 'example.com', null]),
    ).toEqual(['example.com']);
  });
});
