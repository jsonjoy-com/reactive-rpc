import {Defer} from 'thingies/lib/Defer';

class Entry {
  constructor(
    public readonly code: () => Promise<void>,
    public readonly future: Defer<void>,
  ) {}
}

export class Mutex {
  protected readonly queue = new Map<string, Entry[]>();

  public readonly acquire = async (key: string, code: () => Promise<void>): Promise<void> => {
    const queue = this.queue.get(key);
    const entry = new Entry(code, new Defer<void>());
    if (queue instanceof Array) {
      queue.push(entry);
    } else {
      this.queue.set(key, []);
      this.run(key, entry).catch(() => {});
    }
    return await entry.future.promise;
  };

  protected async run(key: string, entry: Entry): Promise<void> {
    try {
      await entry.code();
      entry.future.resolve();
    } catch (error) {
      entry.future.reject(error);
    } finally {
      const queue = this.queue.get(key);
      if (!(queue instanceof Array)) return;
      if (!queue.length) {
        this.queue.delete(key);
        return;
      }
      const next = queue.shift();
      if (!(next instanceof Entry)) return;
      this.run(key, next).catch(() => {});
    }
  }
}
