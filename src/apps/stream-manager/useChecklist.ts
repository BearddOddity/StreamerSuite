import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CHECKLIST_LABELS, type ChecklistItem } from "./types";

const KEY = "streamersuite-stream-manager-checklist";

function defaultItems(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_LABELS.map((label, i) => ({ id: `default-${i}`, label, checked: false, custom: false }));
}

function load(): ChecklistItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : defaultItems();
  } catch {
    return defaultItems();
  }
}

export function useChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const toggle = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }, []);

  const addItem = useCallback((label: string) => {
    if (!label.trim()) return;
    setItems((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: label.trim(), checked: false, custom: true }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const resetForNewStream = useCallback(() => {
    setItems((prev) => prev.map((i) => ({ ...i, checked: false })));
  }, []);

  const checkedCount = items.filter((i) => i.checked).length;

  return { items, toggle, addItem, removeItem, resetForNewStream, checkedCount };
}
