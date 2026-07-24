"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import { auth as authApi } from "@/lib/api";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Mail, ArrowRight, RefreshCw } from "lucide-react";

export default function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const { setAuth } = useAuthStore();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleInput = (idx: number, val: string) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[idx] = char;
    setCode(next);
    if (char && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (next.every(c => c !== "") && char) handleVerify(next.join(""));
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr: string) => {
    if (codeStr.length !== 6) { toast.error("Ingresa el código de 6 dígitos"); return; }
    if (!email) { toast.error("Email no encontrado. Regístrate de nuevo."); router.replace("/register"); return; }
    setLoading(true);
    try {
      const res = await authApi.verifyEmail(email, codeStr);
      const data = res.data?.data ?? res.data;
      // Backend returns accessToken (camelCase)
      const token = data?.accessToken ?? data?.token ?? data?.access_token;
      const refreshToken = data?.refreshToken;
      if (token) {
        // Fetch full user profile
        const meRes = await api.get("/users/me", { headers: { Authorization: `Bearer ${token}` } });
        const u = meRes.data?.data ?? meRes.data;
        setAuth({
          id: u.id ?? u._id,
          email: u.email ?? email,
          fullName: u.full_name ?? u.fullName ?? "",
          username: u.username ?? "",
          role: u.role ?? "user",
          subscriptionTier: u.subscription_tier ?? u.subscriptionTier ?? "free",
          isEmailVerified: true,
        }, token, refreshToken);
        toast.success("¡Email verificado! Bienvenido a ZENCRUS");
        router.replace("/onboarding");
      } else {
        toast.success("Email verificado. Inicia sesión.");
        router.replace("/login");
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? "Código incorrecto o expirado";
      toast.error(msg);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await authApi.resendVerification(email);
      toast.success("Código reenviado. Revisa tu correo.");
      setCountdown(60);
    } catch {
      toast.error("No se pudo reenviar. Intenta de nuevo.");
    } finally {
      setResending(false);
    }
  };

  const box: React.CSSProperties = {
    width: 48, height: 56, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 24, fontWeight: 800,
    textAlign: "center", outline: "none", fontFamily: "inherit", transition: "all 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -100, right: -60, width: 300, height: 300, borderRadius: "50%", background: "#2563EB", opacity: 0.1, filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <Image src="/logo-blanco.png" alt="ZENCRUS" width={140} height={42} style={{ objectFit: "contain" }} priority />
        </div>

        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Mail size={30} color="#2563EB" />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#f4f4f5", marginBottom: 10 }}>Verifica tu correo</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 8 }}>Enviamos un código de 6 dígitos a</p>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#60a5fa", marginBottom: 32 }}>{email || "tu correo"}</p>

        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", padding: 28, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, marginBottom: 20 }}>CÓDIGO DE VERIFICACIÓN</div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }} onPaste={handlePaste}>
            {code.map((c, i) => (
              <input key={i} ref={el => { inputRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
                value={c} onChange={e => handleInput(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)} disabled={loading}
                style={{ ...box, border: `1px solid ${c ? "rgba(37,99,235,0.6)" : "rgba(255,255,255,0.12)"}`, background: c ? "rgba(37,99,235,0.1)" : "rgba(255,255,255,0.05)" }} />
            ))}
          </div>

          <button onClick={() => handleVerify(code.join(""))} disabled={loading || code.some(c => c === "")}
            style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", cursor: loading || code.some(c => c === "") ? "not-allowed" : "pointer", background: loading || code.some(c => c === "") ? "rgba(37,99,235,0.3)" : "#2563EB", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
            {loading
              ? <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
              : <>Verificar cuenta <ArrowRight size={17} /></>}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {countdown > 0
            ? <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Reenviar código en <span style={{ color: "#60a5fa", fontWeight: 700 }}>{countdown}s</span></p>
            : <button onClick={handleResend} disabled={resending} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#60a5fa", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
                <RefreshCw size={14} />{resending ? "Enviando..." : "Reenviar código"}
              </button>}
          <button onClick={() => router.replace("/register")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "inherit" }}>
            Usar otro correo
          </button>
        </div>
      </div>
    </div>
  );
}
