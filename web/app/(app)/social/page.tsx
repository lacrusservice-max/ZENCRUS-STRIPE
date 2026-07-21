"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { social as socialApi } from "@/lib/api";
import toast from "react-hot-toast";
import { Heart, MessageCircle, Image as ImageIcon, Send, Users } from "lucide-react";

interface Post {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  content: string;
  imageUrl?: string;
  likesCount: number;
  commentsCount: number;
  liked: boolean;
  createdAt: string;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "rgba(37,99,235,0.25)", border: "1px solid rgba(37,99,235,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 800, color: "#60a5fa", flexShrink: 0,
    }}>
      {initials || "?"}
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function SocialPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postContent, setPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadFeed = async (p = 1) => {
    try {
      const res = await socialApi.getFeed(p);
      const newPosts: Post[] = res.data?.data?.posts ?? res.data?.posts ?? [];
      if (p === 1) setPosts(newPosts);
      else setPosts(prev => [...prev, ...newPosts]);
      setHasMore(newPosts.length >= 10);
    } catch {
      if (p === 1) toast.error("Error al cargar el feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFeed(1); }, []);

  const handlePost = async () => {
    if (!postContent.trim()) return;
    setPosting(true);
    try {
      await socialApi.createPost(postContent.trim());
      setPostContent("");
      toast.success("¡Publicado!");
      loadFeed(1);
    } catch {
      toast.error("Error al publicar");
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (post: Post) => {
    try {
      await socialApi.likePost(post.id);
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, liked: !p.liked, likesCount: p.liked ? p.likesCount - 1 : p.likesCount + 1 } : p));
    } catch {
      toast.error("Error al dar like");
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>

      {/* Header */}
      <div style={{ paddingTop: 24, paddingBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: "#2563EB", letterSpacing: 3.5, marginBottom: 4 }}>ZENCRUS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={24} color="#f4f4f5" />
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f4f5" }}>Comunidad</div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>Comparte tu progreso e inspira a otros</div>
      </div>

      {/* Create post */}
      <div style={{ marginBottom: 20 }}>
        <div className="glass-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <Avatar name={user?.fullName ?? "U"} />
            <textarea
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              placeholder="¿Qué lograste hoy? Comparte tu progreso..."
              rows={3}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "10px 14px", color: "#f4f4f5", fontSize: 13, resize: "none", fontFamily: "inherit", outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              <ImageIcon size={16} /> Imagen
            </button>
            <button onClick={handlePost} disabled={!postContent.trim() || posting} className="btn-primary" style={{ fontSize: 13, padding: "8px 16px" }}>
              <Send size={14} /> Publicar
            </button>
          </div>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #2563EB", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto" }} />
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f4f4f5", marginBottom: 8 }}>Sé el primero en publicar</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Comparte tu progreso con la comunidad</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map(post => (
            <div key={post.id} className="glass-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <Avatar name={post.fullName || post.username} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5" }}>{post.fullName || post.username}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>@{post.username} · {timeAgo(post.createdAt)}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "#f4f4f5", lineHeight: 1.6, marginBottom: post.imageUrl ? 12 : 0 }}>{post.content}</p>
              {post.imageUrl && (
                <img src={post.imageUrl} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 12 }} />
              )}
              <div style={{ display: "flex", gap: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, marginTop: 12 }}>
                <button onClick={() => handleLike(post)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: post.liked ? "#FF3B30" : "rgba(255,255,255,0.4)", fontSize: 13 }}>
                  <Heart size={16} fill={post.liked ? "#FF3B30" : "none"} /> {post.likesCount}
                </button>
                <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                  <MessageCircle size={16} /> {post.commentsCount}
                </button>
              </div>
            </div>
          ))}
          {hasMore && (
            <button onClick={() => { const next = page + 1; setPage(next); loadFeed(next); }} className="btn-secondary" style={{ width: "100%" }}>
              Cargar más
            </button>
          )}
        </div>
      )}
    </div>
  );
}
