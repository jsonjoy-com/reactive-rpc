import {setup as setupLocalLevel} from '../../local/level/__tests__/setup';
import {EditSessionFactory} from '../EditSessionFactory';

export const setup = async (opts?: Parameters<typeof setupLocalLevel>[0]) => {
  const kit = await setupLocalLevel(opts);
  const createSessions = async (local = kit) => {
    const sessions = new EditSessionFactory({
      sid: local.sid,
      repo: local.local,
    });
    return {local, sessions};
  };
  const {sessions} = await createSessions();
  return {...kit, createSessions, sessions};
};
