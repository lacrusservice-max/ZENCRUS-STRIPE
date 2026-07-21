import { Suspense } from "react";
import VerifyEmailContent from "./VerifyEmailContent";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#080808" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #2563EB", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
