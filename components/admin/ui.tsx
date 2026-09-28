"use client";

import Link from "next/link";
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

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
    <button className={classes} type={type} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined}>
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
  inputId,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  inputId?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  const generatedId = `rv-field-${useId().replace(/:/g, "")}`;
  const fallbackId = inputId ?? generatedId;
  let controlId = fallbackId;
  let control = children;
  let managedControl = false;

  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    const childProps = child.props;
    controlId = typeof childProps.id === "string" ? childProps.id : fallbackId;
    const isNativeControl = typeof child.type === "string" && ["input", "select", "textarea"].includes(child.type);
    const isManagedControl = child.type === TextInput || child.type === Select || child.type === TextArea;
    managedControl = isNativeControl || isManagedControl;

    if (managedControl) {
      const describedBy = [hint ? `${controlId}-hint` : "", error ? `${controlId}-error` : ""].filter(Boolean).join(" ") || undefined;
      control = isNativeControl
        ? cloneElement(child, {
            id: controlId,
            "aria-describedby": childProps["aria-describedby"] ?? describedBy,
            "aria-invalid": childProps["aria-invalid"] ?? (error ? true : undefined),
          })
        : cloneElement(child, {
            id: controlId,
            ariaDescribedBy: childProps.ariaDescribedBy ?? describedBy,
            ariaInvalid: childProps.ariaInvalid ?? (error ? true : undefined),
          });
    }
  }

  return (
    <div className={className ? `rv-field ${className}` : "rv-field"}>
      <label className="rv-label" htmlFor={managedControl || inputId ? controlId : undefined}>{label}</label>
      {control}
      {hint ? <span id={`${controlId}-hint`} className="rv-hint">{hint}</span> : null}
      {error ? <span id={`${controlId}-error`} className="rv-error-text" role="alert">{error}</span> : null}
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
  name,
  required,
  ariaInvalid,
  ariaDescribedBy,
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
  name?: string;
  required?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      className="rv-input"
      type={type}
      value={value}
      name={name}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      required={required}
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={ariaDescribedBy}
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
  id,
  name,
  required,
  ariaInvalid,
  ariaDescribedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  code?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  return (
    <textarea
      id={id}
      className={code ? "rv-textarea rv-textarea--code" : "rv-textarea"}
      value={value}
      name={name}
      rows={rows}
      placeholder={placeholder}
      required={required}
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={ariaDescribedBy}
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
  id,
  name,
  required,
  ariaInvalid,
  ariaDescribedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  return (
    <select
      id={id}
      className="rv-select"
      value={value}
      name={name}
      disabled={disabled}
      required={required}
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={ariaDescribedBy}
      onChange={(event) => onChange(event.target.value)}
    >
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
  ariaLabel = "Sections",
}: {
  tabs: Array<{ value: string; label: string; count?: number }>;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const id = useId().replace(/:/g, "");
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.value === value));

  const move = (index: number) => onChange(tabs[(index + tabs.length) % tabs.length].value);

  return (
    <div className="rv-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          id={`${id}-${tab.value}`}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          tabIndex={value === tab.value ? 0 : -1}
          className={value === tab.value ? "is-active" : ""}
          onClick={() => onChange(tab.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              move(activeIndex + 1);
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              move(activeIndex - 1);
            }
            if (event.key === "Home") {
              event.preventDefault();
              move(0);
            }
            if (event.key === "End") {
              event.preventDefault();
              move(tabs.length - 1);
            }
          }}
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
    <div className="rv-loading" role="status" aria-live="polite">
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
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusPanel = () => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    };
    const focusTimer = window.setTimeout(focusPanel, 0);

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="rv-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={wide ? "rv-modal__panel rv-modal__panel--wide" : "rv-modal__panel"} ref={panelRef}>
        <div className="rv-modal__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog">
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

export function Stat({ label, value, hint, tone, href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "primary" | "attention" | "danger"; href?: string }) {
  const content = (
    <>
      <span className="rv-stat__label">{label}</span>
      <strong className="rv-stat__value">{value}</strong>
      {hint ? <div className="rv-stat__hint">{hint}</div> : null}
    </>
  );
  const className = ["rv-stat", tone ? `rv-stat--${tone}` : "", href ? "rv-stat--link" : ""].filter(Boolean).join(" ");

  return href ? <Link className={className} href={href}>{content}</Link> : <div className={className}>{content}</div>;
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
