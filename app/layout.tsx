import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.whelmproductivity.com"),
  title: {
    default: "Whelm Productivity",
    template: "%s | Whelm Productivity",
  },
  description:
    "Whelm Productivity is a mobile-first focus timer, schedule planner, notes workspace, and accountability system.",
  applicationName: "Whelm Productivity",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Whelm Productivity",
    description:
      "Mobile-first focus timer, planning calendar, notes, and accountability in one system.",
    url: "https://www.whelmproductivity.com",
    siteName: "Whelm Productivity",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Whelm Productivity",
    description:
      "Mobile-first focus timer, planning calendar, notes, and accountability in one system.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: "Whelm",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/whelm-icon.png",
    apple: "/whelm-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preload" href="/intro/twosecappicon.mp4" as="video" type="video/mp4" />
        <link rel="preload" href="/emotes/welcomeemoting.mp4" as="video" type="video/mp4" />
        <link rel="preload" href="/sensei/neutral.png" as="image" />
      </head>
      <body>{children}</body>
    </html>
  );
}
