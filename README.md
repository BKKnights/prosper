## `\\//,` Prosper
A continuously improving, experimentation framework.

[![semantic-release: prosper](https://img.shields.io/badge/semantic--release-prosper-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

### Installation
#### npm
```bash
npm i @bkknights/prosper
```
#### yarn
```bash
yarn add @bkknights/prosper
```

### Why
Prosper provides a means of:
* injecting intelligently selected experimental code that is shorted lived
* using multi armed bandit machine learning to selected which experimental code is injected
* prevents code churn where long-lived code belongs

The non-Prosper way:
* Uses feature flagging
* Favors code churn, with highly fractured experimentation
* Constantly effects test coverage
* Provides a very blurry understanding of the code base when experimenting

The Prosper way:
* Use experiments rather than Features Flags
  * Picture one master switch, rather than a many small switches
  * Code for each variant lives close together, within an experiment
* Favors short-lived experimental code, that accentuates long-lived code
  * Once understandings from a variant is known, then it can be moved from short-lived (experiment) to long-lived (source)
* Meant to churn as little as possible, using decorator `@pick(symbol)` with class properties.
* Provides a very clear understanding of the code base when experimenting


### Examples

#### Suppose we had a contrived set of classes:
This is considered 'long-term' code.  Our goal is that we want to find out if a Vulcan reply string is better, based on some user interaction.
```typescript
class ReplyHandler {
  reply() {
    return 'See ya!';
  }
}

class Service {
  replyHandler: ReplyHandler = new ReplyHandler();
  async setup(httpEvent): Promise<void> {}
  run(): string {
    return this.replyHandler.reply();
  }
}

```


##### Without Prosper
Using Feature Flags, and a hypothetical function `findBestReplyIndex`, which finds the best index for user.
Note: We now have to change from sync to async, which changes usage as well.
```typescript
class ReplyHandler {
  async reply(): string {
    // short lived code
    const index = await findBestReplyIndex();
    // long lived code
    const defaultValue = 'See ya!';
    // short lived code
    if (featureFlagsEnabled()) { // If's can get tricky, when experimenting...
      switch (index) {
        case 0: return 'Live long, and prosper.';
        // Others?
      }
    }
    return defaultValue;
  }
}

class Service {
  replyHandler: ReplyHandler = new ReplyHandler();
  async setup(httpEvent): Promise<void> {}
  // Note: Changed from sync to async
  async run(): string {
    return await this.replyHandler.reply();
  }
}
```

##### With Prosper
Using Experiments

```typescript
// Imports
import { BaseExperiment, Variant } from 'prosper';

// Create a symbol to reference ReplyHandler
const replyHandlerSymbol = Symbol('ReplyHandler');

//
class Experiment extends BaseExperiment {
  // pretend I've connected it up to database
}

// Setup short lived experimentation Code
function whichReply(): Experiment {
  class VulcanReply extends ReplyHandler {
    reply(): string {
      return 'Live Long And Prosper';
    }
  }
  
  // Setup both defaults, and control set against experiment
  return new Experiment('Which Reply Is Best?', [
    new Variant('A: Control Set', {
      [replyHandlerSymbol]: ReplyHandler
    }),
    new Variant('B: Vulcan Greeting/Reply', {
      ...defaults,
      [replyHandlerSymbol]: VulcanReply
    }),
  ]);
}

// Instantiate Prosper, with whichReply experiment set
const prosper = new Prosper().with(whichReply());

class Service {
  prosper = prosper; // Note: Or inject?
  // Note: Now "picking" from multiple ReplyHandler's, associated in setup
  @pick(replyHandlerSymbol) replyHandler: ReplyHandler;

  // Note: Need to allow prosper to both setup and bind to a value that persists over time in 1 key location within codebase
  async setup(httpEvent): Promise<void> {
    await this.prosper.setForUser(httpEvent.userId);
  } 
  // Note: usage stayed the same
  run(): string {
    return this.replyHandler.reply();
  }
}
```

##### Key takeaways
* Tests remain isolated, period.
* A/B tests are very focused and isolated


### API
#### Class Level
Interacting with Prosper is done by creating a single instance of prosper used on classes where `@pick(Symbol)` is used.
```ts
import { Prosper, pick } from './';

const prosper = new Prosper();

class MyClass {
  prosper: Prosper = prosper;
  @pick(Symbol('foo')) foo: Function;
  bar() {
    this.foo();
  }
}
```

#### Setup
Prosper is interacted with by extending the abstract class BaseExperimentSet

```ts
import { Prosper, pick } from './';
import { BaseExperiment } from './base-experiment';

export class MyExperiment extends BaseExperiment<AlgorithmType> {
  public async getExperiment(): Promise<IExperiment | null> {
  }

  public async upsertExperiment(experiment: IExperiment): Promise<void> {
  }

  public async deleteExperiment(experiment: IExperiment): Promise<void> {
  }

  public async getUserExperiment(userId: string, experimentId: string): Promise<IUserVariant | null> {
  }

  public async upsertUserVariant(userVariant: IUserVariant): Promise<void> {
  }

  public async deleteUserVariant(userExperiment: IUserVariant): Promise<void> {
  }

  public async deleteUserVariants(): Promise<void> {
  }

  public async getAlgorithm(): Promise<Algorithm> {
  }

  public async upsertAlgorithm(algorithm: Algorithm): Promise<void> {
  }

  public async deleteAlgorithm(): Promise<void> {
  }

  public async getVariantIndex(algorithm: Algorithm): Promise<number> {
  }

  public async rewardAlgorithm(algorithm: Algorithm, userVariantIndex: number, reward: number): Promise<Algorithm> {
  }
}

new Prosper().with(setupEvents(new MyExperiment()))
```

#### Experimentation Level
Variants are written and added to an `MyExperiment`

```ts
import { Prosper } from './';
import { BaseExperiment } from './base-experiment';
import { Variant } from './variant';

const fooSymbol = Symbol('foo');
const foo1 = () => {
  // do default
};
const foo2 = () => {
  // do experiment!
};

class Experiment extends BaseExperiment {
  constructor(name: string, variants: Variant[]) {
    super();
    this.name = name;
    this.variants = variants;
  }
}

const prosper = new Prosper()
        .with(
                new Experiment('My Experiments', [
                  new Variant('Control Set: A', {
                    [fooSymbol]: foo1
                  }),
                  new Variant('Deveation: B', {
                    [fooSymbol]: foo2
                  }),
                ])
        );

// call and `await prosper.setForUser(key)` just after database connectivity!

// elsewhere in codebase
class MyClass {
  prosper = prosper;
  @pick(fooSymbol) foo: Function;

  myMethod() {
    this.foo(); // calls either `foo1` or `foo2`, whichever the algorithms is indicating
  }
}

```

...Vulcan's are cool.
