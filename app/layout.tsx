import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import OvernightWarning from "./overnight-warning";

export const metadata: Metadata = {
  title: "WHELM",
  description: "Focus timer with session tracking.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <OvernightWarning>{children}</OvernightWarning>
      </body>
    </html>
  );
}
