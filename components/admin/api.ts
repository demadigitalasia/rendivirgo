"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ApiErrorPayload = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorPayload;

  constructor(message: string, status: number, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export function apiUrl(path: string, params?: QueryParams): string {
  const base = path.startsWith("/api") ? path : `/api/${path.replace(/^\//, "")}`;
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
  body?: BodyInit;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers = new Headers();
  let body = options.body;

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  const response = await fetch(apiUrl(path), {
    method: options.method ?? (options.json !== undefined ? "POST" : "GET"),
    headers,
    body,
    signal: options.signal,
    credentials: "same-origin",
  });

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => "");

  if (!response.ok) {
    const errorPayload = (isJson ? payload : { message: String(payload) }) as ApiErrorPayload;
    const rawMessage = errorPayload?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(", ") : (rawMessage ?? `Request failed with status ${response.status}`);
    throw new ApiError(message, response.status, errorPayload);
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
  setData: (updater: T | ((current: T | null) => T | null)) => void;
};

export function useApi<T>(path: string | null, options?: { enabled?: boolean }): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [version, setVersion] = useState(0);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    apiFetch<T>(path, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((caught) => {
        if ((caught as Error).name === "AbortError") return;
        setError(errorMessage(caught));
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [path, enabled, version]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  return { data, error, loading, refresh, setData };
}

export type ListParams = QueryParams & { page?: number; pageSize?: number };

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function useList<T>(path: string, initialParams: ListParams = {}) {
  const [params, setParams] = useState<ListParams>({ page: 1, pageSize: 20, ...initialParams });
  const [searchInput, setSearchInput] = useState(String(initialParams.search ?? ""));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setParams((current) => (current.search === searchInput ? current : { ...current, search: searchInput || undefined, page: 1 }));
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const url = useMemo(() => apiUrl(path, params), [path, params]);
  const state = useApi<PaginatedResponse<T>>(url);

  const update = useCallback((patch: ListParams) => {
    setParams((current) => ({ ...current, ...patch }));
  }, []);

  return {
    ...state,
    params,
    update,
    searchInput,
    setSearchInput,
    setPage: (page: number) => update({ page }),
    reset: () => {
      setSearchInput("");
      setParams({ page: 1, pageSize: 20, ...initialParams });
    },
  };
}

export const formatUSD = (amount: number | null | undefined, options?: { maximumFractionDigits?: number }) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(Number(amount ?? 0));

export const formatNumber = (value: number | null | undefined) => new Intl.NumberFormat("en-US").format(Number(value ?? 0));

export const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const toDateInputValue = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const toDateTimeInputValue = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};
