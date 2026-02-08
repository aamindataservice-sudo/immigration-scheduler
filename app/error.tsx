"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error?.message, error?.stack, error?.digest);
  }, [error]);

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
      </div>
    </div>
  );
}
