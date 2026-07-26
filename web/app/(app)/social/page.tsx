"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { social as socialApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Heart, MessageCircle, Send, Users, Plus, X, Flame, Trophy, MoreHorizontal } from "lucide-react";
import { Colors as C } from "@/lib/theme";

interface Author { id: string; full_name: string | null; username: string | null; profile_picture: string | null }
interface Post {
  id: string; user_id: string; content: string | null; image_url: string | null;
  kind: string; metadata: Record<string, unknown>; likes_count: number; comments_count: number;
  created_at: string; author: Author | null; liked: boolean;
}
interface Comment { id: string; content: string; created_at: string; author: Author | null }

function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  const initial = (name?.trim()?.[0] ?? "Z").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: C.navy, border: `1.5px solid ${C.navyBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
      {initial}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const s = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function SocialPage() {
  const { user } = useAuthStore();
  const [scope, setScope] = useState<"all" | "following">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentsFor, setCommentsFor] = useState<Post | null>(null);

  const loadFeed = useCallback(async (sc: "all" | "following") => {
    setLoading(true);
    try {
      const res = await socialApi.getFeed(sc);
      setPosts(res.data?.data ?? []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeed(scope); }, [scope, loadFeed]);

  const publish = async () => {
    const content = draft.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const res = await socialApi.createPost(content);
      setPosts(prev => [res.data.data, ...prev]);
      setDraft("");
      toast.success("Publicado");
    } catch {
      toast.error("No se pudo publicar");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (p: Post) => {
    const liked = !p.liked;
    setPosts(prev => prev.map(x => x.id === p.id ? { ...x, liked, likes_count: x.likes_count + (liked ? 1 : -1) } : x));
    try { if (liked) { await socialApi.likePost(p.id); } else { await socialApi.unlikePost(p.id); } }
    catch { setPosts(prev => prev.map(x => x.id === p.id ? { ...x, liked: !liked, likes_count: x.likes_count + (liked ? -1 : 1) } : x)); }
  };

  const removePost = async (p: Post) => {
    if (!confirm("¿Eliminar esta publicación?")) return;
    setPosts(prev => prev.filter(x => x.id !== p.id));
    try { await socialApi.deletePost(p.id); } catch { loadFeed(scope); }
  };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 20px 120px" }}>
      <div style={{ paddingTop: 32, paddingBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#3fae6b", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · COMUNIDAD</div>
        <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, color: C.text, letterSpacing: -0.5 }}>Comunidad</div>
      </div>

      <div className="sc-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {(["all", "following"] as const).map(sc => (
              <button key={sc} onClick={() => setScope(sc)} style={{
                padding: "10px 20px", borderRadius: 999, cursor: "pointer", fontSize: 13.5, fontWeight: 700,
                background: scope === sc ? "linear-gradient(135deg, #2563EB, #1d4ed8)" : "rgba(255,255,255,0.04)",
                color: scope === sc ? "#fff" : C.dim,
                border: `1px solid ${scope === sc ? "transparent" : C.border}`,
                boxShadow: scope === sc ? "0 8px 20px rgba(37,99,235,0.3)" : "none",
              }}>
                {sc === "all" ? "Explorar" : "Siguiendo"}
              </button>
            ))}
          </div>

          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <Avatar name={user?.fullName} size={44} />
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="¿Qué quieres compartir con la comunidad?"
                maxLength={2000}
                rows={2}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 15, resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={publish} disabled={!draft.trim() || posting} className="btn-primary" style={{ opacity: draft.trim() ? 1 : 0.5, padding: "10px 20px" }}>
                <Plus size={15} /> {posting ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: C.dim }}>Cargando feed…</div>
          ) : posts.length === 0 ? (
            <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
              <Users size={48} color={C.dim2} style={{ margin: "0 auto 16px", display: "block" }} />
              <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8 }}>
                {scope === "following" ? "Aún no sigues a nadie" : "Sé el primero en publicar"}
              </div>
              <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.6 }}>
                {scope === "following" ? "Sigue cuentas para ver su progreso aquí." : "Comparte tu progreso y motiva a la comunidad ZENCRUS."}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {posts.map(p => {
                const name = p.author?.full_name ?? "Usuario ZENCRUS";
                const streak = p.metadata?.streak as number | undefined;
                const achievement = p.metadata?.achievement as string | undefined;
                return (
                  <div key={p.id} className="glass-card" style={{ padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <Avatar name={name} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{name}</div>
                        <div style={{ fontSize: 12, color: C.dim2 }}>{timeAgo(p.created_at)}</div>
                      </div>
                      {p.user_id === user?.id && (
                        <button onClick={() => removePost(p)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim2, padding: 4 }}>
                          <MoreHorizontal size={18} />
                        </button>
                      )}
                    </div>

                    {p.content && <div style={{ fontSize: 15, color: C.text, lineHeight: 1.55, marginBottom: 14, whiteSpace: "pre-wrap" }}>{p.content}</div>}

                    {(streak || achievement) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                        {streak ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(240,138,75,0.15)", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, color: C.orange }}><Flame size={13} /> Racha de {streak} días</span> : null}
                        {achievement ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,214,10,0.15)", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, color: C.amber }}><Trophy size={13} /> {achievement}</span> : null}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 24, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                      <button onClick={() => toggleLike(p)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: p.liked ? C.red : C.dim, fontSize: 13.5, fontWeight: 700 }}>
                        <Heart size={19} fill={p.liked ? C.red : "none"} /> {p.likes_count}
                      </button>
                      <button onClick={() => setCommentsFor(p)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.dim, fontSize: 13.5, fontWeight: 700 }}>
                        <MessageCircle size={19} /> {p.comments_count}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="section-label">Comunidad ZENCRUS</div>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Users size={18} color="#3fae6b" />
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Comparte tu progreso</div>
            </div>
            <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>
              Publica tus rachas, logros y avances — la constancia se contagia. Sigue a otros atletas para ver su camino en tiempo real.
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .sc-grid { display: flex; flex-direction: column; gap: 24px; }
        @media (min-width: 900px) {
          .sc-grid { flex-direction: row; align-items: flex-start; }
          .sc-grid > div:first-child { flex: 1 1 0; }
          .sc-grid > div:last-child { flex: 0 0 320px; position: sticky; top: 24px; }
        }
      `}</style>

      {commentsFor && (
        <CommentsSheet
          post={commentsFor}
          onClose={() => setCommentsFor(null)}
          onAdded={() => setPosts(prev => prev.map(x => x.id === commentsFor.id ? { ...x, comments_count: x.comments_count + 1 } : x))}
        />
      )}
    </div>
  );
}

