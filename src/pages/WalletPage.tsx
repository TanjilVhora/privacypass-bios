import { useEffect, useState } from 'react';
import { deleteCredential, getCredentials, getMeta } from '../storage/db';
import { syncAll } from '../services/sync';
import { buildResponse } from '../services/present';
import { CLAIM_ORDER, ClaimName } from '../crypto/schema';
import type { Credential, PresentationRequest } from '../types';
import QRScan from '../components/QRScan';
import QRShow from '../components/QRShow';
import ClaimTable from '../components/ClaimTable';
import { useOffline } from '../components/NetworkBadge';

export default function WalletPage() {
  const isOffline = useOffline();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [selectedCredentialId, setSel] = useState<string>();
  const [scannedRequest, setReq] = useState<PresentationRequest | null>(null);
  const [responseQr, setQr] = useState<string | null>(null);
  const [lastSyncAt, setLast] = useState<number>();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  const reload = async () => {
    const c = await getCredentials();
    setCredentials(c); setSel((s) => (s && c.some((x) => x.id === s) ? s : c[0]?.id));
    setLast((await getMeta('lastSyncAt')) as number | undefined);
  };
  useEffect(() => { void reload(); }, []);
  const cred = credentials.find((c) => c.id === selectedCredentialId);

  async function sync() {
    try { await syncAll(); setMsg({ ok: true, text: 'Synced issuer key and status list.' }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    await reload();
  }
  function onScan(text: string) {
    try {
      const q = JSON.parse(text) as PresentationRequest;
      if (q.type !== 'pp-request' || q.v !== 1 || !Array.isArray(q.claims) || q.claims.some((c) => !CLAIM_ORDER.includes(c))) throw new Error();
      setReq(q); setQr(null); setScanning(false); setMsg(null);
    } catch { setMsg({ ok: false, text: 'That is not a valid request QR.' }); }
  }
  async function approve() {
    if (!cred || !scannedRequest) return;
    try { setQr(JSON.stringify(await buildResponse(scannedRequest, cred, scannedRequest.mode))); setMsg(null); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  }
  const shown: Partial<Record<ClaimName, string>> = {};
  if (cred && scannedRequest) [...scannedRequest.claims, 'valid_until' as ClaimName].forEach((n) => (shown[n] = cred.claims[n]));
  const state = (c: Credential) => (c.revoked ? ['Revoked', 'bg-red-100 text-red-900 border-red-800'] : c.validUntil < Date.now() ? ['Expired', 'bg-red-100 text-red-900 border-red-800'] : ['Active', 'bg-green-100 text-green-900 border-green-800']);

  return (
    <>
      {msg && <div role="alert" className={`card ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>{msg.text}</div>}
      <section className="card">
        <h3 className="h2">Sync</h3>
        <p className="text-sm text-slate-600">Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'never'}</p>
        <button className="btn btn-pri mt-2" disabled={isOffline} onClick={sync}>Sync now</button>
        {isOffline && <span className="text-sm text-amber-900 ml-2">Offline: sync is disabled.</span>}
      </section>
      <section>
        <h3 className="h2">My credentials</h3>
        {credentials.length === 0 && <div className="card text-slate-600">No credentials yet. Issue one in the Issuer tab.</div>}
        {credentials.map((c) => {
          const [label, cls] = state(c);
          return (
            <div key={c.id} className={`rounded-2xl p-4 mb-3 text-white bg-gradient-to-br from-ink via-sky-900 to-brand shadow-lg border-4 ${c.id === selectedCredentialId ? 'border-amber-500' : 'border-transparent'}`}>
              <div className="flex justify-between text-sm text-sky-100 font-semibold"><span>Demo University</span><span>Student pass</span></div>
              <div className="text-2xl font-bold my-3">{c.claims.name}</div>
              <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
                <div><div className="text-sky-200 font-normal text-xs">Student ID</div>{c.claims.student_id}</div>
                <div><div className="text-sky-200 font-normal text-xs">Valid until</div>{c.claims.valid_until.slice(0, 10)}</div>
                <div><div className="text-sky-200 font-normal text-xs">Date of birth</div>Hidden</div>
              </div>
              <div className="flex gap-2 mt-4 items-center flex-wrap">
                <span className={`pill ${cls}`}>{label}</span>
                <button className="px-3 py-2 rounded-lg border border-white/60 bg-white/15 text-white" onClick={() => { setSel(c.id); setReq(null); setQr(null); }}>{c.id === selectedCredentialId ? 'Selected' : 'Select'}</button>
                <button className="px-3 py-2 rounded-lg border border-white/60 bg-white/15 text-white" onClick={async () => { await deleteCredential(c.id); await reload(); }}>Delete</button>
              </div>
            </div>
          );
        })}
      </section>
      <section className="card">
        <h3 className="h2">Respond to a request</h3>
        <button className="btn btn-pri" disabled={!cred} onClick={() => setScanning(!scanning)}>{scanning ? 'Close scanner' : 'Scan verifier request'}</button>
        {scanning && <div className="mt-3"><QRScan onResult={onScan} /></div>}
        {scannedRequest && cred && (
          <div className="mt-4">
            <p className="font-semibold">{scannedRequest.verifierLabel} asks for: {scannedRequest.claims.join(', ')}</p>
            <p className="text-sm text-slate-600 mb-2">Hidden claims never leave your phone. valid_until is always shown.</p>
            <ClaimTable claims={cred.claims} revealed={shown} />
            <div className="flex gap-2 mt-3"><button className="btn btn-pri" onClick={approve}>Approve and show QR</button><button className="btn" onClick={() => { setReq(null); setQr(null); }}>Decline</button></div>
          </div>
        )}
        {responseQr && <div className="mt-4"><QRShow payload={responseQr} /><button className="btn mt-2" onClick={() => { setQr(null); setReq(null); }}>Done</button></div>}
      </section>
    </>
  );
}
