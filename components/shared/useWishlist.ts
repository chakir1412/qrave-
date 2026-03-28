import { useMemo, useState, useCallback } from "react";
import type { MenuItem } from "./types";

export type WishlistEntry = { item: MenuItem; qty: number };

export function useWishlist() {
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [open, setOpen] = useState(false);

  const addToWishlist = useCallback((item: MenuItem, qty = 1) => {
    setEntries((prev) => {
      const i = prev.findIndex((x) => x.item.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { item, qty }];
    });
  }, []);

  const updateQty = useCallback((itemId: string, delta: number) => {
    setEntries((prev) => {
      const i = prev.findIndex((x) => x.item.id === itemId);
      if (i < 0) return prev;
      const next = [...prev];
      const newQty = next[i].qty + delta;
      if (newQty <= 0) return next.filter((_, j) => j !== i);
      next[i] = { ...next[i], qty: newQty };
      return next;
    });
  }, []);

  const removeFromWishlist = useCallback((itemId: string) => {
    setEntries((prev) => prev.filter((x) => x.item.id !== itemId));
  }, []);

  const clearWishlist = useCallback(() => setEntries([]), []);

  const itemCount = useMemo(
    () => entries.reduce((sum, x) => sum + x.qty, 0),
    [entries]
  );

  const totalPrice = useMemo(
    () => entries.reduce((sum, x) => sum + x.item.preis * x.qty, 0),
    [entries]
  );

  const openWishlist = useCallback(() => setOpen(true), []);
  const closeWishlist = useCallback(() => setOpen(false), []);

  const isInWishlist = useCallback(
    (itemId: string) => entries.some((e) => e.item.id === itemId),
    [entries]
  );

  return {
    entries,
    open,
    itemCount,
    totalPrice,
    addToWishlist,
    updateQty,
    removeFromWishlist,
    clearWishlist,
    openWishlist,
    closeWishlist,
    isInWishlist,
  };
}

