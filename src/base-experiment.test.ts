import { BaseExperiment, IExperiment } from './base-experiment';
import { IUserVariant } from './user-variant';
import { Variant } from './variant';

class MockAlgorithm {}

describe('BaseExperiment', () => {
  let name: string;
  let variant1: Variant;
  let variant2: Variant;
  let variants: Variant[];
  let isEnabled: boolean;
  let experiment: IExperiment | null;
  let userVariant: IUserVariant | null;
  let mockAlgorithm: MockAlgorithm;
  let userId: string;
  let foo1: jest.Mock;
  let foo2: jest.Mock;
  let variantIndex: number;
  const fooSymbol = Symbol('foo');

  function getMockExperiment(): BaseExperiment<MockAlgorithm> {
    class MockExperiment extends BaseExperiment<MockAlgorithm> {
      getExperiment = jest.fn(async (): Promise<IExperiment | null> => experiment);
      getUserVariant = jest.fn(async (): Promise<IUserVariant | null> => userVariant);
      upsertExperiment = jest.fn(async (): Promise<IExperiment> => experiment);
      upsertUserVariant = jest.fn(async (): Promise<void> => null);
      deleteExperiment = jest.fn(async (): Promise<void> => null);
      getAlgorithm = jest.fn(async (): Promise<MockAlgorithm> => mockAlgorithm);
      rewardAlgorithm = jest.fn(async (v: MockAlgorithm): Promise<MockAlgorithm> => v);
      deleteAlgorithm = jest.fn(async (): Promise<void> => null);
      deleteUserVariant = jest.fn(async (): Promise<void> => null);
      deleteUserVariants = jest.fn(async (): Promise<void> => null);
      getVariantIndex = jest.fn(async (): Promise<number> => variantIndex);
      upsertAlgorithm = jest.fn(async (): Promise<void> => null);
    }
    const mockExperiment = new MockExperiment();
    mockExperiment.name = name;
    if (experiment) {
      mockExperiment.id = experiment.id;
    }
    if (userVariant) {
      mockExperiment.variantIndex = userVariant.index;
    }
    mockExperiment.variants = variants;
    mockExperiment.isEnabled = isEnabled;
    return mockExperiment;
  }
  beforeEach(() => {
    userId = '123';
    name = 'name';
    experiment = {
      id: '456',
      name,
      isEnabled: true,
    };
    userVariant = {
      experimentId: '',
      userId,
      index: 0,
    };
    mockAlgorithm = new MockAlgorithm();
    foo1 = jest.fn();
    foo2 = jest.fn();
    variant1 = new Variant('control set', { [fooSymbol]: foo1 });
    variant2 = new Variant('b', { [fooSymbol]: foo2 });
    variants = [variant1, variant2];
    isEnabled = false;
    variantIndex = Infinity;
  });

  describe('completeForUser', () => {
    describe('when this.isEnabled is false', () => {
      it('ends early', async () => {
        isEnabled = false;
        const experiment = getMockExperiment();
        await experiment.completeForUser(userId, 1);
        expect(experiment.getExperiment).not.toHaveBeenCalled();
      });
    });
    describe('when this.isEnabled is true', () => {
      beforeEach(() => {
        isEnabled = true;
      });
      describe('when no experiment exists', () => {
        it('calls get, but still ends early', async () => {
          experiment = null;
          const mockExperiment = getMockExperiment();
          await mockExperiment.completeForUser(userId, 1);
          expect(mockExperiment.getExperiment).toHaveBeenCalled();
        });
      });
      describe('when experiment exists', () => {
        describe('when no userVariant exists', () => {
          it('does not call getAlgorithm', async () => {
            userVariant = null;
            const mockExperiment = getMockExperiment();
            await mockExperiment.completeForUser(userId, 1);
            expect(mockExperiment.getExperiment).toHaveBeenCalled();
            expect(mockExperiment.getAlgorithm).not.toHaveBeenCalled();
            expect(mockExperiment.rewardAlgorithm).not.toHaveBeenCalled();
          });
        });
        describe('when userVariant exists', () => {
          it('does call getAlgorithm & rewardAlgorithm', async () => {
            const mockExperiment = getMockExperiment();
            const score = 1;
            await mockExperiment.completeForUser(userId, score);
            expect(mockExperiment.getExperiment).toHaveBeenCalled();
            expect(mockExperiment.getAlgorithm).toHaveBeenCalled();
            expect(mockExperiment.rewardAlgorithm).toHaveBeenCalledWith(mockAlgorithm, userVariant.index, score);
          });
        });
      });
    });
  });

  describe('setForUser', () => {
    describe('when experiment is truthy', () => {
      it('sets this.isEnabled and this.id', async () => {
        isEnabled = false;
        const mockExperiment = getMockExperiment();
        mockExperiment.isEnabled = false;
        delete mockExperiment.id;
        experiment.isEnabled = true;
        experiment.id = '123';
        await mockExperiment.setForUser();
        expect(mockExperiment.isEnabled).toBe(true);
        expect(mockExperiment.id).toBe('123');
      });
    });
    describe('when experiment is falsey', () => {
      it('sets this.isEnabled to false and deletes this.id', async () => {
        isEnabled = undefined;
        const mockExperiment = getMockExperiment();
        mockExperiment.id = '123';
        experiment = null;
        await mockExperiment.setForUser();
        expect(mockExperiment.isEnabled).toBe(false);
        expect(mockExperiment.id).toBeUndefined();
      });
    });
    it('calls this.getAlgorithm', async () => {
      const mockExperiment = getMockExperiment();
      await mockExperiment.setForUser('123');
      expect(mockExperiment.getAlgorithm).toHaveBeenCalled();
    });
    it('calls this.getIndex with userId', async () => {
      const mockExperiment = getMockExperiment();
      const getIndexSpy = jest.spyOn(mockExperiment, 'setVariantIndexForUser');
      await mockExperiment.setForUser('123');
      expect(getIndexSpy).toHaveBeenCalledWith('123');
    });
  });

  describe('useVariant', () => {
    describe('when variant cannot be found', () => {
      it('throws', () => {
        expect(() => {
          getMockExperiment().useVariant('un-findable');
        }).toThrow('Variant with name "un-findable" not found');
      });
    });
    describe('when variant can be found', () => {
      it('sets this.variantIndex with correct value', () => {
        const mockExperiment = getMockExperiment();
        expect(mockExperiment.variantIndex).toEqual(0);
        mockExperiment.useVariant('b');
        expect(mockExperiment.variantIndex).toEqual(1);
      });
    });
  });

  describe('safeEnable', () => {
    it('sets this.isEnabled true', () => {
      const mockExperiment = getMockExperiment();
      mockExperiment.safeEnable();
      expect(mockExperiment.isEnabled).toEqual(true);
    });
  });

  describe('safeDisable', () => {
    it('sets this.isEnabled false', () => {
      const mockExperiment = getMockExperiment();
      mockExperiment.safeDisable();
      expect(mockExperiment.isEnabled).toEqual(false);
    });
  });

  describe('setVariantIndexForUser', () => {
    describe('when this.isEnabled is true', () => {
      beforeEach(() => {
        isEnabled = true;
      });
      describe('when userId is falsey', () => {
        it('sets this.variantIndex', async () => {
          userVariant = null;
          variantIndex = 42;
          const mockExperiment = getMockExperiment();
          await mockExperiment.setVariantIndexForUser();
          expect(mockExperiment.getVariantIndex).toHaveBeenCalled();
          expect(mockExperiment.variantIndex).toBe(variantIndex);
        });
      });
      describe('when userId is truthy', () => {
        describe('when an existing experiment is present', () => {
          describe('when an existing userVariant is not present', () => {
            it('gets variantIndex from this.getVariantIndex and returns value', async () => {
              userVariant = null;
              variantIndex = 3;
              const mockExperiment = getMockExperiment();
              await mockExperiment.setVariantIndexForUser(userId);
              expect(mockExperiment.getVariantIndex).toHaveBeenCalled();
              expect(mockExperiment.variantIndex).toBe(variantIndex);
            });
            it('upserts the userVariant', async () => {
              userVariant = null;
              variantIndex = 4;
              const mockExperiment = getMockExperiment();
              await mockExperiment.setVariantIndexForUser(userId);
              expect(mockExperiment.upsertUserVariant).toHaveBeenCalledWith({
                ...userVariant,
                userId,
                index: variantIndex,
                experimentId: mockExperiment.id,
              });
            });
          });
          describe('when an existing userVariant is preset', () => {
            describe('when index is present', () => {
              it('sets this.variantIndex', async () => {
                userVariant.index = 2;
                const mockExperiment = getMockExperiment();
                await mockExperiment.setVariantIndexForUser(userId);
                expect(mockExperiment.getVariantIndex).not.toHaveBeenCalled();
                expect(mockExperiment.variantIndex).toBe(userVariant.index);
              });
            });
            it('calls the getUserVariant event handler', async () => {
              delete userVariant.index;
              const mockExperiment = getMockExperiment();
              await mockExperiment.setVariantIndexForUser(userId);
              expect(mockExperiment.getUserVariant).toHaveBeenCalledWith(userId, mockExperiment.id);
              expect(mockExperiment.upsertUserVariant).toHaveBeenCalledWith({
                ...userVariant,
                experimentId: mockExperiment.id,
                index: variantIndex,
              });
            });
          });
        });
      });
    });
  });

  describe('getVariant', () => {
    describe('when there are less than one variant', () => {
      it('throws', async () => {
        variants.length = 0;
        const mockExperiment = getMockExperiment();
        await expect(mockExperiment.getVariant('123')).rejects.toEqual(new Error('Empty variants'));
      });
    });
    describe('when this.isEnabled is falsey', () => {
      it('returns early null', async () => {
        isEnabled = false;
        const mockExperiment = getMockExperiment();
        expect(await mockExperiment.getVariant(userId)).toBe(null);
      });
    });
    describe('when this.isEnabled is truthy', () => {
      it('returns early null', async () => {
        isEnabled = true;
        const mockExperiment = getMockExperiment();
        expect(await mockExperiment.getVariant(userId)).toBe(variant1);
      });
    });
  });

  describe('hasPick', () => {
    describe('when there are less than one variant', () => {
      it('throws', () => {
        variants.length = 0;
        const mockExperiment = getMockExperiment();
        const symbol = Symbol('test');
        expect(() => {
          mockExperiment.hasPick(symbol);
        }).toThrow('Empty variants');
      });
    });
    describe('when value is within first Variant', () => {
      it('returns true', () => {
        const mockExperiment = getMockExperiment();
        expect(mockExperiment.hasPick(fooSymbol)).toBe(true);
      });
    });
    describe('when value is not first Variant', () => {
      it('returns false', () => {
        const symbol = Symbol('test');
        const mockExperiment = getMockExperiment();
        expect(mockExperiment.hasPick(symbol)).toBe(false);
      });
    });
  });

  describe('pick', () => {
    describe('when there are less than one variant', () => {
      it('throws', () => {
        variants.length = 0;
        const mockExperiment = getMockExperiment();
        const symbol = Symbol('test');
        expect(() => {
          mockExperiment.pick(symbol);
        }).toThrow('Empty variants');
      });
    });
    describe('when this.isEnabled is falsey', () => {
      it('returns value from first variant', () => {
        isEnabled = false;
        const mockExperiment = getMockExperiment();
        expect(mockExperiment.pick(fooSymbol)).toBe(variant1.picks[fooSymbol]);
      });
    });
    describe('when this.isEnabled is truthy', () => {
      describe('when index is a number', () => {
        it('returns value from experiment', () => {
          isEnabled = true;
          const mockExperiment = getMockExperiment();
          mockExperiment.variantIndex = 0;
          expect(mockExperiment.pick(fooSymbol)).toBe(foo1);
        });
      });
    });
    describe('when this.variantIndex is null or undefined', () => {
      it.each([null, undefined])('this.variantIndex defaults to 0', (variantIndex) => {
        const mockExperiment = getMockExperiment();
        jest.spyOn(mockExperiment.variants[0], 'getPick');

        mockExperiment.variantIndex = variantIndex;
        const result = mockExperiment.pick(fooSymbol);
        expect(mockExperiment.variants[0].getPick).toHaveBeenCalledWith(fooSymbol);
        expect(result).toBe(foo1);
      });
    });
  });

  describe('enable', () => {
    it('creates experiment model if it does not exist and enables it and creates algorithm', async () => {
      const mockExperiment = getMockExperiment();
      mockExperiment.getExperiment = jest.fn().mockResolvedValue(null);
      await mockExperiment.enable();

      expect(mockExperiment.upsertExperiment).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          name: mockExperiment.name,
          isEnabled: false,
          id: mockExperiment.id,
        })
      );
      expect(mockExperiment.upsertAlgorithm).toHaveBeenCalledWith(mockAlgorithm);
      expect(mockExperiment.upsertExperiment).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          name: mockExperiment.name,
          isEnabled: true,
          id: mockExperiment.id,
        })
      );
      expect(mockExperiment.isEnabled).toBe(true);
    });

    it('enables experiment if it already exists and creates algorithm', async () => {
      const mockExperiment = getMockExperiment();
      await mockExperiment.enable();

      expect(mockExperiment.upsertExperiment).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockExperiment.name,
          isEnabled: false,
          id: mockExperiment.id,
        })
      );
      expect(mockExperiment.upsertAlgorithm).toHaveBeenCalledWith(mockAlgorithm);
      expect(mockExperiment.upsertExperiment).toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockExperiment.name,
          isEnabled: true,
          id: mockExperiment.id,
        })
      );
      expect(mockExperiment.isEnabled).toBe(true);
    });

    it('does not enable experiment if creating algorithm fails', async () => {
      const mockExperiment = getMockExperiment();
      mockExperiment.upsertAlgorithm = jest.fn().mockImplementation(() => {
        throw new Error();
      });

      await expect(mockExperiment.enable()).rejects.toBeTruthy();
      mockExperiment.enable().catch(async () => {
        expect(mockExperiment.upsertExperiment).not.toHaveBeenCalledWith(
          expect.objectContaining({
            name: mockExperiment.name,
            isEnabled: true,
            id: mockExperiment.id,
          })
        );
        expect(mockExperiment.isEnabled).toBe(false);
      });
    });
  });

  describe('disable', () => {
    it('calls this.getExperiment', async () => {
      const mockExperiment = getMockExperiment();
      await mockExperiment.disable();
      expect(mockExperiment.getExperiment).toHaveBeenCalled();
    });
    it('calls this.deleteUserVariants', async () => {
      const mockExperiment = getMockExperiment();
      await mockExperiment.disable();
      expect(mockExperiment.deleteUserVariants).toHaveBeenCalledWith();
    });
    it('calls this.deleteExperiment', async () => {
      const mockExperiment = getMockExperiment();
      await mockExperiment.disable();
      expect(mockExperiment.deleteExperiment).toHaveBeenCalledWith({
        ...experiment,
        name: mockExperiment.name,
        isEnabled: false,
      });
    });
    it('calls this.deleteAlgorithm', async () => {
      const mockExperiment = getMockExperiment();
      await mockExperiment.disable();
      expect(mockExperiment.deleteAlgorithm).toHaveBeenCalled();
    });
    it('deletes this.id', async () => {
      const mockExperiment = getMockExperiment();
      await mockExperiment.disable();
      expect(mockExperiment.id).toBe(undefined);
    });
  });
});
