import {MemoryLevel} from 'memory-level';
import {buildE2eClient} from '../../../common/testing/buildE2eClient';
import {createCaller} from '../routes';
import {LevelStore} from '../services/blocks/store/level/LevelStore';
import {Services} from '../services/Services';
import {ClassicLevel} from 'classic-level';
import {MemoryStore} from '../services/blocks/store/MemoryStore';
import type {Store} from '../services/blocks/store/types';

export const setup = async (store: Store = new MemoryStore(), close?: () => Promise<void>) => {
  const services = new Services({store});
  const {caller} = createCaller(services);
  const {client} = buildE2eClient(caller, {
    writerDefaultBufferKb: [1, 32],
    clientBufferSize: [1, 3],
    clientBufferTime: [1, 10],
    serverBufferSize: [1, 3],
    serverBufferTime: [1, 10],
  });
  const call = client.call.bind(client);
  const call$ = client.call$.bind(client);
  const stop = async (): Promise<void> => {
    await close?.();
  };
  return {call, call$, stop};
};

export const setupMemory = async () => {
  const store = new MemoryStore();
  return setup(store);
};

export const setupLevelMemory = async () => {
  const kv = new MemoryLevel<string, Uint8Array>({
    keyEncoding: 'utf8',
    valueEncoding: 'view',
  });
  const store = new LevelStore(<any>kv);
  return setup(store);
};

export const setupLevelClassic = async () => {
  const kv = new ClassicLevel<string, Uint8Array>('./db', {valueEncoding: 'view'});
  await kv.open();
  const store = new LevelStore(<any>kv);
  return setup(store, async () => kv.close());
};

export type JsonCrdtTestSetup = typeof setup;
