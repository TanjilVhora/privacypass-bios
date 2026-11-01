import { CLAIM_ORDER, ClaimName } from '../crypto/schema';

type Claims = Partial<Record<ClaimName, string>>;
export default function ClaimTable({ claims, revealed }: { claims?: Claims; revealed: Claims }) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-slate-600"><th className="py-1">Claim</th><th>Value</th></tr></thead>
      <tbody>
        {CLAIM_ORDER.map((n) => (
          <tr key={n} className="border-t border-slate-200">
            <td className="py-1.5 pr-2 font-medium">{n}</td>
            <td className="break-words">
              {n in revealed ? revealed[n] : <span className="italic text-slate-600">hidden{claims ? '' : ''}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
