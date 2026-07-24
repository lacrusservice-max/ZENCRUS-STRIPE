"use client";

import { Suspense } from "react";
import SuccessContent from "./SuccessContent";

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#08090c" }} />}>
      <SuccessContent />
    </Suspense>
  );
}
