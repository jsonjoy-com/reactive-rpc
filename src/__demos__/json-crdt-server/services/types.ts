import type {ConnectionContext} from '../../../server/context';
import type {Services} from './Services';

export type MyCtx = ConnectionContext<{services: Services}>;
