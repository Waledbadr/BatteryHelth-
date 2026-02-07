import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Battery Health Analytics",
  description: "Offline Windows battery analytics dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
