// Single source of truth for the checks. Vitest files and the in-app Proofs page both run this.
import { generateBbsKeyPair, signCredential, verifyBbsProof, deriveBbsProof } from '../src/crypto/bbs';
import { issueSdJwt, presentSdJwt, verifySdJwt } from '../src/crypto/sdjwt';
import { isRevokedIndex, isStatusFresh, setRevokedBit, signStatusList, verifyStatusList } from '../src/crypto/statuslist';
import { b64urlEncode, randomNonce } from '../src/crypto/encoding';
import { ClaimName, listIdFor } from '../src/crypto/schema';
import { CREDENTIAL_LIFETIME_MS, REQUEST_TTL_MS, SCHEMA_VERSION, STATUS_LIST_SIZE, STATUS_MAX_AGE_MS } from '../src/config';
import { buildResponse } from '../src/services/present';
import { verifyResponse, VerifyDeps } from '../src/services/verify';
import type { Credential, PresentationRequest, PresentationResponse, ProofMode, StatusListState, TrustedIssuer } from '../src/types';

const ISSUER = 'demo-university';
const EC = { name: 'ECDSA', namedCurve: 'P-256' };

export interface World {
  bbs: { secretKey: string; publicKey: string }; priv: JsonWebKey; pub: JsonWebKey;
  issuer: TrustedIssuer; cred: Credential; list: StatusListState; now: number;
}

export async function issueCred(w: Pick<World, 'bbs' | 'priv'>, validForMs: number, now: number): Promise<Credential> {
  const claims = {
    name: 'Asha Demo', dob: '2003-04-12', student_id: 'S-1042', student_status: 'enrolled',
    age_over_18: 'true', address: '12 Sample Rd, Demo City', valid_until: new Date(now + validForMs).toISOString(),
  } as Record<ClaimName, string>;
  return {
    id: randomNonce(8), issuerId: ISSUER, schemaVersion: SCHEMA_VERSION, claims,
    signature: await signCredential(claims, ISSUER, w.bbs.secretKey, w.bbs.publicKey),
    sdjwt: await issueSdJwt(claims, w.priv), statusIndex: 7, listId: listIdFor(ISSUER),
    issuedAt: now, validUntil: now + validForMs, revoked: false,
  };
}

