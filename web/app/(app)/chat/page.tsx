"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { chat as chatApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Send } from "lucide-react";

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

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(30,40,80,0.9)", border: "1.5px solid rgba(37,99,235,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>⚡</span>
      </div>
      <div style={{ background: "#141414", border: "1px solid #2c2c2e", borderRadius: "18px 18px 18px 4px", padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", animation: `typing-dot 1.2s ${i * 0.2}s infinite` }} />
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
    const firstName = user?.fullName?.split(" ")[0] ?? "Atleta";
    const welcome: Message = {
      id: "welcome",
      role: "assistant",
      content: `¡Hola${firstName ? ", " + firstName : ""}! Soy tu Coach ZENCRUS ⚡. Estoy aquí para ayudarte con nutrición, fitness y todo lo que necesites para alcanzar tus metas. ¿En qué te puedo ayudar hoy?`,
      timestamp: new Date(),
    };
    setMessages([welcome]);
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
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await chatApi.send(content, history);
      const reply = res.data?.data?.message ?? res.data?.message ?? "Lo siento, no pude procesar tu mensaje.";
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "Ocurrió un error al conectar. Por favor intenta de nuevo.", timestamp: new Date() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, aiMessagesToday]);

  const atLimit = aiMessagesToday >= DAILY_LIMIT;
  const remaining = DAILY_LIMIT - aiMessagesToday;
  const formatTime = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #2c2c2e", flexShrink: 0, background: "rgba(10,10,10,0.98)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(30,40,80,0.9)", border: "1.5px solid #2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 20 }}>⚡</span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5" }}>Coach ZENCRUS</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
              {atLimit ? "Límite diario alcanzado" : `${remaining} mensajes gratis hoy`}
            </div>
          </div>
        </div>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: sending ? "#FF6B35" : "#30D158" }} />
      </div>

      {/* Context chips */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", flexWrap: "wrap", borderBottom: "1px solid #2c2c2e", flexShrink: 0 }}>
        {[{ emoji: "🍽️", label: "0 kcal" }, { emoji: "💧", label: "0 vasos" }, { emoji: "🔥", label: "0d racha" }, { emoji: "⭐", label: "Score 0" }].map(c => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 4, background: "#141414", border: "1px solid #2c2c2e", borderRadius: 999, padding: "4px 10px" }}>
            <span style={{ fontSize: 12 }}>{c.emoji}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {messages.map(msg => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
              {!isUser && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(30,40,80,0.9)", border: "1.5px solid rgba(37,99,235,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>⚡</span>
                </div>
              )}
              <div style={{ maxWidth: "80%", background: isUser ? "#2563EB" : "#141414", border: isUser ? "none" : "1px solid #2c2c2e", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "12px 16px" }}>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#f4f4f5", whiteSpace: "pre-wrap", margin: 0 }}>{msg.content}</p>
                <p style={{ fontSize: 10, marginTop: 4, textAlign: "right", color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>{formatTime(msg.timestamp)}</p>
              </div>
            </div>
          );
        })}
        {sending && <TypingIndicator />}

        {messages.length <= 1 && !sending && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Preguntas frecuentes</p>
            {QUICK_QUESTIONS.map(q => (
              <button key={q} onClick={() => handleSend(q)} disabled={atLimit} style={{ width: "100%", background: "#141414", border: "1px solid #2c2c2e", borderRadius: 14, padding: "12px 14px", marginBottom: 8, textAlign: "left", cursor: "pointer", color: "#60a5fa", fontSize: 13, fontWeight: 500, opacity: atLimit ? 0.4 : 1, fontFamily: "inherit" }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {atLimit && (
          <div style={{ margin: "16px 0", background: "#141414", border: "1px solid rgba(37,99,235,0.5)", borderRadius: 16, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5", marginBottom: 8 }}>Límite diario alcanzado</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 16 }}>Usaste {aiMessagesToday}/{DAILY_LIMIT} mensajes gratis.</div>
            <button className="btn-primary" style={{ fontSize: 13 }}>Ver Premium →</button>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "12px 16px", borderTop: "1px solid #2c2c2e", flexShrink: 0, background: "rgba(10,10,10,0.98)" }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={atLimit ? "Límite diario alcanzado" : "Escribe tu pregunta..."}
          disabled={atLimit}
          rows={1}
          style={{ flex: 1, resize: "none", background: "#141414", border: "1.5px solid #2c2c2e", borderRadius: 18, padding: "12px 16px", fontSize: 15, color: "#f4f4f5", outline: "none", fontFamily: "inherit", maxHeight: 100, opacity: atLimit ? 0.4 : 1 }}
        />
        <button onClick={() => handleSend()} disabled={!input.trim() || sending || atLimit} style={{ width: 44, height: 44, borderRadius: "50%", background: input.trim() && !atLimit ? "#2563EB" : "#141414", border: input.trim() && !atLimit ? "none" : "1px solid #2c2c2e", cursor: input.trim() && !atLimit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Send size={18} color={input.trim() && !atLimit ? "#fff" : "rgba(255,255,255,0.3)"} />
        </button>
      </div>
    </div>
  );
}
