import { describe, it, expect } from 'vitest';
import { signStatusList, verifyStatusList, isStatusFresh, isRevokedIndex } from '../src/crypto/statuslist';
import { b64urlEncode } from '../src/crypto/encoding';
import type { StatusListState } from '../src/types';

async function makeKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    priv: await crypto.subtle.exportKey('jwk', kp.privateKey),
    pub: await crypto.subtle.exportKey('jwk', kp.publicKey),
  };
}

function makeList(revoked: number[] = [], now = Date.now()): StatusListState {
  const bits = new Uint8Array(128); // 1024 bits
  revoked.forEach((i) => { bits[Math.floor(i / 8)] |= 1 << (i % 8); });
  return {
    listId: 'list1', issuerId: 'demo-university', size: 1024,
    bitsB64: b64urlEncode(bits), issuedAt: now, expiresAt: now + 3600_000, signature: '',
  };
}

describe('status list', () => {
  it('a good list verifies', async () => {
    const { priv, pub } = await makeKeys();
    const signed = await signStatusList(makeList([3]), priv);
    expect(await verifyStatusList(signed, pub)).toBe(true);
  });

  it('a tampered bitsB64 fails', async () => {
    const { priv, pub } = await makeKeys();
    const signed = await signStatusList(makeList([3]), priv);
    const tampered = { ...signed, bitsB64: makeList([]).bitsB64 };
    expect(await verifyStatusList(tampered, pub)).toBe(false);
  });

  it('a wrong public key fails', async () => {
    const { priv } = await makeKeys();
    const other = await makeKeys();
    const signed = await signStatusList(makeList(), priv);
    expect(await verifyStatusList(signed, other.pub)).toBe(false);
  });

  it('a fresh list is fresh', () => {
    const now = Date.now();
    const list = { ...makeList([], now), fetchedAt: now };
    expect(isStatusFresh(list, now + 1000, 24 * 3600_000)).toBe(true);
  });

  it('a stale list is not fresh', () => {
    const now = Date.now();
    const list = { ...makeList([], now), fetchedAt: now };
    expect(isStatusFresh(list, now + 25 * 3600_000, 24 * 3600_000)).toBe(false);
  });

  it('a list with no fetchedAt is not fresh', () => {
    expect(isStatusFresh(makeList(), Date.now(), 24 * 3600_000)).toBe(false);
  });

  it('an expired list is not fresh', () => {
    const now = Date.now();
    const list = { ...makeList([], now), fetchedAt: now, expiresAt: now + 1000 };
    expect(isStatusFresh(list, now + 2000, 24 * 3600_000)).toBe(false);
  });

  it('a set bit reads as revoked, others do not', () => {
    const list = makeList([3, 100, 1023]);
    expect(isRevokedIndex(list, 3)).toBe(true);
    expect(isRevokedIndex(list, 100)).toBe(true);
    expect(isRevokedIndex(list, 1023)).toBe(true);
    expect(isRevokedIndex(list, 4)).toBe(false);
    expect(isRevokedIndex(list, 0)).toBe(false);
  });
});