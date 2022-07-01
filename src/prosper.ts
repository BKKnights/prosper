import { BaseExperiment } from './base-experiment';
import { isEqual, difference } from 'lodash';

export class Prosper<Experiment extends BaseExperiment<unknown>> {
  public experiments: Experiment[] = [];
  public usedSymbols: Set<symbol> = new Set<symbol>();

  // session api
  public async setForUser(userId?: string): Promise<void> {
    for (let i = 0; i < this.experiments.length; i++) {
      await this.experiments[i].setForUser(userId);
    }
  }

  // session api
  public hasPick(symbol: symbol): boolean {
    return this.experiments.map((experiment) => experiment.hasPick(symbol)).some((v) => v === true);
  }

  // session api
  public pick<T>(symbol: symbol): T {
    const found = this.experiments.find((experiment) => experiment.hasPick(symbol));
    if (!found) {
      throw new Error(`unable to find ${symbol.toString()}`);
    }
    return found.pick<T>(symbol);
  }

  // setup api
  private validate(experiment: Experiment): Set<symbol> {
    const { variants } = experiment;
    const pickSymbols: symbol[] = Object.getOwnPropertySymbols(variants[0]?.picks || {});
    if (this.experiments.some((existingExperiment: Experiment) => existingExperiment.name === experiment.name)) {
      throw new Error(`Experiment name "${experiment.name}" already used`);
    }
    for (let i = 1; i < variants.length; i++) {
      const variant = variants[i];
      const variantPickSymbols = Object.getOwnPropertySymbols(variant.picks);
      if (!isEqual(variantPickSymbols, pickSymbols)) {
        throw new Error(
          `Variant "${variant.name}" contains pick(s) ${difference(variantPickSymbols, pickSymbols)
            .map((v) => v.toString())
            .join(', ')} not in "${variants[0].name}"`
        );
      }
    }
    const newSymbolsSet = new Set(pickSymbols);
    newSymbolsSet.forEach((symbol: symbol) => {
      if (this.usedSymbols.has(symbol)) {
        throw new Error(`Variant pick name ${symbol.toString()} already used`);
      }
    });
    return newSymbolsSet;
  }

  // setup api
  public with(experiment: Experiment): this {
    const newSymbols = this.validate(experiment);
    this.experiments.push(experiment);
    this.usedSymbols = new Set([...this.usedSymbols, ...newSymbols]);
    return this;
  }

  // external api
  public getExperiment(experimentName: string): Experiment {
    const experiment = this.experiments.find((experiment) => experiment.name === experimentName);
    if (experiment) {
      return experiment;
    }
    throw new Error(`Experiment "${experimentName}" not found`);
  }

  // external api
  public experimentExists(experimentName: string): boolean {
    try {
      this.getExperiment(experimentName);
    } catch (e) {
      return false;
    }
    return true;
  }

  public checkExperimentHasVariant(experimentName: string, variantName: string): void {
    const experiment = this.getExperiment(experimentName);
    const variantNames = new Set(experiment.variants.map((variant) => variant.name));

    if (!variantNames.has(variantName)) {
      throw new Error(`Variant "${variantName}" does not exist in Experiment "${experimentName}".`);
    }
  }
}

export type ProsperClass<T extends BaseExperiment<unknown>> = { prosper: Prosper<T> };

// setup api
export function pick<Experiment extends BaseExperiment<unknown>>(
  serviceIdentifier: symbol
): <T extends ProsperClass<Experiment>>(target: T, targetKey: string) => void {
  return function <T extends ProsperClass<Experiment>>(target: T, targetKey: string): void {
    Object.defineProperty(target, targetKey, {
      get(): T {
        const prosper = (this.prosper as Prosper<Experiment>) ?? undefined;
        if (!prosper) {
          throw new Error('.prosper property missing');
        }
        if (!prosper.hasPick(serviceIdentifier)) {
          throw new Error(`pick ${serviceIdentifier.toString()} is not available`);
        }
        return prosper.pick<T>(serviceIdentifier);
      },
    });
  };
}
