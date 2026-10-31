import { verifyBbsProof } from '../crypto/bbs';
import { isStatusFresh } from '../crypto/statuslist';
import { STATUS_MAX_AGE_MS } from '../config';
import type {
  PresentationRequest, PresentationResponse, StatusListState,
  TrustedIssuer, VerifyResult, VerifyStatus,
} from '../types';

const DAY_MS = 24 * 3600 * 1000;

export async function verifyResponse(
  resp: PresentationResponse,
  request: PresentationRequest,
  issuers: TrustedIssuer[],
  statusList: StatusListState | null,
  usedNonces: Set<string>,
  now: number,
  statusMaxAgeMs: number = STATUS_MAX_AGE_MS,
): Promise<VerifyResult> {
  const t0 = performance.now();
  const checks: VerifyResult['checks'] = [];

  const finish = (status: VerifyStatus): VerifyResult => ({
    status,
    checks,
    // never show claims from a response that failed verification
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

  // e. BBS proof verifies
  const proofOk = resp.mode === 'bbs' && (await verifyBbsProof(resp, issuer!.bbsPublicKey));
  if (!check('BBS proof valid', proofOk)) return finish('INVALID_PROOF');

  // f. credential not expired (valid_until is valid through the end of that day)
  const vu = resp.revealed.valid_until;
  const vuMs = vu ? Date.parse(vu) : NaN;
  if (!check('credential not expired', !Number.isNaN(vuMs) && now <= vuMs + DAY_MS - 1, vu)) {
    return finish('EXPIRED_CREDENTIAL');
  }

  // g. burn the nonce (caller persists usedNonces to IndexedDB)
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