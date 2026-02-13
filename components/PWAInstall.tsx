"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { isStandalone } from "@/lib/pwa-standalone";

const InstallGuideModal = dynamic(() => import("./InstallGuideModal"), { ssr: false });

const DISMISS_KEY = "pwa_install_dismissed";
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (isNaN(t)) return false;
    return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<{ outcome: string }> };

export default function PWAInstall() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [standalone, setStandalone] = useState(false);

  const checkStandalone = useCallback(() => {
    const v = isStandalone();
    setStandalone(v);
    if (v) {
      setShowBanner(false);
      setShowGuide(false);
    }
  }, []);

  const checkAndShow = useCallback(() => {
    if (standalone) return;
    if (isDismissed()) return;
    setShowBanner(true);
  }, [standalone]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    checkStandalone();
    const t = setTimeout(checkStandalone, 400);
    const t2 = setTimeout(checkStandalone, 1200);
    const onVisibility = () => checkStandalone();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mounted, checkStandalone]);

  useEffect(() => {
    if (!mounted || standalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      if (!isDismissed()) setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (!isDismissed()) {
      const t = setTimeout(checkAndShow, 2000);
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        clearTimeout(t);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [mounted, standalone, checkAndShow]);

  const installPWA = async () => {
    const ev = deferredPromptRef.current;
    if (ev && typeof ev.prompt === "function") {
      try {
        await ev.prompt();
        setShowBanner(false);
        deferredPromptRef.current = null;
      } catch {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    setDismissed();
  };

  const openGuide = () => {
    setShowGuide(true);
  };

  if (!mounted) return null;
  if (standalone) return null;

  return (
    <>
      <style jsx>{`
            .pwa-install-banner {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              z-index: 9999;
              padding: 12px 16px;
              padding-left: max(16px, env(safe-area-inset-left));
              padding-right: max(16px, env(safe-area-inset-right));
              padding-bottom: max(12px, env(safe-area-inset-bottom));
              background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
              border-top: 1px solid rgba(255, 255, 255, 0.12);
              box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.3);
              animation: pwaBannerSlide 0.4s cubic-bezier(0.34, 1.2, 0.64, 1);
            }
            @keyframes pwaBannerSlide {
              from { transform: translateY(100%); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .pwa-install-banner-inner {
              max-width: 480px;
              margin: 0 auto;
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .pwa-install-logo {
              width: 44px;
              height: 44px;
              flex-shrink: 0;
            }
            .pwa-install-text {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 2px;
            }
            .pwa-install-text strong {
              font-size: 14px;
              color: #f1f5f9;
            }
            .pwa-install-text span {
              font-size: 12px;
              color: #94a3b8;
            }
            .pwa-install-actions {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .pwa-install-btn-guide {
              padding: 8px 12px;
              border-radius: 10px;
              border: 1px solid rgba(255, 255, 255, 0.3);
              background: transparent;
              color: #e2e8f0;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            }
            .pwa-install-btn-guide:hover {
              background: rgba(255, 255, 255, 0.1);
            }
            .pwa-install-btn {
              padding: 10px 18px;
              border-radius: 10px;
              border: none;
              background: #3b82f6;
              color: white;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
            }
            .pwa-install-btn:hover {
              background: #2563eb;
            }
            .pwa-install-dismiss {
              width: 36px;
              height: 36px;
              border-radius: 10px;
              border: none;
              background: rgba(255, 255, 255, 0.1);
              color: #94a3b8;
              font-size: 18px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .pwa-install-dismiss:hover {
              background: rgba(255, 255, 255, 0.15);
              color: #e2e8f0;
            }
            @media (max-width: 420px) {
              .pwa-install-banner-inner { flex-wrap: wrap; }
              .pwa-install-text { order: 3; width: 100%; }
              .pwa-install-actions { order: 2; margin-left: auto; }
            }
          `}</style>

      {showBanner && (
        <div className="pwa-install-banner" role="region" aria-label="Install app">
          <div className="pwa-install-banner-inner">
            <img src="/logo.svg" alt="" className="pwa-install-logo" />
            <div className="pwa-install-text">
              <strong>International Arrival System</strong>
              <span>Install on this device for quick access</span>
            </div>
            <div className="pwa-install-actions">
              <button type="button" className="pwa-install-btn-guide" onClick={openGuide}>
                How to install
              </button>
              <button type="button" className="pwa-install-btn" onClick={installPWA}>
                Install
              </button>
              <button type="button" className="pwa-install-dismiss" onClick={dismissBanner} aria-label="Dismiss">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <InstallGuideModal open={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
}
