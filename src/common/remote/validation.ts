import {RpcError} from 'rpc-error';

export const validateId = (id: unknown) => {
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id >= 0xffff) {
    throw RpcError.validation('Invalid id');
  }
};

const REG_METHOD_NAME = /^[a-zA-Z0-9_\.\-:]{0,64}$/;

export const validateMethod = (method: unknown) => {
  if (!method || typeof method !== 'string' || method.length > 64 || !REG_METHOD_NAME.test(method)) {
    throw RpcError.validation('Invalid method');
  }
};
