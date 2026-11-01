import { useState } from 'react';
import NetworkBadge from './components/NetworkBadge';
import IssuerPage from './pages/IssuerPage';
import WalletPage from './pages/WalletPage';
import VerifierPage from './pages/VerifierPage';
import ProofsPage from './pages/ProofsPage';

const TABS = [
  ['issuer', 'Issuer', 'The college signs a student pass and publishes its trusted key and revocation list.'],
  ['wallet', 'Wallet', 'Your pass stays on your phone. You decide what each shop sees.'],
  ['verifier', 'Verifier', 'Ask for one fact, scan the answer, and check it on this device.'],
  ['proofs', 'Proofs', 'Compare linkability, run the self-tests and measure verification speed.'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function App() {
  const [tab, setTab] = useState<Tab>('issuer');
  const cur = TABS.find((t) => t[0] === tab)!;
  return (
    <div style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="bg-gradient-to-br from-ink to-blue-900 text-white sticky top-0 z-10 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 pt-3 flex items-center gap-3 flex-wrap">
          <img src="/icon.svg" alt="" className="w-9 h-9" />
          <div className="flex-1 min-w-[160px]">
            <h1 className="text-xl font-bold leading-tight">PrivacyPass ID</h1>
            <p className="text-sm text-blue-200">Prove one fact. Reveal nothing else.</p>
          </div>
          <NetworkBadge />
        </div>
        <nav className="max-w-3xl mx-auto px-3 py-3 flex gap-2 overflow-x-auto" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`flex-1 min-w-[88px] px-3 py-2 rounded-full border font-semibold ${tab === k ? 'bg-white text-ink border-white' : 'bg-white/10 text-blue-100 border-white/30'}`}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-3xl mx-auto p-4">
        <h2 className="text-2xl font-bold">{cur[1]}</h2>
        <p className="text-slate-600 mb-4">{cur[2]}</p>
        {tab === 'issuer' && <IssuerPage />}
        {tab === 'wallet' && <WalletPage />}
        {tab === 'verifier' && <VerifierPage />}
        {tab === 'proofs' && <ProofsPage />}
      </main>
    </div>
  );
}
