"use client";

import { useState, useRef, useEffect } from "react";
import jsQR from "jsqr";
import {
  isAllowedQrLink,
  getWrongDomainInfo,
  isRefValid,
  extractReferenceFromQrContent,
  SOMALI_VALID_VISA,
  SOMALI_FAKE_VISA,
} from "@/lib/qr-validation";

type ScanResult = "valid" | "fake" | null;

const scanResultStyles = `
  @keyframes officer-scan-scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
  .officer-scan-result { padding: 36px 28px; text-align: center; border-radius: 22px; margin: 0 20px 24px; }
  .officer-scan-result-in { animation: officer-scan-scaleIn 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) forwards; }
  .officer-scan-valid { background: linear-gradient(135deg, rgba(34, 197, 94, 0.22), rgba(22, 163, 74, 0.14)); border: 1px solid rgba(34, 197, 94, 0.45); box-shadow: 0 8px 32px rgba(34, 197, 94, 0.15); }
  .officer-scan-fake { background: linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(185, 28, 28, 0.14)); border: 1px solid rgba(239, 68, 68, 0.45); box-shadow: 0 8px 32px rgba(239, 68, 68, 0.15); }
  .officer-scan-result-icon { font-size: 4.5rem; margin-bottom: 14px; }
  .officer-scan-result-title { margin: 0 0 14px; font-size: 1.6rem; font-weight: 700; }
  .officer-scan-valid .officer-scan-result-title { color: #4ade80; }
  .officer-scan-fake .officer-scan-result-title { color: #f87171; }
  .officer-scan-result-somali { margin: 0 0 24px; font-size: 1.15rem; line-height: 1.65; color: #e2e8f0; }
  .officer-scan-result-url { margin: 0 0 24px; font-size: 12px; color: #94a3b8; word-break: break-all; }
  .officer-scan-result-btn { padding: 16px 32px; border-radius: 16px; border: none; background: rgba(255,255,255,0.12); color: white; font-size: 15px; font-weight: 600; cursor: pointer; transition: transform 0.2s, background 0.2s; }
  .officer-scan-result-btn:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); }
  .officer-scan-result-btn:active { transform: translateY(0); }
`;

const cameraStyles = `
  @keyframes officer-scan-frame-pulse { 0%, 100% { opacity: 0.7; box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); } 50% { opacity: 1; box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); } }
  .officer-scan-view { margin: -24px -20px; padding: 24px 20px; }
  .officer-scan-camera-wrap { position: relative; max-width: 480px; margin: 0 auto 20px; border-radius: 22px; overflow: hidden; background: #0f172a; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 12px 32px rgba(0,0,0,0.25); }
  .officer-scan-video { width: 100%; display: block; }
  .officer-scan-canvas { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; }
  .officer-scan-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
  .officer-scan-frame { width: 240px; height: 240px; border: 3px solid rgba(56, 189, 248, 0.7); border-radius: 20px; animation: officer-scan-frame-pulse 2s ease-in-out infinite; }
  .officer-scan-hint { margin-top: 18px; padding: 0 20px; text-align: center; font-size: 14px; color: rgba(255,255,255,0.92); font-weight: 500; }
  .officer-scan-file-btn { display: block; width: 100%; max-width: 480px; margin: 0 auto; padding: 16px 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #e2e8f0; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.25s ease; }
  .officer-scan-file-btn:hover { background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.3); transform: translateY(-2px); }
  .officer-scan-file-btn:active { transform: translateY(0); }
  .officer-scan-input { position: absolute; width: 0; height: 0; opacity: 0; }
  .officer-scan-error { margin-top: 14px; padding: 14px; border-radius: 14px; background: rgba(239, 68, 68, 0.15); color: #fca5a5; font-size: 14px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2); }
`;

