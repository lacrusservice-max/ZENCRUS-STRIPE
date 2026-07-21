"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email) { setError("El email es requerido"); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Email inválido"); return; }
    setLoading(true);
    try {
      await auth.forgotPassword(email);
      setSent(true);
    } catch {
      toast.error("No pudimos enviar el email. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(34,197,94,0.15)",
            border: "1px solid rgba(34,197,94,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle size={28} color="#22c55e" />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Revisa tu correo</h2>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7 }}>
            Enviamos un enlace de recuperación a{" "}
            <strong style={{ color: "#f1f5f9" }}>{email}</strong>.
            Revisa tu bandeja de entrada y sigue las instrucciones.
          </p>
        </div>
        <Link href="/login" style={{ width: "100%" }}>
          <Button variant="secondary" fullWidth>
            Volver al inicio de sesión
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Recuperar contraseña</h1>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>
          Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <Input
        label="Email"
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(""); }}
        leftIcon={<Mail size={15} />}
        error={error}
        autoComplete="email"
      />

      <Button type="submit" fullWidth loading={loading} size="lg">
        Enviar enlace
      </Button>

      <p style={{ textAlign: "center", fontSize: 14, color: "#94a3b8" }}>
        <Link href="/login" style={{ color: "#5b4fff", textDecoration: "none" }}>
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
