import Image from "next/image";

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
      <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
        <Image src="/logo-blanco.png" alt="ZENCRUS" width={150} height={44} style={{ objectFit: "contain" }} priority />
      </div>
      <div style={{ width: "100%", maxWidth: 520, position: "relative" }}>
        {children}
      </div>
    </div>
  );
}
