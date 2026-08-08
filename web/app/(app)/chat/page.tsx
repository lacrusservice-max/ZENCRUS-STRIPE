"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { chat as chatApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Send, Zap, Utensils, Droplet, Flame, Star } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "¿Qué debería comer hoy para complementar mis macros?",
  "¿Cómo puedo mejorar mi Health Score esta semana?",
  "¿Qué ejercicio recomiendas para hoy?",
  "¿Cuánta proteína necesito y cómo distribuirla?",
  "Dame un tip de nutrición para hoy",
  "¿Cómo puedo mantener mi racha activa?",
];

function ZenaAvatar({ size = 32 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, rgba(255,31,61,0.5), rgba(255,255,255,0.35))", border: "1.5px solid rgba(96,165,250,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 6px 16px rgba(255,31,61,0.3)" }}>
      <Zap size={size * 0.46} color="#FF8FA0" />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 14 }}>
      <ZenaAvatar />
      <div className="glass-card" style={{ borderRadius: "18px 18px 18px 4px", padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF5871", animation: `typing-dot 1.2s ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiMessagesToday, setAiMessagesToday] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const DAILY_LIMIT = 5;

  useEffect(() => {
    const saved = parseInt(localStorage.getItem("zencrus_ai_today") ?? "0");
    const savedDate = localStorage.getItem("zencrus_ai_date") ?? "";
    const today = new Date().toISOString().slice(0, 10);
    if (savedDate !== today) {
      localStorage.setItem("zencrus_ai_date", today);
      localStorage.setItem("zencrus_ai_today", "0");
      setAiMessagesToday(0);
    } else {
      setAiMessagesToday(saved);
    }

    let cancelled = false;
    (async () => {
      try {
        const existingId = localStorage.getItem("zencrus_chat_session_id");
        if (existingId) {
          const res = await chatApi.getSession(existingId);
          const rows = res.data?.data?.messages ?? [];
          if (rows.length && !cancelled) {
            setSessionId(existingId);
            setMessages(rows.map((m: { id: string; sender_type: string; content: string; created_at: string }) => ({
              id: m.id, role: m.sender_type === "user" ? "user" : "assistant", content: m.content, timestamp: new Date(m.created_at),
            })));
            return;
          }
        }
        const res = await chatApi.createSession(`Chat ${new Date().toLocaleDateString("es-MX")}`);
        const session = res.data?.data?.session;
        const rows = res.data?.data?.messages ?? [];
        if (cancelled) return;
        if (session?.id) { setSessionId(session.id); localStorage.setItem("zencrus_chat_session_id", session.id); }
        setMessages(rows.length
          ? rows.map((m: { id: string; sender_type: string; content: string; created_at: string }) => ({ id: m.id, role: m.sender_type === "user" ? "user" : "assistant", content: m.content, timestamp: new Date(m.created_at) }))
          : [{ id: "welcome", role: "assistant", content: `¡Hola${user?.fullName ? ", " + user.fullName.split(" ")[0] : ""}! Soy tu Coach ZENCRUS ⚡. ¿En qué te puedo ayudar hoy?`, timestamp: new Date() }]);
      } catch {
        if (!cancelled) setMessages([{ id: "welcome", role: "assistant", content: "¡Hola! Soy tu Coach ZENCRUS ⚡. ¿En qué te puedo ayudar hoy?", timestamp: new Date() }]);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    if (aiMessagesToday >= DAILY_LIMIT) {
      toast.error("Límite diario alcanzado. Actualiza a Premium para mensajes ilimitados.");
      return;
    }
    const userMsg: Message = { id: Date.now().toString(), role: "user", content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);
    const newCount = aiMessagesToday + 1;
    setAiMessagesToday(newCount);
    localStorage.setItem("zencrus_ai_today", newCount.toString());
    try {
      let sid = sessionId;
      if (!sid) {
        const created = await chatApi.createSession();
        sid = created.data?.data?.session?.id;
        if (sid) { setSessionId(sid); localStorage.setItem("zencrus_chat_session_id", sid); }
      }
      if (!sid) throw new Error("no session");
      const res = await chatApi.sendMessage(sid, content);
      const reply = res.data?.data?.aiMessage?.content ?? "Lo siento, no pude procesar tu mensaje.";
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "Ocurrió un error al conectar. Por favor intenta de nuevo.", timestamp: new Date() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, aiMessagesToday, sessionId]);

  const atLimit = aiMessagesToday >= DAILY_LIMIT;
  const remaining = DAILY_LIMIT - aiMessagesToday;
  const formatTime = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(10,10,10,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ width: "100%", maxWidth: 780, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ZenaAvatar size={42} />
            <div>
              <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 19, color: "#f4f4f5" }}>Coach ZENA</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                {atLimit ? "Límite diario alcanzado" : `${remaining} mensajes gratis hoy`}
              </div>
            </div>
          </div>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: sending ? "#FF6B35" : "#30D158", boxShadow: `0 0 10px ${sending ? "rgba(255,107,53,0.6)" : "rgba(48,209,88,0.6)"}` }} />
        </div>
      </div>

      {/* Context chips */}
      <div style={{ display: "flex", justifyContent: "center", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width: "100%", maxWidth: 780, display: "flex", gap: 8, padding: "10px 20px", flexWrap: "wrap" }}>
          {[{ icon: Utensils, c: "#FF5871", label: "0 kcal" }, { icon: Droplet, c: "#38BDF8", label: "0 vasos" }, { icon: Flame, c: "#FF6B35", label: "0d racha" }, { icon: Star, c: "#FFD60A", label: "Score 0" }].map(c => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 999, padding: "5px 12px" }}>
              <c.icon size={12} color={c.c} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 780, padding: "20px 20px 8px" }}>
        {messages.map(msg => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 10, marginBottom: 14 }}>
              {!isUser && <ZenaAvatar />}
              <div
                className={isUser ? undefined : "glass-card"}
                style={{
                  maxWidth: "78%",
                  background: isUser ? "linear-gradient(135deg, #FF1F3D, #FF0030)" : undefined,
                  boxShadow: isUser ? "0 8px 20px rgba(255,31,61,0.3)" : undefined,
                  borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "12px 16px",
                }}
              >
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#f4f4f5", whiteSpace: "pre-wrap", margin: 0 }}>{msg.content}</p>
                <p style={{ fontSize: 10, marginTop: 4, textAlign: "right", color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>{formatTime(msg.timestamp)}</p>
              </div>
            </div>
          );
        })}
        {sending && <TypingIndicator />}

        {messages.length <= 1 && !sending && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>Preguntas frecuentes</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }} className="chat-suggestions">
              {QUICK_QUESTIONS.map(q => (
                <button key={q} onClick={() => handleSend(q)} disabled={atLimit} className="glass-card" style={{ width: "100%", padding: "13px 16px", textAlign: "left", cursor: "pointer", color: "#FF8FA0", fontSize: 13.5, fontWeight: 500, opacity: atLimit ? 0.4 : 1, fontFamily: "inherit", border: "1px solid rgba(96,165,250,0.15)" }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {atLimit && (
          <div className="glass-card-accent" style={{ margin: "16px 0" }}>
            <div style={{ padding: 24, textAlign: "center" }}>
              <Zap size={36} color="#FF5871" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f4f4f5", marginBottom: 8 }}>Límite diario alcanzado</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 16 }}>Usaste {aiMessagesToday}/{DAILY_LIMIT} mensajes gratis.</div>
              <button className="btn-primary" style={{ fontSize: 13 }}>Ver Premium →</button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Input */}
      <div style={{ display: "flex", justifyContent: "center", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(10,10,10,0.9)", backdropFilter: "blur(12px)" }}>
        <div style={{ width: "100%", maxWidth: 780, display: "flex", alignItems: "flex-end", gap: 10, padding: "14px 20px" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={atLimit ? "Límite diario alcanzado" : "Escribe tu pregunta..."}
            disabled={atLimit}
            rows={1}
            className="glass-input"
            style={{ flex: 1, resize: "none", borderRadius: 18, fontSize: 15, maxHeight: 100, opacity: atLimit ? 0.4 : 1 }}
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || sending || atLimit} style={{ width: 46, height: 46, borderRadius: "50%", background: input.trim() && !atLimit ? "linear-gradient(135deg, #FF1F3D, #FF0030)" : "rgba(255,255,255,0.05)", boxShadow: input.trim() && !atLimit ? "0 8px 20px rgba(255,31,61,0.35)" : "none", border: input.trim() && !atLimit ? "none" : "1px solid rgba(255,255,255,0.09)", cursor: input.trim() && !atLimit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Send size={18} color={input.trim() && !atLimit ? "#fff" : "rgba(255,255,255,0.3)"} />
          </button>
        </div>
      </div>
      <style>{`
        @media (min-width: 640px) {
          .chat-suggestions { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
