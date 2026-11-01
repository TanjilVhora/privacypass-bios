import { Router } from 'express';
import { CFG } from '../keys';
import type { TrustedIssuer } from '../../src/types';

const r = Router();
r.get('/', (_req, res) => {
  const now = Date.now();
  const issuer: TrustedIssuer = {
    issuerId: CFG.issuerId, name: CFG.issuerName, bbsPublicKey: CFG.bbsPublicKey,
    listPublicKeyJwk: CFG.listPublicJwk, validFrom: now - 24 * 3600 * 1000, validTo: now + 365 * 24 * 3600 * 1000,
  };
  res.json({ issuers: [issuer] });
});
export default r;