export default function OfficerScanView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [feedback, setFeedback] = useState("Point camera at QR code");
  const [cameraError, setCameraError] = useState("");
  const [wrongDomainUrl, setWrongDomainUrl] = useState("");

  const stopCamera = () => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject = null;
    }
  };

  const showValid = () => {
    stopCamera();
    setScanResult("valid");
    setWrongDomainUrl("");
  };

  const showFake = (url?: string) => {
    stopCamera();
    setScanResult("fake");
    if (url) setWrongDomainUrl(url);
  };

  const resetScan = () => {
    setScanResult(null);
    setWrongDomainUrl("");
    setFeedback("Point camera at QR code");
    setCameraError("");
  };

  const processDecodedData = (data: string) => {
    if (!isAllowedQrLink(data)) {
      const info = getWrongDomainInfo(data);
      setWrongDomainUrl(info.url);
      showFake(info.url);
      return;
    }
    const ref = extractReferenceFromQrContent(data);
    if (!ref || !isRefValid(ref)) {
      showFake();
      return;
    }
    showValid();
  };

  const startCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const isMobile = typeof window !== "undefined" && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    const scanIntervalMs = isMobile ? 350 : 200;
    const maxSize = isMobile ? 320 : 480;

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "environment",
          width: isMobile ? { ideal: 640 } : { ideal: 1280 },
          height: isMobile ? { ideal: 480 } : { ideal: 720 },
        },
      })
      .then((stream) => {
        streamRef.current = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("muted", "true");
        video.play().then(() => {
          intervalRef.current = setInterval(() => {
            if (!streamRef.current || !videoRef.current || !canvasRef.current) return;
            const v = videoRef.current;
            const c = canvasRef.current;
            if (v.readyState !== v.HAVE_ENOUGH_DATA || v.videoWidth <= 0) return;
            const w = Math.min(v.videoWidth, maxSize);
            const h = Math.min(v.videoHeight, Math.round((maxSize * v.videoHeight) / v.videoWidth));
            if (c.width !== w) c.width = w;
            if (c.height !== h) c.height = h;
            const ctx = c.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            let code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
            if (!code?.data) code = jsQR(imageData.data, w, h, { inversionAttempts: "invertFirst" });
            if (!code?.data) code = jsQR(imageData.data, w, h);
            if (code?.data) processDecodedData(code.data);
          }, scanIntervalMs);
        }).catch(() => {
          intervalRef.current = setInterval(() => {
            if (!streamRef.current || !videoRef.current || !canvasRef.current) return;
            const v = videoRef.current;
            const c = canvasRef.current;
            if (v.readyState !== v.HAVE_ENOUGH_DATA || v.videoWidth <= 0) return;
            const w = Math.min(v.videoWidth, maxSize);
            const h = Math.min(v.videoHeight, Math.round((maxSize * v.videoHeight) / v.videoWidth));
            if (c.width !== w) c.width = w;
            if (c.height !== h) c.height = h;
            const ctx = c.getContext("2d");
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            let code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
            if (!code?.data) code = jsQR(imageData.data, w, h, { inversionAttempts: "invertFirst" });
            if (!code?.data) code = jsQR(imageData.data, w, h);
            if (code?.data) processDecodedData(code.data);
          }, scanIntervalMs);
        });
      })
      .catch((err) => {
        setCameraError(err?.message || "Camera access denied.");
      });
  };

  useEffect(() => {
    if (scanResult !== null) return;
    startCamera();
    return () => {
      stopCamera();
    };
  }, [scanResult]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      let code = jsQR(imageData.data, w, h, { inversionAttempts: "attemptBoth" });
      if (!code?.data) code = jsQR(imageData.data, w, h, { inversionAttempts: "invertFirst" });
      if (!code?.data) code = jsQR(imageData.data, w, h);
      if (code?.data) processDecodedData(code.data);
      else setFeedback("No QR code found in image.");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setFeedback("Could not load image.");
    };
    img.src = url;
  };

  if (scanResult === "valid") {
    return (
      <div className="officer-scan-result officer-scan-valid officer-scan-result-in">
        <div className="officer-scan-result-icon">✅</div>
        <h2 className="officer-scan-result-title">Visa sax ah</h2>
        <p className="officer-scan-result-somali">{SOMALI_VALID_VISA}</p>
        <button type="button" className="officer-scan-result-btn" onClick={resetScan}>
          Scan again
        </button>
        <style jsx>{scanResultStyles}</style>
      </div>
    );
  }

  if (scanResult === "fake") {
    return (
      <div className="officer-scan-result officer-scan-fake officer-scan-result-in">
        <div className="officer-scan-result-icon">⚠️</div>
        <h2 className="officer-scan-result-title">Visa been ah</h2>
        <p className="officer-scan-result-somali">{SOMALI_FAKE_VISA}</p>
        {wrongDomainUrl && (
          <p className="officer-scan-result-url">QR link: {wrongDomainUrl}</p>
        )}
        <button type="button" className="officer-scan-result-btn" onClick={resetScan}>
          Scan again
        </button>
        <style jsx>{scanResultStyles}</style>
      </div>
    );
  }

  return (
    <section className="officer-scan-view">
      <div className="officer-scan-camera-wrap">
        <video ref={videoRef} className="officer-scan-video" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="officer-scan-canvas" aria-hidden />
        <div className="officer-scan-overlay">
          <div className="officer-scan-frame" />
          <p className="officer-scan-hint">{feedback}</p>
        </div>
      </div>
      <button type="button" className="officer-scan-file-btn" onClick={() => fileInputRef.current?.click()}>
        📷 Upload image
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="officer-scan-input" aria-hidden tabIndex={-1} />
      {cameraError && (
        <div className="officer-scan-error">
          <span>⚠️</span> {cameraError}
        </div>
      )}
      <style jsx>{cameraStyles}</style>
    </section>
  );
}
