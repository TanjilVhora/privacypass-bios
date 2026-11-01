export const CREDENTIAL_LIFETIME_MS = 7 * 24 * 3600 * 1000;
export const REQUEST_TTL_MS = 2 * 60 * 1000;
export const STATUS_MAX_AGE_MS = 24 * 3600 * 1000; // demo: 30_000 via ?demo=1
export const STATUS_LIST_SIZE = 1024;
export const DB_NAME = 'privacypass';
export const DB_VERSION = 1;
export { SCHEMA_VERSION } from './crypto/schema';

export const getStatusMaxAgeMs = (): number => {
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1') return 30_000;
  } catch { /* ignore */ }
  return STATUS_MAX_AGE_MS;
};