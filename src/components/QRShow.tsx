import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QRShow({ payload }: { payload: string }) {
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setErr('');
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'L', margin: 2, width: 320 }).then(setSrc).catch(() => setErr('Payload is too large for one QR code.'));
  }, [payload]);
  return (
    <div className="text-center">
      {err ? <p className="text-red-900 bg-red-100 rounded-lg p-2">{err}</p> : <img src={src} alt="QR code" className="bg-white p-2 rounded-lg mx-auto max-w-full" width={320} height={320} />}
      <p className="text-sm text-slate-600 mt-1">{new TextEncoder().encode(payload).length} bytes</p>
      <button className="btn mt-2" onClick={async () => { try { await navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setErr('Copy failed. Select the text manually.'); } }}>
        {copied ? 'Copied' : 'Copy as text'}
      </button>
    </div>
  );
}
