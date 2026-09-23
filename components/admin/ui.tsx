"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <>
      <div className="rv-topbar">
        <div>
          <div className="rv-topbar__title">{title}</div>
          {subtitle ? <div className="rv-topbar__subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="rv-topbar__actions">{actions}</div> : null}
      </div>
    </>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  flush,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={className ? `rv-card ${className}` : "rv-card"}>
      {title || actions ? (
        <div className="rv-card__header">
          <div>
            <h2>{title}</h2>
            {description ? <div className="rv-hint">{description}</div> : null}
          </div>
          {actions ? <div className="rv-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? "rv-card__body rv-card__body--flush" : "rv-card__body"}>{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "default",
  size,
  disabled,
  loading,
  className,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  href?: string;
}) {
  const classes = [
    "rv-btn",
    variant !== "default" ? `rv-btn--${variant}` : "",
    size === "sm" ? "rv-btn--sm" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (href && !disabled) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type={type} onClick={onClick} disabled={disabled || loading}>
      {loading ? <span className="rv-spinner" /> : null}
      {children}
    </button>
  );
}

export type BadgeTone = "green" | "amber" | "red" | "blue" | "bronze" | "gray" | "default";

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={tone === "default" ? "rv-badge" : `rv-badge rv-badge--${tone}`}>{children}</span>;
}

const statusTones: Record<string, BadgeTone> = {
  Published: "green",
  Draft: "gray",
  Archived: "gray",
  Reserved: "amber",
  Sold: "blue",
  New: "bronze",
  Processing: "amber",
  Packed: "blue",
  Shipped: "blue",
  Completed: "green",
  Cancelled: "red",
  Returned: "red",
  Paid: "green",
  Pending: "amber",
  Failed: "red",
  Refunded: "red",
  PartiallyRefunded: "amber",
  Replied: "green",
  Read: "blue",
  Scheduled: "amber",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="rv-badge">—</span>;
  return <Badge tone={statusTones[status] ?? "default"}>{status.replace(/([a-z])([A-Z])/g, "$1 $2")}</Badge>;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `rv-field ${className}` : "rv-field"}>
      <label className="rv-label">{label}</label>
      {children}
      {hint ? <span className="rv-hint">{hint}</span> : null}
      {error ? <span className="rv-error-text">{error}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  step,
  disabled,
  id,
  autoComplete,
}: {
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  disabled?: boolean;
  id?: string;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      className="rv-input"
      type={type}
      value={value}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      autoComplete={autoComplete}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows,
  placeholder,
  code,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  code?: boolean;
}) {
  return (
    <textarea
      className={code ? "rv-textarea rv-textarea--code" : "rv-textarea"}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select className="rv-select" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className="rv-switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: string; label: string; count?: number }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rv-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={value === tab.value ? "is-active" : ""}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined ? ` (${tab.count})` : ""}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rv-empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="rv-loading">
      <span className="rv-spinner" />
      {label}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rv-stack" style={{ padding: 18 }}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rv-skeleton" style={{ width: `${90 - index * 7}%` }} />
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="rv-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={wide ? "rv-modal__panel rv-modal__panel--wide" : "rv-modal__panel"} ref={panelRef}>
        <div className="rv-modal__header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="rv-modal__body">{children}</div>
        {footer ? <div className="rv-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Delete",
  title = "Are you sure?",
  description = "This action cannot be undone.",
  variant = "danger",
  size,
}: {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  confirmLabel?: string;
  title?: string;
  description?: string;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Modal
        open={open}
        title={title}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <p>{description}</p>
      </Modal>
    </>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rv-stat">
      <span className="rv-stat__label">{label}</span>
      <strong className="rv-stat__value">{value}</strong>
      {hint ? <div className="rv-stat__hint">{hint}</div> : null}
    </div>
  );
}

export function KeyValue({ entries }: { entries: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="rv-kv">
      {entries.map((entry) => (
        <div key={entry.label} style={{ display: "contents" }}>
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}
