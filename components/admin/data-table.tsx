"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button, EmptyState, SkeletonRows } from "./ui";

export type Column<T> = {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  align?: "left" | "right";
  width?: string;
};

export function DataTable<T>({
  columns,
  items,
  loading,
  rowKey,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  selectable,
  ariaLabel = "Data table",
  getRowLabel,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: {
  columns: Array<Column<T>>;
  items: T[];
  loading?: boolean;
  rowKey: (item: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  selectable?: boolean;
  ariaLabel?: string;
  getRowLabel?: (item: T) => string;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (checked: boolean) => void;
}) {
  const allSelected = Boolean(selectable && selectedIds?.length && items.every((item) => selectedIds.includes(rowKey(item))));
  const someSelected = Boolean(selectable && selectedIds?.length && !allSelected && items.some((item) => selectedIds.includes(rowKey(item))));
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  if (loading) {
    return <SkeletonRows rows={6} />;
  }

  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="rv-table-wrap">
      <table className="rv-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {selectable ? (
              <th style={{ width: 40 }}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all"
                  checked={Boolean(allSelected)}
                  aria-checked={someSelected ? "mixed" : Boolean(allSelected)}
                  onChange={(event) => onToggleSelectAll?.(event.target.checked)}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const id = rowKey(item);
            return (
              <tr key={id}>
                {selectable ? (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select row ${getRowLabel?.(item) ?? id}`}
                      checked={Boolean(selectedIds?.includes(id))}
                      onChange={() => onToggleSelect?.(id)}
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.key} className={column.align === "right" ? "is-actions" : undefined}>
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="rv-pagination" aria-label="Table pagination">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="rv-pagination__controls">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
