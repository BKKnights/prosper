import { pick, Prosper } from './prosper';
import { BaseExperiment } from './base-experiment';
import { IVariantPicks, Variant } from './variant';

class MockExperiment extends BaseExperiment<any> {
  constructor(name: string, variants: Variant[]) {
    super();
    this.name = name;
    this.variants = variants;
    this.setForUser = jest.fn(async () => null);
    this.hasPick = jest.fn((v) => super.hasPick(v));
    this.pick = jest.fn((v) => super.pick(v));
  }
  getExperiment = jest.fn();
  getUserVariant = jest.fn();
  upsertExperiment = jest.fn();
  upsertUserVariant = jest.fn();
  deleteExperiment = jest.fn();
  getAlgorithm = jest.fn();
  rewardAlgorithm = jest.fn();
  deleteAlgorithm = jest.fn();
  deleteUserVariant = jest.fn();
  deleteUserVariants = jest.fn();
  getVariantIndex = jest.fn();
  upsertAlgorithm = jest.fn();
}

describe('Prosper', () => {
  let thing1Symbol: symbol;
  let thing2Symbol: symbol;
  let thing1: string;
  let thing2: string;
  let experimentPicks1: IVariantPicks;
  let experimentPicks2: IVariantPicks;
  let experimentSpy1: MockExperiment;
  let experimentSpy2: MockExperiment;
  let prosper: Prosper<BaseExperiment<any>>;
  beforeEach(() => {
    thing1Symbol = Symbol('thing1');
    thing2Symbol = Symbol('thing2');
    thing1 = '123';
    thing2 = '321';
    experimentPicks1 = { [thing1Symbol]: thing1 };
    experimentPicks2 = { [thing2Symbol]: thing2 };
    experimentSpy1 = new MockExperiment('test1', [new Variant('control set', experimentPicks1)]);
    experimentSpy2 = new MockExperiment('test2', [new Variant('control set', experimentPicks2)]);
    prosper = new Prosper().with(experimentSpy1).with(experimentSpy2);
  });
  describe('setForUser', () => {
    it('iterates on each experiment set, and calls their .setForUser method with userId', async () => {
      await prosper.setForUser('123');
      expect(experimentSpy1.setForUser).toHaveBeenCalledWith('123');
      expect(experimentSpy2.setForUser).toHaveBeenCalledWith('123');
    });
  });

  describe('hasPick', () => {
    describe('when a pick is within experiment', () => {
      it('returns true', () => {
        expect(prosper.hasPick(thing1Symbol)).toEqual(true);
      });
    });
    describe('when a pick is not within experiment', () => {
      it('returns false', () => {
        const thing3Name = Symbol('thing3');
        expect(prosper.hasPick(thing3Name)).toEqual(false);
      });
    });
  });

  describe('pick', () => {
    describe('when a pick is only available', () => {
      it('iterates, calls experiment.hasPick, and continues until found, and then calls experiment.pick', () => {
        prosper.pick(thing2Symbol);
        expect(experimentSpy1.hasPick).toHaveBeenCalledWith(thing2Symbol);
        expect(experimentSpy1.pick).not.toHaveBeenCalledWith(thing2Symbol);
        expect(experimentSpy2.hasPick).toHaveBeenCalledWith(thing2Symbol);
        expect(experimentSpy2.pick).toHaveBeenCalledWith(thing2Symbol);
      });
    });
    describe('when a pick is not available', () => {
      it('eventually throws', () => {
        expect(() => {
          prosper.pick(Symbol('thing3'));
        }).toThrow('unable to find Symbol(thing3)');
      });
    });
  });

  describe('with', () => {
    describe("when an experiment's name has already been used", () => {
      it('throws', () => {
        expect(() => {
          prosper.with(new MockExperiment('test2', []));
        }).toThrow('Experiment name "test2" already used');
      });
    });

    describe('when a symbol has already been used', () => {
      it('throws', () => {
        expect(() => {
          prosper.with(new MockExperiment('bad', [new Variant('', experimentPicks1)]));
        }).toThrow('Variant pick name Symbol(thing1) already used');
      });
    });

    describe('when a symbol is not found in first Variant', () => {
      it('throws', () => {
        expect(() => {
          prosper.with(
            new MockExperiment('bad', [
              new Variant('first', { [Symbol('thing3')]: '222' }),
              new Variant('second', { [Symbol('thing4')]: '222' }),
            ])
          );
        }).toThrow('Variant "second" contains pick(s) Symbol(thing4) not in "first"');
      });
    });

    it('adds each symbol to this.usedSymbols', () => {
      expect(prosper.usedSymbols.has(thing1Symbol)).toBe(true);
      expect(prosper.usedSymbols.has(thing2Symbol)).toBe(true);
    });
  });

  describe('getExperiment', () => {
    describe('when experiment exists within Prosper instance', () => {
      it('gets that matching experiment', () => {
        expect(prosper.getExperiment('test1')).toBe(experimentSpy1);
      });
    });
    describe('when experiment does not exist within Prosper instance', () => {
      it('throws', () => {
        expect(() => {
          prosper.getExperiment('test3');
        }).toThrow('Experiment "test3" not found');
      });
    });
  });

  describe('checkExperimentHasVariant', () => {
    describe('when variant exists within experiment', () => {
      it('does not throw error', () => {
        expect(() => prosper.checkExperimentHasVariant('test1', 'control set')).not.toThrow();
      });
    });
    describe('when variant does not exist within experiment', () => {
      it.each(['', null, undefined, 'nonexistent variant'])('throws', (variantName) => {
        expect(() => prosper.checkExperimentHasVariant('test1', variantName)).toThrow(
          `Variant "${variantName}" does not exist in Experiment "test1".`
        );
      });
    });
    describe('when experiment does not exist within Prosper instance', () => {
      it.each(['', null, undefined, 'test3'])('throws', (experimentName) => {
        expect(() => {
          prosper.getExperiment(experimentName);
        }).toThrow(`Experiment "${experimentName}" not found`);
      });
    });
  });
});

describe('pick', () => {
  const fooSymbol = Symbol('foo');
  const barSymbol = Symbol('bar');
  const foo = jest.fn();
  const prosper = new Prosper().with(
    new MockExperiment('a', [
      new Variant('A', {
        [fooSymbol]: foo,
      }),
    ])
  );
  class TestableClass {
    prosper = prosper;
    @pick(fooSymbol) foo: jest.Mock;
    @pick(barSymbol) bar: jest.Mock;
  }
  beforeEach(() => {
    foo.mockReset();
  });
  describe('when .prosper property has not been defined on instance', () => {
    it('throws', () => {
      const testableClass = new TestableClass();
      delete testableClass.prosper;
      expect(() => {
        testableClass.foo();
      }).toThrow('.prosper property missing');
    });
  });
  describe('when requested pick is not available from prosper', () => {
    it('throws', () => {
      const testableClass = new TestableClass();
      expect(() => {
        testableClass.bar();
      }).toThrow('pick Symbol(bar) is not available');
    });
  });
  it('decorates class and uses prosper', () => {
    const testableClass = new TestableClass();
    const arg = 123;
    testableClass.foo(arg);
    expect(foo).toHaveBeenCalledWith(arg);
  });
});
