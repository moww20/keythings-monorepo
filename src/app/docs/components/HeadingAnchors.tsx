"use client";

import { useEffect } from "react";

function slugify(text: string | null | undefined): string {
  return (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function HeadingAnchors(): null {
  useEffect(() => {
    try {
      const headings = Array.from(document.querySelectorAll<HTMLElement>("main h2, main h3"));
      const usedIds = new Map<string, number>();
      headings.forEach((heading) => {
        if (!heading.id) heading.id = slugify(heading.textContent);
        // Ensure uniqueness by appending a numeric suffix when needed
        const base = heading.id;
        const count = usedIds.get(base) ?? 0;
        if (count > 0) {
          heading.id = `${base}-${count + 1}`;
        }
        usedIds.set(base, count + 1);
        heading.classList.add("group", "relative", "pr-8");
        // Avoid duplicating button
        if (heading.querySelector('[data-anchor-btn]')) return;
        const button = document.createElement("button");
        button.setAttribute("data-anchor-btn", "");
        button.setAttribute("aria-label", "Copy link to heading");
        button.className = "absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-[--color-muted] hover:text-foreground";
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", "M10 14l4-4m-7 7a4 4 0 010-6l1-1m8 8a4 4 0 010-6l-1-1");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.6");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
        button.appendChild(svg);
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const url = `${window.location.origin}${window.location.pathname}#${heading.id}`;
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            // ignore clipboard failure
          }
          window.history.replaceState(null, "", `#${heading.id}`);
        });
        heading.appendChild(button);
      });
    } catch {
      // ignore DOM access issues
    }
  }, []);

  return null;
}


