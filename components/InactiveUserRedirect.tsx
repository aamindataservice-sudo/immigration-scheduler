"use client";

import { useEffect } from "react";

const INACTIVE_REDIRECT_URL = "https://etas.gov.so/";

export default function InactiveUserRedirect() {
  useEffect(() => {
    let raw: string | null = null;
    let sessionToken: string | null = null;
    try {
      raw = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
      sessionToken = typeof window !== "undefined" ? localStorage.getItem("sessionToken") : null;
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

    const params = new URLSearchParams({ userId });
    if (sessionToken) params.set("sessionToken", sessionToken);
    fetch(`/api/auth/check-active?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        if (data.isActive === false) {
          try {
            localStorage.removeItem("currentUser");
            localStorage.removeItem("biometric_users");
            localStorage.removeItem("sessionToken");
            localStorage.removeItem(`biometric_${userId}`);
            localStorage.removeItem(`biometric_cred_${userId}`);
          } catch {}
          window.location.href = INACTIVE_REDIRECT_URL;
          return;
        }
        if (data.sessionValid === false) {
          try {
            localStorage.removeItem("currentUser");
            localStorage.removeItem("biometric_users");
            localStorage.removeItem("sessionToken");
            localStorage.removeItem(`biometric_${userId}`);
            localStorage.removeItem(`biometric_cred_${userId}`);
          } catch {}
          window.location.href = "/";
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
