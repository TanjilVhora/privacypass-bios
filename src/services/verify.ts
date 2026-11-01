import { verifyBbsProof } from '../crypto/bbs';
import { verifySdJwt } from '../crypto/sdjwt';
import { isStatusFresh } from '../crypto/statuslist';
import { listIdFor } from '../crypto/schema';
import { STATUS_MAX_AGE_MS, getStatusMaxAgeMs } from '../config';
import type {
  PresentationRequest, PresentationResponse, StatusListState,
  TrustedIssuer, VerifyResult, VerifyStatus,
} from '../types';

const DAY_MS = 24 * 3600 * 1000;

export interface VerifyDeps {
  now: number;
  statusMaxAgeMs: number;
  getIssuer: (issuerId: string) => Promise<TrustedIssuer | undefined | null>;
  isNonceUsed: (nonce: string) => Promise<boolean>;
  markNonceUsed: (nonce: string) => Promise<void>;
  getStatusList: (listId: string) => Promise<StatusListState | undefined | null>;
}

async function verifyCore(
  resp: PresentationResponse,
  request: PresentationRequest,
  issuers: TrustedIssuer[],
  statusList: StatusListState | null | undefined,
  usedNonces: Set<string>,
  now: number,
  statusMaxAgeMs: number,
): Promise<VerifyResult> {
  const t0 = performance.now();
  const checks: VerifyResult['checks'] = [];

  const finish = (status: VerifyStatus): VerifyResult => ({
    status,
    checks,
    revealed: status === 'VALID' || status === 'VALID_STATUS_UNKNOWN' ? resp.revealed : {},
    verifyMs: performance.now() - t0,
  });
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, detail });
    return ok;
  };

  // a. nonce equals the active request nonce
  if (!check('nonce matches request', resp.nonce === request.nonce)) return finish('NONCE_MISMATCH');

  // b. nonce not used before
  if (!check('nonce not replayed', !usedNonces.has(resp.nonce))) return finish('REPLAY');

  // c. request not expired
  if (!check('request not expired', now <= request.expiresAt)) return finish('EXPIRED_REQUEST');

  // d. issuer trusted and key valid
  const issuer = issuers.find((i) => i.issuerId === resp.issuerId);
  const trusted = !!issuer && resp.issuerId === request.issuerId;
  if (!check('issuer trusted', trusted)) return finish('UNTRUSTED_ISSUER');
  if (!check('issuer key in validity window', now >= issuer!.validFrom && now <= issuer!.validTo)) {
    return finish('ISSUER_KEY_EXPIRED');
  }

  // e. proof verifies (BBS main system, SD-JWT baseline)
  let proofOk = false;
  if (resp.mode === 'bbs') {
    proofOk = await verifyBbsProof(resp, issuer!.bbsPublicKey);
  } else if (resp.mode === 'sdjwt') {
    const r = await verifySdJwt(resp.proof, issuer!.listPublicKeyJwk, resp.nonce);
    proofOk = r.ok && Object.entries(resp.revealed).every(([k, v]) => r.revealed[k] === v);
  }
  if (!check('proof valid', proofOk)) return finish('INVALID_PROOF');

  // f. credential not expired (valid through the end of the valid_until day)
  const vu = resp.revealed.valid_until;
  const vuMs = vu ? Date.parse(vu) : NaN;
  const dateOnly = !!vu && vu.length <= 10;
  const limit = dateOnly ? vuMs + DAY_MS - 1 : vuMs;
  if (!check('credential not expired', !Number.isNaN(vuMs) && now <= limit, vu)) {
    return finish('EXPIRED_CREDENTIAL');
  }

  // g. burn the nonce (caller persists it)
  usedNonces.add(resp.nonce);
  check('nonce marked used', true);

  // h. status list present and fresh
  const fresh = !!statusList && isStatusFresh(statusList, now, statusMaxAgeMs);
  if (!check('status list fresh', fresh, statusList ? undefined : 'no cached list')) {
    return finish('VALID_STATUS_UNKNOWN');
  }

  // i. all good
  return finish('VALID');
}

export function verifyResponse(
  resp: PresentationResponse, request: PresentationRequest, deps: VerifyDeps,
): Promise<VerifyResult>;
export function verifyResponse(
  resp: PresentationResponse, request: PresentationRequest, issuers: TrustedIssuer[],
  statusList: StatusListState | null, usedNonces: Set<string>, now: number, statusMaxAgeMs?: number,
): Promise<VerifyResult>;
export async function verifyResponse(
  resp: PresentationResponse, request: PresentationRequest, third: VerifyDeps | TrustedIssuer[],
  statusList?: StatusListState | null, usedNonces?: Set<string>, now?: number,
  statusMaxAgeMs: number = STATUS_MAX_AGE_MS,
): Promise<VerifyResult> {
  if (Array.isArray(third)) {
    return verifyCore(resp, request, third, statusList, usedNonces ?? new Set(), now ?? Date.now(), statusMaxAgeMs);
  }
  const deps = third;
  const issuer = await deps.getIssuer(resp.issuerId);
  const list = await deps.getStatusList(listIdFor(resp.issuerId));
  const used = new Set<string>();
  if (await deps.isNonceUsed(resp.nonce)) used.add(resp.nonce);
  const alreadyUsed = used.has(resp.nonce);
  const result = await verifyCore(resp, request, issuer ? [issuer] : [], list, used, deps.now, deps.statusMaxAgeMs);
  if (!alreadyUsed && used.has(resp.nonce)) await deps.markNonceUsed(resp.nonce);
  return result;
}

// Used by VerifierPage: reads issuers, status list and used nonces from IndexedDB.
export async function verifyWithDb(
  resp: PresentationResponse, request: PresentationRequest,
): Promise<VerifyResult> {
  const db = await import('../storage/db');
  return verifyResponse(resp, request, {
    now: Date.now(),
    statusMaxAgeMs: getStatusMaxAgeMs(),
    getIssuer: (id) => db.getIssuer(id),
    isNonceUsed: (n) => db.isNonceUsed(n),
    markNonceUsed: (n) => db.markNonceUsed(n),
    getStatusList: (id) => db.getStatusList(id),
  });
}