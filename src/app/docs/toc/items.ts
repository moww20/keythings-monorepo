export interface DocsNavItem {
  title: string;
  href: string;
  label: string;
  description?: string;
  children?: DocsNavItem[];
}

export const docsItems: DocsNavItem[] = [
  { title: "Overview", href: "/docs", label: "Overview", description: "Documentation overview", children: [] },
];

export const flatDocs: DocsNavItem[] = docsItems;
