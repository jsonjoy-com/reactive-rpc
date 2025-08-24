import {Subject} from "rxjs";
import {BufferedLogicalChannel} from "../../../../common/channel/logical/BufferedLogicalChannel";

describe("BufferedLogicalChannel", () => {
  test("flushes when bufferSize reached", async () => {
    const sendMock = jest.fn(async (list: number[]) => {});
    const channel = {
      msg$: new Subject<number[]>(),
      err$: new Subject<unknown>(),
      send: sendMock,
    } as any;

    const buffered = new BufferedLogicalChannel<number, number>({
      channel,
      bufferSize: 2,
      bufferTime: 1000,
    });

    await buffered.send([1]);
    await buffered.send([2]);

    // allow any async flush to run
    await new Promise((r) => setTimeout(r, 0));

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith([1, 2]);
  });

  test("flushes after bufferTime", async () => {
    jest.useFakeTimers();

    const sendMock = jest.fn(async (list: number[]) => {});
    const channel = {
      msg$: new Subject<number[]>(),
      err$: new Subject<unknown>(),
      send: sendMock,
    } as any;

    const buffered = new BufferedLogicalChannel<number, number>({
      channel,
      bufferSize: 100,
      bufferTime: 10,
    });

    await buffered.send([1]);

    // advance timers so TimedQueue flushes by time
    jest.advanceTimersByTime(20);
    // allow async callbacks to run
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith([1]);

    jest.useRealTimers();
  });

  test("logs errors from channel.send", async () => {
    const err = new Error("boom");
    const sendMock = jest.fn(async (_list: number[]) => {
      throw err;
    });

    const channel = {
      msg$: new Subject<number[]>(),
      err$: new Subject<unknown>(),
      send: sendMock,
    } as any;

    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const buffered = new BufferedLogicalChannel<number, number>({
      channel,
      bufferSize: 1,
      bufferTime: 1000,
    });

    await buffered.send([1]);
    await new Promise((r) => setTimeout(r, 0));

    expect(sendMock).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(err);

    consoleError.mockRestore();
  });
});
