import { deriveBbsProof } from '../crypto/bbs';
import { presentSdJwt } from '../crypto/sdjwt';
import { ALWAYS_DISCLOSED, CLAIM_INDEX, CLAIM_ORDER, ClaimName } from '../crypto/schema';
import { getIssuer } from '../storage/db';
import type { Credential, PresentationRequest, PresentationResponse, ProofMode } from '../types';

export function assertCanPresent(req: PresentationRequest, cred: Credential, now = Date.now()): void {
  if (cred.revoked) throw new Error('This credential is revoked. The wallet refuses to present it.');
  if (cred.validUntil < now) throw new Error('This credential has expired.');
  if (req.issuerId !== cred.issuerId) throw new Error('The request is for a different issuer.');
  if (now > req.expiresAt) throw new Error('The request has expired. Ask the verifier for a new one.');
  if (!req.claims.length || req.claims.some((c) => !(c in CLAIM_INDEX) || c === 'valid_until')) throw new Error('The request asks for invalid claims.');
}

export async function buildResponse(
  request: PresentationRequest, credential: Credential, mode: ProofMode = request.mode,
  opts: { bbsPublicKey?: string; now?: number } = {},
): Promise<PresentationResponse> {
  assertCanPresent(request, credential, opts.now);
  const base = { v: 1 as const, type: 'pp-response' as const, mode, nonce: request.nonce, issuerId: credential.issuerId, schemaVersion: credential.schemaVersion };
  if (mode === 'sdjwt') {
    if (!credential.sdjwt) throw new Error('This credential has no SD-JWT form.');
    const names = [...new Set<ClaimName>([...request.claims, ...ALWAYS_DISCLOSED])].sort((a, b) => CLAIM_INDEX[a] - CLAIM_INDEX[b]);
    const revealed: Partial<Record<ClaimName, string>> = {};
    names.forEach((n) => (revealed[n] = credential.claims[n]));
    return { ...base, revealed, disclosedIndexes: names.map((n) => CLAIM_INDEX[n]), proof: presentSdJwt(credential.sdjwt, names, request.nonce) };
  }
  const publicKey = opts.bbsPublicKey ?? (await getIssuer(request.issuerId))?.bbsPublicKey;
  if (!publicKey) throw new Error('Issuer key not synced. Tap Sync once while online.');
  const d = await deriveBbsProof(credential, publicKey, request.claims, request.nonce);
  return { ...base, revealed: d.revealed, disclosedIndexes: d.disclosedIndexes, proof: d.proof };
}
export { CLAIM_ORDER };
