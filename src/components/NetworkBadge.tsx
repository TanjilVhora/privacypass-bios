import { useSyncExternalStore } from 'react';

let manualOffline = false;
const subs = new Set<() => void>();
const sub = (f: () => void) => {
  subs.add(f);
  addEventListener('online', f);
  addEventListener('offline', f);
  return () => { subs.delete(f); removeEventListener('online', f); removeEventListener('offline', f); };
};
export const useOffline = () => useSyncExternalStore(sub, () => manualOffline || !navigator.onLine);

export default function NetworkBadge() {
  const off = useOffline();
  return (
    <div className="flex items-center gap-2">
      <span className={`pill ${off ? 'bg-amber-100 text-amber-900 border-amber-800' : 'bg-green-100 text-green-900 border-green-800'}`}>{off ? 'Offline' : 'Online'}</span>
      <button className="px-3 py-1.5 rounded-lg border border-white/40 bg-white/10 text-sm font-medium" onClick={() => { manualOffline = !manualOffline; subs.forEach((f) => f()); }}>
        {manualOffline ? 'Go online' : 'Simulate offline'}
      </button>
    </div>
  );
}
