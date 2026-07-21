"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { auth as authApi } from "@/lib/api";
import toast from "react-hot-toast";
import Image from "next/image";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Ingresa tu correo y contraseña");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      const data = res.data?.data ?? res.data;
      const token = data?.accessToken ?? data?.token ?? data?.access_token;
      if (!token) throw new Error("No token received");

      // Decode JWT payload to get user info (no extra API call needed)
      const payload = JSON.parse(atob(token.split(".")[1]));

      setAuth({
        id: payload.userId ?? payload.sub ?? "",
        email: payload.email ?? email.trim().toLowerCase(),
        fullName: "",
        username: "",
        role: payload.role ?? "user",
        subscriptionTier: payload.subscriptionTier ?? payload.subscription_tier ?? "free",
        isEmailVerified: true,
      }, token);
      router.replace("/home");
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? "Error al iniciar sesión";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 0,
    background: focused === field ? "rgba(37,99,235,0.07)" : "rgba(255,255,255,0.04)",
    borderRadius: 14,
    border: `1px solid ${focused === field ? "rgba(37,99,235,0.55)" : "rgba(255,255,255,0.09)"}`,
    padding: "14px 16px",
    marginBottom: 20,
    transition: "all 0.2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 24px", position: "relative", overflow: "hidden" }}>
      {/* Blobs */}
      <div style={{ position: "absolute", top: -100, right: -60, width: 320, height: 320, borderRadius: "50%", background: "#2563EB", opacity: 0.13, filter: "blur(40px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 60, left: -80, width: 260, height: 260, borderRadius: "50%", background: "#009997", opacity: 0.10, filter: "blur(40px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, animation: "slideUp 0.5s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Image src="/logo-blanco.png" alt="ZENCRUS" width={160} height={48} style={{ objectFit: "contain" }} priority />
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: 0.4 }}>Tu compañero de salud inteligente</div>
        </div>

        {/* Card */}
        <form onSubmit={handleLogin} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.09)", padding: 28, boxShadow: "0 20px 40px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden" }}>
          {/* Highlight */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.18)", pointerEvents: "none" }} />

          {/* Email */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Correo electrónico</div>
          <div style={inputStyle("email")}>
            <Mail size={17} color="rgba(255,255,255,0.36)" style={{ marginRight: 10, flexShrink: 0 }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "#fff", fontFamily: "inherit" }}
            />
          </div>

          {/* Password */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Contraseña</div>
          <div style={inputStyle("pass")}>
            <Lock size={17} color="rgba(255,255,255,0.36)" style={{ marginRight: 10, flexShrink: 0 }} />
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onFocus={() => setFocused("pass")}
              onBlur={() => setFocused(null)}
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "#fff", fontFamily: "inherit" }}
            />
            <button type="button" onClick={() => setShowPass(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(255,255,255,0.36)", display: "flex" }}>
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {/* Forgot */}
          <div style={{ textAlign: "right", marginTop: -12, marginBottom: 24 }}>
            <Link href="/forgot-password" style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>¿Olvidaste tu contraseña?</Link>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", fontSize: 15, padding: "16px" }}>
            {loading ? <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} /> : "Iniciar sesión"}
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.09)" }} />
            <span style={{ padding: "0 12px", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>o</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.09)" }} />
          </div>

          {/* Register link */}
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>¿No tienes cuenta? </span>
            <Link href="/register" style={{ fontSize: 13, color: "#60a5fa", fontWeight: 700 }}>Regístrate gratis</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
