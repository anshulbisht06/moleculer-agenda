/**
 * Demo: use agenda to define an job and do runNow.
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
      name: 'logMe',
      handler: (job) => {
        broker.logger.info(`${job.attrs.name} me ${new Date().toISOString()}`);
      },
    }],
  });

  // Bundle it with try and catch.
  try {
    // Start server.
    await broker.start();

    // Run now: will run in background.
    await broker.call('agenda.runNow', { name: 'logMe' });
    // Give 1 s to run.
    await delay(1000);

    // Stop it.
    await broker.stop();
    await mongoDB.stop();
    broker.logger.info('MongoDB is stopped.');
    process.exit(0);
  } catch (err) {
    broker.logger.error(err.message);
    process.exit(1);
  }
})();
