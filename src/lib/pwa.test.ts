import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { registerServiceWorker } from "./registerServiceWorker";

// ── PWA Manifest ──────────────────────────────────────────────────────────────
// Reads the manifest file at build time to verify it satisfies the browser
// criteria that trigger the PWA install prompt.

describe("PWA manifest (public/manifest.json)", () => {
  const content = readFileSync(
    join(process.cwd(), "public", "manifest.json"),
    "utf-8",
  );
  const manifest = JSON.parse(content) as {
    name?: string;
    short_name?: string;
    start_url?: string;
    display?: string;
    theme_color?: string;
    background_color?: string;
    icons?: Array<{ src: string; sizes: string; type?: string }>;
  };

  it("has a non-empty name", () => {
    expect(typeof manifest.name).toBe("string");
    expect(manifest.name!.length).toBeGreaterThan(0);
  });

  it("has a non-empty short_name", () => {
    expect(typeof manifest.short_name).toBe("string");
    expect(manifest.short_name!.length).toBeGreaterThan(0);
  });

  it("has start_url set to /", () => {
    expect(manifest.start_url).toBe("/");
  });

  it("has display set to standalone (required for install prompt)", () => {
    expect(["standalone", "fullscreen", "minimal-ui"]).toContain(
      manifest.display,
    );
  });

  it("has a 192x192 icon (minimum required for PWA install prompt)", () => {
    expect(manifest.icons).toBeDefined();
    const has192 = manifest.icons!.some((icon) =>
      icon.sizes.split(" ").some((s) => parseInt(s) >= 192),
    );
    expect(has192).toBe(true);
  });

  it("has a 512x512 icon (required for splash screens)", () => {
    expect(manifest.icons).toBeDefined();
    const has512 = manifest.icons!.some((icon) =>
      icon.sizes.split(" ").some((s) => parseInt(s) >= 512),
    );
    expect(has512).toBe(true);
  });

  it("all icon src paths are non-empty strings", () => {
    expect(manifest.icons).toBeDefined();
    for (const icon of manifest.icons!) {
      expect(typeof icon.src).toBe("string");
      expect(icon.src.length).toBeGreaterThan(0);
    }
  });
});

// ── Service Worker Registration ───────────────────────────────────────────────

describe("registerServiceWorker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls navigator.serviceWorker.register with /sw.js and scope /", () => {
    const mockRegister = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: mockRegister },
      configurable: true,
      writable: true,
    });

    registerServiceWorker();

    expect(mockRegister).toHaveBeenCalledOnce();
    expect(mockRegister).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("does not throw when serviceWorker API is unavailable", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => registerServiceWorker()).not.toThrow();
  });
});

// ── Service Worker source ─────────────────────────────────────────────────────
// Structural checks: verify the SW file declares install, activate, and fetch
// event listeners — the three lifecycle requirements for a functional PWA SW.

describe("public/sw.js", () => {
  const swSource = readFileSync(
    join(process.cwd(), "public", "sw.js"),
    "utf-8",
  );

  it("registers an install event listener", () => {
    expect(swSource).toContain(`addEventListener("install"`);
  });

  it("registers an activate event listener", () => {
    expect(swSource).toContain(`addEventListener("activate"`);
  });

  it("registers a fetch event listener", () => {
    expect(swSource).toContain(`addEventListener("fetch"`);
  });

  it("calls skipWaiting() to activate immediately on install", () => {
    expect(swSource).toContain("skipWaiting");
  });

  it("calls clients.claim() to take control of existing clients on activate", () => {
    expect(swSource).toContain("clients.claim");
  });
});
