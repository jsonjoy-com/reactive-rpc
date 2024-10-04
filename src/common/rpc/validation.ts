import {RpcError} from './caller/error/RpcError';

export const validateId = (id: unknown) => {
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) {
    throw RpcError.validation('Invalid id');
  }
};

export const validateMethod = (method: unknown) => {
  if (!method || typeof method !== 'string' || method.length > 64) {
    throw RpcError.validation('Invalid method');
  }
};
