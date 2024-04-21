import {spawn} from 'child_process';
import {Defer} from '../../util/Defer';
import {parseArgs} from 'util';

const {
  values: {server, suite},
} = parseArgs({
  options: {
    server: {
      type: 'string',
      default: 'http1',
    },
    suite: {
      type: 'string',
      default: 'sample-api',
    },
  },
});

const startServer = async () => {
  const started = new Defer<void>();
  const exitCode = new Defer<number>();
  const cp = spawn('yarn', [`demo:e2e:${suite}:${server}`], {
    shell: true,
  });
  process.on('exit', (code) => {
    cp.kill();
  });
  cp.stdout.on('data', (data) => {
    const line = String(data);
    if (line.indexOf('SERVER_STARTED') > -1) started.resolve();
    process.stderr.write('[server] ' + line);
  });
  cp.stderr.on('data', (data) => {
    const msg = Buffer.isBuffer(data) ? data.toString() : String(data);
    // tslint:disable-next-line no-console
    console.error('Could not start server', msg);
    started.reject(data);
    process.stderr.write('ERROR: [server] ' + msg);
  });
  cp.on('close', (code) => {
    exitCode.resolve(code || 0);
    process.stdout.write('[server] ' + `process exited with code ${code}\n`);
  });
  return {
    cp,
    started: started.promise,
    exitCode: exitCode.promise,
  };
};

const runTests = async () => {
  const exitCode = new Defer<number>();
  const cp = spawn('yarn', [`test:e2e:jest:${suite}`], {
    env: {
      ...process.env,
      TEST_E2E: '1',
    },
    stdio: 'inherit',
  });
  process.on('exit', (code) => {
    cp.kill();
  });
  cp.on('close', (code) => {
    exitCode.resolve(code || 0);
    process.stdout.write('[jest] ' + `process exited with code ${code}\n`);
  });
  return {
    cp,
    exitCode: exitCode.promise,
  };
};

(async () => {
  try {
    const server = await startServer();
    await server.started;
    let exitCode = 0;
    const jest = await runTests();
    exitCode = await jest.exitCode;
    if (exitCode !== 0) throw exitCode;
    process.exit(exitCode);
  } catch (error) {
    // tslint:disable-next-line no-console
    console.error(error);
    process.exit(1);
  }
})();
