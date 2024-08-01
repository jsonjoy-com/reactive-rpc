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
} from './schema';
import type {RouteDeps, Router, RouterBase} from '../types';

export const block =
  (d: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const {system} = d;

    system.alias('BlockId', BlockId);
    system.alias('BlockCur', BlockCur);
    system.alias('BlockBatchSeq', BlockBatchSeq);

    system.alias('BlockSnapshot', BlockSnapshot);
    system.alias('NewBlockSnapshotResponse', NewBlockSnapshotResponse);

    system.alias('BlockPatch', BlockPatch);
    system.alias('BlockPatchPartial', BlockPatchPartial);
    system.alias('BlockPatchPartialReturn', BlockPatchPartialReturn);
    system.alias('BlockBatch', BlockBatch);
    system.alias('BlockBatchPartial', BlockBatchPartial);
    system.alias('BlockBatchPartialReturn', BlockBatchPartialReturn);

    system.alias('BlockEvent', BlockEvent);

    // prettier-ignore
    return (
    ( new_(d)
    ( get(d)
    ( view(d)
    ( upd(d)
    ( del(d)
    ( listen(d)
    ( scan(d)
    ( r )))))))));
  };
