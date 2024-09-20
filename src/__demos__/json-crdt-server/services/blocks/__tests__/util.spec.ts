import {storageSpaceReclaimDecision} from '../util';

test('returns 0 when more than 300 MB available', async () => {
  const promises = {
    statfs: async () => ({bavail: 400 * 1024, bsize: 1024}) as any,
  };
  const fn = storageSpaceReclaimDecision(promises, () => true, 300 * 1024 * 1024);
  const res = await fn();
  expect(res).toBe(0);
});

test('returns greater than 0 when less than 300 MB available', async () => {
  const promises = {
    statfs: async () => ({bavail: 200 * 1024, bsize: 1024}) as any,
  };
  const fn = storageSpaceReclaimDecision(promises, () => true, 300 * 1024 * 1024);
  const res = await fn();
  expect(res > 0).toBe(true);
});

test('returns 0 when not good time for GC', async () => {
  const promises = {
    statfs: async () => ({bavail: 200 * 1024, bsize: 1024}) as any,
  };
  const fn = storageSpaceReclaimDecision(promises, () => false, 300 * 1024 * 1024);
  const res = await fn();
  expect(res).toBe(0);
});
