"use client";

import { useEffect } from "react";

/**
 * NativeInit — runs only inside the Capacitor native shell. It has no UI; it just
 * themes the status bar and dismisses the splash once the web app has loaded.
 * The CRM's existing responsive MobileNav already provides the in-app bottom bar,
 * so no extra native chrome is needed here.
 */
export default function NativeInit() {
  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        try {
          const { StatusBar, Style } = await import("@capacitor/status-bar");
          await StatusBar.setStyle({ style: Style.Light }); // dark icons on light bg
          if (Capacitor.getPlatform() === "android") {
            await StatusBar.setBackgroundColor({ color: "#ffffff" });
          }
        } catch {}
        try {
          const { SplashScreen } = await import("@capacitor/splash-screen");
          await SplashScreen.hide();
        } catch {}
      } catch {
        /* web build / no Capacitor — no-op */
      }
    })();
  }, []);

  return null;
}
