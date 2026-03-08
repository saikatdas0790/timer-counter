import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWakeLock } from "./useWakeLock";

// Helper: build a minimal WakeLockSentinel mock
function makeSentinel() {
  return {
    release: vi.fn().mockResolvedValue(undefined),
  };
}

// Helper: install a mock navigator.wakeLock
function installWakeLock(
  sentinel: ReturnType<typeof makeSentinel> | null = makeSentinel(),
) {
  const request =
    sentinel !== null
      ? vi.fn().mockResolvedValue(sentinel)
      : vi.fn().mockRejectedValue(new Error("denied"));

  Object.defineProperty(navigator, "wakeLock", {
    value: { request },
    configurable: true,
    writable: true,
  });

  return { request };
}

// Helper: remove the wakeLock property
function removeWakeLock() {
  Object.defineProperty(navigator, "wakeLock", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  removeWakeLock();
});

describe("useWakeLock", () => {
  it("requests a screen wake lock when active is true", async () => {
    const sentinel = makeSentinel();
    const { request } = installWakeLock(sentinel);

    const { unmount } = renderHook(() => useWakeLock(true));

    // Let the Promise resolve
    await act(async () => {});

    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith("screen");

    unmount();
  });

  it("does not request a wake lock when active is false", async () => {
    const { request } = installWakeLock();

    const { unmount } = renderHook(() => useWakeLock(false));
    await act(async () => {});

    expect(request).not.toHaveBeenCalled();

    unmount();
  });

  it("releases the sentinel on unmount", async () => {
    const sentinel = makeSentinel();
    installWakeLock(sentinel);

    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {});

    expect(sentinel.release).not.toHaveBeenCalled();

    unmount();

    expect(sentinel.release).toHaveBeenCalledOnce();
  });

  it("releases the sentinel when active transitions from true to false", async () => {
    const sentinel = makeSentinel();
    installWakeLock(sentinel);

    const { rerender, unmount } = renderHook(
      ({ active }: { active: boolean }) => useWakeLock(active),
      { initialProps: { active: true } },
    );
    await act(async () => {});

    expect(sentinel.release).not.toHaveBeenCalled();

    rerender({ active: false });
    await act(async () => {});

    expect(sentinel.release).toHaveBeenCalledOnce();

    unmount();
  });

  it("re-requests the wake lock when active goes true → false → true", async () => {
    const sentinel1 = makeSentinel();
    const sentinel2 = makeSentinel();
    const request = vi
      .fn()
      .mockResolvedValueOnce(sentinel1)
      .mockResolvedValueOnce(sentinel2);
    Object.defineProperty(navigator, "wakeLock", {
      value: { request },
      configurable: true,
      writable: true,
    });

    const { rerender, unmount } = renderHook(
      ({ active }: { active: boolean }) => useWakeLock(active),
      { initialProps: { active: true } },
    );
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    await act(async () => {});
    expect(sentinel1.release).toHaveBeenCalledOnce();

    rerender({ active: true });
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(2);

    unmount();
    expect(sentinel2.release).toHaveBeenCalledOnce();
  });

  it("re-acquires the lock on visibilitychange when page becomes visible", async () => {
    const sentinel1 = makeSentinel();
    const sentinel2 = makeSentinel();
    const request = vi
      .fn()
      .mockResolvedValueOnce(sentinel1)
      .mockResolvedValueOnce(sentinel2);
    Object.defineProperty(navigator, "wakeLock", {
      value: { request },
      configurable: true,
      writable: true,
    });

    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);

    // Simulate page becoming visible again (browser releases lock when hidden)
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {});

    expect(request).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("does not throw when Wake Lock API is unavailable", async () => {
    removeWakeLock();

    expect(() => {
      const { unmount } = renderHook(() => useWakeLock(true));
      unmount();
    }).not.toThrow();
  });

  it("does not throw when the wake lock request is denied (Promise rejects)", async () => {
    installWakeLock(null); // null → request returns a rejected Promise

    // If the hook didn't swallow the rejection, renderHook / act would throw.
    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    unmount();
    // Reaching here without throwing means the rejection was handled gracefully.
  });
});
