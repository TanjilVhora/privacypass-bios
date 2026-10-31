# PrivacyPass ID: Threat Model

| Threat | Mitigation | Evidence (test) | Status |
|---|---|---|---|
| Colluding verifiers linking a holder | Fresh randomized BBS proof per presentation; no unique ID or status index disclosed | bbs.test: two proofs of same claim are byte-different, both valid. sdjwt.test: SD-JWT signature identical across presentations (baseline is linkable) | Done |
| Forged or modified credential | BBS verification against pinned issuer key | bbs.test: changed value, wrong issuer key, and added claim all rejected; verify.test: tampered claim gives INVALID_PROOF | Done |
| Replay of a captured response | Nonce as presentationHeader, single use, request expiry | verify.test: REPLAY, NONCE_MISMATCH, EXPIRED_REQUEST | Done |
| Stale revocation data | Signed status list, age check, explicit UNKNOWN state | statuslist.test: stale, expired and missing-fetchedAt lists not fresh; tampered list fails signature; verify.test: VALID_STATUS_UNKNOWN | Done |
| Revoked credential still presented | Wallet checks its private index after sync and refuses to present | Status list bit check tested; wallet refusal not yet tested | Partial |
| Rogue or compromised issuer | Trusted-issuer key list with validity window | verify.test: UNTRUSTED_ISSUER, ISSUER_KEY_EXPIRED. Issuer still sees who it issued to | Partial |
| Stolen phone | Wallet PIN (basic) | None | Future (holder binding) |
| Age predicate | Issuer-attested age_over_18 claim | None | Future (real ZK range proof) |
| Device fingerprinting, network metadata, key management | None | None | Out of scope |

## Who knows what
- Issuer: sees who it issued to.
- Verifier: sees only the requested claim and valid_until.
- Server: never sees any presentation or verification.

## Known limits (state these openly)
- Revocation latency is bounded by credential lifetime (7 days) plus sync delay. The verifier cannot see the holder's status index, so it only gates on list freshness.
- valid_until is always revealed, so holders sharing the same date form one group.
- Prototype with synthetic data. Not production-ready until independently reviewed.