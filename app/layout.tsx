import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Respawn — Your life in games",
  description:
    "Discover your next favorite game. Keep a diary of the worlds you visit, rate what you play, and build your gaming collection.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
