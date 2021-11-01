/**
 * Demo: use agenda to define a job which schedule log next 1 min.
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
      handler: () => {
        broker.logger.info(`Log me ${new Date().toISOString()}`);
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
