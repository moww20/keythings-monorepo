"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { docsItems } from "../toc/items";

interface BreadcrumbItem {
  href: string;
  label: string;
}

function findCrumbs(pathname: string): BreadcrumbItem[] {
  for (const section of docsItems) {
    const child = section.children.find((entry) => pathname.startsWith(entry.href));
    if (child) return [{ href: "/docs", label: "Docs" }, { href: child.href, label: child.label }];
  }
  return [{ href: "/docs", label: "Docs" }];
}

export default function Breadcrumbs(): JSX.Element {
  const pathname = usePathname();
  const crumbs = findCrumbs(pathname);
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm">
      <ol className="flex items-center gap-2 text-[--color-muted]">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-2">
            {i > 0 && <span className="opacity-70">/</span>}
            {i < crumbs.length - 1 ? (
              <Link href={c.href} className="hover:text-foreground">{c.label}</Link>
            ) : (
              <span className="text-foreground">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}


