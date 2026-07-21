import { Zap } from "lucide-react";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07070f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 80px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 400,
          background: "radial-gradient(circle, rgba(91,79,255,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #5b4fff, #2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={18} color="#fff" fill="#fff" />
        </div>
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            background: "linear-gradient(135deg, #5b4fff, #2563eb)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          ZENCRUS
        </span>
      </div>
      <div style={{ width: "100%", maxWidth: 520, position: "relative" }}>
        {children}
      </div>
    </div>
  );
}
