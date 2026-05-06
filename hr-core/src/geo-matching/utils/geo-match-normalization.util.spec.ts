import {
  extractDomain,
  isSharedHotelDomain,
  normalizeGeoMatchNameRaw,
  normalizeGeoMatchNameReduced,
  normalizeGeoMatchPhone,
} from './geo-match-normalization.util';

describe('geo match normalization utilities', () => {
  it('normalizes raw names without dropping identity words', () => {
    expect(normalizeGeoMatchNameRaw('Melpo-Antia Hotel & Suites')).toBe(
      'MELPO ANTIA HOTEL AND SUITES',
    );
  });

  it('normalizes reduced names by removing generic hotel words', () => {
    expect(normalizeGeoMatchNameReduced('Nicholas Color Hotel')).toBe(
      'NICHOLAS COLOR',
    );
  });

  it('normalizes Cyprus phone numbers to comparable digits', () => {
    expect(normalizeGeoMatchPhone('+357 23 844000')).toBe('35723844000');
    expect(normalizeGeoMatchPhone('23844000')).toBe('35723844000');
  });

  it('extracts comparable domains and identifies shared hotel domains', () => {
    expect(extractDomain('https://www.tsokkos.com/hotels')).toBe(
      'tsokkos.com',
    );
    expect(isSharedHotelDomain('tsokkos.com')).toBe(true);
    expect(isSharedHotelDomain('grecianpark.com')).toBe(false);
  });
});
