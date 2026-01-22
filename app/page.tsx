"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type BiometricState = "idle" | "scanning" | "success" | "face_rejected" | "finger_rejected" | "error";

export default function Home() {
  const router = useRouter();
  const [phone, setPhone] = useState("252");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [setupError, setSetupError] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupPhone, setSetupPhone] = useState("252");
  const [setupPassword, setSetupPassword] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [savedUsers, setSavedUsers] = useState<{ id: string; fullName: string; phone: string }[]>([]);
  
  // Auto-biometric states
  const [showSplash, setShowSplash] = useState(true);
  const [biometricState, setBiometricState] = useState<BiometricState>("idle");
  const [attemptCount, setAttemptCount] = useState(0);
  
  // PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Check if installed as PWA
  const isPWA = typeof window !== "undefined" && 
    (window.matchMedia("(display-mode: standalone)").matches || 
     (window.navigator as any).standalone === true);

  // Auto-login with biometric
  const autoLoginWithBiometric = useCallback(async (savedUser: any) => {
    setBiometricState("scanning");
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const assertion = await navigator.credentials.get({
        publicKey: { challenge, timeout: 60000, userVerification: "required", rpId: window.location.hostname },
      });
      if (assertion) {
        const res = await fetch("/api/auth/biometric-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: savedUser.phone }),
        });
        const data = await res.json();
        if (!data.ok) {
          // Random rejection type for fun
          setBiometricState(Math.random() > 0.5 ? "face_rejected" : "finger_rejected");
          setAttemptCount(prev => prev + 1);
          return false;
        }
        setBiometricState("success");
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        setTimeout(() => {
          router.push(data.user.role === "ADMIN" ? "/admin" : "/officer");
        }, 500);
        return true;
      }
    } catch (e) {
      // Random rejection type for fun
      setBiometricState(Math.random() > 0.5 ? "face_rejected" : "finger_rejected");
      setAttemptCount(prev => prev + 1);
      return false;
    }
    return false;
  }, [router]);

  useEffect(() => {
    // Check for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem("pwa_install_dismissed");
      if (!dismissed && !isPWA) {
        setShowInstallPrompt(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check for logged in user
    const raw = localStorage.getItem("currentUser");
    if (raw) {
      const user = JSON.parse(raw);
      if (user.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push(user.role === "ADMIN" ? "/admin" : "/officer");
      }
      return;
    }

    // Check admin existence
    fetch("/api/auth/bootstrap")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setHasAdmin(data.hasAdmin);
        else setHasAdmin(true);
      })
      .catch(() => setHasAdmin(true));
    
    // Check biometric support and saved users
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(async (available) => {
        setBiometricAvailable(available);
        if (available) {
          const saved = localStorage.getItem("biometric_users");
          if (saved) {
            try {
              const users = JSON.parse(saved);
              setSavedUsers(users);
              // Auto-trigger biometric if there's exactly one saved user
              if (users.length === 1) {
                // Small delay for splash animation
                setTimeout(() => {
                  autoLoginWithBiometric(users[0]);
                }, 800);
              } else if (users.length > 1) {
                // Multiple users - show selector after splash
                setTimeout(() => setShowSplash(false), 1500);
              } else {
                setTimeout(() => setShowSplash(false), 1500);
              }
            } catch {
              setTimeout(() => setShowSplash(false), 1500);
            }
          } else {
            setTimeout(() => setShowSplash(false), 1500);
          }
        } else {
          setTimeout(() => setShowSplash(false), 1500);
        }
      });
    } else {
      setTimeout(() => setShowSplash(false), 1500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [router, autoLoginWithBiometric, isPWA]);

  const saveBiometric = async (user: any) => {
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Immigration Scheduler", id: window.location.hostname },
          user: { id: new TextEncoder().encode(user.id), name: user.phone, displayName: user.fullName },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000,
        },
      });
      if (credential) {
        const newSaved = [...savedUsers.filter(u => u.id !== user.id), { id: user.id, fullName: user.fullName, phone: user.phone }];
        localStorage.setItem("biometric_users", JSON.stringify(newSaved));
        setSavedUsers(newSaved);
      }
    } catch (err) { console.error("Biometric save failed:", err); }
  };

  const loginWithBiometric = async (savedUser: any) => {
    setError("");
    setLoading(true);
    setBiometricState("scanning");
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const assertion = await navigator.credentials.get({
        publicKey: { challenge, timeout: 60000, userVerification: "required", rpId: window.location.hostname },
      });
      if (assertion) {
        const res = await fetch("/api/auth/biometric-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: savedUser.phone }),
        });
        const data = await res.json();
        if (!data.ok) { 
          setError(data.error || "Biometric login failed");
          setBiometricState("error");
          return; 
        }
        setBiometricState("success");
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        router.push(data.user.role === "ADMIN" ? "/admin" : "/officer");
      }
    } catch { 
      setError("Biometric verification cancelled"); 
      setBiometricState("idle");
    }
    finally { setLoading(false); }
  };

  const removeBiometricUser = (userId: string) => {
    const newSaved = savedUsers.filter(u => u.id !== userId);
    localStorage.setItem("biometric_users", JSON.stringify(newSaved));
    setSavedUsers(newSaved);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Login failed");
        return;
      }
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      // Ask to save biometric after successful login
      if (biometricAvailable && !savedUsers.find(u => u.id === data.user.id) && !data.user.mustChangePassword) {
        if (confirm("Enable Face/Fingerprint login for faster access next time?")) {
          await saveBiometric(data.user);
        }
      }
      if (data.user.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push(data.user.role === "ADMIN" ? "/admin" : "/officer");
      }
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const setupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");
    setSetupLoading(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: setupName, phone: setupPhone, password: setupPassword }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSetupError(data.error || "Setup failed");
        return;
      }
      localStorage.setItem("currentUser", JSON.stringify(data.user));
      router.push("/change-password");
    } catch (err: any) {
      setSetupError(err?.message ?? "Setup failed");
    } finally {
      setSetupLoading(false);
    }
  };

  const installPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("pwa_install_dismissed", "true");
  };

  const skipBiometric = () => {
    setBiometricState("idle");
    setShowSplash(false);
  };

  const retryBiometric = () => {
    if (savedUsers.length === 1) {
      autoLoginWithBiometric(savedUsers[0]);
    } else {
      setBiometricState("idle");
    }
  };

  // Splash screen with biometric
  if (showSplash && biometricAvailable && savedUsers.length > 0) {
    return (
      <div className="splash-container">
        <div className="splash-content">
          <div className="splash-logo">🛫</div>
          <h1>Immigration Scheduler</h1>
          
          {biometricState === "scanning" && (
            <div className="biometric-animation scanning">
              <div className="scan-ring"></div>
              <div className="scan-icon">🔐</div>
              <p>Verifying identity...</p>
              <p className="scan-hint">Look at camera or touch sensor</p>
            </div>
          )}

          {biometricState === "success" && (
            <div className="biometric-animation success">
              <div className="success-icon">✅</div>
              <p>Welcome back!</p>
              <p className="user-name">{savedUsers[0]?.fullName}</p>
            </div>
          )}

          {biometricState === "face_rejected" && (
            <div className="biometric-animation rejected">
              <div className="rejected-face">
                <div className="face-emoji">🙅‍♂️</div>
                <div className="face-x">❌</div>
              </div>
              <p className="rejected-text">Who are you? 🤔</p>
              <p className="rejected-hint">Face not recognized!</p>
              <div className="rejected-actions">
                <button className="retry-btn" onClick={retryBiometric}>
                  🔄 Try Again
                </button>
                <button className="password-btn" onClick={skipBiometric}>
                  🔑 Use Password
                </button>
              </div>
            </div>
          )}

          {biometricState === "finger_rejected" && (
            <div className="biometric-animation rejected">
              <div className="rejected-finger">
                <div className="finger-emoji">👆</div>
                <div className="finger-shake">🙅</div>
              </div>
              <p className="rejected-text">Nice try! 😏</p>
              <p className="rejected-hint">Fingerprint not yours!</p>
              <div className="rejected-actions">
                <button className="retry-btn" onClick={retryBiometric}>
                  🔄 Try Again
                </button>
                <button className="password-btn" onClick={skipBiometric}>
                  🔑 Use Password
                </button>
              </div>
            </div>
          )}

          {biometricState === "idle" && savedUsers.length > 1 && (
            <div className="user-selector">
              <p>Select your account:</p>
              {savedUsers.map((u) => (
                <button key={u.id} className="user-select-btn" onClick={() => autoLoginWithBiometric(u)}>
                  <span className="user-icon">👤</span>
                  <span>{u.fullName}</span>
                </button>
              ))}
              <button className="skip-btn" onClick={skipBiometric}>
                Sign in with password instead
              </button>
            </div>
          )}
        </div>

        <style jsx>{`
          .splash-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
          }

          .splash-content {
            text-align: center;
            color: white;
          }

          .splash-logo {
            font-size: 5rem;
            margin-bottom: 16px;
            animation: float 3s ease-in-out infinite;
          }

          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          .splash-content h1 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 32px;
          }

          .biometric-animation {
            padding: 32px;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
          }

          .biometric-animation.scanning .scan-ring {
            width: 120px;
            height: 120px;
            border: 4px solid rgba(59, 130, 246, 0.3);
            border-top-color: #3b82f6;
            border-radius: 50%;
            margin: 0 auto 16px;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .scan-icon {
            font-size: 3rem;
            margin: -90px auto 60px;
          }

          .biometric-animation p {
            margin: 8px 0;
          }

          .scan-hint {
            font-size: 12px;
            opacity: 0.7;
          }

          .biometric-animation.success .success-icon {
            font-size: 4rem;
            animation: pop 0.3s ease-out;
          }

          @keyframes pop {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }

          .user-name {
            font-size: 1.25rem;
            font-weight: 600;
            color: #4ade80;
          }

          .biometric-animation.rejected {
            background: rgba(239, 68, 68, 0.1);
          }

          .rejected-face, .rejected-finger {
            position: relative;
            margin-bottom: 16px;
          }

          .face-emoji, .finger-emoji {
            font-size: 4rem;
            animation: shake 0.5s ease-in-out;
          }

          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px) rotate(-5deg); }
            75% { transform: translateX(10px) rotate(5deg); }
          }

          .face-x {
            position: absolute;
            top: -5px;
            right: calc(50% - 40px);
            font-size: 1.5rem;
            animation: fadeIn 0.3s ease-out 0.3s both;
          }

          .finger-shake {
            position: absolute;
            top: 0;
            right: calc(50% - 50px);
            font-size: 2rem;
            animation: fadeIn 0.3s ease-out 0.3s both;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0); }
            to { opacity: 1; transform: scale(1); }
          }

          .rejected-text {
            font-size: 1.25rem;
            font-weight: 600;
            color: #fca5a5;
          }

          .rejected-hint {
            font-size: 14px;
            opacity: 0.8;
          }

          .rejected-actions {
            display: flex;
            gap: 12px;
            margin-top: 24px;
            justify-content: center;
          }

          .retry-btn, .password-btn {
            padding: 12px 20px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s ease;
          }

          .retry-btn {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
          }

          .retry-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
          }

          .password-btn {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
          }

          .password-btn:hover {
            background: rgba(255, 255, 255, 0.2);
          }

          .user-selector {
            padding: 24px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 16px;
          }

          .user-selector p {
            margin-bottom: 16px;
            opacity: 0.8;
          }

          .user-select-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            padding: 14px 20px;
            margin-bottom: 8px;
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.3));
            border: 1px solid rgba(59, 130, 246, 0.5);
            border-radius: 12px;
            color: white;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .user-select-btn:hover {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(37, 99, 235, 0.5));
            transform: translateY(-2px);
          }

          .user-icon {
            font-size: 1.5rem;
          }

          .skip-btn {
            margin-top: 16px;
            padding: 10px 16px;
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            font-size: 13px;
            cursor: pointer;
            text-decoration: underline;
          }

          .skip-btn:hover {
            color: white;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="auth-container">
      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <div className="install-prompt">
          <div className="install-content">
            <div className="install-icon">📲</div>
            <div className="install-text">
              <strong>Install App</strong>
              <p>Add to home screen for faster access</p>
            </div>
            <button className="install-btn" onClick={installPWA}>Install</button>
            <button className="install-dismiss" onClick={dismissInstallPrompt}>✕</button>
          </div>
        </div>
      )}

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🛫</div>
          <h1>Immigration Scheduler</h1>
          <p>Manage officer shifts efficiently</p>
        </div>

        {hasAdmin === null && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div className="spinner"></div>
            <p className="muted">Loading...</p>
          </div>
        )}

        {hasAdmin === false && (
          <div className="auth-form-section">
            <h2>Initial Setup</h2>
            <p className="muted" style={{ marginBottom: 20 }}>
              Create your admin account to get started.
            </p>
            <form onSubmit={setupAdmin}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="input"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="Administrator"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="input"
                  value={setupPhone}
                  onChange={(e) => setSetupPhone(e.target.value)}
                  placeholder="252xxxxxxxxx"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  placeholder="Leave empty for admin123"
                />
              </div>
              {setupError && <div className="error-box">{setupError}</div>}
              <button className="btn btn-primary btn-block btn-lg" disabled={setupLoading}>
                {setupLoading ? "Creating..." : "Create Admin Account"}
              </button>
            </form>
          </div>
        )}

        {hasAdmin === true && (
          <div className="auth-form-section">
            {/* Biometric Quick Login */}
            {biometricAvailable && savedUsers.length > 0 && (
              <div className="biometric-section">
                <p className="section-label">Quick Login</p>
                <div className="biometric-users">
                  {savedUsers.map((u) => (
                    <div key={u.id} className="biometric-user">
                      <button className="biometric-btn" onClick={() => loginWithBiometric(u)} disabled={loading}>
                        <span className="bio-icon">🔐</span>
                        <span className="bio-name">{u.fullName}</span>
                        <span className="bio-hint">Tap to use Face/Fingerprint</span>
                      </button>
                      <button className="remove-bio-btn" onClick={() => removeBiometricUser(u.id)} title="Remove">✕</button>
                    </div>
                  ))}
                </div>
                <div className="divider"><span>or sign in with password</span></div>
              </div>
            )}
            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="252xxxxxxxxx"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              {error && <div className="error-box">{error}</div>}
              <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
            <div className="auth-help">
              <p><strong>Default passwords:</strong></p>
              <p>Admin: <code>admin123</code></p>
              <p>Officers: <code>officer123</code></p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
        }

        .install-prompt {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          padding: 12px 16px;
          z-index: 1000;
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }

        .install-content {
          max-width: 400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .install-icon {
          font-size: 2rem;
        }

        .install-text {
          flex: 1;
          color: white;
        }

        .install-text strong {
          display: block;
          font-size: 14px;
        }

        .install-text p {
          font-size: 12px;
          opacity: 0.9;
          margin: 0;
        }

        .install-btn {
          padding: 8px 16px;
          background: white;
          color: #2563eb;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }

        .install-btn:hover {
          background: #f0f9ff;
        }

        .install-dismiss {
          padding: 4px 8px;
          background: transparent;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          opacity: 0.7;
        }

        .install-dismiss:hover {
          opacity: 1;
        }

        .auth-card {
          max-width: 400px;
          width: 100%;
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .auth-logo {
          font-size: 3rem;
          margin-bottom: 12px;
        }

        .auth-header h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 4px;
          color: #0f172a;
        }

        .auth-header p {
          color: #64748b;
          font-size: 14px;
        }

        .auth-form-section h2 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .biometric-section { margin-bottom: 20px; }
        .section-label { font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 12px; }
        .biometric-users { display: flex; flex-direction: column; gap: 8px; }
        .biometric-user { display: flex; gap: 8px; align-items: stretch; }
        .biometric-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px; background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); border: 2px solid #0ea5e9; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; }
        .biometric-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3); }
        .biometric-btn:disabled { opacity: 0.6; }
        .bio-icon { font-size: 2rem; }
        .bio-name { font-weight: 600; color: #0369a1; font-size: 15px; }
        .bio-hint { font-size: 11px; color: #0284c7; }
        .remove-bio-btn { width: 36px; display: flex; align-items: center; justify-content: center; background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; cursor: pointer; font-size: 14px; }
        .remove-bio-btn:hover { background: #fecaca; }
        .divider { display: flex; align-items: center; margin: 20px 0; color: #94a3b8; font-size: 13px; }
        .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: #e2e8f0; }
        .divider span { padding: 0 12px; }

        .form-group {
          margin-bottom: 16px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          margin-bottom: 6px;
        }

        .input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 15px;
          transition: all 0.15s ease;
        }

        .input:focus {
          outline: none;
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .error-box {
          padding: 12px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          color: #b91c1c;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .btn-lg {
          padding: 14px 20px;
          font-size: 15px;
        }

        .btn-block {
          width: 100%;
        }

        .btn-primary {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .auth-help {
          margin-top: 24px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 10px;
          font-size: 13px;
          color: #64748b;
        }

        .auth-help p {
          margin: 4px 0;
        }

        .auth-help code {
          background: #e2e8f0;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #334155;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 12px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 480px) {
          .auth-card {
            padding: 24px;
            border-radius: 12px;
          }

          .auth-header h1 {
            font-size: 1.25rem;
          }

          .input {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}
