/**
 * Demo:
 * * use agenda to define a job which do log info.
 * * use agenda to schedule log job every minutes.
 * * use agenda to disable and then enable log job.
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
        broker.logger.info(`${job.attrs.name} job ${new Date().toISOString()} with data ${JSON.stringify(job.attrs.data)}`);
      },
    }],
  });

  // Bundle it with try and catch.
  try {
    // Start server.
    await broker.start();
    // Run job every minutes.
    await broker.call('agenda.runEvery', {
      interval: '* * * * *',
      name: 'log',
      data: { test: true },
      options: {
        timezone: 'Asia/Jakarta',
        skipImmediate: true,
      },
    });

    // After 1 minute, disable a job.
    setTimeout(async () => {
      await broker.call('agenda.runDisable', { name: 'log' });
      broker.logger.debug('Disable job: log');
    }, 60000);

    // After 3 minute, enable a job.
    setTimeout(async () => {
      await broker.call('agenda.runEnable', { name: 'log' });
      broker.logger.debug('Enable job: log');
    }, 180000);

    broker.logger.info('Await for 5 minutes.');
    // Run for 3 minutes.
    setTimeout(async () => {
      await broker.stop();
      await mongoDB.stop();
      broker.logger.info('MongoDB is stopped.');
      process.exit(0);
    }, 300000);
  } catch (err) {
    broker.logger.error(err.message);
    process.exit(1);
  }
})();
