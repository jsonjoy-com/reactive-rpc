import {PresenceService} from './PresenceService';
import {PubsubService} from './PubSubService';
import {BlocksServices} from './blocks/BlocksServices';
import {MemoryStore} from './blocks/store/MemoryStore';
import {Store} from './blocks/store/types';

export class Services {
  public readonly pubsub: PubsubService;
  public readonly presence: PresenceService;
  public readonly blocks: BlocksServices;

  constructor(
    store: Store = new MemoryStore(),
  ) {
    this.pubsub = new PubsubService();
    this.presence = new PresenceService();
    this.blocks = new BlocksServices(this, store);
  }
}
