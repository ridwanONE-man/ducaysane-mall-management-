import React, { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

const CHECK_EVERY_MS = 60_000;

// The script file name of the running build (it changes on every deploy).
const currentBuild = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))
    .map(s => new URL(s.src, location.href).pathname)
    .find(src => src.includes('/assets/')) || null;

// Tells an open tab that a newer version of the site was deployed, so nobody keeps
// working on old code until they happen to reload.
export const UpdateBanner: React.FC = () => {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const running = currentBuild();
    if (!running) return; // dev server: nothing to compare

    const check = async () => {
      try {
        const html = await (await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })).text();
        const latest = /<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/.exec(html)?.[1];
        if (latest && new URL(latest, location.href).pathname !== running) setUpdateReady(true);
      } catch {}
    };

    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!updateReady) return null;
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl bg-slate-900 text-white shadow-2xl animate-in slide-in-from-bottom-4">
      <Sparkles className="w-4 h-4 text-amber-300" />
      <span className="text-xs font-semibold">A new version of the system is available.</span>
      <button
        type="button"
        onClick={() => location.reload()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Reload
      </button>
    </div>
  );
};
