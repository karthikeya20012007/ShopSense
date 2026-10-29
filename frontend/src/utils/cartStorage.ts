import type { CartItem } from '../types';

export const GUEST_STORAGE_KEY = 'shopsense_cart_guest';
export const LEGACY_STORAGE_KEY = 'shopsense_cart';
export const ACTIVE_CART_KEY_POINTER = 'shopsense_current_cart_key';

/**
 * Returns the storage key scoped to a specific customer, or the guest key if unauthenticated.
 */
export const getCartStorageKey = (userId?: string | null): string => {
  if (userId && typeof userId === 'string' && userId.trim()) {
    return `shopsense_cart_${userId.trim()}`;
  }
  return GUEST_STORAGE_KEY;
};

/**
 * Safely parse cart items from localStorage without throwing errors.
 */
export const loadCartFromStorage = (storageKey: string): CartItem[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        Boolean(item) &&
        Boolean(item.product) &&
        typeof item.product.id === 'string' &&
        typeof item.quantity === 'number' &&
        item.quantity > 0
    );
  } catch {
    return [];
  }
};

/**
 * Persist cart items to localStorage under the given storage key.
 */
export const saveCartToStorage = (storageKey: string, items: CartItem[]): void => {
  try {
    if (items.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // Ignore localStorage write failures
  }
};

/**
 * Explicit user cart clear (e.g. clicking 'Clear Cart' on the Cart page or completing checkout).
 * This completely wipes the items from the user's storage key.
 */
export const clearCartStorage = (storageKey: string): void => {
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(ACTIVE_CART_KEY_POINTER);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage deletion errors
  }
};

/**
 * Session logout cart clearing.
 * Clears the active session pointer and guest/legacy keys,
 * but PRESERVES the customer's user-scoped cart key so they can restore it on their next login.
 */
export const clearSessionCartStorage = (): void => {
  try {
    localStorage.removeItem(ACTIVE_CART_KEY_POINTER);
    localStorage.removeItem(GUEST_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage deletion errors
  }
};
