import { webcrypto } from 'node:crypto';
if (!(globalThis as { crypto?: unknown }).crypto) (globalThis as { crypto?: unknown }).crypto = webcrypto;
