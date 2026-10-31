import { describe, it, expect } from 'vitest';
import { generateIssuerKeys, signCredential, deriveBbsProof, verifyBbsProof } from '../src/crypto/bbs';
import { randomNonce } from '../src/crypto/encoding';
import { SCHEMA_VERSION, type ClaimName } from '../src/crypto/schema';
import type { Credential, PresentationResponse } from '../src/types';

const ISSUER = 'demo-university';
const claims: Record<ClaimName, string> = {
  name: 'Asha', dob: '2001-04-12', student_id: 'DU-2291',
  student_status: 'enrolled', age_over_18: 'true',
  address: '12 Demo Lane', valid_until: '2026-12-31',
};

async function setup() {
  const keys = await generateIssuerKeys();
  const signature = await signCredential(claims, ISSUER, keys.secretKey, keys.publicKey);
  const cred: Credential = {
    id: 'c1', issuerId: ISSUER, schemaVersion: SCHEMA_VERSION, claims, signature,
    statusIndex: 5, listId: 'list1', issuedAt: Date.now(),
    validUntil: Date.parse('2026-12-31'), revoked: false,
  };
  return { keys, cred };
}

async function respond(cred: Credential, pk: string, nonce: string, disclosed: ClaimName[] = ['student_status']) {
  const d = await deriveBbsProof(cred, pk, disclosed, nonce);
  const resp: PresentationResponse = {
    v: 1, type: 'pp-response', mode: 'bbs', nonce, issuerId: cred.issuerId,
    schemaVersion: cred.schemaVersion, revealed: d.revealed,
    disclosedIndexes: d.disclosedIndexes, proof: d.proof,
  };
  return resp;
}

describe('BBS layer', () => {
  it('sign, derive, verify is accepted', async () => {
    const { keys, cred } = await setup();
    const resp = await respond(cred, keys.publicKey, randomNonce());
    expect(await verifyBbsProof(resp, keys.publicKey)).toBe(true);
  });

  it('changed revealed value is rejected', async () => {
    const { keys, cred } = await setup();
    const resp = await respond(cred, keys.publicKey, randomNonce());
    resp.revealed.student_status = 'graduated';
    expect(await verifyBbsProof(resp, keys.publicKey)).toBe(false);
  });

  it('wrong issuer public key is rejected', async () => {
    const { keys, cred } = await setup();
    const other = await generateIssuerKeys();
    const resp = await respond(cred, keys.publicKey, randomNonce());
    expect(await verifyBbsProof(resp, other.publicKey)).toBe(false);
  });

  it('different nonce at verify time is rejected', async () => {
    const { keys, cred } = await setup();
    const resp = await respond(cred, keys.publicKey, randomNonce());
    resp.nonce = randomNonce();
    expect(await verifyBbsProof(resp, keys.publicKey)).toBe(false);
  });

  it('an added claim is rejected', async () => {
    const { keys, cred } = await setup();
    const resp = await respond(cred, keys.publicKey, randomNonce());
    resp.revealed.name = 'Asha';
    expect(await verifyBbsProof(resp, keys.publicKey)).toBe(false);
  });

  it('two proofs of the same claim are byte-different but both valid', async () => {
    const { keys, cred } = await setup();
    const a = await respond(cred, keys.publicKey, 'nonce-A');
    const b = await respond(cred, keys.publicKey, 'nonce-B');
    expect(a.proof).not.toBe(b.proof);
    expect(await verifyBbsProof(a, keys.publicKey)).toBe(true);
    expect(await verifyBbsProof(b, keys.publicKey)).toBe(true);
  });

  it('revealed claims are only the requested claim and valid_until', async () => {
    const { keys, cred } = await setup();
    const resp = await respond(cred, keys.publicKey, randomNonce());
    expect(Object.keys(resp.revealed).sort()).toEqual(['student_status', 'valid_until']);
  });
});