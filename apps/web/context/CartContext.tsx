'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  billingType: string;
  specs?: Record<string, any>;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  totalCount: number;
  totalPrice: number;
  proceedToCheckout: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('stx_web_cart');
      if (saved) setItems(JSON.parse(saved));
    } catch {
      // Ignore parse error
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('stx_web_cart', JSON.stringify(items));
    } catch {
      // Ignore quota error
    }
  }, [items]);

  const addItem = (newItem: Omit<CartItem, 'quantity'>) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.id === newItem.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [...prev, { ...newItem, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const proceedToCheckout = () => {
    const dashboardBase = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
    if (items.length === 0) return;
    const firstItem = items[0];
    const planIds = items.map((i) => i.id).join(',');
    const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const targetUrl = `${dashboardBase}/orders?planId=${encodeURIComponent(firstItem.id)}&planIds=${encodeURIComponent(planIds)}&price=${totalPrice}`;
    window.location.href = targetUrl;
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        cartOpen,
        setCartOpen,
        totalCount,
        totalPrice,
        proceedToCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
