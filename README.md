# PrivacyPass ID

Privacy-preserving student credentials with BBS selective disclosure. Synthetic data only. Prototype, not production-ready.

## Run
1. `npm install` (Node 20.6+ for `--env-file`)
2. `npm run keygen`, copy the printed lines into `.env` (start from `.env.example`)
3. `npm test`
4. Dev: `npm run dev:server` and `npm run dev` (open the Vite URL)
5. Production: `npm run build && npm start`, deploy over HTTPS (camera, service worker, WebCrypto)

Open the app once online, tap Sync in Wallet and Verifier, then airplane mode still verifies.
Add `?demo=1` to shorten status freshness to 30 s.

## What is real and what is simplified
- Real: BBS selective disclosure from `@digitalbazaar/bbs-signatures`, nonce as presentation header, replay protection, signed status list, offline verification.
- Simplified (labeled): `age_over_18` is issuer-attested, not a ZK range proof. Revocation latency is bounded by the 7-day credential life plus sync delay. Wallet PIN and holder binding are future work.
- SD-JWT exists only as the linkable baseline (same issuer signature every time).
- Server never receives a presentation and never stores claims.
