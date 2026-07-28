"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function DealsMenuLink() {
  const pathname = usePathname();

  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".sidebar nav").forEach((nav) => {
      let link = nav.querySelector<HTMLAnchorElement>('a[href="/deals"]');
      if (!link) {
        link = document.createElement("a");
        link.href = "/deals";
        link.textContent = "€ Travel Deals";
        const approval = nav.querySelector('a[href="/approval"]');
        if (approval?.nextSibling) nav.insertBefore(link, approval.nextSibling);
        else nav.appendChild(link);
      }
      link.classList.toggle("active", pathname === "/deals");
    });
  }, [pathname]);

  return null;
}
