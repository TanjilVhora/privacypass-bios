import type { SdJwtCredential } from '../types';
import type { ClaimName } from './schema';

// STUB: real baseline comes in Step 9.
export async function issueSdJwt(_claims: Record<ClaimName, string>, _key: CryptoKey): Promise<SdJwtCredential> {
  return { payload: 'stub', signature: 'stub-signature', disclosures: [] };
}
export function presentSdJwt(_c: SdJwtCredential, _disclosed: ClaimName[], _nonce: string): string {
  return 'stub-presentation';
}
export async function verifySdJwt(_p: string, _key: CryptoKey, _nonce: string) {
  return { ok: true, revealed: {} as Record<string, string> };
}