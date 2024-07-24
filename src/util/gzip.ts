import {listToUint8} from '@jsonjoy.com/util/lib/buffers/concat';

export const toStream = (data: Uint8Array): ReadableStream<Uint8Array> => {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
};

export const fromStream = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return listToUint8(chunks);
};

const pipeThrough = async (data: Uint8Array, transform: ReadableWritablePair<Uint8Array, Uint8Array>): Promise<Uint8Array> =>
  await fromStream(toStream(data).pipeThrough<Uint8Array>(transform));

export const gzip = async (data: Uint8Array): Promise<Uint8Array> =>
  await pipeThrough(data, new CompressionStream('gzip'));

export const ungzip = async (data: Uint8Array): Promise<Uint8Array> =>
  await pipeThrough(data, new DecompressionStream('gzip'));
