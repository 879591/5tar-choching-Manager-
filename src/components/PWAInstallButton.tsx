import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleTrigger = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        className={
          variant === 'full'
            ? 'w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap'
            : 'flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap min-h-[38px]'
        }
        title="Install 5tar Coaching Manager App"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Download App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Install 5tar Coaching Manager</h3>
                  <p className="text-xs text-slate-500">Use like a native Android, iOS, or Desktop app</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {isIOS ? (
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-900">iPhone / iPad (Safari):</p>
                  <p>1. Tap the <strong>Share</strong> icon at the bottom of Safari.</p>
                  <p>2. Scroll down and tap <strong>Add to Home Screen</strong>.</p>
                  <p>3. Tap <strong>Add</strong> in the top-right corner.</p>
                </div>
              ) : (
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-900">Android / Chrome / Desktop:</p>
                  <p>1. Open this app in full browser tab if viewing inside a preview frame.</p>
                  <p>2. Tap the browser menu (<strong>⋮</strong>) or address bar install icon.</p>
                  <p>3. Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-18 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Using cached data</span>
    </div>
  );
};
