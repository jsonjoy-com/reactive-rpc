import {createCaller} from './routes';

export {createCaller} from './routes';
export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];
