import { b64urlEncode, b64urlDecode, utf8 } from './encoding';
import type { StatusListState } from '../types';

const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' };
const KEY_ALGO = { name: 'ECDSA', namedCurve: 'P-256' };

const signedString = (s: StatusListState) =>
  `${s.listId}.${s.issuerId}.${s.issuedAt}.${s.expiresAt}.${s.bitsB64}`;

export async function signStatusList(
  state: StatusListState,
  privateKeyJwk: JsonWebKey,
): Promise<StatusListState> {
  const key = await crypto.subtle.importKey('jwk', privateKeyJwk, KEY_ALGO, false, ['sign']);
  const sig = new Uint8Array(
    await crypto.subtle.sign(SIGN_ALGO, key, utf8(signedString(state)) as BufferSource),
  );
  return { ...state, signature: b64urlEncode(sig) };
}

export async function verifyStatusList(
  state: StatusListState,
  listPublicKeyJwk: JsonWebKey,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('jwk', listPublicKeyJwk, KEY_ALGO, false, ['verify']);
    return await crypto.subtle.verify(
      SIGN_ALGO,
      key,
      b64urlDecode(state.signature) as BufferSource,
      utf8(signedString(state)) as BufferSource,
    );
  } catch {
    return false;
  }
}

export function isStatusFresh(state: StatusListState, now: number, maxAgeMs: number): boolean {
  if (state.fetchedAt === undefined) return false;
  if (now - state.fetchedAt > maxAgeMs) return false;
  if (now > state.expiresAt) return false;
  return true;
}

export function isRevokedIndex(state: StatusListState, index: number): boolean {
  const bytes = b64urlDecode(state.bitsB64);
  const byte = bytes[Math.floor(index / 8)];
  if (byte === undefined) throw new RangeError(`status index ${index} out of range`);
  return ((byte >> (index % 8)) & 1) === 1;
}