"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CheckerPage() {
  const router = useRouter();
  
  useEffect(() => {
      const raw = localStorage.getItem("currentUser");
      if (!raw) {
        router.push("/");
        return;
      }
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.id && (parsed.role === "CHECKER" || parsed.role === "SUPER_ADMIN")) {
        router.replace("/workspace");
        return;
      }
    } catch {
      // ignore
    }
    router.push("/");
  }, [router]);
  
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
      <div style={{ color: "white" }}>Redirecting...</div>
      </div>
  );
}
