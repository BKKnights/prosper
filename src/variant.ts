export interface IVariantPicks {
  [symbol: symbol]: any;
}

export class Variant {
  name: string;
  picks: IVariantPicks;

  constructor(name: string, picks: IVariantPicks) {
    this.name = name;
    this.picks = picks;
  }

  public getPick<T>(symbol: symbol): T {
    return this.picks[symbol] as T;
  }
}
