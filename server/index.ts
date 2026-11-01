import { webcrypto } from 'node:crypto';
if (!(globalThis as { crypto?: unknown }).crypto) (globalThis as { crypto?: unknown }).crypto = webcrypto;
import express from 'express';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CFG } from './keys';
import issue from './routes/issue';
import issuers from './routes/issuers';
import status from './routes/status';
import revoke from './routes/revoke';

const app = express();
app.use(express.json({ limit: '20kb' })); // no request-body logging anywhere
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/issue', issue);
app.use('/api/issuers', issuers);
app.use('/api/status', status);
app.use('/api/revoke', revoke);
// No endpoint receives a presentation. Verification happens on the verifier's device.

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(dist + 'index.html'));
}
app.listen(CFG.port, () => console.log(`PrivacyPass server on :${CFG.port}`));
