import { webcrypto } from 'node:crypto';
if (!(globalThis as { crypto?: unknown }).crypto) (globalThis as { crypto?: unknown }).crypto = webcrypto;
import { generateBbsKeyPair } from '../src/crypto/bbs';

const bbsKeys = await generateBbsKeyPair();
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
const pub = await webcrypto.subtle.exportKey('jwk', pair.publicKey);

console.log('# Copy these lines into .env\n');
console.log(`BBS_SECRET_KEY=${bbsKeys.secretKey}`);
console.log(`BBS_PUBLIC_KEY=${bbsKeys.publicKey}`);
console.log(`LIST_PRIVATE_KEY_JWK='${JSON.stringify(priv)}'`);
console.log(`LIST_PUBLIC_KEY_JWK='${JSON.stringify(pub)}'`);
