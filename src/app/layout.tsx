import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marsen Learn English",
  robots: { index: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
