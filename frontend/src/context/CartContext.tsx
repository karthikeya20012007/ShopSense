import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Product, CartItem } from '../types';
import { useAuth, onAuthLogout } from './AuthContext';
import {
  GUEST_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  ACTIVE_CART_KEY_POINTER,
  getCartStorageKey,
  loadCartFromStorage,
  saveCartToStorage,
  clearCartStorage,
  clearSessionCartStorage,
} from '../utils/cartStorage';

export {
  GUEST_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  ACTIVE_CART_KEY_POINTER,
  getCartStorageKey,
  loadCartFromStorage,
  saveCartToStorage,
  clearCartStorage,
  clearSessionCartStorage,
};

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  resetCartOnLogout: () => void;
  totalItems: number;
  cartSubtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const currentUserId = user?.id ?? null;

  // Hydrate initial items from localStorage
  // Prioritizes the active cart key pointer from before refresh to prevent UI count flicker
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const activeKey = localStorage.getItem(ACTIVE_CART_KEY_POINTER);
      if (activeKey) {
        const loaded = loadCartFromStorage(activeKey);
        if (loaded.length > 0) return loaded;
      }
      const guestItems = loadCartFromStorage(GUEST_STORAGE_KEY);
      if (guestItems.length > 0) return guestItems;

      const legacyItems = loadCartFromStorage(LEGACY_STORAGE_KEY);
      if (legacyItems.length > 0) return legacyItems;

      return [];
    } catch {
      return [];
    }
  });

  const isHydratedRef = useRef<boolean>(false);
  const lastUserIdRef = useRef<string | null | undefined>(undefined);
  const isLoggingOutRef = useRef<boolean>(false);

  // Synchronize cart with authentication lifecycle, login, and user switching
  useEffect(() => {
    // CRITICAL: Do NOT switch or clear carts while auth is in its initial loading state
    if (isLoading) {
      return;
    }

    // Initial auth resolution on mount / page refresh
    if (lastUserIdRef.current === undefined) {
      lastUserIdRef.current = currentUserId;

      if (currentUserId !== null) {
        // Authenticated customer: restore their saved scoped cart
        const userKey = getCartStorageKey(currentUserId);
        const userItems = loadCartFromStorage(userKey);
        setItems(userItems);
        try {
          localStorage.setItem(ACTIVE_CART_KEY_POINTER, userKey);
        } catch {
          // Ignore
        }
      } else {
        // Unauthenticated guest user: ensure active pointer did not belong to a previous customer
        const activeKey = localStorage.getItem(ACTIVE_CART_KEY_POINTER);
        if (activeKey && activeKey !== GUEST_STORAGE_KEY) {
          // Active pointer belonged to an authenticated customer whose session expired:
          // Do NOT expose customer's cart to unauthenticated guest
          setItems([]);
          localStorage.removeItem(ACTIVE_CART_KEY_POINTER);
        } else {
          setItems(loadCartFromStorage(GUEST_STORAGE_KEY));
        }
      }

      isHydratedRef.current = true;
      return;
    }

    // Handle user identity changes (login, switch account, or logout)
    if (lastUserIdRef.current !== currentUserId) {
      lastUserIdRef.current = currentUserId;

      // Temporarily pause persistence effect to avoid writing stale items to the new key
      isHydratedRef.current = false;

      if (currentUserId === null) {
        // User logged out: clear in-memory cart and clean session pointer
        // (User's scoped cart key is PRESERVED in localStorage so they can recover it on login)
        setItems([]);
        clearSessionCartStorage();
      } else {
        // Customer logged in or switched account: load that customer's cart
        const newKey = getCartStorageKey(currentUserId);
        const loaded = loadCartFromStorage(newKey);
        setItems(loaded);
        try {
          localStorage.setItem(ACTIVE_CART_KEY_POINTER, newKey);
        } catch {
          // Ignore
        }
      }

      isHydratedRef.current = true;
    }
  }, [currentUserId, isLoading]);

  // Explicit logout handler: clears in-memory cart, resets count to 0,
  // removes active session pointer, and preserves user's scoped cart in localStorage
  const resetCartOnLogout = useCallback(() => {
    isLoggingOutRef.current = true;
    isHydratedRef.current = false;
    setItems([]);
    clearSessionCartStorage();
    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 50);
  }, []);

  // Listen for explicit logout events dispatched by AuthContext
  useEffect(() => {
    const unsubscribe = onAuthLogout(() => {
      resetCartOnLogout();
    });
    return unsubscribe;
  }, [resetCartOnLogout]);

  // Persist cart items to localStorage on user modifications
  useEffect(() => {
    // CRITICAL: Do NOT write to localStorage if auth is loading or during logout/hydration transitions!
    if (isLoading || !isHydratedRef.current || isLoggingOutRef.current) {
      return;
    }

    // Extra safety: only persist when current user matches the last resolved user
    if (lastUserIdRef.current !== currentUserId) {
      return;
    }

    const key = getCartStorageKey(currentUserId);
    try {
      if (items.length > 0) {
        saveCartToStorage(key, items);
        localStorage.setItem(ACTIVE_CART_KEY_POINTER, key);
      } else {
        localStorage.removeItem(key);
        if (!currentUserId) {
          localStorage.removeItem(ACTIVE_CART_KEY_POINTER);
        }
      }
    } catch {
      // Ignore write errors
    }
  }, [items, currentUserId, isLoading]);

  const addToCart = (product: Product, quantity: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, product.stock_quantity);
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      } else {
        const initialQty = Math.min(quantity, product.stock_quantity);
        if (initialQty <= 0) return prev;
        return [...prev, { product, quantity: initialQty }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const cappedQty = Math.min(quantity, item.product.stock_quantity);
          return { ...item, quantity: cappedQty };
        }
        return item;
      })
    );
  };

  // Explicit user cart clear (e.g. from CartPage button or after checkout)
  const clearCart = useCallback(() => {
    setItems([]);
    const key = getCartStorageKey(currentUserId);
    clearCartStorage(key);
  }, [currentUserId]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const cartSubtotal = items.reduce((sum, item) => {
    const price =
      typeof item.product.price === 'number'
        ? item.product.price
        : parseFloat(item.product.price as string) || 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        resetCartOnLogout,
        totalItems,
        cartSubtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
