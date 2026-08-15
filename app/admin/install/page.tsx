import type { Metadata } from "next";
import Script from "next/script";
import InstallProductionApp from "./install-production-app";
import "../orders/fulfillment.css";

export const metadata: Metadata = {
  title: "Install Maroma Production",
  description: "Install the Maroma Production fulfilment app.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Maroma Production", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/maroma-production-safe-192.png", icon: "/icons/maroma-production-safe-192.png" },
};

export default function InstallPage() {
  return (
    <>
      <Script
        id="capture-production-install-prompt"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__maromaInstallPrompt=e;window.dispatchEvent(new Event('maroma-install-ready'));});`,
        }}
      />
      <InstallProductionApp />
    </>
  );
}
