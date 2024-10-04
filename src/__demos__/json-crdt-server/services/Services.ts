import {PresenceService} from './PresenceService';
import {PubsubService} from './PubSubService';
import {BlocksServices, type BlocksServicesOpts} from './blocks/BlocksServices';
import {MemoryStore} from './blocks/store/MemoryStore';
import type {Store} from './blocks/store/types';

export interface ServicesOpts {
  store?: Store;
  blocks?: BlocksServicesOpts;
}

export class Services {
  public readonly pubsub: PubsubService;
  public readonly presence: PresenceService;
  public readonly blocks: BlocksServices;

  constructor({store = new MemoryStore(), blocks}: ServicesOpts = {}) {
    this.pubsub = new PubsubService();
    this.presence = new PresenceService();
    this.blocks = new BlocksServices(this, store, blocks);
  }

  async stop() {
    await this.blocks.stop();
  }
}
