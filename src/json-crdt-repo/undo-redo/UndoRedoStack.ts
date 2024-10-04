import {timeout} from 'thingies/lib/timeout';

const timeout2 = <T>(ms: number, promise: Promise<T>): Promise<T | undefined> =>
  timeout(ms, promise).catch(() => undefined);

export interface UndoItem {
  undo(): RedoItem | Promise<RedoItem>;
}

export interface RedoItem {
  redo(): UndoItem | Promise<UndoItem>;
}

export class UndoRedoStack {
  private undoStack: UndoItem[] = [];
  private redoStack: RedoItem[] = [];

  public undoLength(): number {
    return this.undoStack.length;
  }

  public redoLength(): number {
    return this.redoStack.length;
  }

  public push(undo: UndoItem): RedoItem[] {
    const redoStack = this.redoStack;
    this.redoStack = [];
    this.undoStack.push(undo);
    return redoStack;
  }

  private locked = false;

  public async undo(): Promise<-2 | -1 | 0 | 1> {
    if (this.locked) return 0;
    this.locked = true;
    try {
      const undo = this.undoStack.pop();
      if (!undo) return -1;
      let redo: RedoItem | Promise<RedoItem> | undefined = undo.undo();
      if (redo && typeof redo === 'object' && typeof (redo as any).then === 'function') {
        redo = await timeout2(2000, Promise.resolve(redo));
        if (!redo) return -2;
      }
      this.redoStack.push(redo as RedoItem);
      return 1;
    } finally {
      this.locked = false;
    }
  }

  public async redo(): Promise<-3 | -2 | -1 | 0 | 1> {
    if (this.locked) return 0;
    this.locked = true;
    try {
      const redo = this.redoStack.pop();
      if (!redo) return -1;
      let undo: UndoItem | Promise<UndoItem> | undefined = redo.redo();
      if (undo && typeof undo === 'object' && typeof (undo as any).then === 'function') {
        undo = await timeout2(2000, Promise.resolve(undo));
        if (!undo) return -2;
      }
      this.undoStack.push(undo as UndoItem);
      return 1;
    } catch {
      return -3;
    } finally {
      this.locked = false;
    }
  }
}
