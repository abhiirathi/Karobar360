"use client";
import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

// Installing Karobar360 as an app.
// Chrome and Edge (PC and Android) offer a one-tap install; iPhone, iPad and Mac Safari need the
// Share or File menu, so the button shows those steps instead. Hidden once the app is installed.

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Win = Window & { __k360Install?: PromptEvent | null };

const READY = "k360-install-ready";

/** Mounted once in the root layout: registers the service worker and keeps the browser's install offer. */
export function AppSetup() {
  useEffect(() => {
    const w = window as Win;
    const keep = (e: Event) => { e.preventDefault(); w.__k360Install = e as PromptEvent; window.dispatchEvent(new Event(READY)); };
    const done = () => { w.__k360Install = null; window.dispatchEvent(new Event(READY)); };
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => { window.removeEventListener("beforeinstallprompt", keep); window.removeEventListener("appinstalled", done); };
  }, []);
  return null;
}

type How = "prompt" | "ios" | "mac" | null;

function useInstall() {
  const [how, setHow] = useState<How>(null);
  useEffect(() => {
    const check = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (standalone) return setHow(null);
      if ((window as Win).__k360Install) return setHow("prompt");
      const ua = navigator.userAgent;
      const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
      const safari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Edg\//.test(ua);
      if (ios) return setHow("ios");
      if (/Macintosh/.test(ua) && safari) return setHow("mac");
      setHow(null);
    };
    check();
    window.addEventListener(READY, check);
    return () => window.removeEventListener(READY, check);
  }, []);
  return how;
}

/** "Install app" button. `variant="icon"` is a small round button for tight bars. */
export default function InstallApp({ variant = "button", className = "" }: { variant?: "button" | "icon" | "link"; className?: string }) {
  const how = useInstall();
  const [help, setHelp] = useState(false);
  if (!how) return null;

  const click = async () => {
    const e = (window as Win).__k360Install;
    if (how === "prompt" && e) {
      await e.prompt();
      const { outcome } = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      if (outcome === "accepted") { (window as Win).__k360Install = null; window.dispatchEvent(new Event(READY)); }
      return;
    }
    setHelp(true);
  };

  const label = "Install app";
  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={click} className={`btn btn-quiet btn-sm !px-2.5 ${className}`} aria-label={label} title={label}><Download size={16} /></button>
      ) : variant === "link" ? (
        <button type="button" onClick={click} className={`inline-flex items-center gap-1.5 hover:text-ink ${className}`}><Download size={13} />{label}</button>
      ) : (
        <button type="button" onClick={click} className={`btn btn-quiet ${className}`}><Download size={17} />{label}</button>
      )}
      {help && <InstallHelp how={how} onClose={() => setHelp(false)} />}
    </>
  );
}

function InstallHelp({ how, onClose }: { how: How; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const steps = how === "mac"
    ? [<>In the menu bar, open <b>File</b></>, <>Choose <b>Add to Dock</b></>, <>Open Karobar360 from the Dock or Launchpad</>]
    : [<>Tap the <b>Share</b> button <Share size={15} className="inline align-[-2px]" /> in the browser bar</>, <>Scroll and tap <b>Add to Home Screen</b> <SquarePlus size={15} className="inline align-[-2px]" /></>, <>Tap <b>Add</b>, then open Karobar360 from your home screen</>];
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Install Karobar360" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-left text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="text-lg font-semibold">Install Karobar360</div>
          <button type="button" onClick={onClose} className="ml-auto -mr-1 -mt-1 rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="mt-1 text-[0.92rem] text-ink-2">It opens full screen with its own icon, like any other app.</p>
        <ol className="mt-5 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-[0.95rem]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[0.8rem] font-semibold text-accent-ink">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="btn btn-primary mt-6 w-full justify-center">Got it</button>
      </div>
    </div>
  );
}
