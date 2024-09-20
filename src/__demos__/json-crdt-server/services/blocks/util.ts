import type * as fs from 'fs';

type Promises = (typeof fs)['promises'];

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

export const storageSpaceReclaimDecision =
  (
    promises: Pick<Promises, 'statfs'>,
    isGoodTime: () => boolean = () => Math.random() < 0.1,
    threshold: number = 300 * MEGABYTE,
  ) =>
  async () => {
    if (!isGoodTime()) return 0;
    const stats = await promises.statfs('/');
    const availableBytes = stats.bavail * stats.bsize;
    if (availableBytes > threshold) return 0;
    const avgDocSize = 30 * KILOBYTE;
    const blocksToDelete = Math.ceil((threshold - availableBytes) / avgDocSize);
    const blocksToDeleteClamped = Math.min(100, blocksToDelete);
    return blocksToDeleteClamped;
  };
