import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION } from '../config';
import type { Credential, StatusListState, TrustedIssuer } from '../types';

interface PPDB extends DBSchema {
  credentials: { key: string; value: Credential };
  issuers: { key: string; value: TrustedIssuer };
  statusLists: { key: string; value: StatusListState };
  usedNonces: { key: string; value: { nonce: string; usedAt: number } };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbp: Promise<IDBPDatabase<PPDB>> | undefined;
const db = () =>
  (dbp ??= openDB<PPDB>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      d.createObjectStore('credentials', { keyPath: 'id' });
      d.createObjectStore('issuers', { keyPath: 'issuerId' });
      d.createObjectStore('statusLists', { keyPath: 'listId' });
      d.createObjectStore('usedNonces', { keyPath: 'nonce' });
      d.createObjectStore('meta', { keyPath: 'key' });
    },
  }));

export const putCredential = async (c: Credential) => void (await (await db()).put('credentials', c));
export const getCredentials = async () => (await db()).getAll('credentials');
export const deleteCredential = async (id: string) => (await db()).delete('credentials', id);
export const putIssuers = async (list: TrustedIssuer[]) => {
  const tx = (await db()).transaction('issuers', 'readwrite');
  await Promise.all([...list.map((i) => tx.store.put(i)), tx.done]);
};
export const getIssuer = async (id: string) => (await db()).get('issuers', id);
export const getAllIssuers = async () => (await db()).getAll('issuers');
export const putStatusList = async (s: StatusListState) => void (await (await db()).put('statusLists', s));
export const getStatusList = async (listId: string) => (await db()).get('statusLists', listId);
export const markNonceUsed = async (nonce: string) => void (await (await db()).put('usedNonces', { nonce, usedAt: Date.now() }));
export const isNonceUsed = async (nonce: string) => !!(await (await db()).get('usedNonces', nonce));
export const setMeta = async (key: string, value: unknown) => void (await (await db()).put('meta', { key, value }));
export const getMeta = async (key: string) => (await (await db()).get('meta', key))?.value;
