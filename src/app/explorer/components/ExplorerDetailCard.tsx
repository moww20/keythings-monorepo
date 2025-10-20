import React from "react";

interface ExplorerDetailItem {
  label: string;
  value: React.ReactNode;
}

type ColumnCount = 1 | 2 | 3;

interface ExplorerDetailCardProps {
  title: string;
  items: ExplorerDetailItem[];
  columns?: ColumnCount;
}

const COLUMN_CLASS_NAMES: Record<ColumnCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export function ExplorerDetailCard({ title, items, columns = 2 }: ExplorerDetailCardProps): React.ReactElement {
  const columnClassName = COLUMN_CLASS_NAMES[columns] ?? COLUMN_CLASS_NAMES[2];
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_18px_50px_rgba(5,6,11,0.45)]">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <dl className={`mt-4 grid gap-4 text-sm text-subtle ${columnClassName}`}>
        {items.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-xs uppercase tracking-[0.3em] text-muted">{label}</dt>
            <dd className="text-sm text-foreground/90 break-words">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
