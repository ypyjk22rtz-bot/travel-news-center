import type { Metadata } from "next";
import "./globals.css";
import "./sources/sources.css";
import MenuLinkFix from "./menu-link-fix";
import DealsMenuLink from "./DealsMenuLink";
import RadarSignalLinkFix from "./radar-signal-link-fix";
import OpportunityMenuLink from "./OpportunityMenuLink";

export const metadata: Metadata = {
  title: "Travel News Center AI",
  description: "Official travel intelligence, powered by AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body><MenuLinkFix /><DealsMenuLink /><OpportunityMenuLink /><RadarSignalLinkFix />{children}</body>
    </html>
  );
}
