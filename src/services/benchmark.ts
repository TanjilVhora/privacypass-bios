import { generateIssuerKeys, signCredential, deriveBbsProof } from '../crypto/bbs';
import { verifyResponse } from './verify';
import { randomNonce, b64urlEncode } from '../crypto/encoding';
import { SCHEMA_VERSION, type ClaimName } from '../crypto/schema';
import type {
  Credential, PresentationRequest, PresentationResponse, StatusListState, TrustedIssuer,
} from '../types';

const ISSUER = 'demo-university';
const claims: Record<ClaimName, string> = {
  name: 'Asha', dob: '2001-04-12', student_id: 'DU-2291',
  student_status: 'enrolled', age_over_18: 'true',
  address: '12 Demo Lane', valid_until: '2030-12-31',
};

export interface BenchStats {
  medianMs: number;
  p95Ms: number;
  runs: number;
  payloadBytes: number;
}

export async function benchmarkVerify(runs = 50): Promise<BenchStats> {
  const now = Date.now();
  const keys = await generateIssuerKeys();
  const signature = await signCredential(claims, ISSUER, keys.secretKey, keys.publicKey);
  const cred: Credential = {
    id: 'bench', issuerId: ISSUER, schemaVersion: SCHEMA_VERSION, claims, signature,
    statusIndex: 1, listId: 'bench-list', issuedAt: now,
    validUntil: Date.parse('2030-12-31'), revoked: false,
  };
  const issuer: TrustedIssuer = {
    issuerId: ISSUER, name: 'Demo University', bbsPublicKey: keys.publicKey,
    listPublicKeyJwk: {}, validFrom: now - 1000, validTo: now + 365 * 24 * 3600_000,
  };
  const list: StatusListState = {
    listId: 'bench-list', issuerId: ISSUER, size: 1024,
    bitsB64: b64urlEncode(new Uint8Array(128)),
    issuedAt: now, expiresAt: now + 3600_000, signature: 'x', fetchedAt: now,
  };

  const times: number[] = [];
  let payloadBytes = 0;
  for (let i = 0; i < runs; i++) {
    // fresh response each run: new nonce, new proof
    const nonce = randomNonce();
    const request: PresentationRequest = {
      v: 1, type: 'pp-request', verifierLabel: 'Bench', issuerId: ISSUER,
      claims: ['student_status'], nonce, expiresAt: now + 120_000, mode: 'bbs',
    };
    const d = await deriveBbsProof(cred, keys.publicKey, ['student_status'], nonce);
    const resp: PresentationResponse = {
      v: 1, type: 'pp-response', mode: 'bbs', nonce, issuerId: ISSUER,
      schemaVersion: SCHEMA_VERSION, revealed: d.revealed,
      disclosedIndexes: d.disclosedIndexes, proof: d.proof,
    };
    payloadBytes = JSON.stringify(resp).length;

    const t = performance.now();
    const r = await verifyResponse(resp, request, [issuer], list, new Set(), now);
    times.push(performance.now() - t);
    if (r.status !== 'VALID') throw new Error(`benchmark run ${i} gave ${r.status}`);
  }

  times.sort((a, b) => a - b);
  const pick = (p: number) => times[Math.min(times.length - 1, Math.ceil(p * times.length) - 1)];
  return {
    medianMs: Number(pick(0.5).toFixed(1)),
    p95Ms: Number(pick(0.95).toFixed(1)),
    runs,
    payloadBytes,
  };
}