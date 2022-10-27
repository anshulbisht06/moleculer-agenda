const Agenda = require('agenda');
const { MoleculerError } = require('moleculer').Errors;

module.exports = function createService(agendaConfig = {}) {
  const service = {
    name: 'agenda',

    actions: {
      runEvery: {
        params: {
          interval: 'string',
          name: {
            type: 'multi',
            rules: [{
              type: 'string',
            }, {
              type: 'array',
              items: 'string',
            }],
          },
          data: { type: 'any', optional: true },
          options: {
            type: 'object',
            optional: true,
            strict: 'remove',
            props: {
              timezone: { type: 'string', optional: true },
              skipImmediate: { type: 'boolean', optional: true },
              startDate: { type: 'date', optional: true },
              endDate: { type: 'date', optional: true },
              skipDays: { type: 'string', optional: true },
            },
          },
        },
        handler({ params }) {
          const {
            interval, name, data, options,
          } = params;
          return this.runEvery(interval, name, data, options);
        },
      },

      runAt: {
        params: {
          when: {
            type: 'multi',
            rules: [{ type: 'string' }, { type: 'date' }],
          },
          name: {
            type: 'multi',
            rules: [{
              type: 'string',
            }, {
              type: 'array',
              items: 'string',
            }],
          },
          data: { type: 'any', optional: true },
        },
        handler({ params }) {
          const { when, name, data } = params;
          return this.runAt(when, name, data);
        },
      },

      runNow: {
        params: {
          name: 'string',
          data: { type: 'any', optional: true },
        },
        handler({ params }) {
          const { name, data } = params;
          return this.runNow(name, data);
        },
      },

      runDisable: {
        params: {
          name: 'string',
        },
        handler({ params }) {
          const { name } = params;
          return this.runDisable(name);
        },
      },

      runEnable: {
        params: {
          name: 'string',
        },
        handler({ params }) {
          const { name } = params;
          return this.runEnable(name);
        },
      },

      cancelJob: {
        params: {
          query: 'object',
        },
        handler({ params }) {
          const { query } = params;
          return this.cancelJob(query);
        },
      },

    },

    methods: {
      /**
       * Runs job name at the given interval
       * @param {String} interval Run every X interval.
       * @param {String|Array<string>} name Job name or list of job name to schedule every interval.
       * @param {Any} data Optional data to run for job.
       * @param {Agenda.JobOptions} options Optional options to run job.
       * @returns {Promise<Agenda.Job|MoleculerError>} Agenda job object when success.
       */
      async runEvery(interval, name, data, options) {
        this.logger.debug(`Agenda run job "${name}" every: ${interval}`);
        try {
          const job = await this.agenda.every(interval, name, data, options);
          return job;
        } catch (err) {
          const error = new MoleculerError(err.message, 500, 'AGENDARUNEVERY_ERROR');
          return this.Promise.reject(error);
        }
      },

      /**
       * Schedules a job to run name once at a given time.
       * @param {String} when When the job will run.
       * @param {String|Array<string>} name Job name or array of job names.
       * @param {Any} data Optional data to run for job.
       * @returns {Promise<Agenda.Job|MoleculerError>} Agenda job object when success.
       */
      async runAt(when, name, data) {
        this.logger.debug(`Agenda run job "${name}" at: ${when}`);
        try {
          const job = await this.agenda.schedule(when, name, data);
          return job;
        } catch (err) {
          const error = new MoleculerError(err.message, 500, 'AGENDARUNAT_ERROR');
          return this.Promise.reject(error);
        }
      },

      /**
       * Schedules a job to run name once immediately.
       * @param {String} name Job name to run.
       * @param {Any} data Job data to run.
       * @returns {Promise<Agenda.Job|MoleculerError>} Agenda job object when success.
       */
      async runNow(name, data) {
        this.logger.debug(`Agenda run job "${name}" now.`);
        try {
          const job = await this.agenda.now(name, data);
          return job;
        } catch (err) {
          const error = new MoleculerError(err.message, 500, 'AGENDARUNNOW_ERROR');
          return this.Promise.reject(error);
        }
      },

      /**
       * Disables any job name, preventing job from being run.
       * @param {String} name Job name to disable.
       * @returns {Promise<number>} 1 if success, 0 if fail.
       */
      async runDisable(name) {
        return this.agenda.disable({ name });
      },

      /**
       * Enables any job name, allowing job to be run.
       * @param {String} name Job name to enable.
       * @returns {Promise<number>} 1 if success, 0 if fail.
       */
      async runEnable(name) {
        return this.agenda.enable({ name });
      },

      /**
       * Cancels any job that matches the query passed.
       * @param {Object} query Mongodb's query.
       * @returns {Promise<number>} if success returns num of rows removed (0 for no cancel operation)
       */
      async cancelJob(query) {
        return this.agenda.cancel(query);
      },
    },

    async created() {
      // Initiate agenda.
      this.agenda = new Agenda(agendaConfig);
      // Setup agenda event error.
      this.agenda.on('error', (err) => {
        this.logger.error(`Agenda error: ${err.message}`);
      });
      // Provide container to save every & schedule.
      const jobs = { crons: {}, schedules: { date: [] } };
      // Set every & schedule when agenda is ready.
      this.agenda.once('ready', () => {
        this.logger.debug('Agenda is ready');
        const { crons, schedules } = jobs;
        // Do schedule and every here.
        Object.keys(crons).forEach((key) => {
          this.agenda.every(key, crons[key]);
          this.logger.debug(`Schedule job ${crons[key].join(', ')} every ${key}`);
        });
        Object.keys(schedules).forEach((key) => {
          if (key === 'date') {
            schedules.date.forEach((s) => {
              this.agenda.schedule(s.schedule, s.name);
              this.logger.debug(`Schedule job ${s.name} to ${s.schedule}`);
            });
          } else {
            this.agenda.schedule(key, schedules[key]);
            this.logger.debug(`Schedule job ${schedules[key].join(', ')} to ${key}`);
          }
        });
      });

      // Check whether job definitions exists.
      if (typeof this.schema.jobs !== 'undefined'
        && Array.isArray(this.schema.jobs)
        && this.schema.jobs.length > 0
      ) {
        // Compile schema for job params.
        const checkJobParams = this.broker.validator.compile({
          name: { type: 'string' },
          handler: { type: 'function' },
          options: {
            type: 'object',
            strict: 'remove',
            optional: true,
            props: {
              concurrency: { type: 'number', optional: true },
              lockLimit: { type: 'number', optional: true },
              lockLifetime: { type: 'number', optional: true },
              priority: {
                type: 'multi',
                rules: [{
                  type: 'enum', values: ['lowest', 'low', 'normal', 'high', 'highest'],
                }, {
                  type: 'number',
                }],
                optional: true,
              },
              shouldSaveResult: { type: 'boolean', optional: true },
            },
          },
          schedule: {
            type: 'multi',
            rules: [{ type: 'string' }, { type: 'date' }],
            optional: true,
          },
          every: { type: 'string', optional: true },
        });
        this.schema.jobs
          .filter((j) => (checkJobParams(j) === true))
          .forEach((job) => {
            const {
              name, options, handler, schedule, every,
            } = job;
            // Define job processor.
            if (typeof options !== 'undefined') {
              this.agenda.define(name, options, handler);
            } else {
              this.agenda.define(name, handler);
            }
            // If there is schedule, then schedule it without data.
            if (typeof schedule !== 'undefined') {
              // Don't care about invalid Date.
              if (schedule instanceof Date) {
                jobs.schedules.date.push({ schedule, name });
              } else {
                if (typeof jobs.schedules[schedule] === 'undefined') {
                  jobs.schedules[schedule] = [];
                }
                jobs.schedules[schedule].push(name);
              }
            }
            if (typeof every !== 'undefined') {
              if (typeof jobs.crons[every] === 'undefined') {
                jobs.crons[every] = [];
              }
              jobs.crons[every].push(name);
            }
          });
      }
    },

    async started() {
      await this.agenda.start();
      this.logger.debug('Agenda started');
      return this.Promise.resolve();
    },

    async stopped() {
      this.agenda.stop();
      this.logger.debug('Agenda stopped');
      return this.Promise.resolve();
    },
  };
  return service;
};
