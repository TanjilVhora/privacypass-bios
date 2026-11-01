import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export default function QRScan({ onResult }: { onResult: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const [paste, setPaste] = useState('');

  useEffect(() => {
    if (!on) return;
    if (!navigator.mediaDevices?.getUserMedia) { setErr('Camera unavailable (needs HTTPS). Paste the text instead.'); setOn(false); return; }
    let stop = false, raf = 0, stream: MediaStream | undefined;
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true })!;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
      if (stop) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      const v = video.current!;
      v.srcObject = s; void v.play();
      const tick = () => {
        if (stop) return;
        if (v.readyState === v.HAVE_ENOUGH_DATA) {
          cv.width = v.videoWidth; cv.height = v.videoHeight; cx.drawImage(v, 0, 0);
          const im = cx.getImageData(0, 0, cv.width, cv.height), code = jsQR(im.data, im.width, im.height);
          if (code?.data) { stop = true; setOn(false); onResult(code.data); return; }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => { setErr('Camera blocked or missing. Paste the text instead.'); setOn(false); });
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [on]);

  return (
    <div>
      {on ? <video ref={video} playsInline muted className="w-full max-h-72 rounded-lg bg-black" /> : null}
      <div className="flex gap-2 flex-wrap my-2">
        <button className="btn btn-pri" onClick={() => { setErr(''); setOn(!on); }}>{on ? 'Stop camera' : 'Start camera'}</button>
      </div>
      {err && <p className="text-red-900 bg-red-100 rounded-lg p-2 text-sm">{err}</p>}
      <label className="lbl" htmlFor="paste">Or paste the QR text</label>
      <textarea id="paste" className="input font-mono text-xs" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} />
      <button className="btn mt-2" disabled={!paste.trim()} onClick={() => { onResult(paste.trim()); setPaste(''); }}>Use pasted text</button>
    </div>
  );
}