export async function makeWorld(): Promise<World> {
  const now = Date.now();
  const bbs = await generateBbsKeyPair();
  const pair = await crypto.subtle.generateKey(EC, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const issuer: TrustedIssuer = { issuerId: ISSUER, name: 'Demo University', bbsPublicKey: bbs.publicKey, listPublicKeyJwk: pub, validFrom: now - 86400000, validTo: now + 365 * 86400000 };
  const list = await signStatusList({
    listId: listIdFor(ISSUER), issuerId: ISSUER, size: STATUS_LIST_SIZE, bitsB64: b64urlEncode(new Uint8Array(STATUS_LIST_SIZE / 8)),
    issuedAt: now, expiresAt: now + 4 * CREDENTIAL_LIFETIME_MS, signature: '',
  }, priv);
  return { bbs, priv, pub, issuer, list, now, cred: await issueCred({ bbs, priv }, CREDENTIAL_LIFETIME_MS, now) };
}

export const mkReq = (w: World, mode: ProofMode, claims: ClaimName[] = ['student_status']): PresentationRequest => ({
  v: 1, type: 'pp-request', verifierLabel: 'Shop A', issuerId: ISSUER, claims, nonce: randomNonce(16), expiresAt: w.now + REQUEST_TTL_MS, mode,
});

export const mkDeps = (w: World, o: Partial<VerifyDeps> = {}): VerifyDeps => {
  const used = new Set<string>();
  return {
    now: w.now, statusMaxAgeMs: STATUS_MAX_AGE_MS,
    getIssuer: async (id) => (id === ISSUER ? w.issuer : undefined),
    isNonceUsed: async (n) => used.has(n), markNonceUsed: async (n) => void used.add(n),
    getStatusList: async () => ({ ...w.list, fetchedAt: w.now }), ...o,
  };
};

export interface Result { group: string; name: string; ok: boolean; detail?: string }

export async function runSuite(): Promise<Result[]> {
  const out: Result[] = [];
  const t = async (group: string, name: string, fn: () => Promise<boolean>) => {
    try { out.push({ group, name, ok: await fn() }); } catch (e) { out.push({ group, name, ok: false, detail: String(e) }); }
  };
  const w = await makeWorld();
  const opts = { bbsPublicKey: w.bbs.publicKey, now: w.now };
  const respOf = (req: PresentationRequest, c = w.cred, o = opts) => buildResponse(req, c, req.mode, o);
  const status = async (resp: PresentationResponse, req: PresentationRequest, o: Partial<VerifyDeps> = {}) => (await verifyResponse(resp, req, mkDeps(w, o))).status;
  const pk = w.bbs.publicKey;

  await t('bbs', 'sign, derive, verify round trip accepted', async () => verifyBbsProof(await respOf(mkReq(w, 'bbs')), pk));
  await t('bbs', 'changed disclosed value rejected', async () => {
    const r = await respOf(mkReq(w, 'bbs'));
    return !(await verifyBbsProof({ ...r, revealed: { ...r.revealed, student_status: 'graduated' } }, pk));
  });
  await t('bbs', 'wrong issuer public key rejected', async () => !(await verifyBbsProof(await respOf(mkReq(w, 'bbs')), (await generateBbsKeyPair()).publicKey)));
  await t('bbs', 'proof with a claim added rejected', async () => {
    const r = await respOf(mkReq(w, 'bbs'));
    return !(await verifyBbsProof({ ...r, revealed: { ...r.revealed, name: 'Asha Demo' }, disclosedIndexes: [0, ...r.disclosedIndexes] }, pk));
  });
  await t('bbs', 'proof with a claim removed rejected', async () => {
    const r = await respOf(mkReq(w, 'bbs'));
    return !(await verifyBbsProof({ ...r, revealed: { valid_until: r.revealed.valid_until }, disclosedIndexes: [6] }, pk));
  });
  await t('bbs', 'two proofs of same claim are byte-different and both verify', async () => {
    const a = await respOf(mkReq(w, 'bbs')), b = await respOf(mkReq(w, 'bbs'));
    return a.proof !== b.proof && (await verifyBbsProof(a, pk)) && (await verifyBbsProof(b, pk));
  });

  await t('sdjwt', 'same SD-JWT presented twice has identical signature (baseline is linkable)', async () => {
    const a = presentSdJwt(w.cred.sdjwt!, ['student_status', 'valid_until'], 'n1'), b = presentSdJwt(w.cred.sdjwt!, ['student_status', 'valid_until'], 'n2');
    return a.split('~')[0] === b.split('~')[0];
  });
  await t('sdjwt', 'SD-JWT verifies and reveals only chosen claims', async () => {
    const r = await verifySdJwt(presentSdJwt(w.cred.sdjwt!, ['student_status', 'valid_until'], 'n1'), w.pub, 'n1');
    return r.ok && Object.keys(r.revealed).sort().join() === 'student_status,valid_until';
  });
  await t('sdjwt', 'SD-JWT with wrong nonce rejected', async () => !(await verifySdJwt(presentSdJwt(w.cred.sdjwt!, ['valid_until'], 'n1'), w.pub, 'n2')).ok);

  await t('verify', 'valid BBS response gives VALID', async () => { const q = mkReq(w, 'bbs'); return (await status(await respOf(q), q)) === 'VALID'; });
  await t('verify', 'valid SD-JWT response gives VALID', async () => { const q = mkReq(w, 'sdjwt'); return (await status(await respOf(q), q)) === 'VALID'; });
  await t('verify', 'reuse nonce gives REPLAY', async () => {
    const q = mkReq(w, 'bbs'), r = await respOf(q), d = mkDeps(w);
    await verifyResponse(r, q, d);
    return (await verifyResponse(r, q, d)).status === 'REPLAY';
  });
  await t('verify', 'response for old nonce gives NONCE_MISMATCH', async () => (await status(await respOf(mkReq(w, 'bbs')), mkReq(w, 'bbs'))) === 'NONCE_MISMATCH');
  await t('verify', 'expired request gives EXPIRED_REQUEST', async () => { const q = mkReq(w, 'bbs'); return (await status(await respOf(q), q, { now: q.expiresAt + 1 })) === 'EXPIRED_REQUEST'; });
  await t('verify', 'expired credential gives EXPIRED_CREDENTIAL', async () => {
    const old = await issueCred(w, -1000, w.now), q = mkReq(w, 'bbs');
    return (await status(await respOf(q, old, { ...opts, now: w.now - 10000 }), q)) === 'EXPIRED_CREDENTIAL';
  });
  await t('verify', 'stale status list gives VALID_STATUS_UNKNOWN', async () => {
    const q = mkReq(w, 'bbs');
    return (await status(await respOf(q), q, { getStatusList: async () => ({ ...w.list, fetchedAt: w.now - 2 * STATUS_MAX_AGE_MS }) })) === 'VALID_STATUS_UNKNOWN';
  });
  await t('verify', 'missing status list gives VALID_STATUS_UNKNOWN', async () => { const q = mkReq(w, 'bbs'); return (await status(await respOf(q), q, { getStatusList: async () => undefined })) === 'VALID_STATUS_UNKNOWN'; });
  await t('verify', 'unknown issuer gives UNTRUSTED_ISSUER', async () => { const q = mkReq(w, 'bbs'); return (await status(await respOf(q), q, { getIssuer: async () => undefined })) === 'UNTRUSTED_ISSUER'; });
  await t('verify', 'expired issuer key gives ISSUER_KEY_EXPIRED', async () => { const q = mkReq(w, 'bbs'); return (await status(await respOf(q), q, { getIssuer: async () => ({ ...w.issuer, validTo: w.now - 1 }) })) === 'ISSUER_KEY_EXPIRED'; });
  await t('verify', 'revoked credential: wallet refuses to present', async () => {
    try { await respOf(mkReq(w, 'bbs'), { ...w.cred, revoked: true }); return false; } catch { return true; }
  });

  await t('statuslist', 'valid signed list verifies', async () => verifyStatusList(w.list, w.pub));
  await t('statuslist', 'tampered status list is rejected', async () => !(await verifyStatusList({ ...w.list, bitsB64: setRevokedBit(w.list.bitsB64, 3) }, w.pub)));
  await t('statuslist', 'revoked index is detected', async () => {
    const l = await signStatusList({ ...w.list, bitsB64: setRevokedBit(w.list.bitsB64, 7) }, w.priv);
    return isRevokedIndex(l, 7) && !isRevokedIndex(l, 8);
  });
  await t('statuslist', 'old fetchedAt is not fresh', async () => !isStatusFresh({ ...w.list, fetchedAt: w.now - 2 * STATUS_MAX_AGE_MS }, w.now, STATUS_MAX_AGE_MS));
  return out;
}

export async function runBenchmark(runs = 50) {
  const w = await makeWorld(), req = mkReq(w, 'bbs');
  const resp = await buildResponse(req, w.cred, 'bbs', { bbsPublicKey: w.bbs.publicKey, now: w.now });
  const t: number[] = [];
  for (let i = 0; i < runs; i++) t.push((await verifyResponse(resp, req, mkDeps(w))).verifyMs);
  t.sort((a, b) => a - b);
  return { medianMs: (t[Math.floor((runs - 1) / 2)] + t[Math.ceil((runs - 1) / 2)]) / 2, p95Ms: t[Math.min(runs - 1, Math.ceil(runs * 0.95) - 1)], runs, payloadBytes: new TextEncoder().encode(JSON.stringify(resp)).length };
}

export async function runLinkability() {
  const w = await makeWorld(), rows = [];
  for (const mode of ['sdjwt', 'bbs'] as ProofMode[]) {
    const a = await buildResponse(mkReq(w, mode), w.cred, mode, { bbsPublicKey: w.bbs.publicKey, now: w.now });
    const b = await buildResponse(mkReq(w, mode), w.cred, mode, { bbsPublicKey: w.bbs.publicKey, now: w.now });
    const sig = (r: PresentationResponse) => (mode === 'sdjwt' ? r.proof.split('~')[0].split('.')[2] : r.proof);
    const ok = async (r: PresentationResponse) => (mode === 'bbs' ? verifyBbsProof(r, w.bbs.publicKey) : (await verifySdJwt(r.proof, w.pub, r.nonce)).ok);
    rows.push({ mode, shopA: sig(a), shopB: sig(b), identical: sig(a) === sig(b), bothVerify: (await ok(a)) && (await ok(b)) });
  }
  return rows;
}
export { deriveBbsProof };
