import { useEffect, useState } from 'react';
import { getCredentials, putCredential } from '../storage/db';
import { isRevokedIndex } from '../crypto/statuslist';
import type { Credential, StatusListState } from '../types';
import { syncIssuers } from '../services/sync';
import { STATUS_LIST_SIZE } from '../config';

type Msg = { ok: boolean; text: string } | null;
const FIELDS = [['name', 'Name'], ['dob', 'Date of birth (YYYY-MM-DD)'], ['student_id', 'Student ID'], ['student_status', 'Student status'], ['age_over_18', 'Over 18 (true/false)'], ['address', 'Address']] as const;

export default function IssuerPage() {
  const [claimsForm, setForm] = useState<Record<string, string>>({ name: 'Asha Demo', dob: '2003-04-12', student_id: 'S-1042', student_status: 'enrolled', age_over_18: 'true', address: '12 Sample Rd, Demo City' });
  const [issuedCredential, setIssued] = useState<Credential | null>(null);
  const [adminToken, setToken] = useState('');
  const [statusList, setList] = useState<StatusListState | null>(null);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [target, setTarget] = useState('');
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const c = await getCredentials();
    setCreds(c); setTarget((t) => t || c[0]?.id || '');
    try { const r = await fetch('/api/status'); if (r.ok) setList(await r.json()); } catch { /* offline */ }
  };
  useEffect(() => { void reload(); }, []);

  async function issue() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claims: claimsForm }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Issue failed');
      await putCredential(j.credential);
      await syncIssuers().catch(() => undefined);
      setIssued(j.credential); setMsg({ ok: true, text: 'Credential issued and saved to this wallet.' });
      await reload();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  }

  async function revoke() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentialId: target, adminToken }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Revoke failed');
      setList(j.list); setMsg({ ok: true, text: 'Revoked. Wallets and verifiers must sync to see it.' });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  }

  const revokedCount = statusList ? Array.from({ length: STATUS_LIST_SIZE }, (_, i) => isRevokedIndex(statusList, i)).filter(Boolean).length : 0;
  return (
    <>
      {msg && <div role="alert" className={`card ${msg.ok ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>{msg.text}</div>}
      <section className="card">
        <h3 className="h2">Issue a credential</h3>
        <p className="text-sm text-slate-600 mb-3">Synthetic data only. Never enter real documents.</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          {FIELDS.map(([k, label]) => (
            <div key={k}><label className="lbl" htmlFor={k}>{label}</label>
              <input id={k} className="input" value={claimsForm[k]} onChange={(e) => setForm({ ...claimsForm, [k]: e.target.value })} /></div>
          ))}
        </div>
        <button className="btn btn-pri" disabled={busy} onClick={issue}>Issue credential to wallet</button>
        {issuedCredential && <p className="text-sm mt-3 break-all">Issued <b>{issuedCredential.claims.name}</b> (id {issuedCredential.id.slice(0, 8)}, valid until {issuedCredential.claims.valid_until.slice(0, 10)}).</p>}
      </section>
      <section className="card">
        <h3 className="h2">Revoke a credential</h3>
        <label className="lbl" htmlFor="cred">Credential</label>
        <select id="cred" className="input mb-3" value={target} onChange={(e) => setTarget(e.target.value)}>
          {creds.length === 0 && <option value="">No credentials in this wallet</option>}
          {creds.map((c) => <option key={c.id} value={c.id}>{c.claims.name} ({c.id.slice(0, 8)})</option>)}
        </select>
        <label className="lbl" htmlFor="tok">Admin token</label>
        <input id="tok" type="password" className="input mb-3" value={adminToken} onChange={(e) => setToken(e.target.value)} />
        <button className="btn btn-dng" disabled={busy || !target || !adminToken} onClick={revoke}>Revoke credential</button>
      </section>
      <section className="card">
        <h3 className="h2">Signed status list</h3>
        {statusList ? <p className="text-sm">List <b>{statusList.listId}</b>, {revokedCount} revoked of {statusList.size}. Signed {new Date(statusList.issuedAt).toLocaleString()}.</p> : <p className="text-sm text-slate-600">Not loaded. The server must be reachable.</p>}
        <button className="btn mt-2" onClick={reload}>Refresh</button>
      </section>
    </>
  );
}
