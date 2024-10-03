import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import {JsonCrdtRepo} from '../../json-crdt-repo/JsonCrdtRepo';
import {bind} from 'collaborative-input';
import {Model, Patch} from 'json-joy/lib/json-crdt';

/* tslint:disable no-console */

const main = async () => {
  const repo = new JsonCrdtRepo({
    wsUrl: 'wss://demo-iasd8921ondk0.jsonjoy.com/rpc',
  });
  const id = 'block-sync-ui-demo-text-3';
  const session = await repo.sessions.load({id: [id], make: {}, remote: {timeout: 1000}});
  const model = session.model;
  const view = model.view();
  if (typeof view !== 'string') model.api.root('');

  const Demo: React.FC = () => {
    const [remote, setRemote] = React.useState<Model | null>(null);
    const ref = React.useRef<HTMLTextAreaElement | null>(null);
    React.useLayoutEffect(() => {
      if (!ref.current) return;
      const unbind = bind(() => model.api.str([]), ref.current);
      return () => unbind();
    }, []);

    return (
      <div style={{padding: 32}}>
        <textarea ref={ref} style={{width: 600, height: 300}}></textarea>
        <hr />
        <button
          onClick={async () => {
            const {block} = await repo.remote.read(id);
            const model = Model.fromBinary(block.snapshot.blob);
            for (const batch of block.tip)
              for (const patch of batch.patches) model.applyPatch(Patch.fromBinary(patch.blob));
            setRemote(model);
          }}
        >
          Load remote state
        </button>
        <br />
        {!!remote && (
          <code style={{fontSize: 8}}>
            <pre>{remote.toString()}</pre>
          </code>
        )}
      </div>
    );
  };

  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = ReactDOM.createRoot(div);
  root.render(<Demo />);
};

main().catch(() => {});
