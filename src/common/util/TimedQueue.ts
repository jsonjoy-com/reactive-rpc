/**
 * Queue that is flushed automatically when it reaches some item limit
 * or when timeout is reached.
 */
export class TimedQueue<T> {
  /**
   * Queue will be flushed when it reaches this number of items.
   */
  public itemLimit = 100;

  /**
   * Queue will be flushed after this many milliseconds.
   */
  public timeLimit = 5;

  /**
   * Method that will be called when queue is flushed.
   */
  public onFlush: (list: T[]) => void = () => {};

  private list: T[] = [];
  private timer: null | number | NodeJS.Timeout = null;

  public push(item: T) {
    this.list.push(item);
    if (this.list.length >= this.itemLimit) {
      this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.timeLimit);
    }
  }

  public flush(): T[] {
    const list = this.list;
    this.list = [];
    if (this.timer) clearTimeout(this.timer as any);
    this.timer = null;
    if (list.length) this.onFlush(list);
    return list;
  }
}
