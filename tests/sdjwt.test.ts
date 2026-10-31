import { describe, it, expect } from 'vitest';
import { issueSdJwt, presentSdJwt, verifySdJwt, sdJwtSignatureOf } from '../src/crypto/sdjwt';
import type { ClaimName } from '../src/crypto/schema';

const claims: Record<ClaimName, string> = {
  name: 'Asha', dob: '2001-04-12', student_id: 'DU-2291',
  student_status: 'enrolled', age_over_18: 'true',
  address: '12 Demo Lane', valid_until: '2030-12-31',
};

async function keys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    priv: await crypto.subtle.exportKey('jwk', kp.privateKey),
    pub: await crypto.subtle.exportKey('jwk', kp.publicKey),
  };
}

describe('SD-JWT baseline', () => {
  it('issue, present and verify works and reveals only chosen claims', async () => {
    const { priv, pub } = await keys();
    const cred = await issueSdJwt(claims, priv);
    const p = presentSdJwt(cred, ['student_status', 'valid_until'], 'n1');
    const r = await verifySdJwt(p, pub, 'n1');
    expect(r.ok).toBe(true);
    expect(Object.keys(r.revealed).sort()).toEqual(['student_status', 'valid_until']);
  });

  it('presenting twice gives an IDENTICAL signature (linkable)', async () => {
    const { priv } = await keys();
    const cred = await issueSdJwt(claims, priv);
    const a = presentSdJwt(cred, ['student_status'], 'nonce-A');
    const b = presentSdJwt(cred, ['student_status'], 'nonce-B');
    expect(sdJwtSignatureOf(a)).toBe(sdJwtSignatureOf(b));
  });

  it('a tampered disclosure is rejected', async () => {
    const { priv, pub } = await keys();
    const cred = await issueSdJwt(claims, priv);
    const fake = btoa(JSON.stringify(['salt', 'student_status', 'graduated']));
    const p = presentSdJwt(cred, [], 'n1').replace(/~n1$/, `~${fake}~n1`);
    expect((await verifySdJwt(p, pub, 'n1')).ok).toBe(false);
  });

  it('a wrong nonce is rejected', async () => {
    const { priv, pub } = await keys();
    const cred = await issueSdJwt(claims, priv);
    const p = presentSdJwt(cred, ['student_status'], 'n1');
    expect((await verifySdJwt(p, pub, 'other')).ok).toBe(false);
  });
});