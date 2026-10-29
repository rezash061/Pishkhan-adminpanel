"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { admin } from "@/lib/api/client";
import { toPersianDigits } from "@/lib/format";
import { logout } from "@/lib/logout";

const IDLE_MS = Number(process.env.NEXT_PUBLIC_ADMIN_IDLE_SECONDS ?? 900) * 1000;
const WARN_MS = Number(process.env.NEXT_PUBLIC_ADMIN_IDLE_WARN_SECONDS ?? 120) * 1000;
const KEEPALIVE_MS = 4 * 60_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"] as const;

/**
 * 15-minute idle timeout (admin plan 2.2). Background polling keeps tokens fresh, so inactivity is measured
 * here from real input, shared across tabs, and ends the session with a warning two minutes before.
 */
export function IdleTimeout() {
  const t = useTranslations("idle");
  const lastActivity = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const markActive = useCallback((broadcast = true) => {
    lastActivity.current = Date.now();
    if (broadcast) channel.current?.postMessage(lastActivity.current);
  }, []);

  useEffect(() => {
    lastActivity.current = Date.now();
    channel.current = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("pishkhan-admin-activity");
    channel.current?.addEventListener("message", (e: MessageEvent<number>) => {
      lastActivity.current = Math.max(lastActivity.current, e.data);
    });

    let lastBroadcast = 0;
    const onActivity = () => {
      // While the warning is open, only the explicit "stay" button counts as activity.
      if (document.querySelector("[data-idle-warning]")) return;
      const now = Date.now();
      lastActivity.current = now;
      if (now - lastBroadcast > 5_000) {
        lastBroadcast = now;
        channel.current?.postMessage(now);
      }
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // An active user who stays on one page still needs the backend session (15-minute refresh idle window) kept alive.
    let lastPing = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now - lastActivity.current < 60_000 && now - lastPing > KEEPALIVE_MS) {
        lastPing = now;
        void admin("/me").catch(() => undefined);
      }
      const left = IDLE_MS - (now - lastActivity.current);
      if (left <= 0) {
        window.clearInterval(timer);
        void logout("idle");
      } else {
        setRemaining(left <= WARN_MS ? left : null);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      channel.current?.close();
    };
  }, []);

  const stay = () => {
    markActive();
    setRemaining(null);
    // Touch the backend so the refresh token's idle window restarts too.
    void admin("/me").catch(() => undefined);
  };

  return (
    <Dialog open={remaining !== null}>
      <DialogContent title={t("title")} blocking>
        <div data-idle-warning>
          <p className="text-sm">{t("body", { seconds: toPersianDigits(Math.ceil((remaining ?? 0) / 1000)) })}</p>
          <div className="mt-6 flex gap-2">
            <Button onClick={stay} autoFocus>
              {t("stay")}
            </Button>
            <Button variant="secondary" onClick={() => void logout("loggedOut")}>
              {t("logout")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
