import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import {JsonCrdtRepo} from '../../json-crdt-repo/JsonCrdtRepo';
import {ClickableJsonCrdt} from 'clickable-json';
import {Model} from 'json-joy/lib/json-crdt';

const repo = new JsonCrdtRepo({
  wsUrl: 'wss://demo-iasd8921ondk0.jsonjoy.com/rpc',
});
const id = 'block-sync-ui-demo-id';
const session = repo.make(id);

const model = session.model;

model.api.onLocalChange.listen((op) => {
  console.log('onLocalChange', op);
});

model.api.onFlush.listen((op) => {
  console.log('onFlush', op);
});

model.api.onTransaction.listen((op) => {
  console.log('onTransaction', op);
});

const Demo: React.FC = () => {
  return (
    <div style={{padding: 32}}>
      <ClickableJsonCrdt model={model} showRoot />
    </div>
  );
};

const div = document.createElement('div');
document.body.appendChild(div);
const root = ReactDOM.createRoot(div);
root.render(<Demo />);
