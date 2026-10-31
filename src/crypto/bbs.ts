import * as bbs from '@digitalbazaar/bbs-signatures';
import {
  CIPHERSUITE, CLAIM_ORDER, CLAIM_INDEX, ALWAYS_DISCLOSED, SCHEMA_VERSION,
  type ClaimName,
} from './schema';
import { b64urlEncode, b64urlDecode, utf8 } from './encoding';
import type { Credential, PresentationResponse } from '../types';

const hdr = (issuerId: string) => utf8(`${issuerId}|${SCHEMA_VERSION}`);
const msg = (k: string, v: string) => utf8(`${k}=${v}`);

export async function generateIssuerKeys() {
  const { secretKey, publicKey } = await bbs.generateKeyPair({ ciphersuite: CIPHERSUITE });
  return { secretKey: b64urlEncode(secretKey), publicKey: b64urlEncode(publicKey) };
}

export async function signCredential(
  claims: Record<ClaimName, string>,
  issuerId: string,
  secretKey: string,
  publicKey: string,
): Promise<string> {
  const messages = CLAIM_ORDER.map((k) => msg(k, claims[k]));
  const sig = await bbs.sign({
    secretKey: b64urlDecode(secretKey),
    publicKey: b64urlDecode(publicKey),
    header: hdr(issuerId),
    messages,
    ciphersuite: CIPHERSUITE,
  });
  return b64urlEncode(sig);
}

export async function deriveBbsProof(
  cred: Credential,
  publicKey: string,
  disclosed: ClaimName[],
  nonce: string,
) {
  const names = [...new Set([...disclosed, ...ALWAYS_DISCLOSED])];
  const idx = names.map((n) => CLAIM_INDEX[n]).sort((a, b) => a - b);
  const messages = CLAIM_ORDER.map((k) => msg(k, cred.claims[k]));
  const proof = await bbs.deriveProof({
    publicKey: b64urlDecode(publicKey),
    signature: b64urlDecode(cred.signature),
    header: hdr(cred.issuerId),
    messages,
    presentationHeader: utf8(nonce),
    disclosedMessageIndexes: idx,
    ciphersuite: CIPHERSUITE,
  });
  const revealed: Partial<Record<ClaimName, string>> = {};
  idx.forEach((i) => {
    revealed[CLAIM_ORDER[i]] = cred.claims[CLAIM_ORDER[i]];
  });
  return { proof: b64urlEncode(proof), disclosedIndexes: idx, revealed };
}

export async function verifyBbsProof(
  resp: PresentationResponse,
  publicKey: string,
): Promise<boolean> {
  try {
    // Derive indexes from the revealed claims. Never trust resp.disclosedIndexes.
    const keys = Object.keys(resp.revealed) as ClaimName[];
    if (keys.some((k) => CLAIM_INDEX[k] === undefined)) return false;
    const idx = keys.map((k) => CLAIM_INDEX[k]).sort((a, b) => a - b);
    const disclosedMessages = idx.map((i) =>
      msg(CLAIM_ORDER[i], resp.revealed[CLAIM_ORDER[i]]!),
    );
    return await bbs.verifyProof({
      publicKey: b64urlDecode(publicKey),
      proof: b64urlDecode(resp.proof),
      header: hdr(resp.issuerId),
      presentationHeader: utf8(resp.nonce),
      disclosedMessages,
      disclosedMessageIndexes: idx,
      ciphersuite: CIPHERSUITE,
    });
  } catch {
    return false;
  }
}