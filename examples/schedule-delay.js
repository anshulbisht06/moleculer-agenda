/**
 * Demo: use agenda to define an async job which schedule delay for 5s next 1 min.
 */
const { ServiceBroker } = require('moleculer');
const { MongoMemoryServer } = require('mongodb-memory-server');
const delay = require('delay');
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
      name: 'delay',
      handler: async (job) => {
        const delayMe = 5000;
        broker.logger.info(`${job.attrs.name} me ${delayMe} ms`);
        await delay(delayMe);
        broker.logger.info('Job finished');
      },
      schedule: 'in 1 minute',
    }],
  });

  // Bundle it with try and catch.
  try {
    // Start server.
    await broker.start();

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
