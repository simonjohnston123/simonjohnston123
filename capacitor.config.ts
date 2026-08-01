import type { CapacitorConfig } from "@capacitor/cli";

// Placid CRM — native shell over the live web app (placidcrm.com). The app loads
// the live site, so web deploys update the app instantly; only native capabilities
// (icon/splash/push/camera) are baked in here and need a store resubmit to change.
// Bundle id is stable (com.placid.crm); the store DISPLAY NAME is still to be
// confirmed since the product also carries the "Placid Connect" brand.
const config: CapacitorConfig = {
  appId: "com.placid.crm",
  appName: "Placid CRM",
  webDir: "www",
  server: {
    url: "https://placidcrm.com",
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
  },
  backgroundColor: "#ffffff",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
      androidScaleType: "CENTER_INSIDE",
    },
    StatusBar: {
      style: "LIGHT", // light background => dark icons
      backgroundColor: "#ffffff",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: "native",
    },
  },
};

export default config;
