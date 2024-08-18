import {setup as setupLocalLevel} from '../../local/level/__tests__/setup';
import {EditSessionFactory} from '../EditSessionFactory';

export const setup = async () => {
  const kit = await setupLocalLevel();
  const sessions = new EditSessionFactory({
    sid: kit.sid,
    repo: kit.local,
  });
  return {...kit, sessions};
};
