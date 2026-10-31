import { describe, it, expect } from 'vitest';
import { generateIssuerKeys, signCredential, deriveBbsProof } from '../src/crypto/bbs';
import { verifyResponse } from '../src/services/verify';
import { randomNonce, b64urlEncode } from '../src/crypto/encoding';
import { SCHEMA_VERSION, type ClaimName } from '../src/crypto/schema';
import type {
  Credential, PresentationRequest, PresentationResponse, StatusListState, TrustedIssuer,
} from '../src/types';

const ISSUER = 'demo-university';
const baseClaims: Record<ClaimName, string> = {
  name: 'Asha', dob: '2001-04-12', student_id: 'DU-2291',
  student_status: 'enrolled', age_over_18: 'true',
  address: '12 Demo Lane', valid_until: '2030-12-31',
};

async function setup(validUntil = '2030-12-31') {
  const now = Date.now();
  const claims = { ...baseClaims, valid_until: validUntil };
  const keys = await generateIssuerKeys();
  const signature = await signCredential(claims, ISSUER, keys.secretKey, keys.publicKey);
  const cred: Credential = {
    id: 'c1', issuerId: ISSUER, schemaVersion: SCHEMA_VERSION, claims, signature,
    statusIndex: 5, listId: 'l1', issuedAt: now, validUntil: Date.parse(validUntil), revoked: false,
  };
  const issuer: TrustedIssuer = {
    issuerId: ISSUER, name: 'Demo University', bbsPublicKey: keys.publicKey,
    listPublicKeyJwk: {}, validFrom: now - 1000, validTo: now + 365 * 24 * 3600_000,
  };
  const nonce = randomNonce();
  const request: PresentationRequest = {
    v: 1, type: 'pp-request', verifierLabel: 'Shop A', issuerId: ISSUER,
    claims: ['student_status'], nonce, expiresAt: now + 120_000, mode: 'bbs',
  };
  const d = await deriveBbsProof(cred, keys.publicKey, ['student_status'], nonce);
  const resp: PresentationResponse = {
    v: 1, type: 'pp-response', mode: 'bbs', nonce, issuerId: ISSUER,
    schemaVersion: SCHEMA_VERSION, revealed: d.revealed,
    disclosedIndexes: d.disclosedIndexes, proof: d.proof,
  };
  const list: StatusListState = {
    listId: 'l1', issuerId: ISSUER, size: 1024, bitsB64: b64urlEncode(new Uint8Array(128)),
    issuedAt: now, expiresAt: now + 3600_000, signature: 'x', fetchedAt: now,
  };
  return { now, issuer, request, resp, list };
}

describe('verifyResponse', () => {
  it('a valid response gives VALID', async () => {
    const s = await setup();
    const r = await verifyResponse(s.resp, s.request, [s.issuer], s.list, new Set(), s.now);
    expect(r.status).toBe('VALID');
    expect(r.checks.length).toBe(9);
    expect(r.revealed.student_status).toBe('enrolled');
  });

  it('a reused nonce gives REPLAY', async () => {
    const s = await setup();
    const used = new Set<string>();
    await verifyResponse(s.resp, s.request, [s.issuer], s.list, used, s.now);
    const r = await verifyResponse(s.resp, s.request, [s.issuer], s.list, used, s.now);
    expect(r.status).toBe('REPLAY');
  });

  it('a different nonce gives NONCE_MISMATCH', async () => {
    const s = await setup();
    const r = await verifyResponse({ ...s.resp, nonce: randomNonce() }, s.request, [s.issuer], s.list, new Set(), s.now);
    expect(r.status).toBe('NONCE_MISMATCH');
  });

  it('an expired request gives EXPIRED_REQUEST', async () => {
    const s = await setup();
    const r = await verifyResponse(s.resp, s.request, [s.issuer], s.list, new Set(), s.request.expiresAt + 1);
    expect(r.status).toBe('EXPIRED_REQUEST');
  });

  it('an unknown issuer gives UNTRUSTED_ISSUER', async () => {
    const s = await setup();
    const r = await verifyResponse(s.resp, s.request, [], s.list, new Set(), s.now);
    expect(r.status).toBe('UNTRUSTED_ISSUER');
  });

  it('an issuer key outside its window gives ISSUER_KEY_EXPIRED', async () => {
    const s = await setup();
    const old = { ...s.issuer, validTo: s.now - 1 };
    const r = await verifyResponse(s.resp, s.request, [old], s.list, new Set(), s.now);
    expect(r.status).toBe('ISSUER_KEY_EXPIRED');
  });

  it('a tampered claim gives INVALID_PROOF', async () => {
    const s = await setup();
    const bad = { ...s.resp, revealed: { ...s.resp.revealed, student_status: 'graduated' } };
    const r = await verifyResponse(bad, s.request, [s.issuer], s.list, new Set(), s.now);
    expect(r.status).toBe('INVALID_PROOF');
    expect(r.revealed).toEqual({});
  });

  it('an expired credential gives EXPIRED_CREDENTIAL', async () => {
    const s = await setup('2020-01-01');
    const r = await verifyResponse(s.resp, s.request, [s.issuer], s.list, new Set(), s.now);
    expect(r.status).toBe('EXPIRED_CREDENTIAL');
  });

  it('a stale list gives VALID_STATUS_UNKNOWN', async () => {
    const s = await setup();
    const stale = { ...s.list, fetchedAt: s.now - 48 * 3600_000 };
    const r = await verifyResponse(s.resp, s.request, [s.issuer], stale, new Set(), s.now);
    expect(r.status).toBe('VALID_STATUS_UNKNOWN');
  });

  it('no cached list gives VALID_STATUS_UNKNOWN', async () => {
    const s = await setup();
    const r = await verifyResponse(s.resp, s.request, [s.issuer], null, new Set(), s.now);
    expect(r.status).toBe('VALID_STATUS_UNKNOWN');
  });
});