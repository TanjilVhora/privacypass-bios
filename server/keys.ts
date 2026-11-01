import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}. Run "npm run keygen" and copy the output into .env`);
  return v;
};

export const CFG = {
  issuerId: process.env.ISSUER_ID ?? 'demo-university',
  issuerName: process.env.ISSUER_NAME ?? 'Demo University',
  bbsSecretKey: need('BBS_SECRET_KEY'),
  bbsPublicKey: need('BBS_PUBLIC_KEY'),
  listPrivateJwk: JSON.parse(need('LIST_PRIVATE_KEY_JWK')) as JsonWebKey,
  listPublicJwk: JSON.parse(need('LIST_PUBLIC_KEY_JWK')) as JsonWebKey,
  adminToken: need('ADMIN_TOKEN'),
  port: Number(process.env.PORT ?? 3000),
};

const DIR = fileURLToPath(new URL('./data/', import.meta.url));
export const readJson = <T>(file: string, fallback: T): T => {
  try { return JSON.parse(fs.readFileSync(DIR + file, 'utf8')) as T; } catch { return fallback; }
};
export const writeJson = (file: string, value: unknown): void => {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(DIR + file, JSON.stringify(value, null, 2));
};
