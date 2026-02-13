"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { isStandalone } from "@/lib/pwa-standalone";

const InstallGuideModal = dynamic(() => import("./InstallGuideModal"), { ssr: false });

const CHECKER_HELP = `Checker – how to use your features

Check Payment
• Open the Check Payment card from your dashboard.
• Enter the receipt serial number (from the payment slip).
• Tap Search to verify. If found, you can view or download the receipt.

Scan QR code
• Open the Scan me card and allow camera access.
• Point the camera at the QR code on the receipt or e-Visa page.
• Only QR codes from the official immigration e-Visa site are accepted.
• You can also upload an image of the QR code.

Officer penalties
• Open Officer penalties from your dashboard.
• View stamp cards and tap a card to add +1 to its count.
• Use the menu (⋮) on a card to edit or delete. Create new stamps as needed.`;

const OFFICER_HELP = `Officer – how to use your features

Dashboard & Workspace
• Use the Workspace to access your assigned features.
• Open Schedules to see your shifts and the calendar.
• Open Patterns to see your day-off and full-time pattern.

My shifts
• View your assigned shifts for the selected date.
• Schedules are set by admins; contact them for changes.`;

const ADMIN_HELP = `Admin – how to use your features

Workspace
• Use the sidebar to open: Check Payment, Check E-Visa, Payment History, User Management, Schedules, Patterns, Vacations, Settings, Audit Logs, Reports.

User Management
• Create and edit users (Officer, Checker, Admin). Assign privileges per user.
• Use Reset Passwords to set a temporary password for a user.

Schedules
• Select a date to view or create shifts. Assign officers to shifts.
• Use auto-schedule if enabled to generate shifts from patterns.

Patterns
• Manage day-off and full-time patterns for each officer. These define who is available for auto-scheduling.

Payment & Visa
• Check Payment and Check E-Visa to verify receipts and e-Visas.
• Payment History shows all checks. Audit Logs show system activity.

Settings
• Configure auto-schedule time and other system options.`;

export default function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; fullName: string; role: string } | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !open) return;
    try {
      const raw = localStorage.getItem("currentUser");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id && parsed?.role) setUser(parsed);
        else setUser(null);
      } else setUser(null);
    } catch {
      setUser(null);
    }
  }, [mounted, open]);

  const role = user?.role || "";
  const isStandaloneMode = mounted && isStandalone();

  let helpTitle = "Help";
  let helpBody = "Log in to see help for your role.";
  if (role === "CHECKER") {
    helpTitle = "Checker help";
    helpBody = CHECKER_HELP;
  } else if (role === "OFFICER") {
    helpTitle = "Officer help";
    helpBody = OFFICER_HELP;
  } else if (role === "ADMIN" || role === "SUPER_ADMIN") {
    helpTitle = "Admin help";
    helpBody = ADMIN_HELP;
  }

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        className="help-icon-btn"
        onClick={() => setOpen(true)}
        aria-label="Help"
        title="Help"
      >
        <span className="help-icon">?</span>
      </button>

      {open && (
        <>
          <div className="help-backdrop" onClick={() => setOpen(false)} aria-hidden />
          <div className="help-panel">
            <div className="help-panel-header">
              <h3 className="help-panel-title">{helpTitle}</h3>
              <button type="button" className="help-panel-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="help-panel-content">
              <div className="help-topic-body">
                {helpBody.split("\n").map((line, i) => (
                  <p key={i}>{line.trim() ? line.trim() : <br />}</p>
                ))}
              </div>
              {!isStandaloneMode && (
                <button
                  type="button"
                  className="help-install-btn"
                  onClick={() => { setShowInstallGuide(true); setOpen(false); }}
                >
                  Install the app
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <InstallGuideModal open={showInstallGuide} onClose={() => setShowInstallGuide(false)} />

      <style jsx>{`
        .help-icon-btn {
          position: fixed;
          bottom: max(12px, env(safe-area-inset-bottom));
          left: max(12px, env(safe-area-inset-left));
          z-index: 9997;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid rgba(15, 118, 110, 0.35);
          background: #fff;
          color: #0f766e;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .help-icon-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.2);
        }
        .help-icon { line-height: 1; }
        .help-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 9998;
          animation: helpFade 0.2s ease-out;
        }
        @keyframes helpFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .help-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(360px, 100vw);
          max-width: 100%;
          background: #fff;
          z-index: 9999;
          box-shadow: -8px 0 32px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          animation: helpSlide 0.25s ease-out;
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
        }
        @keyframes helpSlide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .help-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        .help-panel-title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #0f172a;
        }
        .help-panel-close {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: #f1f5f9;
          color: #475569;
          font-size: 1.2rem;
          cursor: pointer;
        }
        .help-panel-close:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .help-panel-content {
          padding: 16px 20px;
          overflow-y: auto;
          flex: 1;
        }
        .help-topic-body {
          font-size: 0.9rem;
          color: #475569;
          line-height: 1.6;
        }
        .help-topic-body p { margin: 0 0 8px; }
        .help-install-btn {
          margin-top: 20px;
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid rgba(15, 118, 110, 0.4);
          background: rgba(15, 118, 110, 0.1);
          color: #0f766e;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
        }
        .help-install-btn:hover {
          background: rgba(15, 118, 110, 0.2);
        }
      `}</style>
    </>
  );
}
