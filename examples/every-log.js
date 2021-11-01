/**
 * Demo: use agenda to define a job which log every minutes for 3 minutes.
 */
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
      handler: (job) => {
        broker.logger.info(`${job.attrs.name} job ${new Date().toISOString()}`);
      },
      every: '* * * * *',
    }],
  });

  // Bundle it with try and catch.
  try {
    // Start server.
    await broker.start();

    broker.logger.info('Await for 3 minutes.');
    // Run for 3 minutes.
    setTimeout(async () => {
      await broker.stop();
      await mongoDB.stop();
      broker.logger.info('MongoDB is stopped.');
      process.exit(0);
    }, 180000);
  } catch (err) {
    broker.logger.error(err.message);
    process.exit(1);
  }
})();
