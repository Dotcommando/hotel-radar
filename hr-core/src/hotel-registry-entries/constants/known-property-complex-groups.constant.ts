export interface IKnownPropertyComplexGroup {
  buildRule: string;
  canonicalName: string;
  minMemberCount: number;
  normalizedBaseName: string;
  suffixes: string[];
}

export const KNOWN_PROPERTY_COMPLEX_GROUPS: IKnownPropertyComplexGroup[] = [
  {
    buildRule: 'known_property_complex_group',
    canonicalName: 'EVELEOS COUNTRY HOUSE',
    minMemberCount: 2,
    normalizedBaseName: 'EVELEOS COUNTRY HOUSE',
    suffixes: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  },
];
