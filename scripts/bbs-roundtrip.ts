import * as bbs from '@digitalbazaar/bbs-signatures';

const ciphersuite = 'BLS12-381-SHA-256';
const enc = new TextEncoder();

const claims = [
  'name=Asha',
  'dob=2001-04-12',
  'student_id=DU-2291',
  'student_status=enrolled',
  'age_over_18=true',
  'address=12 Demo Lane',
  'valid_until=2026-12-31',
];
const messages = claims.map((c) => enc.encode(c));
const header = enc.encode('demo-university|student-v1');

// Issuer: make keys and sign all 7 claims
const { secretKey, publicKey } = await bbs.generateKeyPair({ ciphersuite });
const signature = await bbs.sign({ secretKey, publicKey, header, messages, ciphersuite });
console.log('1. full signature valid (expect true):',
  await bbs.verifySignature({ publicKey, signature, header, messages, ciphersuite }));

// Holder: reveal only index 3 (student_status) and 6 (valid_until)
const idx = [3, 6];
const derive = (nonce: string) =>
  bbs.deriveProof({
    publicKey, signature, header, messages,
    presentationHeader: enc.encode(nonce),
    disclosedMessageIndexes: idx,
    ciphersuite,
  });

// Verifier
const verify = (proof: Uint8Array, nonce: string, disclosed = idx.map((i) => messages[i])) =>
  bbs.verifyProof({
    publicKey, proof, header,
    presentationHeader: enc.encode(nonce),
    disclosedMessages: disclosed,
    disclosedMessageIndexes: idx,
    ciphersuite,
  });

const p1 = await derive('nonce-A');
const p2 = await derive('nonce-B');

console.log('2. proof 1 valid (expect true):', await verify(p1, 'nonce-A'));
console.log('3. proof 2 valid (expect true):', await verify(p2, 'nonce-B'));
console.log('4. proof 1 with wrong nonce (expect false):', await verify(p1, 'nonce-B'));

const forged = [enc.encode('student_status=graduated'), messages[6]];
console.log('5. tampered claim (expect false):', await verify(p1, 'nonce-A', forged));

console.log('6. two proofs identical (expect false):', Buffer.compare(p1, p2) === 0);
console.log('7. proof size in bytes:', p1.length);