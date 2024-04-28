import {buildE2eClient} from '../../../common/testing/buildE2eClient';
import {createCaller} from '../../../__demos__/json-crdt-server/routes';
import {DemoServerRemoteHistory} from '../DemoServerRemoteHistory';

export const setup = () => {
  const {caller, router} = createCaller();
  const {client} = buildE2eClient(caller);
  const remote = new DemoServerRemoteHistory(client);

  return {
    router,
    caller,
    client,
    remote,
  };
};
