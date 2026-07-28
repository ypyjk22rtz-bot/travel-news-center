"use client";

import { useEffect } from "react";

export default function RadarSignalLinkFix() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button || button.textContent?.trim() !== "Vezi semnalele") return;

      window.setTimeout(() => {
        const headings = Array.from(document.querySelectorAll("h2"));
        const priorityHeading = headings.find((heading) => heading.textContent?.trim() === "Priority Queue");
        const section = priorityHeading?.closest("section");
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
