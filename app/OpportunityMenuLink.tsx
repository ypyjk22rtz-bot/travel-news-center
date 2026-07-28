"use client";

import { useEffect } from "react";

export default function OpportunityMenuLink() {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll("aside.sidebar nav").forEach((nav) => {
        if (nav.querySelector('a[href="/opportunities"]')) return;
        const link = document.createElement("a");
        link.href = "/opportunities";
        link.textContent = "🏆 Opportunity Radar";
        const approval = nav.querySelector('a[href="/approval"]');
        if (approval) nav.insertBefore(link, approval);
        else nav.appendChild(link);
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
