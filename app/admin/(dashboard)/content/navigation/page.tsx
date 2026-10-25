"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, ChevronDown, Heart, Search, ShoppingBag, Sparkles } from "lucide-react";
import { apiFetch, errorMessage, useApi, type ApiState } from "@/components/admin/api";
import { toast } from "@/components/admin/toast";
import { Button, Card, Field, Loading, PageHeader, Select, Switch, TextInput } from "@/components/admin/ui";
import {
  navigationRouteOptions,
  type AdminNavigationData,
  type AdminNavigationItem,
  type NavigationRouteKey,
  type NavigationTarget,
} from "@/lib/navigation";
import "./navigation.css";

type DestinationType = NavigationTarget["type"];

function updateById(items: AdminNavigationItem[], id: string, update: (item: AdminNavigationItem) => AdminNavigationItem): AdminNavigationItem[] {
  return items.map((item) => item.id === id
    ? update(item)
    : { ...item, children: updateById(item.children, id, update) });
}

function moveItem(items: AdminNavigationItem[], index: number, direction: -1 | 1): AdminNavigationItem[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function targetTypeOptions(data: AdminNavigationData, currentType: DestinationType) {
  const options = [
    { value: "route", label: "Built-in page" },
    ...(data.categories.some((category) => category.available) ? [{ value: "category", label: "Product category" }] : []),
    ...(data.pages.some((page) => page.available) ? [{ value: "page", label: "Published content page" }] : []),
    { value: "external", label: "External URL" },
  ];
  if (!options.some((option) => option.value === currentType)) {
    options.push({ value: currentType, label: currentType === "category" ? "Product category · unavailable" : "Published content page · unavailable" });
  }
  return options;
}

function destinationOptions(type: DestinationType, data: AdminNavigationData, selectedSlug?: string) {
  if (type === "route") return navigationRouteOptions;
  if (type === "category") return data.categories.filter((destination) => destination.available || destination.slug === selectedSlug).map((destination) => ({
    value: destination.slug,
    label: `${destination.label}${destination.available ? "" : " · inactive"}`,
  }));
  if (type === "page") return data.pages.filter((destination) => destination.available || destination.slug === selectedSlug).map((destination) => ({
    value: destination.slug,
    label: `${destination.label}${destination.available ? "" : " · draft"}`,
  }));
  return [];
}

function targetValue(item: AdminNavigationItem): string {
  if (item.target.type === "route") return item.target.route;
  if (item.target.type === "external") return item.target.url;
  return item.target.slug;
}

function targetSummary(item: AdminNavigationItem, data: AdminNavigationData): string {
  const target = item.target;
  if (target.type === "route") {
    return navigationRouteOptions.find((route) => route.value === target.route)?.label ?? "Built-in page";
  }
  if (target.type === "category") {
    return data.categories.find((category) => category.slug === target.slug)?.label ?? "Product category";
  }
  if (target.type === "page") {
    return data.pages.find((page) => page.slug === target.slug)?.label ?? "Content page";
  }
  try {
    return new URL(target.url).host || "External URL";
  } catch {
    return "External URL";
  }
}

function newItem(labelEn = "New link", labelId = "Tautan baru"): AdminNavigationItem {
  return {
    id: crypto.randomUUID(),
    labelEn,
    labelId,
    target: { type: "route", route: "home" },
    enabled: true,
    openInNewTab: false,
    children: [],
  };
}

function newSubmenuItem(data: AdminNavigationData): AdminNavigationItem {
  const item = newItem("New submenu link", "Tautan submenu baru");
  const category = data.categories.find((destination) => destination.available);
  if (category) return { ...item, target: { type: "category", slug: category.slug } };
  const page = data.pages.find((destination) => destination.available);
  if (page) return { ...item, target: { type: "page", slug: page.slug } };
  return item;
}

function itemWithTarget(item: AdminNavigationItem, type: DestinationType, data: AdminNavigationData): AdminNavigationItem {
  let target: NavigationTarget;
  if (type === "route") target = { type: "route", route: "home" };
  else if (type === "category") target = { type: "category", slug: data.categories.find((category) => category.available)?.slug ?? "" };
  else if (type === "page") target = { type: "page", slug: data.pages.find((page) => page.available)?.slug ?? "" };
  else target = { type: "external", url: "" };
  return { ...item, target, openInNewTab: false };
}

function TargetFields({
  item,
  data,
  onChange,
}: {
  item: AdminNavigationItem;
  data: AdminNavigationData;
  onChange: (item: AdminNavigationItem) => void;
}) {
  const currentSlug = item.target.type === "category" || item.target.type === "page" ? item.target.slug : undefined;
  const options = destinationOptions(item.target.type, data, currentSlug);
  const destination = targetValue(item);
  const unavailable = item.target.type === "category"
    ? !data.categories.some((category) => category.slug === destination && category.available)
    : item.target.type === "page"
      ? !data.pages.some((page) => page.slug === destination && page.available)
      : false;
  const destinationChoices = unavailable && !options.some((option) => option.value === destination)
    ? [...options, { value: destination, label: `${destination} · unavailable` }]
    : options;

  return (
    <div className="rv-navigation-target">
      <Field label="Destination type">
        <Select
          value={item.target.type}
          onChange={(value) => onChange(itemWithTarget(item, value as DestinationType, data))}
          options={targetTypeOptions(data, item.target.type)}
        />
      </Field>
      {item.target.type === "external" ? (
        <Field label="HTTPS URL" hint="External links must start with https://">
          <TextInput
            value={item.target.url}
            onChange={(url) => onChange({ ...item, target: { type: "external", url } })}
            placeholder="https://example.com"
          />
        </Field>
      ) : (
        <Field label="Destination" hint={unavailable ? "This destination is currently inactive or unpublished." : undefined}>
          <Select
            value={destination}
            onChange={(value) => {
              const target: NavigationTarget = item.target.type === "route"
                ? { type: "route", route: value as NavigationRouteKey }
                : item.target.type === "category"
                  ? { type: "category", slug: value }
                  : { type: "page", slug: value };
              onChange({ ...item, target });
            }}
            options={destinationChoices}
            placeholder="Choose destination"
          />
        </Field>
      )}
      {item.target.type === "external" ? (
        <Switch checked={item.openInNewTab} onChange={(openInNewTab) => onChange({ ...item, openInNewTab })} label="Open in a new tab" />
      ) : null}
    </div>
  );
}

function NavigationItemEditor({
  item,
  data,
  title,
  index,
  count,
  depth = 0,
  onChange,
  onMove,
  onRemove,
  onAddChild,
}: {
  item: AdminNavigationItem;
  data: AdminNavigationData;
  title: string;
  index: number;
  count: number;
  depth?: number;
  onChange: (item: AdminNavigationItem) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onAddChild?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleChildren = item.children.filter((child) => child.enabled).length;

  return (
    <div className={`rv-navigation-item${depth ? " rv-navigation-item--child" : ""}`}>
      <div className="rv-navigation-item__heading">
        <button
          className="rv-navigation-item__toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="rv-navigation-item__index">{title} {index + 1}</span>
          <span className="rv-navigation-item__summary">
            <strong>{item.labelEn || "Untitled link"}</strong>
            <span>
              {targetSummary(item, data)}
              {item.children.length ? <i aria-hidden="true"> · {visibleChildren} of {item.children.length} submenu links visible</i> : null}
            </span>
          </span>
          <span className={`rv-navigation-item__visibility${item.enabled ? " is-visible" : ""}`}>
            {item.enabled ? "Visible" : "Hidden"}
          </span>
          <span className="rv-navigation-item__chevron" aria-hidden="true">⌄</span>
        </button>
        <div className="rv-navigation-item__actions" role="group" aria-label={`Actions for ${item.labelEn || "menu item"}`}>
          <Button className="rv-navigation-move" size="sm" disabled={index === 0} aria-label={`Move ${item.labelEn} up`} onClick={() => onMove(-1)}>↑</Button>
          <Button className="rv-navigation-move" size="sm" disabled={index === count - 1} aria-label={`Move ${item.labelEn} down`} onClick={() => onMove(1)}>↓</Button>
          <Button size="sm" variant="danger" onClick={onRemove}>Remove</Button>
        </div>
      </div>
      {expanded ? (
        <div className="rv-navigation-item__details">
          <div className="rv-navigation-item__fields">
            <Field label="Label (English)">
              <TextInput value={item.labelEn} onChange={(labelEn) => onChange({ ...item, labelEn })} placeholder="Shop" />
            </Field>
            <Field label="Label (Bahasa Indonesia)">
              <TextInput value={item.labelId} onChange={(labelId) => onChange({ ...item, labelId })} placeholder="Belanja" />
            </Field>
            <TargetFields item={item} data={data} onChange={onChange} />
          </div>
          <div className="rv-navigation-item__footer">
            <Switch checked={item.enabled} onChange={(enabled) => onChange({ ...item, enabled })} label="Show in storefront navigation" />
            {onAddChild ? <Button size="sm" onClick={onAddChild}>Add submenu link</Button> : null}
          </div>
          {item.children.length ? (
            <div className="rv-navigation-children">
              {item.children.map((child, childIndex) => (
                <NavigationItemEditor
                  key={child.id}
                  item={child}
                  data={data}
                  title="Submenu"
                  index={childIndex}
                  count={item.children.length}
                  depth={1}
                  onChange={(updatedChild) => onChange({
                    ...item,
                    children: item.children.map((candidate) => candidate.id === child.id ? updatedChild : candidate),
                  })}
                  onMove={(direction) => onChange({ ...item, children: moveItem(item.children, childIndex, direction) })}
                  onRemove={() => onChange({ ...item, children: item.children.filter((candidate) => candidate.id !== child.id) })}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function NavigationSettingsPage() {
  const state: ApiState<AdminNavigationData> = useApi<AdminNavigationData>("/api/admin/navigation");
  const [items, setItems] = useState<AdminNavigationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewOpenItemId, setPreviewOpenItemId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (state.data) setItems(state.data.items);
  }, [state.data]);

  const updateItem = (item: AdminNavigationItem) => setItems((current) => updateById(current, item.id, () => item));

  const save = async () => {
    if (!items.some((item) => item.enabled)) {
      toast.error("Keep at least one top-level menu item visible.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiFetch<AdminNavigationData>("/api/admin/navigation", { method: "PATCH", json: { items } });
      setItems(result.items);
      state.setData(result);
      toast.success("Navigation saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const data = state.data;
  const visiblePreviewItems = items.filter((item) => item.enabled);
  const firstPreviewSubmenu = visiblePreviewItems.find((item) => item.children.some((child) => child.enabled));
  const openPreviewItemId = previewOpenItemId === undefined ? firstPreviewSubmenu?.id : previewOpenItemId;
  const openPreviewItem = visiblePreviewItems.find((item) => item.id === openPreviewItemId && item.children.some((child) => child.enabled));
  const previewLabel = (item: AdminNavigationItem) => item.labelEn;

  return (
    <>
      <PageHeader
        title="Navigation"
        subtitle="Manage the English storefront menu, submenu links, and destinations."
        actions={
          <div className="rv-inline">
            <Button onClick={state.refresh} disabled={state.loading}>Refresh</Button>
            <Button variant="primary" loading={busy} disabled={!data} onClick={save}>Save changes</Button>
          </div>
        }
      />

      <div className="rv-content rv-navigation-content">
        {state.loading && !data ? <Card><Loading label="Loading navigation…" /></Card> : null}
        {state.error ? <Card title="Could not load navigation"><p className="rv-error-text">{state.error}</p></Card> : null}

        {data ? (
          <>
              <Card title="Storefront preview" description="Select a menu item with a submenu to inspect its dropdown before saving.">
              <div className="rv-navigation-preview-controls">
                <div className="rv-inline">
                  <Button size="sm" ariaPressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}>Desktop</Button>
                  <Button size="sm" ariaPressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")}>Mobile</Button>
                </div>
              </div>
              <div className={`rv-navigation-preview rv-navigation-preview--${previewDevice}`}>
                <div className="rv-navigation-preview__brand">
                  <Image src="/brand/rendi-virgo-primary.webp" alt="RENDI VIRGO" width={780} height={260} sizes="148px" />
                </div>
                <nav className="rv-navigation-preview__nav" aria-label="Navigation preview">
                  {visiblePreviewItems.map((item) => {
                    const hasChildren = item.children.some((child) => child.enabled);
                    const label = previewLabel(item);
                    const isOpen = openPreviewItem?.id === item.id;
                    return (
                      <div className={`rv-navigation-preview__item${isOpen ? " is-open" : ""}`} key={item.id}>
                        {hasChildren ? (
                          <button
                            className="rv-navigation-preview__link"
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls="rv-navigation-preview-submenu"
                            onClick={() => setPreviewOpenItemId(isOpen ? null : item.id)}
                          >
                            <span>{label}</span><ChevronDown size={13} strokeWidth={1.7} aria-hidden="true" />
                          </button>
                        ) : <span className="rv-navigation-preview__link">{label}</span>}
                      </div>
                    );
                  })}
                </nav>
                <div className="rv-navigation-preview__actions" aria-hidden="true">
                  <span><Search size={16} strokeWidth={1.6} /></span>
                  <span><Heart size={16} strokeWidth={1.6} /></span>
                  <span><ShoppingBag size={16} strokeWidth={1.6} /></span>
                </div>
                {openPreviewItem ? (
                  <div className="rv-navigation-preview__submenu" id="rv-navigation-preview-submenu">
                    <div className="rv-navigation-preview__submenu-heading">
                      <div>
                        <span>{openPreviewItem.target.type === "route" && openPreviewItem.target.route === "shop" ? "SHOP CATEGORIES" : "SUBMENU"}</span>
                        <strong>{previewLabel(openPreviewItem)}</strong>
                      </div>
                      <Sparkles size={17} strokeWidth={1.6} aria-hidden="true" />
                    </div>
                    <div className="rv-navigation-preview__children">
                      {openPreviewItem.children.filter((child) => child.enabled).map((child) => (
                        <div key={child.id}><span>{previewLabel(child)}</span><ArrowUpRight size={13} strokeWidth={1.6} aria-hidden="true" /></div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            <Card
              title="Primary navigation"
              description="Use the arrows to set menu order. Expand an item to edit labels, destinations, and submenu links."
              actions={<span className="rv-navigation-count">{items.length} items <i aria-hidden="true">·</i> {items.filter((item) => item.enabled).length} visible</span>}
            >
              <div className="rv-navigation-list">
                {items.map((item, index) => (
                  <NavigationItemEditor
                    key={item.id}
                    item={item}
                    data={data}
                    title="Menu item"
                    index={index}
                    count={items.length}
                    onChange={updateItem}
                    onMove={(direction) => setItems((current) => moveItem(current, index, direction))}
                    onRemove={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                    onAddChild={item.children.length < 16
                      ? () => updateItem({ ...item, children: [...item.children, newSubmenuItem(data)] })
                      : undefined}
                  />
                ))}
              </div>
              <div className="rv-navigation-add">
                <Button disabled={items.length >= 16} onClick={() => setItems((current) => [...current, newItem()])}>Add menu item</Button>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
