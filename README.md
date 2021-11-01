# moleculer-agenda

Job Scheduling Mixin for [Agenda](https://www.npmjs.com/package/agenda).

![unittest](https://github.com/andreyunugro/moleculer-agenda/actions/workflows/unittest.yml/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/andreyunugro/moleculer-agenda/badge.svg?branch=main)](https://coveralls.io/github/andreyunugro/moleculer-agenda?branch=main)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/9c7ab07463f94f2691cacecd42db8305)](https://www.codacy.com/gh/andreyunugro/moleculer-agenda/dashboard?utm_source=github.com&utm_medium=referral&utm_content=andreyunugro/moleculer-agenda&utm_campaign=Badge_Coverage)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/9c7ab07463f94f2691cacecd42db8305)](https://www.codacy.com/gh/andreyunugro/moleculer-agenda/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=andreyunugro/moleculer-agenda&amp;utm_campaign=Badge_Grade)

## Install

```sh
npm install moleculer-agenda --save
```

## Usage

> You need Mongo Database, example below use [mongodb-memory-server](https://github.com/nodkz/mongodb-memory-server) package. You can see more example on examples directory.

```js
// Demo: use agenda to define a job and schedule it for next 1 minute.
const { ServiceBroker } = require('moleculer');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AgendaService = require('../index');

// Main routine.
(async () => {
  // Create broker.
  const broker = new ServiceBroker({
    logger: console,
    logLevel: 'debug',
  });

  // Create mongodb memory server.
  const mongoDB = await MongoMemoryServer.create();
  const mongoDBUri = mongoDB.getUri();
  broker.logger.info('MongoDB started: ', mongoDBUri);

  // Load my service.
  broker.createService({
    name: 'agenda',
    mixins: [AgendaService({ db: { address: mongoDBUri } })],
    jobs: [{
      name: 'log',
      handler: () => {
        broker.logger.info(`Log me ${new Date().toISOString()}`);
      },
    }],
  });

  // Bundle it with try and catch.
  try {
    // Start server.
    await broker.start();
    // Schedule it.
    await broker.call('agenda.runAt', { 
      when: 'in 1 minute',
      name: 'log',
    });

    broker.logger.info('Await for 2 minutes.');
    // Run for 2 minutes.
    setTimeout(async () => {
      await broker.stop();
      await mongoDB.stop();
      broker.logger.info('MongoDB is stopped.');
      process.exit(0);
    }, 120000);
  } catch (err) {
    broker.logger.error(err.message);
    process.exit(1);
  }
})();
```

## Actions

<!-- AUTO-CONTENT-START:ACTIONS -->

### `runEvery` 

Runs job name at the given interval

#### Parameters
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `interval` | `String` | **required** | Run every X interval |
| `name` | `String` \| `Array<string>` | **required** | Job name or list of job name to schedule every X interval. |
| `data` | `Any` | - | Optional data to run for job |
| `options` | `Agenda.JobOptions` | - | Optional options to run job. |

### `runAt`

Schedules a job to run name once at a given time.

#### Parameters
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `when` | `String` | **required** | When the job will run |
| `name` | `String` \| `Array<string>` | **required** | Job name or list of job name to schedule every X interval. |
| `data` | `Any` | - | Optional data to run for job |

### `runNow`

Schedules a job to run name once immediately.

#### Parameters
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `name` | `String` | **required** | Job name to run. |
| `data` | `Any` | - | Optional data to run for job |

### `runDisable`

Disables any job name, preventing job from being run.

#### Parameters
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `name` | `String` | **required** | Job name to disable. |

### `runEnable`

Enables any job name, allowing job to be run.

#### Parameters
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `name` | `String` | **required** | Job name to enable. |

<!-- AUTO-CONTENT-END:ACTIONS -->

<!-- AUTO-CONTENT-TEMPLATE:ACTIONS
{{#each this}}
### `{{name}}` {{#each badges}}{{this}} {{/each}}
{{#since}}
_<sup>Since: {{this}}</sup>_
{{/since}}

{{description}}

#### Parameters
| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
{{#each params}}
| `{{name}}` | {{type}} | {{defaultValue}} | {{description}} |
{{/each}}
{{^params}}
*No input parameters.*
{{/params}}

{{/each}}
-->

## Test
```sh
npm test
```

In development with watching

```sh
npm run ci
```

## License
The project is available under the [MIT license](https://tldrlegal.com/license/mit-license).
