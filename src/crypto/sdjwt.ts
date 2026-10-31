import { b64urlEncode, b64urlDecode, utf8, sha256, randomNonce } from './encoding';
import { CLAIM_ORDER, type ClaimName } from './schema';
import type { SdJwtCredential } from '../types';

const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' };
const KEY_ALGO = { name: 'ECDSA', namedCurve: 'P-256' };

const hashDisclosure = async (d: string) => b64urlEncode(await sha256(utf8(d)));

export async function issueSdJwt(
  claims: Record<ClaimName, string>,
  privateKeyJwk: JsonWebKey,
  issuerId = 'demo-university',
): Promise<SdJwtCredential> {
  const disclosures = CLAIM_ORDER.map((name) =>
    b64urlEncode(utf8(JSON.stringify([randomNonce(16), name, claims[name]]))),
  );
  const digests = (await Promise.all(disclosures.map(hashDisclosure))).sort();
  const payload = b64urlEncode(utf8(JSON.stringify({ iss: issuerId, digests })));
  const key = await crypto.subtle.importKey('jwk', privateKeyJwk, KEY_ALGO, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign(SIGN_ALGO, key, utf8(payload) as BufferSource));
  return { payload, signature: b64urlEncode(sig), disclosures };
}

// Chosen disclosures only. The signed payload and signature are sent unchanged every time.
export function presentSdJwt(c: SdJwtCredential, disclosed: ClaimName[], nonce: string): string {
  const chosen = c.disclosures.filter((d) => {
    const [, name] = JSON.parse(new TextDecoder().decode(b64urlDecode(d)));
    return disclosed.includes(name);
  });
  return [c.payload, c.signature, ...chosen].join('~') + '~' + nonce;
}

export async function verifySdJwt(
  presentation: string,
  publicKeyJwk: JsonWebKey,
  nonce: string,
): Promise<{ ok: boolean; revealed: Record<string, string> }> {
  try {
    const [payload, signature, ...rest] = presentation.split('~');
    const sentNonce = rest.pop();
    if (sentNonce !== nonce) return { ok: false, revealed: {} };
    const key = await crypto.subtle.importKey('jwk', publicKeyJwk, KEY_ALGO, false, ['verify']);
    const sigOk = await crypto.subtle.verify(
      SIGN_ALGO, key, b64urlDecode(signature) as BufferSource, utf8(payload) as BufferSource);
    if (!sigOk) return { ok: false, revealed: {} };
    const { digests } = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    const revealed: Record<string, string> = {};
    for (const d of rest.filter(Boolean)) {
      if (!digests.includes(await hashDisclosure(d))) return { ok: false, revealed: {} };
      const [, name, value] = JSON.parse(new TextDecoder().decode(b64urlDecode(d)));
      revealed[name] = value;
    }
    return { ok: true, revealed };
  } catch {
    return { ok: false, revealed: {} };
  }
}

// Helper for the Proofs page: the part of a presentation that never changes.
export const sdJwtSignatureOf = (presentation: string) => presentation.split('~')[1];