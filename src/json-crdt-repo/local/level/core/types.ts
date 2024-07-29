import type {AbstractLevel} from 'abstract-level';

export type KV = AbstractLevel<Uint8Array, Uint8Array, Uint8Array>;

export interface CrudLocalRepoCipher {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}
