import {Defer} from 'thingies/lib/Defer';

class Entry<T> {
  constructor(
    public readonly code: () => Promise<T>,
    public readonly future: Defer<T>,
  ) {}
}

export class Mutex {
  protected readonly queue = new Map<string, Entry<unknown>[]>();

  public readonly acquire = async <T>(key: string, code: () => Promise<T>): Promise<T> => {
    const queue = this.queue.get(key);
    const entry = new Entry(code, new Defer<T>());
    if (queue instanceof Array) queue.push(entry as Entry<unknown>);
    else {
      this.queue.set(key, []);
      this.run(key, entry).catch(() => {});
    }
    return await entry.future.promise;
  };

  protected async run<T>(key: string, entry: Entry<T>): Promise<void> {
    try {
      const result = await entry.code();
      entry.future.resolve(result);
    } catch (error) {
      entry.future.reject(error);
    } finally {
      const queue = this.queue;
      const entries = queue.get(key);
      if (entries instanceof Array) {
        if (!entries.length) queue.delete(key);
        else {
          const next = entries.shift();
          if (next instanceof Entry) this.run(key, next).catch(() => {});
        }
      }
    }
  }
}
