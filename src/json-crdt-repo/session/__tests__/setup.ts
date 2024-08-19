import {setup as setupLocalLevel} from '../../local/level/__tests__/setup';
import {EditSessionFactory} from '../EditSessionFactory';

export const setup = async () => {
  const kit = await setupLocalLevel();
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
