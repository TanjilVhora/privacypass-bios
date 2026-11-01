export const CIPHERSUITE = 'BLS12-381-SHA-256';
export const SCHEMA_VERSION = 'student-v1';
export const CLAIM_ORDER = ['name','dob','student_id','student_status','age_over_18','address','valid_until'] as const;
export type ClaimName = typeof CLAIM_ORDER[number];
export const ALWAYS_DISCLOSED: ClaimName[] = ['valid_until'];
export const CLAIM_INDEX: Record<ClaimName, number> = {
  name: 0, dob: 1, student_id: 2, student_status: 3,
  age_over_18: 4, address: 5, valid_until: 6,
};
export const listIdFor = (issuerId: string) => `${issuerId}-status-v1`;