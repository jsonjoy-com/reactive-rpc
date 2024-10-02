import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import {JsonCrdtRepo} from '../../json-crdt-repo/JsonCrdtRepo';
import {ClickableJsonCrdt} from 'clickable-json';
import {Model, Patch} from 'json-joy/lib/json-crdt';

/* tslint:disable no-console */

const repo = new JsonCrdtRepo({
  wsUrl: 'wss://demo-iasd8921ondk0.jsonjoy.com/rpc',
});
const id = 'block-sync-ui-demo-json';
const session = repo.make(id);

const model = session.model;

model.api.onPatch.listen((op) => {
  console.log('onPatch', op + '');
});

model.api.onLocalChange.listen((op) => {
  console.log('onLocalChange', op);
});

model.api.onFlush.listen((op) => {
  console.log('onFlush', op + '');
});

model.api.onTransaction.listen((op) => {
  console.log('onTransaction', op);
});

const Demo: React.FC = () => {
  const [remote, setRemote] = React.useState<Model | null>(null);

  return (
    <div style={{padding: 32}}>
      <ClickableJsonCrdt model={model} showRoot />
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
