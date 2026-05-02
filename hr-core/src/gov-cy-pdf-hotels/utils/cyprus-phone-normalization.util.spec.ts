import { normalizeCyprusPhones } from './cyprus-phone-normalization.util';

describe('normalizeCyprusPhones', () => {
  it.each([
    ['+35723725800', ['+35723725800']],
    ['23725800', ['+35723725800']],
    ['0035723725800', ['+35723725800']],
    ['35723725800', ['+35723725800']],
    ['+35799525462+35799406091', ['+35799525462', '+35799406091']],
    ['+3572662153499603286', ['+35726621534', '+35799603286']],
    ['+3572295237222952372', ['+35722952372']],
    ['+36725583991', ['+35725583991']],
    ['+22833709', ['+35722833709']],
    ['Tel: 26 621534, 99 603286', ['+35726621534', '+35799603286']],
    ['+357 22 952372 / 22 952372', ['+35722952372']],
    ['00 357 23 725800', ['+35723725800']],
  ])('normalizes %s', (value, expected) => {
    expect(normalizeCyprusPhones([value])).toEqual(expected);
  });

  it('deduplicates phones while preserving first occurrence order', () => {
    expect(
      normalizeCyprusPhones([
        '+35799525462+35799406091',
        '99525462',
        'Tel: 22 952372 / 22 952372',
      ]),
    ).toEqual(['+35799525462', '+35799406091', '+35722952372']);
  });

  it('drops values that cannot be normalized safely', () => {
    expect(normalizeCyprusPhones(['123', '+441234567890'])).toEqual([]);
  });
});
