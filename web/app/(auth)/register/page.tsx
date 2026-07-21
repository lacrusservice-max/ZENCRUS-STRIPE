"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { auth as authApi } from "@/lib/api";
import toast from "react-hot-toast";
import Image from "next/image";
import { Eye, EyeOff, Mail, Lock, User, ChevronLeft, ShieldCheck, CheckCircle, XCircle, Loader } from "lucide-react";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { ok: password.length >= 8, label: "8+" },
    { ok: /[A-Z]/.test(password), label: "A-Z" },
    { ok: /[0-9]/.test(password), label: "0-9" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "!@#" },
  ];
  const score = checks.filter(c => c.ok).length;
  const color = score <= 1 ? "#ef4444" : score <= 2 ? "#f97316" : score <= 3 ? "#eab308" : "#22c55e";
  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? color : "rgba(255,255,255,0.08)" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        {checks.map(c => (
          <span key={c.label} style={{ fontSize: 10, color: c.ok ? "#22c55e" : "rgba(255,255,255,0.25)", fontWeight: 600 }}>
            {c.ok ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  // Step 0
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 1
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const checkUsername = useCallback((val: string) => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!val || val.length < 3) { setUsernameStatus("idle"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(val)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(val);
        setUsernameStatus(res.data?.data?.available ? "ok" : "taken");
      } catch { setUsernameStatus("ok"); }
    }, 600);
  }, []);

  const handleUsername = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    setUsername(clean);
    checkUsername(clean);
  };

  const validateStep0 = (): string | null => {
    if (!fullName.trim() || fullName.trim().length < 2) return "Ingresa tu nombre completo";
    if (!username || username.length < 3) return "El username necesita al menos 3 caracteres";
    if (usernameStatus === "checking") return "Verificando username...";
    if (usernameStatus === "taken") return "Ese username ya está en uso";
    if (usernameStatus === "invalid") return "Username solo puede tener letras, números y _";
    // idle = API no disponible, dejar pasar y que el servidor valide
    if (usernameStatus !== "ok" && usernameStatus !== "idle") return "Ingresa un username válido";
    return null;
  };

  const handleNext = () => {
    const err = validateStep0();
    if (err) { toast.error(err); return; }
    setStep(1);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Ingresa un correo válido"); return;
    }
    if (password.length < 8) { toast.error("La contraseña necesita al menos 8 caracteres"); return; }
    if (!/[A-Z]/.test(password)) { toast.error("La contraseña necesita al menos una mayúscula"); return; }
    if (!/[0-9]/.test(password)) { toast.error("La contraseña necesita al menos un número"); return; }
    if (password !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }

    setLoading(true);
    try {
      const res = await authApi.register(email.trim().toLowerCase(), password, fullName.trim(), username);
      const data = res.data?.data ?? res.data;
      const token = data?.token ?? data?.access_token;
      if (token) {
        const user = data?.user ?? data;
        setAuth({ id: user.id ?? user._id, email: user.email, fullName: user.fullName ?? fullName.trim(), username: user.username ?? username, role: "user", subscriptionTier: "free", isEmailVerified: false }, token);
        router.push("/onboarding");
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? "Error al crear la cuenta";
      // If email already exists, offer to login instead
      if (msg.toLowerCase().includes("ya existe")) {
        toast.error(msg + " — ¿Ya tienes cuenta? Inicia sesión.", { duration: 5000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    display: "flex", alignItems: "center",
    background: focused === field ? "rgba(37,99,235,0.07)" : "rgba(255,255,255,0.06)",
    borderRadius: 14, border: `1px solid ${focused === field ? "rgba(37,99,235,0.6)" : "rgba(255,255,255,0.08)"}`,
    padding: "14px 14px", marginBottom: 14, transition: "all 0.2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#080808", padding: "0 0 40px", position: "relative", overflow: "hidden" }}>
      {/* Blobs */}
      <div style={{ position: "absolute", top: -100, right: -80, width: 280, height: 280, borderRadius: "50%", background: "#2563EB", opacity: 0.10, filter: "blur(40px)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "16px 20px 12px", gap: 12 }}>
        <button onClick={() => { if (step === 0) router.back(); else setStep(0); }} style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.65)" }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 2, background: "#60a5fa", width: step === 0 ? "50%" : "100%", transition: "width 0.3s ease" }} />
        </div>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{step + 1}/2</span>
      </div>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "0 20px" }}>
        {/* Logo (step 0 only) */}
        {step === 0 && (
          <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
            <Image src="/logo-blanco.png" alt="ZENCRUS" width={140} height={42} style={{ objectFit: "contain" }} priority />
          </div>
        )}

        {/* Step 0 */}
        {step === 0 && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Crear cuenta</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>Tu perfil deportivo empieza aquí</div>

            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginBottom: 8, marginTop: 0 }}>Nombre completo</div>
              <div style={inputStyle("name")}>
                <User size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 10, flexShrink: 0 }} />
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Carlos García" onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "#fff", fontFamily: "inherit" }} />
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Username <span style={{ color: "#ef4444" }}>*</span></div>
              <div style={inputStyle("user")}>
                <span style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginRight: 6 }}>@</span>
                <input value={username} onChange={e => handleUsername(e.target.value)} placeholder="carlos_garcia" onFocus={() => setFocused("user")} onBlur={() => setFocused(null)} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "#fff", fontFamily: "inherit" }} />
                {usernameStatus === "checking" && <Loader size={18} color="rgba(255,255,255,0.35)" style={{ animation: "spin 1s linear infinite" }} />}
                {usernameStatus === "ok" && <CheckCircle size={18} color="#22c55e" />}
                {usernameStatus === "taken" && <XCircle size={18} color="#ef4444" />}
              </div>
              {usernameStatus === "taken" && <div style={{ fontSize: 12, color: "#ef4444", marginTop: -8, marginBottom: 10 }}>Username no disponible</div>}
              {usernameStatus === "ok" && <div style={{ fontSize: 12, color: "#22c55e", marginTop: -8, marginBottom: 10 }}>¡Disponible!</div>}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 16, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                <Lock size={13} color="rgba(255,255,255,0.3)" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", lineHeight: 1.5 }}>Tus datos son privados. Solo usamos tu nombre para personalizar tu experiencia.</span>
              </div>
            </div>

            <button type="button" onClick={handleNext} className="btn-primary" style={{ width: "100%", fontSize: 15 }}>
              Continuar →
            </button>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>¿Ya tienes cuenta? </span>
              <Link href="/login" style={{ fontSize: 13, color: "#60a5fa", fontWeight: 600 }}>Inicia sesión</Link>
            </div>
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleRegister} style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4, paddingTop: 24 }}>Crea tu acceso</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>El último paso — ya casi estás dentro</div>

            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Correo electrónico</div>
              <div style={inputStyle("email")}>
                <Mail size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 10, flexShrink: 0 }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "#fff", fontFamily: "inherit" }} />
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Contraseña</div>
              <div style={inputStyle("pass")}>
                <Lock size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 10, flexShrink: 0 }} />
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" onFocus={() => setFocused("pass")} onBlur={() => setFocused(null)} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "#fff", fontFamily: "inherit" }} />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex" }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password.length > 0 && <PasswordStrength password={password} />}

              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginBottom: 8, marginTop: 14 }}>Confirmar contraseña</div>
              <div style={inputStyle("confirm")}>
                <ShieldCheck size={18} color="rgba(255,255,255,0.35)" style={{ marginRight: 10, flexShrink: 0 }} />
                <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite tu contraseña" onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "#fff", fontFamily: "inherit" }} />
                <button type="button" onClick={() => setShowConfirm(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex" }}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && <div style={{ fontSize: 12, color: "#ef4444", marginTop: -8 }}>Las contraseñas no coinciden</div>}
              {confirmPassword.length > 0 && password === confirmPassword && password.length >= 8 && <div style={{ fontSize: 12, color: "#22c55e", marginTop: -8 }}>¡Contraseñas coinciden!</div>}
            </div>

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.6, marginBottom: 16 }}>
              Al continuar aceptas los <span style={{ color: "#60a5fa" }}>Términos de Servicio</span> y la <span style={{ color: "#60a5fa" }}>Política de Privacidad</span> de ZENCRUS.
            </p>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} /> : (<>Crear mi cuenta ✓</>)}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
