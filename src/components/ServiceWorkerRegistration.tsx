"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/registerServiceWorker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
