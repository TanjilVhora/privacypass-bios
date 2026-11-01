import { useEffect, useState } from 'react';
import { getAllIssuers, getStatusList } from '../storage/db';
import { syncAll } from '../services/sync';
import { verifyWithDb } from '../services/verify';
import { listIdFor } from '../crypto/schema';
import { randomNonce } from '../crypto/encoding';
import { REQUEST_TTL_MS, getStatusMaxAgeMs } from '../config';
import type { PresentationRequest, PresentationResponse, ProofMode, VerifyResult } from '../types';
import QRShow from '../components/QRShow';
import QRScan from '../components/QRScan';
import ClaimTable from '../components/ClaimTable';
import ResultBadge from '../components/ResultBadge';
import { useOffline } from '../components/NetworkBadge';

const PRESETS = { student: ['student_status'], age18: ['age_over_18'] } as const;

export default function VerifierPage() {
  const isOffline = useOffline();
  const [requestPreset, setPreset] = useState<'student' | 'age18'>('student');
  const [mode, setMode] = useState<ProofMode>('bbs');
  const [label, setLabel] = useState('Shop A');
  const [activeRequest, setReq] = useState<PresentationRequest | null>(null);
  const [verifyResult, setResult] = useState<VerifyResult | null>(null);
  const [statusAgeSeconds, setAge] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = async () => {
      setNow(Date.now());
      const iss = (await getAllIssuers())[0];
      const l = iss && (await getStatusList(listIdFor(iss.issuerId)));
      setAge(l && l.fetchedAt ? Math.round((Date.now() - l.fetchedAt) / 1000) : null);
    };
    void tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function sync() {
    try { await syncAll(); setMsg({ ok: true, text: 'Synced issuer key and status list.' }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  async function createRequest() {
    const iss = (await getAllIssuers())[0];
    if (!iss) return setMsg({ ok: false, text: 'No trusted issuer yet. Tap Sync now while online.' });
    setReq({ v: 1, type: 'pp-request', verifierLabel: label.trim() || 'Shop', issuerId: iss.issuerId, claims: [...PRESETS[requestPreset]], nonce: randomNonce(16), expiresAt: Date.now() + REQUEST_TTL_MS, mode });
    setResult(null); setMsg(null);
  }
  async function onScan(text: string) {
    setScanning(false);
    if (!activeRequest) return setMsg({ ok: false, text: 'Create a request first.' });
    try {
      const r = JSON.parse(text) as PresentationResponse;
      if (r.type !== 'pp-response' || typeof r.proof !== 'string' || !r.revealed) throw new Error();
      setResult(await verifyWithDb(r, activeRequest)); setMsg(null);
    } catch { setMsg({ ok: false, text: 'That is not a valid response QR.' }); }
  }
  const left = activeRequest ? Math.max(0, Math.round((activeRequest.expiresAt - now) / 1000)) : 0;
  const maxAge = getStatusMaxAgeMs() / 1000;

  return (
    <>
      {msg && <div role="alert" className={`card ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>{msg.text}</div>}
      <section className="card">
        <h3 className="h2">Trust data</h3>
        <p className="text-sm text-slate-600">Status list age: {statusAgeSeconds === null ? 'none cached' : `${statusAgeSeconds}s (${statusAgeSeconds <= maxAge ? 'fresh' : 'stale'}, limit ${maxAge}s)`}</p>
        <button className="btn btn-pri mt-2" disabled={isOffline} onClick={sync}>Sync now</button>
      </section>
      <section className="card">
        <h3 className="h2">Request a claim</h3>
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <div><label className="lbl" htmlFor="lab">Shop name</label><input id="lab" className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="pre">What to check</label><select id="pre" className="input" value={requestPreset} onChange={(e) => setPreset(e.target.value as 'student' | 'age18')}><option value="student">Student status</option><option value="age18">Over 18</option></select></div>
          <div><label className="lbl" htmlFor="mod">Proof mode</label><select id="mod" className="input" value={mode} onChange={(e) => setMode(e.target.value as ProofMode)}><option value="bbs">BBS (unlinkable)</option><option value="sdjwt">SD-JWT (linkable baseline)</option></select></div>
        </div>
        <button className="btn btn-pri" onClick={createRequest}>Create request QR</button>
        {activeRequest && (
          <div className="mt-4">
            <p className="text-sm text-slate-600 text-center mb-2">{left > 0 ? `Expires in ${left}s` : 'Expired. Create a new request.'}</p>
            <QRShow payload={JSON.stringify(activeRequest)} />
            <div className="text-center mt-3"><button className="btn btn-pri" onClick={() => setScanning(!scanning)}>{scanning ? 'Close scanner' : 'Scan wallet response'}</button></div>
            {scanning && <div className="mt-3"><QRScan onResult={onScan} /></div>}
          </div>
        )}
      </section>
      {verifyResult && (
        <section className="card">
          <h3 className="h2">Result</h3>
          <ResultBadge status={verifyResult.status} big />
          <p className="text-sm text-slate-600 my-2">Checked on this device in {verifyResult.verifyMs.toFixed(1)} ms. No server contacted.</p>
          <ClaimTable revealed={verifyResult.revealed} />
          <h4 className="font-semibold mt-3 mb-1">Checks</h4>
          <ul className="text-sm">{verifyResult.checks.map((c, i) => <li key={i}>{c.ok ? 'Pass' : 'Fail'}: {c.name}</li>)}</ul>
        </section>
      )}
    </>
  );
}
