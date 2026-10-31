import type {
  PresentationRequest, PresentationResponse, StatusListState, TrustedIssuer, VerifyResult,
} from '../types';

// STUB: returns a fixed result so VerifierPage can be built. Real logic comes in Step 8.
export async function verifyResponse(
  resp: PresentationResponse,
  _request: PresentationRequest,
  _issuers: TrustedIssuer[],
  _statusList: StatusListState | null,
  _usedNonces: Set<string>,
  _now: number,
): Promise<VerifyResult> {
  return {
    status: 'VALID',
    checks: [{ name: 'stub', ok: true, detail: 'not implemented yet' }],
    revealed: resp.revealed,
    verifyMs: 0,
  };
}