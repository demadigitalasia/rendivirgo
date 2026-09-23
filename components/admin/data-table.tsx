"use client";

import type { ReactNode } from "react";
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
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (checked: boolean) => void;
}) {
  if (loading) {
    return <SkeletonRows rows={6} />;
  }

  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const allSelected = selectable && selectedIds && items.every((item) => selectedIds.includes(rowKey(item)));

  return (
    <div className="rv-table-wrap">
      <table className="rv-table">
        <thead>
          <tr>
            {selectable ? (
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={Boolean(allSelected)}
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
                      aria-label={`Select row ${id}`}
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
    <div className="rv-pagination">
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
    </div>
  );
}
