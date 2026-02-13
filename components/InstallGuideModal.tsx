"use client";

import { useState, useEffect } from "react";

type DeviceType = "android" | "ios" | "desktop" | "other";

const content = {
  en: {
    title: "How to install",
    sub: "Follow these steps to add the app to your device",
    lang: "Language",
    device: "Your device",
    android: {
      name: "Android (Chrome)",
      steps: [
        "Tap the menu (⋮) at the top right of the browser",
        "Tap « Add to Home screen » or « Install app »",
        "Confirm by tapping « Add » or « Install »",
        "Open the app from your home screen",
      ],
      icons: ["⋮", "➕", "✓", "📱"],
    },
    ios: {
      name: "iPhone / iPad (Safari)",
      steps: [
        "Tap the Share button at the bottom (square with arrow)",
        "Scroll and tap « Add to Home Screen »",
        "Tap « Add » in the top right",
        "Open the app from your home screen",
      ],
      icons: ["⎙", "➕", "✓", "📱"],
    },
    desktop: {
      name: "Desktop (Chrome / Edge)",
      steps: [
        "Click the install icon (⊕) in the address bar, or open the menu (⋮)",
        "Click « Install International Arrival System » or « Install »",
        "Click « Install » in the dialog",
        "The app will open in its own window",
      ],
      icons: ["⊕", "📥", "✓", "🖥️"],
    },
    other: {
      name: "Other devices",
      steps: [
        "Look for « Add to Home screen » or « Install » in your browser menu",
        "Confirm to add the app",
        "Open the app from your home screen or app list",
      ],
      icons: ["🔍", "✓", "📱"],
    },
    close: "Close",
  },
  so: {
    title: "Sida loo rakibo",
    sub: "Raac talaabooyinkan si aad ugu darato galka agalka",
    lang: "Luqad",
    device: "Qalabkaaga",
    android: {
      name: "Android (Chrome)",
      steps: [
        "Taab menu-ka (⋮) midig sare ee browser-ka",
        "Taab « Add to Home screen » ama « Install app »",
        "Xaqiiji taabo « Add » ama « Install »",
        "Fur app-ka galka agalka",
      ],
      icons: ["⋮", "➕", "✓", "📱"],
    },
    ios: {
      name: "iPhone / iPad (Safari)",
      steps: [
        "Taab batoonka Share hoose (square leh falka)",
        "Daaqad-daaqad ka taab « Add to Home Screen »",
        "Taab « Add » midig sare",
        "Fur app-ka galka agalka",
      ],
      icons: ["⎙", "➕", "✓", "📱"],
    },
    desktop: {
      name: "Desktop (Chrome / Edge)",
      steps: [
        "Taab astaanta rakibinta (⊕) ee address bar, ama fur menu (⋮)",
        "Taab « Install International Arrival System » ama « Install »",
        "Taab « Install » dialog-ka",
        "App-ku wuu furi doonaa daaqad uu leeyahay",
      ],
      icons: ["⊕", "📥", "✓", "🖥️"],
    },
    other: {
      name: "Qalab kale",
      steps: [
        "Raadi « Add to Home screen » ama « Install » menu-ka browser-ka",
        "Xaqiiji si aad ugu darto app-ka",
        "Fur app-ka galka agalka ama liiska app-ka",
      ],
      icons: ["🔍", "✓", "📱"],
    },
    close: "Xir",
  },
};

function detectDevice(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iOS first: iPhone, iPod, iPad (UA). iPad on iOS 13+ reports as MacIntel with touch.
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPod/i.test(ua)) return "ios";
  if (/iPad/i.test(ua) || isIPadOS) return "ios";
  // Android (after iOS so we don't mis-detect)
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export default function InstallGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [lang, setLang] = useState<"en" | "so">("en");
  const [device, setDevice] = useState<DeviceType>("desktop");

  useEffect(() => {
    if (open) setDevice(detectDevice());
  }, [open]);

  const t = content[lang];
  const deviceData =
    device === "android"
      ? t.android
      : device === "ios"
        ? t.ios
        : device === "desktop"
          ? t.desktop
          : t.other;
  const steps = deviceData.steps;
  const icons = deviceData.icons;

  if (!open) return null;

  return (
    <div className="pwa-guide-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={t.title}>
      <div className="pwa-guide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pwa-guide-header">
          <h2 className="pwa-guide-title">{t.title}</h2>
          <p className="pwa-guide-sub">{t.sub}</p>
          <div className="pwa-guide-lang">
            <button
              type="button"
              className={`pwa-guide-lang-btn ${lang === "en" ? "active" : ""}`}
              onClick={() => setLang("en")}
            >
              English
            </button>
            <button
              type="button"
              className={`pwa-guide-lang-btn ${lang === "so" ? "active" : ""}`}
              onClick={() => setLang("so")}
            >
              Soomaali
            </button>
          </div>
          <div className="pwa-guide-device-label">{t.device}: <strong>{deviceData.name}</strong></div>
        </div>

        <div className="pwa-guide-steps">
          {steps.map((text, i) => (
            <div
              key={i}
              className="pwa-guide-step"
              style={{ animationDelay: i * 0.15 + "s" }}
            >
              <div className="pwa-guide-step-num">
                <span className="pwa-guide-step-icon">{icons[i] ?? "•"}</span>
                <span className="pwa-guide-step-n">{i + 1}</span>
              </div>
              <p className="pwa-guide-step-text">{text}</p>
            </div>
          ))}
        </div>

        <div className="pwa-guide-footer">
          <button type="button" className="pwa-guide-close" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>

      <style jsx>{`
        .pwa-guide-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 16px;
          animation: pwaGuideFadeIn 0.25s ease-out;
        }
        @keyframes pwaGuideFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .pwa-guide-modal {
          background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
          border-radius: 20px;
          max-width: 420px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          animation: pwaGuideSlide 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
        }
        @keyframes pwaGuideSlide {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .pwa-guide-header {
          padding: 24px 20px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .pwa-guide-title {
          margin: 0 0 6px;
          font-size: 1.35rem;
          font-weight: 800;
          color: #f1f5f9;
        }
        .pwa-guide-sub {
          margin: 0 0 16px;
          font-size: 0.9rem;
          color: #94a3b8;
        }
        .pwa-guide-lang {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .pwa-guide-lang-btn {
          padding: 8px 16px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.06);
          color: #e2e8f0;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pwa-guide-lang-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }
        .pwa-guide-device-label {
          font-size: 0.85rem;
          color: #94a3b8;
        }
        .pwa-guide-device-label strong { color: #e2e8f0; }
        .pwa-guide-steps {
          padding: 20px;
        }
        .pwa-guide-step {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 18px;
          opacity: 0;
          transform: translateX(-16px);
          animation: pwaGuideStepIn 0.45s ease-out forwards;
        }
        .pwa-guide-step .pwa-guide-step-num {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.5);
        }
        @keyframes pwaGuideStepIn {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .pwa-guide-step-num {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
        }
        .pwa-guide-step-icon {
          font-size: 1.1rem;
          line-height: 1;
        }
        .pwa-guide-step-n {
          font-size: 0.65rem;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 2px;
        }
        .pwa-guide-step-text {
          margin: 0;
          padding-top: 10px;
          font-size: 0.95rem;
          color: #e2e8f0;
          line-height: 1.45;
        }
        .pwa-guide-footer {
          padding: 16px 20px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .pwa-guide-close {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .pwa-guide-close:hover {
          background: rgba(255, 255, 255, 0.14);
        }
      `}</style>
    </div>
  );
}
