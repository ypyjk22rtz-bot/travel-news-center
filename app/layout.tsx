import type { Metadata } from "next";
import "./globals.css";
import "./sources/sources.css";
import MenuLinkFix from "./menu-link-fix";

export const metadata: Metadata = {
  title: "Travel News Center AI",
  description: "Official travel intelligence, powered by AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body><MenuLinkFix />{children}</body>
    </html>
  );
}
