import type { ClaimName } from './crypto/schema';

export type ProofMode = 'bbs' | 'sdjwt';

// Placeholder, filled in properly at Step 9
export interface SdJwtCredential {
  payload: string;
  signature: string;
  disclosures: string[];
}

export interface Credential {
  id: string;
  issuerId: string;
  schemaVersion: string;
  claims: Record<ClaimName, string>;
  signature: string;
  sdjwt?: SdJwtCredential;
  statusIndex: number; // private to wallet
  listId: string;
  issuedAt: number;
  validUntil: number;
  revoked: boolean;
}

export interface TrustedIssuer {
  issuerId: string;
  name: string;
  bbsPublicKey: string;
  listPublicKeyJwk: JsonWebKey;
  validFrom: number;
  validTo: number;
}

export interface StatusListState {
  listId: string;
  issuerId: string;
  size: number;
  bitsB64: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
  fetchedAt?: number;
}

export interface PresentationRequest {
  v: 1;
  type: 'pp-request';
  verifierLabel: string;
  issuerId: string;
  claims: ClaimName[];
  nonce: string;
  expiresAt: number;
  mode: ProofMode;
}

export interface PresentationResponse {
  v: 1;
  type: 'pp-response';
  mode: ProofMode;
  nonce: string;
  issuerId: string;
  schemaVersion: string;
  revealed: Partial<Record<ClaimName, string>>;
  disclosedIndexes: number[];
  proof: string;
}

export type VerifyStatus =
  | 'VALID' | 'VALID_STATUS_UNKNOWN'
  | 'INVALID_PROOF' | 'EXPIRED_CREDENTIAL' | 'EXPIRED_REQUEST'
  | 'NONCE_MISMATCH' | 'REPLAY' | 'UNTRUSTED_ISSUER' | 'ISSUER_KEY_EXPIRED';

export interface VerifyResult {
  status: VerifyStatus;
  checks: { name: string; ok: boolean; detail?: string }[];
  revealed: Partial<Record<ClaimName, string>>;
  verifyMs: number;
}