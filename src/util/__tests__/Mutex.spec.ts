import {of, tick} from 'thingies';
import {Mutex} from '../Mutex';

const setup = () => {
  const mutex = new Mutex();
  const list: unknown[] = [];
  const log = (value: unknown) => {
    list.push(value);
  };

  return {
    mutex,
    list,
    log,
  };
};

test('can acquire locks sequentially', async () => {
  const {mutex, list, log} = setup();
  const r1 = await mutex.acquire('key', async () => {
    log(1);
    return 'a';
  });
  const r2 = await mutex.acquire('key', async () => {
    log(2);
    return 'b';
  });
  const r3 = await mutex.acquire('key', async () => {
    log(3);
    return 'c';
  });
  expect(list).toEqual([1, 2, 3]);
  expect(r1).toBe('a');
  expect(r2).toBe('b');
  expect(r3).toBe('c');
});

test('can acquire locks sequentially, with wait', async () => {
  const {mutex, list, log} = setup();
  await mutex.acquire('key', async () => {
    await tick(2);
    log(1);
  });
  await mutex.acquire('key', async () => {
    log(2);
  });
  await mutex.acquire('key', async () => {
    await tick(2);
    log(3);
  });
  expect(list).toEqual([1, 2, 3]);
});

test('can acquire locks sequentially, with wait and failures', async () => {
  const {mutex, list, log} = setup();
  await of(
    mutex.acquire('key', async () => {
      await tick(2);
      log(1);
      throw new Error('fail');
    }),
  );
  await of(
    mutex.acquire('key', async () => {
      log(2);
      throw new Error('fail');
    }),
  );
  await mutex.acquire('key', async () => {
    await tick(2);
    log(3);
  });
  expect(list).toEqual([1, 2, 3]);
});

test('can acquire locks in parallel', async () => {
  const {mutex, list, log} = setup();
  const p1 = mutex.acquire('key', async () => {
    await tick(4);
    log(1);
    return 'a';
  });
  const p2 = mutex.acquire('key', async () => {
    await tick(2);
    log(2);
    return 'b';
  });
  const p3 = mutex.acquire('key', async () => {
    log(3);
    return 'c';
  });
  expect(await p1).toBe('a');
  expect(await p2).toBe('b');
  expect(await p3).toBe('c');
  expect(list).toEqual([1, 2, 3]);
});

test('can acquire locks in parallel, when code fails', async () => {
  const {mutex, list, log} = setup();
  const p1 = mutex.acquire('key', async () => {
    await tick(1);
    log(1);
    throw new Error('fail');
  });
  const p2 = mutex.acquire('key', async () => {
    await tick(2);
    log(2);
    throw new Error('fail 2');
  });
  const p3 = mutex.acquire('key', async () => {
    await tick(3);
    log(3);
    throw new Error('fail 3');
  });
  await Promise.allSettled([p1, p2, p3]);
  expect(list).toEqual([1, 2, 3]);
});
