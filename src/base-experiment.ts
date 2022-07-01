import { Variant } from './variant';
import { IUserVariant } from './user-variant';

export interface IExperiment {
  id?: string;
  name: string;
  isEnabled: boolean;
}

export abstract class BaseExperiment<AlgorithmType> implements IExperiment {
  variantIndex: number;
  name: string;
  variants: Variant[];
  isEnabled: boolean;
  id?: string;

  constructor() {
    this.reset();
  }

  private async getUserVariantIndex(userId: string): Promise<number | null> {
    const experiment = await this.getExperiment();
    if (experiment) {
      const userVariant = await this.getUserVariant(userId, experiment.id);
      if (userVariant) {
        return userVariant.index;
      }
    }
    return null;
  }

  private async upsertUserVariantIndex(userId: string, index: number): Promise<void> {
    const experiment = await this.getExperiment();
    const userVariant = await this.getUserVariant(userId, experiment.id);
    await this.upsertUserVariant({
      ...userVariant,
      userId,
      index,
      experimentId: experiment.id,
    });
  }

  private async removeIndex(userId: string): Promise<void> {
    const experiment = await this.getExperiment();
    const userVariant = await this.getUserVariant(userId, experiment.id);
    await this.deleteUserVariant(userVariant);
  }

  private checkVariants(): void {
    if (this.variants.length < 1) {
      throw new Error('Empty variants');
    }
  }

  public abstract getExperiment(): Promise<IExperiment | null>;
  public abstract upsertExperiment(experiment: IExperiment): Promise<IExperiment>;
  public abstract deleteExperiment(experiment: IExperiment): Promise<void>;
  public abstract getUserVariant(userId: string, experimentId: string): Promise<IUserVariant | null>;
  public abstract upsertUserVariant(userVariant: IUserVariant): Promise<void>;
  public abstract deleteUserVariant(userVariant: IUserVariant): Promise<void>;
  public abstract deleteUserVariants(): Promise<void>;
  public abstract getAlgorithm(): Promise<AlgorithmType>;
  public abstract getVariantIndex(algorithm: AlgorithmType): Promise<number>;
  public abstract rewardAlgorithm(
    algorithm: AlgorithmType,
    userVariantIndex: number,
    score: number
  ): Promise<AlgorithmType>;
  public abstract upsertAlgorithm(algorithm: AlgorithmType): Promise<void>;
  public abstract deleteAlgorithm(): Promise<void>;

  public reset(): void {
    this.variantIndex = 0;
    this.isEnabled = false;
    delete this.id;
  }

  public async completeForUser(userId: string, score: number): Promise<void> {
    if (!this.isEnabled) {
      return;
    }
    const userVariantIndex = await this.getUserVariantIndex(userId);
    // this user may never have started an experiment
    if (userVariantIndex === null) {
      return;
    }
    await this.removeIndex(userId);
    const algorithm = await this.getAlgorithm();
    const updatedAlgorithm = await this.rewardAlgorithm(algorithm, userVariantIndex, score);
    await this.upsertAlgorithm(updatedAlgorithm);
  }

  public async setForUser(userId?: string): Promise<void> {
    const experiment = await this.getExperiment();
    if (experiment) {
      this.isEnabled = experiment.isEnabled;
      this.id = experiment.id;
      await this.setVariantIndexForUser(userId);
      return;
    }
    this.reset();
  }

  public useVariant(variantName: string): void {
    const variant = this.variants.find((variant) => variant.name === variantName);
    if (!variant) throw new Error(`Variant with name "${variantName}" not found`);
    this.variantIndex = this.variants.indexOf(variant);
  }

  /**
   * Not associated with database. Enabled for when administration happens
   */
  public safeEnable(): void {
    this.isEnabled = true;
  }

  /**
   * Not associated with database. Enabled for when administration happens
   */
  public safeDisable(): void {
    this.isEnabled = false;
  }

  public async setVariantIndexForUser(userId?: string): Promise<void> {
    const algorithm = await this.getAlgorithm();
    if (!userId) {
      this.variantIndex = await this.getVariantIndex(algorithm);
      return;
    }

    const existingUserVariantIndex = await this.getUserVariantIndex(userId);
    if (typeof existingUserVariantIndex === 'number') {
      this.variantIndex = existingUserVariantIndex;
      return;
    }

    this.variantIndex = await this.getVariantIndex(algorithm);
    await this.upsertUserVariantIndex(userId, this.variantIndex);
  }

  public async getVariant(userId: string): Promise<Variant> {
    this.checkVariants();
    if (!this.isEnabled) return null;
    await this.setVariantIndexForUser(userId);
    return this.variants[this.variantIndex];
  }

  public hasPick(symbol: symbol): boolean {
    this.checkVariants();
    return Object.getOwnPropertySymbols(this.variants[0].picks).includes(symbol);
  }

  public pick<T>(symbol: symbol): T {
    this.checkVariants();
    const variantIndex = this.variantIndex ?? 0;
    return this.variants[variantIndex].getPick(symbol);
  }

  public async enable(): Promise<void> {
    let experiment = await this.getExperiment();
    // We want to create the experiment without enabling it. This allows us to create the algorithm and then enable the experiment
    // so we don't get into a bad state where the experiment is enabled but creating the algorithm failed
    if (!experiment) {
      experiment = await this.upsertExperiment({ ...this, isEnabled: (this.isEnabled = false), name: this.name });
    }

    const newAlgorithm = await this.getAlgorithm();
    await this.upsertAlgorithm(newAlgorithm);
    await this.upsertExperiment({ ...experiment, isEnabled: (this.isEnabled = true), name: this.name });
  }

  public async disable(): Promise<void> {
    const experiment = await this.getExperiment();
    await this.deleteUserVariants();
    await this.deleteExperiment({ ...experiment, isEnabled: false });
    await this.deleteAlgorithm();
    this.reset();
  }
}
