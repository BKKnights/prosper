import { Variant, IVariantPicks } from './variant';

describe('Variant', () => {
  const name = 'experiment1';
  const sym = Symbol();
  const picks: IVariantPicks = { [sym]: 'test pick1' };
  const variant = new Variant(name, picks);

  describe('constructor', () => {
    it('should set expected properties', () => {
      expect(variant.name).toBe(name);
      expect(variant.picks).toEqual(picks);
    });
  });

  describe('getPick', () => {
    it('should return expected result', () => {
      const pick = variant.getPick<string>(sym);

      expect(pick).toBe('test pick1');
    });
  });
});
