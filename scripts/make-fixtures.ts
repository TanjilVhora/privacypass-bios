import { mkdirSync, writeFileSync } from 'node:fs';
import { generateIssuerKeys, signCredential, deriveBbsProof } from '../src/crypto/bbs';
import { SCHEMA_VERSION, type ClaimName } from '../src/crypto/schema';
import type { Credential, PresentationResponse } from '../src/types';

const ISSUER = 'demo-university';
const FIXED_NONCE = 'fixture-nonce-123';
const claims: Record<ClaimName, string> = {
  name: 'Asha', dob: '2001-04-12', student_id: 'DU-2291',
  student_status: 'enrolled', age_over_18: 'true',
  address: '12 Demo Lane', valid_until: '2030-12-31',
};

const keys = await generateIssuerKeys();
const signature = await signCredential(claims, ISSUER, keys.secretKey, keys.publicKey);

const cred: Credential = {
  id: 'fixture-cred-1', issuerId: ISSUER, schemaVersion: SCHEMA_VERSION, claims, signature,
  statusIndex: 7, listId: 'fixture-list', issuedAt: Date.now(),
  validUntil: Date.parse('2030-12-31'), revoked: false,
};

const d = await deriveBbsProof(cred, keys.publicKey, ['student_status'], FIXED_NONCE);
const resp: PresentationResponse = {
  v: 1, type: 'pp-response', mode: 'bbs', nonce: FIXED_NONCE, issuerId: ISSUER,
  schemaVersion: SCHEMA_VERSION, revealed: d.revealed,
  disclosedIndexes: d.disclosedIndexes, proof: d.proof,
};

mkdirSync('tests/fixtures', { recursive: true });
writeFileSync('tests/fixtures/sample-credential.json', JSON.stringify(cred, null, 2));
writeFileSync('tests/fixtures/sample-response.json', JSON.stringify(resp, null, 2));
writeFileSync('tests/fixtures/sample-issuer.json',
  JSON.stringify({ issuerId: ISSUER, bbsPublicKey: keys.publicKey, nonce: FIXED_NONCE }, null, 2));
console.log('fixtures written. response JSON bytes:', JSON.stringify(resp).length);