"use client";

import { useEffect, useState } from "react";

export type ToastTone = "info" | "success" | "error";

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(items);
}

function push(message: string, tone: ToastTone) {
  const id = nextId++;
  items = [...items, { id, message, tone }];
  emit();
  setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    emit();
  }, 4200);
}

export const toast = {
  info: (message: string) => push(message, "info"),
  success: (message: string) => push(message, "success"),
  error: (message: string) => push(message, "error"),
};

export function Toaster() {
  const [current, setCurrent] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (next) => setCurrent(next);
    listeners.add(listener);
    listener(items);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (!current.length) return null;

  return (
    <div className="rv-toaster" role="status" aria-live="polite">
      {current.map((item) => (
        <div key={item.id} className={`rv-toast rv-toast--${item.tone}`}>
          {item.message}
        </div>
      ))}
    </div>
  );
}
