"use client";

export function LoadingScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#07070f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: "-0.5px",
          background: "linear-gradient(135deg, #5b4fff, #2563eb)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "pulse-glow 2s ease-in-out infinite",
        }}
      >
        ZENCRUS
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(91,79,255,0.2)",
          borderTopColor: "#5b4fff",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}
