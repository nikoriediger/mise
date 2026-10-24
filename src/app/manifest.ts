import type { MetadataRoute } from "next";
import { appName } from "@/i18n/config";

/** Web app manifest: "Add to Home Screen" opens the app full-screen with its own icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appName.length > 14 ? appName.split(" ")[0] : appName,
    start_url: "/",
    display: "standalone",
    background_color: "#eef6ea",
    theme_color: "#eef6ea",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
