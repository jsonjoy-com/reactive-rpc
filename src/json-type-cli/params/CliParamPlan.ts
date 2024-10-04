import {toTree} from 'json-joy/lib/json-text/toTree';
import {AbstractType} from 'json-joy/lib/json-type/type/classes';
import {formatError} from '../util';
import type {Cli} from '../Cli';
import type {CliParam, CliParamInstance} from '../types';

export class CliParamPlan implements CliParam {
  public readonly param = 'plan';
  public readonly title = 'Show execution plan';
  public readonly createInstance = (cli: Cli) =>
    new (class implements CliParamInstance {
      public readonly onBeforeCall = async (method: string) => {
        const fn = cli.router.get(method).type;
        if (!fn) throw new Error(`Method ${method} not found`);
        const out: any = {
          Method: method,
        };
        try {
          const validator = (fn.req as AbstractType<any>).validator('object');
          const error = validator(cli.request);
          if (error) throw error;
          out.Validation = 'OK';
        } catch (error) {
          out.Validation = 'Failed';
          out.ValidationError = formatError(error);
        }
        out.Request = cli.request;
        cli.stdout.write(toTree(out) + '\n');
        cli.exit(0);
      };
    })();
}
