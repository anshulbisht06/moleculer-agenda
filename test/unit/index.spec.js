const Agenda = require('agenda');
const events = require('events');
const { ServiceBroker } = require('moleculer');
const { MoleculerError } = require('moleculer').Errors;
const AgendaService = require('../../src');

jest.mock('agenda');

describe('Test Agenda', () => {
  const eventEmitter = new events.EventEmitter();
  eventEmitter.setMaxListeners(0);
  const errorMessage = 'errorTest';
  const error = new Error(errorMessage);
  const sampleJobObject = {};
  const int = '* * * * *';
  const validJob = new RegExp('^validJob');
  // Create mock implementation for agenda.
  const mockDisableEnable = jest.fn()
    .mockImplementation((query) => {
      if (typeof query.name !== 'undefined' && query.name === 'validJob') {
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    });
  const agendaMock = {
    on: jest.fn().mockImplementation((name, handler) => eventEmitter.on(name, handler)),
    once: jest.fn().mockImplementation((name, handler) => eventEmitter.once(name, handler)),
    start: jest.fn(),
    stop: jest.fn(),
    define: jest.fn(),
    schedule: jest.fn()
      .mockImplementation((when, name) => {
        if (validJob.test(name)) {
          return Promise.resolve(sampleJobObject);
        }
        return Promise.reject(error);
      }),
    every: jest.fn()
      .mockImplementation((interval, name) => {
        if (validJob.test(name)) {
          return Promise.resolve(sampleJobObject);
        }
        return Promise.reject(error);
      }),
    now: jest.fn()
      .mockImplementation((name) => {
        if (name === 'validJob') {
          return Promise.resolve(sampleJobObject);
        }
        return Promise.reject(error);
      }),
    disable: mockDisableEnable,
    enable: mockDisableEnable,
  };
  Agenda.mockImplementation(() => agendaMock);

  // Define service broker to use for all test.
  const broker = new ServiceBroker({ logger: false });

  // Make sure that log get mocked.
  const fakeLog = {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };
  jest.spyOn(broker, 'getLogger').mockImplementation(() => fakeLog);

  afterAll(() => {
    // Release event emitter.
    eventEmitter.removeAllListeners();
  });

  describe('Service', () => {
    it('should be created with default agenda config', () => {
      const service = broker.createService(AgendaService());
      expect(service).toBeDefined();
      expect(service.agenda).toBeDefined();
      expect(Agenda).toHaveBeenCalledWith({});
      expect(agendaMock.on).toHaveBeenCalledTimes(1);
      expect(agendaMock.once).toHaveBeenCalledTimes(1);
      broker.destroyService(service);
    });

    it('should be started and stopped properly', async () => {
      const service = broker.createService(AgendaService());
      await broker.start();
      expect(agendaMock.start).toHaveBeenCalled();
      await broker.stop();
      expect(agendaMock.stop).toHaveBeenCalled();
      broker.destroyService(service);
    });

    it('should log on agenda error', async () => {
      const service = broker.createService(AgendaService());
      await broker.start();
      eventEmitter.emit('error', new Error('TEST'));
      expect(fakeLog.error).toHaveBeenCalledWith('Agenda error: TEST');
      await broker.stop();
      broker.destroyService(service);
    });
  });

  describe('Jobs', () => {
    it('should define job correctly', () => {
      const defineAgendaService = {
        name: 'testDefine',
        mixins: [AgendaService()],
        jobs: [{
          name: 'testJob1',
          handler: () => {},
        }, {
          name: 'testJob2',
          handler: () => {},
          options: {},
        }],
      };
      const service = broker.createService(defineAgendaService);
      const { jobs } = defineAgendaService;
      expect(agendaMock.define)
        .toHaveBeenNthCalledWith(1, jobs[0].name, jobs[0].handler);
      expect(agendaMock.define)
        .toHaveBeenNthCalledWith(2, jobs[1].name, jobs[1].options, jobs[1].handler);
      broker.destroyService(service);
      agendaMock.define.mockClear();
    });

    it('should filter invalid job definition', () => {
      const service = broker.createService({
        name: 'testJobParamError',
        mixins: [AgendaService()],
        jobs: [{
          name: 'testJob1',
        }, {
          handler: () => {},
        }],
      });
      expect(agendaMock.define).not.toHaveBeenCalled();
      broker.destroyService(service);
      agendaMock.define.mockClear();
    });

    it('should schedule job correctly', () => {
      const scheduleAgendaService = {
        name: 'testSchedule',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob1',
          handler: () => {},
          // Schedule using cron string
          schedule: 'in 1 minute',
        }, {
          name: 'validJob2',
          handler: () => {},
          // Schedule using date object.
          schedule: new Date(),
        }, {
          name: 'validJob3',
          handler: () => {},
          // Schedule using date object.
          schedule: 'in 1 minute',
        }],
      };
      const service = broker.createService(scheduleAgendaService);
      const { jobs } = scheduleAgendaService;
      expect(agendaMock.define)
        .toHaveBeenNthCalledWith(1, jobs[0].name, jobs[0].handler);
      expect(agendaMock.define)
        .toHaveBeenNthCalledWith(2, jobs[1].name, jobs[1].handler);
      expect(agendaMock.define)
        .toHaveBeenNthCalledWith(3, jobs[2].name, jobs[2].handler);
      eventEmitter.emit('ready');
      // Date will get schedule first.
      expect(agendaMock.schedule)
        .toHaveBeenNthCalledWith(1, jobs[1].schedule, jobs[1].name);
      // Expect to schedule together.
      expect(agendaMock.schedule)
        .toHaveBeenNthCalledWith(2, jobs[0].schedule, [jobs[0].name, jobs[2].name]);
      broker.destroyService(service);
      agendaMock.define.mockClear();
      agendaMock.schedule.mockClear();
    });

    it('should schedule every job correctly', () => {
      const everyAgendaService = {
        name: 'testEvery',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob1',
          handler: () => {},
          every: '* * * * *',
        }, {
          name: 'validJob2',
          handler: () => {},
          every: '* * * * *',
        }],
      };
      const service = broker.createService(everyAgendaService);
      const { jobs } = everyAgendaService;
      expect(agendaMock.define)
        .toHaveBeenNthCalledWith(1, jobs[0].name, jobs[0].handler);
      expect(agendaMock.define)
        .toHaveBeenNthCalledWith(2, jobs[1].name, jobs[1].handler);
      eventEmitter.emit('ready');
      expect(agendaMock.every)
        .toHaveBeenNthCalledWith(1, jobs[0].every, [jobs[0].name, jobs[1].name]);
      broker.destroyService(service);
      agendaMock.define.mockClear();
      agendaMock.every.mockClear();
    });
  });

  describe('Run Every', () => {
    it('should call agenda.every', async () => {
      const everyAgendaService = {
        name: 'testEvery',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(everyAgendaService);
      await broker.start();
      const result1 = await service
        .runEvery(int, everyAgendaService.jobs[0].name, {});
      const result2 = await service
        .runEvery(int, everyAgendaService.jobs[0].name);
      expect(agendaMock.every)
        .toHaveBeenNthCalledWith(1, int, everyAgendaService.jobs[0].name, {}, undefined);
      expect(result1).toBe(sampleJobObject);
      expect(agendaMock.every)
        .toHaveBeenNthCalledWith(2, int, everyAgendaService.jobs[0].name, undefined, undefined);
      expect(result2).toBe(sampleJobObject);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.every.mockClear();
    });

    it('should call agenda.every and return with error', async () => {
      const everyErrorAgendaService = {
        name: 'testEvery',
        mixins: [AgendaService()],
        jobs: [{
          name: 'errorJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(everyErrorAgendaService);
      await broker.start();
      await expect(service.runEvery(int, everyErrorAgendaService.jobs[0].name)).rejects
        .toThrow(new MoleculerError(error.message, 500, 'AGENDARUNEVERY_ERROR'));
      expect(agendaMock.every)
        .toHaveBeenCalledWith(int, everyErrorAgendaService.jobs[0].name, undefined, undefined);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.every.mockClear();
    });

    it('should call runEvery', async () => {
      const runEveryAgendaService = {
        name: 'testEvery',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(runEveryAgendaService);
      await broker.start();
      const result = await broker.call('testEvery.runEvery', {
        name: 'validJob',
        interval: int,
      });
      expect(result).toBe(sampleJobObject);
      expect(agendaMock.every).toHaveBeenCalled();
      expect(agendaMock.every)
        .toHaveBeenCalledWith(int, runEveryAgendaService.jobs[0].name, undefined, undefined);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.every.mockClear();
    });

    it('should call runEvery with validation error', async () => {
      const runEveryErrorAgendaService = {
        name: 'testEvery',
        mixins: [AgendaService()],
      };
      const service = broker.createService(runEveryErrorAgendaService);
      await broker.start();
      await expect(broker.call('testEvery.runEvery', {})).rejects
        .toThrow(new Error('Parameters validation error!'));
      expect(agendaMock.every).not.toHaveBeenCalled();
      await broker.stop();
      broker.destroyService(service);
      agendaMock.every.mockClear();
    });
  });

  describe('Run At', () => {
    it('should call agenda.schedule', async () => {
      const atAgendaService = {
        name: 'testSchedule',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(atAgendaService);
      await broker.start();
      const whenDate = new Date();
      const result1 = await service
        .runAt('in 1 minute', atAgendaService.jobs[0].name, {});
      const result2 = await service
        .runAt(whenDate, atAgendaService.jobs[0].name);
      const result3 = await service
        .runAt('* * * * *', [atAgendaService.jobs[0].name]);
      expect(agendaMock.schedule)
        .toHaveBeenNthCalledWith(1, 'in 1 minute', atAgendaService.jobs[0].name, {});
      expect(result1).toBe(sampleJobObject);
      expect(agendaMock.schedule)
        .toHaveBeenNthCalledWith(2, whenDate, atAgendaService.jobs[0].name, undefined);
      expect(result2).toBe(sampleJobObject);
      expect(agendaMock.schedule)
        .toHaveBeenNthCalledWith(3, '* * * * *', [atAgendaService.jobs[0].name], undefined);
      expect(result3).toBe(sampleJobObject);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.schedule.mockClear();
    });

    it('should call agenda.schedule and return with error', async () => {
      const atErrorAgendaService = {
        name: 'testSchedule',
        mixins: [AgendaService()],
        jobs: [{
          name: 'errorJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(atErrorAgendaService);
      await broker.start();
      await expect(service.runAt('in 1 minute', atErrorAgendaService.jobs[0].name)).rejects
        .toThrow(new MoleculerError(error.message, 500, 'AGENDARUNEVERY_ERROR'));
      expect(agendaMock.schedule)
        .toHaveBeenCalledWith('in 1 minute', atErrorAgendaService.jobs[0].name, undefined);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.schedule.mockClear();
    });

    it('should call runAt', async () => {
      const runAtAgendaService = {
        name: 'testAt',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(runAtAgendaService);
      await broker.start();
      const result = await broker.call('testAt.runAt', {
        name: 'validJob',
        when: 'in 1 minute',
      });
      expect(result).toBe(sampleJobObject);
      expect(agendaMock.schedule).toHaveBeenCalled();
      expect(agendaMock.schedule)
        .toHaveBeenCalledWith('in 1 minute', runAtAgendaService.jobs[0].name, undefined);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.schedule.mockClear();
    });

    it('should call runAt with validation error', async () => {
      const runAtErrorAgendaService = {
        name: 'testAtError',
        mixins: [AgendaService()],
      };
      const service = broker.createService(runAtErrorAgendaService);
      await broker.start();
      await expect(broker.call('testAtError.runAt', {})).rejects
        .toThrow(new Error('Parameters validation error!'));
      expect(agendaMock.schedule).not.toHaveBeenCalled();
      await broker.stop();
      broker.destroyService(service);
      agendaMock.schedule.mockClear();
    });
  });

  describe('Run Now', () => {
    it('should call agenda.now', async () => {
      const nowAgendaService = {
        name: 'testNow',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(nowAgendaService);
      await broker.start();
      const result1 = await service.runNow(nowAgendaService.jobs[0].name, { test: true });
      const result2 = await service.runNow(nowAgendaService.jobs[0].name);
      expect(agendaMock.now)
        .toHaveBeenNthCalledWith(1, nowAgendaService.jobs[0].name, { test: true });
      expect(result1).toBe(sampleJobObject);
      expect(agendaMock.now)
        .toHaveBeenNthCalledWith(2, nowAgendaService.jobs[0].name, undefined);
      expect(result2).toBe(sampleJobObject);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.now.mockClear();
    });

    it('should call agenda.now and return with error', async () => {
      const nowErrorAgendaService = {
        name: 'testNow',
        mixins: [AgendaService()],
        jobs: [{
          name: 'errorJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(nowErrorAgendaService);
      await broker.start();
      await expect(service.runNow(nowErrorAgendaService.jobs[0].name)).rejects
        .toThrow(new MoleculerError(error.message, 500, 'AGENDARUNNOW_ERROR'));
      expect(agendaMock.now)
        .toHaveBeenCalledWith(nowErrorAgendaService.jobs[0].name, undefined);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.now.mockClear();
    });

    it('should call runNow', async () => {
      const runNowAgendaService = {
        name: 'testNow',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(runNowAgendaService);
      await broker.start();
      const result = await broker.call('testNow.runNow', { name: 'validJob' });
      expect(result).toBe(sampleJobObject);
      expect(agendaMock.now).toHaveBeenCalled();
      expect(agendaMock.now)
        .toHaveBeenCalledWith(runNowAgendaService.jobs[0].name, undefined);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.now.mockClear();
    });

    it('should call runNow with validation error', async () => {
      const runNowErrorAgendaService = {
        name: 'testNow',
        mixins: [AgendaService()],
      };
      const service = broker.createService(runNowErrorAgendaService);
      await broker.start();
      await expect(broker.call('testNow.runNow', {})).rejects
        .toThrow(new Error('Parameters validation error!'));
      expect(agendaMock.now).not.toHaveBeenCalled();
      await broker.stop();
      broker.destroyService(service);
      agendaMock.now.mockClear();
    });
  });

  describe('Run Disable', () => {
    it('should call agenda.disable', async () => {
      const disableJobService = {
        name: 'testDisable',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(disableJobService);
      await broker.start();
      const result1 = await service.runDisable(disableJobService.jobs[0].name);
      const result2 = await service.runDisable('anyJob');
      expect(agendaMock.disable)
        .toHaveBeenNthCalledWith(1, { name: disableJobService.jobs[0].name });
      expect(result1).toBe(1);
      expect(agendaMock.disable)
        .toHaveBeenNthCalledWith(2, { name: 'anyJob' });
      expect(result2).toBe(0);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.disable.mockClear();
    });

    it('should call runDisable', async () => {
      const disableJobService = {
        name: 'testDisable',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(disableJobService);
      await broker.start();
      const result = await broker.call('testDisable.runDisable', { name: 'validJob' });
      expect(result).toBe(1);
      expect(agendaMock.disable).toHaveBeenCalled();
      expect(agendaMock.disable)
        .toHaveBeenCalledWith({ name: disableJobService.jobs[0].name });
      await broker.stop();
      broker.destroyService(service);
      agendaMock.disable.mockClear();
    });
  });

  describe('Run Enable', () => {
    it('should call agenda.enable', async () => {
      const onJobService = {
        name: 'testOn',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(onJobService);
      await broker.start();
      const result1 = await service.runEnable(onJobService.jobs[0].name);
      const result2 = await service.runEnable('anyJob');
      expect(agendaMock.enable)
        .toHaveBeenNthCalledWith(1, { name: onJobService.jobs[0].name });
      expect(result1).toBe(1);
      expect(agendaMock.enable)
        .toHaveBeenNthCalledWith(2, { name: 'anyJob' });
      expect(result2).toBe(0);
      await broker.stop();
      broker.destroyService(service);
      agendaMock.enable.mockClear();
    });

    it('should call runEnable', async () => {
      const onJobService = {
        name: 'testEnable',
        mixins: [AgendaService()],
        jobs: [{
          name: 'validJob',
          handler: () => {},
        }],
      };
      const service = broker.createService(onJobService);
      await broker.start();
      const result = await broker.call('testEnable.runEnable', { name: 'validJob' });
      expect(result).toBe(1);
      expect(agendaMock.enable).toHaveBeenCalled();
      expect(agendaMock.enable)
        .toHaveBeenCalledWith({ name: onJobService.jobs[0].name });
      await broker.stop();
      broker.destroyService(service);
      agendaMock.enable.mockClear();
    });
  });
});