function CommentsSheet({ post, onClose, onAdded }: { post: Post; onClose: () => void; onAdded: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    socialApi.getComments(post.id).then(r => setComments(r.data?.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [post.id]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const r = await socialApi.addComment(post.id, content);
      setComments(prev => [...prev, r.data.data]);
      setDraft("");
      onAdded();
    } catch {
      toast.error("No se pudo comentar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0d0f14", border: `1px solid ${C.border}`, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Comentarios</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", color: C.dim, padding: 20 }}>Cargando…</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", color: C.dim2, padding: 20, fontSize: 14 }}>Sé el primero en comentar.</div>
          ) : comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 12 }}>
              <Avatar name={c.author?.full_name} size={32} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{c.author?.full_name ?? "Usuario"} <span style={{ color: C.dim2, fontWeight: 400 }}>· {timeAgo(c.created_at)}</span></div>
                <div style={{ fontSize: 14, color: C.dim, marginTop: 2, lineHeight: 1.45 }}>{c.content}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, padding: 16, borderTop: `1px solid ${C.border}` }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(); }}
            placeholder="Escribe un comentario…"
            maxLength={1000}
            style={{ flex: 1, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 999, padding: "10px 16px", color: C.text, fontSize: 14, outline: "none" }}
          />
          <button onClick={send} disabled={!draft.trim() || sending} style={{ width: 42, height: 42, borderRadius: "50%", background: draft.trim() ? C.navy : C.panel2, border: "none", cursor: draft.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
