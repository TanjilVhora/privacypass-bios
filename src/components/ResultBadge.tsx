import type { VerifyStatus } from '../types';

const LABEL: Record<VerifyStatus, string> = {
  VALID: 'VALID', VALID_STATUS_UNKNOWN: 'STATUS UNKNOWN - UPDATE REQUIRED', INVALID_PROOF: 'INVALID PROOF',
  EXPIRED_CREDENTIAL: 'EXPIRED CREDENTIAL', EXPIRED_REQUEST: 'EXPIRED REQUEST', NONCE_MISMATCH: 'NONCE MISMATCH',
  REPLAY: 'REPLAY BLOCKED', UNTRUSTED_ISSUER: 'UNTRUSTED ISSUER', ISSUER_KEY_EXPIRED: 'ISSUER KEY EXPIRED',
};
export default function ResultBadge({ status, big }: { status: VerifyStatus; big?: boolean }) {
  const c = status === 'VALID' ? 'bg-green-100 text-green-900 border-green-800' : status === 'VALID_STATUS_UNKNOWN' ? 'bg-amber-100 text-amber-900 border-amber-800' : 'bg-red-100 text-red-900 border-red-800';
  return <span className={`pill ${c} ${big ? '!text-2xl !px-5 !py-3 !rounded-2xl' : ''}`}>{LABEL[status]}</span>;
}
