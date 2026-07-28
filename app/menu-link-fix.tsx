"use client";

import { useEffect } from "react";

const routes: Array<[RegExp, string]> = [
  [/Dashboard/i, "/"],
  [/News Inbox/i, "/news"],
  [/Travel Radar/i, "/radar"],
  [/Approval Center/i, "/approval"],
  [/Source Monitor/i, "/sources"],
  [/Published/i, "/published"],
  [/Activity Log/i, "/activity"],
  [/Settings/i, "/settings"],
];

export default function MenuLinkFix() {
  useEffect(() => {
    const anchors = document.querySelectorAll<HTMLAnchorElement>(".sidebar nav a");
    anchors.forEach((anchor) => {
      if (anchor.getAttribute("href")) return;
      const text = anchor.textContent || "";
      const match = routes.find(([pattern]) => pattern.test(text));
      if (!match) return;
      anchor.href = match[1];
      anchor.style.cursor = "pointer";
    });
  }, []);

  return null;
}
