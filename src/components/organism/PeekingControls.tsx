"use client";

import { useState } from "react";
import ChevronLeft from "@/components/atom/icon/heroicons/outline/ChevronLeft";

export default function PeekingControls() {
  const [isPeekOpen, setIsPeekOpen] = useState(false);

  return (
    <div
      className={`fixed z-10 bottom-12 right-0 flex gap-4 bg-slate-700 p-4 rounded-l-2xl transition-transform shadow shadow-fuchsia-400 ${
        isPeekOpen ? "" : "translate-x-16"
      }`}
    >
      <button
        className={`transition-transform ${isPeekOpen ? "rotate-180" : ""}`}
        onClick={() => setIsPeekOpen((v) => !v)}
      >
        <ChevronLeft className="text-white !h-12 !w-12" />
      </button>
    </div>
  );
}
