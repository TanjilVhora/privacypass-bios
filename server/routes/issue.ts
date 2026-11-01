import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { CFG, readJson, writeJson } from '../keys';
import { signCredential } from '../../src/crypto/bbs';
import { issueSdJwt } from '../../src/crypto/sdjwt';
import { CLAIM_ORDER, ClaimName, listIdFor } from '../../src/crypto/schema';
import { CREDENTIAL_LIFETIME_MS, SCHEMA_VERSION, STATUS_LIST_SIZE } from '../../src/config';
import type { Credential } from '../../src/types';

interface Issued { credentialId: string; statusIndex: number; issuedAt: number }
const r = Router();

r.post('/', async (req, res) => {
  try {
    const input = req.body?.claims as Record<string, unknown> | undefined;
    const needed = CLAIM_ORDER.filter((c) => c !== 'valid_until');
    if (!input || needed.some((c) => typeof input[c] !== 'string' || !(input[c] as string).trim() || (input[c] as string).length > 200)) {
      return res.status(400).json({ error: 'claims must contain the 6 text claims (max 200 chars each)' });
    }
    const now = Date.now();
    const claims = Object.fromEntries(needed.map((c) => [c, (input[c] as string).trim()])) as Record<ClaimName, string>;
    claims.valid_until = new Date(now + CREDENTIAL_LIFETIME_MS).toISOString();

    const issued = readJson<Issued[]>('issued.json', []);
    const used = new Set(issued.map((i) => i.statusIndex));
    if (used.size >= STATUS_LIST_SIZE) return res.status(507).json({ error: 'status list full' });
    let statusIndex: number;
    do { statusIndex = crypto.getRandomValues(new Uint16Array(1))[0] % STATUS_LIST_SIZE; } while (used.has(statusIndex));

    const id = randomUUID();
    const signature = await signCredential(claims, CFG.issuerId, CFG.bbsSecretKey, CFG.bbsPublicKey);
    const sdjwt = await issueSdJwt(claims, CFG.listPrivateJwk);
    issued.push({ credentialId: id, statusIndex, issuedAt: now }); // no claims stored
    writeJson('issued.json', issued);

    const credential: Credential = {
      id, issuerId: CFG.issuerId, schemaVersion: SCHEMA_VERSION, claims, signature, sdjwt,
      statusIndex, listId: listIdFor(CFG.issuerId), issuedAt: now, validUntil: Date.parse(claims.valid_until), revoked: false,
    };
    res.json({ credential });
  } catch {
    res.status(500).json({ error: 'issue failed' }); // never log request bodies
  }
});
export default r;
