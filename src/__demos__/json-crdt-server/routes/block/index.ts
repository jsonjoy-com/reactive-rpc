import {new_} from './methods/new';
import {get} from './methods/get';
import {view} from './methods/view';
import {upd} from './methods/upd';
import {del} from './methods/del';
import {scan} from './methods/scan';
import {listen} from './methods/listen';
import {
  BlockId,
  BlockPatch,
  BlockPatchPartial,
  BlockPatchPartialReturn,
  BlockCur,
  BlockSnapshot,
  NewBlockSnapshotResponse,
  BlockEvent,
  BlockBatch,
  BlockBatchPartial,
  BlockBatchPartialReturn,
  BlockBatchSeq,
  BlockSnapshotReturn,
  Block,
} from './schema';
import type {RouteDeps, Router, RouterBase} from '../types';
import {pull} from './methods/pull';

export const block =
  (d: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const {system} = d;

    system.alias('BlockId', BlockId);
    system.alias('BlockCur', BlockCur);
    system.alias('BlockBatchSeq', BlockBatchSeq);

    system.alias('Block', Block);

    system.alias('BlockSnapshotReturn', BlockSnapshotReturn);
    system.alias('BlockSnapshot', BlockSnapshot);
    system.alias('NewBlockSnapshotResponse', NewBlockSnapshotResponse);

    system.alias('BlockPatch', BlockPatch);
    system.alias('BlockPatchPartial', BlockPatchPartial);
    system.alias('BlockPatchPartialReturn', BlockPatchPartialReturn);
    system.alias('BlockBatch', BlockBatch);
    system.alias('BlockBatchPartial', BlockBatchPartial);
    system.alias('BlockBatchPartialReturn', BlockBatchPartialReturn);

    system.alias('BlockEvent', BlockEvent);

    // biome-ignore format: each on its own line
    return (
    ( new_(d)
    ( get(d)
    ( view(d)
    ( upd(d)
    ( del(d)
    ( listen(d)
    ( scan(d)
    ( pull(d)
    ( r ))))))))));
  };
