"use client";

import { useEffect, useState } from "react";

const CHUNK_ERROR_RELOAD_KEY = "chunkErrorReload";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [didTryReload, setDidTryReload] = useState(false);
  const isChunkError =
    error?.message?.includes("Failed to load chunk") ||
    error?.message?.includes("Loading chunk");

  useEffect(() => {
    console.error("Application error:", error?.message, error?.stack, error?.digest);
  }, [error]);

  // One-time auto reload on chunk error to recover from stale cache
  useEffect(() => {
    if (!isChunkError || typeof window === "undefined") return;
    const alreadyReloaded = sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY);
    if (alreadyReloaded === "1") {
      setDidTryReload(true);
      return;
    }
    sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, "1");
    const url = window.location.pathname + window.location.search;
    const sep = url.includes("?") ? "&" : "?";
    window.location.replace(url + sep + "_r=" + Date.now());
  }, [isChunkError]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ fontSize: "0.9rem", marginBottom: 16, maxWidth: 400, wordBreak: "break-word" }}>
        {error?.message || "A client-side exception occurred."}
      </p>
      {error?.digest && (
        <p style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: 16 }}>Digest: {error.digest}</p>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => (window.location.href = "/")}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.3)",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Go to login
        </button>
        {isChunkError && (
          <>
            {didTryReload && (
              <p style={{ fontSize: "0.85rem", opacity: 0.95, marginBottom: 12, width: "100%" }}>
                Already tried reloading. Do a hard refresh to bypass cache.
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Hard refresh page
            </button>
            <p style={{ fontSize: "0.8rem", opacity: 0.9, marginTop: 16, width: "100%" }}>
              Or use Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
