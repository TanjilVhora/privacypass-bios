import { useState } from 'react';
import { runBenchmark, runLinkability, runSuite, Result } from '../../tests/suite';

type Link = Awaited<ReturnType<typeof runLinkability>>;
type Bench = Awaited<ReturnType<typeof runBenchmark>>;
const THREATS = [
  ['Colluding verifiers', 'Fresh BBS proofs, no unique ID or status index disclosed', 'Done'],
  ['Forged or modified credential', 'BBS verification against pinned issuer key', 'Done'],
  ['Replay of a captured response', 'Nonce as presentation header, single use, expiry', 'Done'],
  ['Stale revocation data', 'Signed list, age check, explicit UNKNOWN state', 'Done'],
  ['Rogue issuer', 'Trusted-issuer key list with validity window', 'Partial'],
  ['Stolen phone', 'Wallet PIN (basic). Holder binding is future work', 'Future work'],
  ['Age predicate', 'Issuer-attested age_over_18. Real ZK range proof is future work', 'Simplified'],
  ['Fingerprinting, network metadata', 'Documented, not mitigated', 'Out of scope'],
];

export default function ProofsPage() {
  const [linkResults, setLink] = useState<Link | null>(null);
  const [testResults, setTests] = useState<Result[] | null>(null);
  const [benchStats, setBench] = useState<Bench | null>(null);
  const [busy, setBusy] = useState('');
  const run = async (name: string, fn: () => Promise<void>) => { setBusy(name); try { await fn(); } catch (e) { alert((e as Error).message); } setBusy(''); };
  const bad = 'bg-red-100 text-red-900 border-red-800', good = 'bg-green-100 text-green-900 border-green-800';

  return (
    <>
      <section className="card">
        <h3 className="h2">Linkability: Shop A vs Shop B</h3>
        <p className="text-sm text-slate-600 mb-2">Same credential, same claim, two shops. Identical signature bytes mean colluding shops can link the holder.</p>
        <button className="btn btn-pri" disabled={!!busy} onClick={() => run('link', async () => setLink(await runLinkability()))}>{busy === 'link' ? 'Running...' : 'Run comparison'}</button>
        {linkResults && linkResults.map((r) => (
          <div key={r.mode} className="mt-3 border border-slate-300 rounded-lg p-3">
            <div className="flex justify-between items-center flex-wrap gap-2"><b>{r.mode === 'bbs' ? 'BBS' : 'SD-JWT baseline'}</b>
              <span className={`pill ${r.identical ? bad : good}`}>{r.identical ? 'IDENTICAL (linkable)' : 'DIFFERENT (unlinkable)'}</span></div>
            <p className="text-xs font-mono break-all mt-2">Shop A: {r.shopA.slice(0, 48)}...</p>
            <p className="text-xs font-mono break-all">Shop B: {r.shopB.slice(0, 48)}...</p>
            <p className="text-sm mt-1">Both verify: {r.bothVerify ? 'yes' : 'no'}</p>
          </div>
        ))}
      </section>
      <section className="card">
        <h3 className="h2">Automated tests</h3>
        <button className="btn btn-pri" disabled={!!busy} onClick={() => run('tests', async () => setTests(await runSuite()))}>{busy === 'tests' ? 'Running...' : 'Run tests'}</button>
        {testResults && (<>
          <p className="my-2 font-semibold">{testResults.filter((r) => r.ok).length} of {testResults.length} passed</p>
          <ul className="text-sm space-y-1">{testResults.map((r, i) => <li key={i}><span className={`pill ${r.ok ? good : bad} !text-xs`}>{r.ok ? 'PASS' : 'FAIL'}</span> {r.name}{r.detail ? ` (${r.detail.slice(0, 80)})` : ''}</li>)}</ul>
        </>)}
      </section>
      <section className="card">
        <h3 className="h2">Benchmark</h3>
        <p className="text-sm text-slate-600 mb-2">Runs verifyResponse 50 times on this device.</p>
        <button className="btn btn-pri" disabled={!!busy} onClick={() => run('bench', async () => setBench(await runBenchmark(50)))}>{busy === 'bench' ? 'Running...' : 'Run benchmark'}</button>
        {benchStats && <table className="text-sm mt-3"><tbody>
          <tr><td className="pr-6 py-1">Median</td><td>{benchStats.medianMs.toFixed(2)} ms</td></tr>
          <tr><td className="pr-6 py-1">p95</td><td>{benchStats.p95Ms.toFixed(2)} ms</td></tr>
          <tr><td className="pr-6 py-1">Runs</td><td>{benchStats.runs}</td></tr>
          <tr><td className="pr-6 py-1">Response QR payload</td><td>{benchStats.payloadBytes} bytes</td></tr></tbody></table>}
      </section>
      <section className="card">
        <h3 className="h2">Threat model</h3>
        <table className="w-full text-sm"><thead><tr className="text-left text-slate-600"><th>Threat</th><th>Mitigation</th><th>Status</th></tr></thead>
          <tbody>{THREATS.map((t) => <tr key={t[0]} className="border-t border-slate-200 align-top"><td className="py-1.5 pr-2 font-medium">{t[0]}</td><td className="pr-2">{t[1]}</td><td>{t[2]}</td></tr>)}</tbody></table>
        <p className="text-sm text-slate-600 mt-3">Issuer sees who it issued to. Verifier sees only the requested claim and valid_until. The server never sees any verification.</p>
      </section>
    </>
  );
}
