import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZENCRUS — Nutrición + Fitness con IA",
  description: "Tu plan de nutrición y fitness personalizado con inteligencia artificial.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "ZENCRUS — Nutrición + Fitness con IA",
    description: "Tu plan de nutrición y fitness personalizado con inteligencia artificial.",
    images: ["/logo-blanco.png"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.className}>
      <body style={{ background: "#0a0a0a", color: "#f4f4f5", minHeight: "100vh" }}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(20,20,20,0.98)",
              color: "#f4f4f5",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#30D158", secondary: "#0a0a0a" } },
            error: { iconTheme: { primary: "#FF3B30", secondary: "#0a0a0a" } },
          }}
        />
      </body>
    </html>
  );
}
