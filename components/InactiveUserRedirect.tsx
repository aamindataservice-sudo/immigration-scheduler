"use client";

import { useEffect } from "react";

const INACTIVE_REDIRECT_URL = "https://etas.gov.so/";

export default function InactiveUserRedirect() {
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
    } catch {
      return;
    }
    if (!raw) return;
    let userId: string | undefined;
    try {
      const parsed = JSON.parse(raw);
      userId = parsed?.id;
    } catch {
      return;
    }
    if (!userId) return;

    fetch(`/api/auth/check-active?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.isActive === false) {
          try {
            localStorage.removeItem("currentUser");
            localStorage.removeItem("biometric_users");
            localStorage.removeItem(`biometric_${userId}`);
            localStorage.removeItem(`biometric_cred_${userId}`);
          } catch {}
          window.location.href = INACTIVE_REDIRECT_URL;
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
