import {applyPatch} from 'json-joy/lib/json-patch';
import {toPath} from 'json-joy/lib/json-pointer';
import type {Cli} from '../Cli';
import type {CliParam, CliParamInstance} from '../types';

export class CliParamBool implements CliParam {
  public readonly param = 'bool';
  public readonly short = 'b';
  public readonly title = 'Set boolean value';
  public readonly example = '--b/foo=true';
  public readonly createInstance = (cli: Cli, pointer: string, rawValue: unknown) =>
    new (class implements CliParamInstance {
      public readonly onRequest = async () => {
        const value = Boolean(JSON.parse(String(rawValue)));
        const path = toPath(pointer);
        cli.request = applyPatch(cli.request, [{op: 'add', path, value}], {mutate: true}).doc;
      };
    })();
}
