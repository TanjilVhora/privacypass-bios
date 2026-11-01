import { getAllIssuers, getCredentials, getIssuer, putCredential, putIssuers, putStatusList, setMeta } from '../storage/db';
import { isRevokedIndex, verifyStatusList } from '../crypto/statuslist';
import type { StatusListState, TrustedIssuer } from '../types';

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} failed (${r.status})`);
  return r.json() as Promise<T>;
}

export async function syncIssuers(): Promise<TrustedIssuer[]> {
  const { issuers } = await getJson<{ issuers: TrustedIssuer[] }>('/api/issuers');
  await putIssuers(issuers);
  await setMeta('lastSyncAt', Date.now());
  return issuers;
}

export async function syncStatus(): Promise<StatusListState> {
  const state = await getJson<StatusListState>('/api/status');
  const issuer = await getIssuer(state.issuerId);
  if (!issuer) throw new Error('Issuer not trusted yet. Sync issuers first.');
  if (!(await verifyStatusList(state, issuer.listPublicKeyJwk))) throw new Error('Status list signature invalid. List rejected.');
  const stored = { ...state, fetchedAt: Date.now() };
  await putStatusList(stored);
  // Revocation is checked locally. The status index is never transmitted.
  for (const c of await getCredentials()) {
    if (c.listId === stored.listId) await putCredential({ ...c, revoked: isRevokedIndex(stored, c.statusIndex) });
  }
  await setMeta('lastSyncAt', Date.now());
  return stored;
}

export async function syncAll() {
  await syncIssuers();
  const list = await syncStatus();
  return { issuers: await getAllIssuers(), list };
}
