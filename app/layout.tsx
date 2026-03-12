import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "WHELM",
  description: "Focus timer with session tracking.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/intro/twosecappicon.mp4" as="video" type="video/mp4" />
        <link rel="preload" href="/emotes/welcomeemoting.mp4" as="video" type="video/mp4" />
        <link rel="preload" href="/sensei/neutral.png" as="image" />
      </head>
      <body>{children}</body>
    </html>
  );
}
