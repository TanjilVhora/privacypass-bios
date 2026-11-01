import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { CFG, readJson } from '../keys';
import { loadList, saveList } from './status';
import { setRevokedBit, signStatusList } from '../../src/crypto/statuslist';

const r = Router();
r.post('/', async (req, res) => {
  const { credentialId, adminToken } = req.body ?? {};
  const a = Buffer.from(String(adminToken ?? '')), b = Buffer.from(CFG.adminToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'bad admin token' });
  const rec = readJson<{ credentialId: string; statusIndex: number }[]>('issued.json', []).find((i) => i.credentialId === credentialId);
  if (!rec) return res.status(404).json({ error: 'unknown credentialId' });
  const cur = await loadList();
  const now = Date.now();
  const list = await signStatusList({ ...cur, bitsB64: setRevokedBit(cur.bitsB64, rec.statusIndex), issuedAt: now }, CFG.listPrivateJwk);
  saveList(list);
  res.json({ ok: true, list });
});
export default r;
