"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface TocHeading {
  id: string;
  text: string;
}

export default function RightToc(): JSX.Element | null {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("main h2, main h3"));
    // Generate unique IDs with suffixes if duplicates appear
    const used = new Map<string, number>();
    const mapped = nodes.map<TocHeading>((node) => {
      const base = (node.id || node.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "").replace(/(^-|-$)/g, "");
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      const id = count > 1 ? `${base}-${count}` : base;
      return { id, text: node.textContent || "" };
    });
    // Ensure IDs exist on DOM nodes (match mapped ordering)
    nodes.forEach((node, index) => {
      if (!node.id || node.id !== mapped[index].id) node.id = mapped[index].id;
    });
    setHeadings(mapped);

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] });
    nodes.forEach((node) => observer.observe(node));

    const onHash = () => {
      const id = window.location.hash.replace("#", "");
      if (!id) return;
      setActive(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", onHash);
    };
  }, [pathname]);

  if (headings.length === 0) return null;

  return (
    <div className="w-48 max-xl:hidden">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-[--color-muted]">On this page</div>
      <nav className="grid gap-0.5">
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={`toc-item px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
              active === heading.id
                ? "is-active text-foreground bg-white/10"
                : "text-foreground/70 hover:text-foreground hover:bg-white/5"
            }`}
            onClick={(event) => {
              event.preventDefault();
              const element = document.getElementById(heading.id);
              if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
              window.history.replaceState(null, "", `#${heading.id}`);
              setActive(heading.id);
            }}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </div>
  );
}


