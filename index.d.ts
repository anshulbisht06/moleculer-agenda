import { AgendaConfig, JobOptions, Job } from 'agenda';
import { ActionHandler, Errors } from 'moleculer';

declare module 'moleculer-agenda' {
    interface AgendaService {
        name: string;

        actions: {
            runEvery: {
                params: {
                    interval: string;
                    name: string | 'array';
                    data?: 'any';
                    options?: JobOptions;
                };
                handler: ActionHandler;
            };

            runAt: {
                params: {
                    when: string | 'date';
                    name: string | 'array';
                    data?: 'any';
                };
                handler: ActionHandler;
            };

            runNow: {
                params: {
                    name: string;
                    data?: any;
                };
                handler: ActionHandler;
            };

            runDisable: {
                params: { name: string };
                handler: ActionHandler;
            };

            runEnable: {
                params: { name: string };
                handler: ActionHandler;
            };
        };

        methods: {
            runEvery(interval: string, name: string | Array<string>, data: any, options: JobOptions): Promise<Job | Errors.MoleculerError>;
            runAt(when: string, name: string | Array<string>, data: any): Promise<Job | Errors.MoleculerError>;
            runNow(name: string, data: any): Promise<Job | Errors.MoleculerError>;
            runDisable(name: string): Promise<number>;
            runEnable(name: string): Promise<number>;
        };

        created: () => Promise<void>;
        started: () => Promise<void>;
        stopped: () => Promise<void>;
    }

    export default function(serviceOpts?: AgendaConfig): AgendaService;
}
