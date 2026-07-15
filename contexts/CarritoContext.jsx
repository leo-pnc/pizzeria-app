'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const CarritoCtx = createContext(null);

export function CarritoProvider({ children }) {
  const [items, setItems] = useState([]);

  // key única por producto+variante+promo
  function keyItem(item) {
    return `${item.tipo}_${item.id}_${item.variante_id || ''}`;
  }

  const agregar = useCallback((item) => {
    setItems((prev) => {
      const k = keyItem(item);
      const existe = prev.find((i) => keyItem(i) === k);
      if (existe) {
        return prev.map((i) => keyItem(i) === k ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { ...item, cantidad: 1 }];
    });
  }, []);

  const quitar = useCallback((item) => {
    setItems((prev) => {
      const k = keyItem(item);
      const existe = prev.find((i) => keyItem(i) === k);
      if (!existe) return prev;
      if (existe.cantidad <= 1) return prev.filter((i) => keyItem(i) !== k);
      return prev.map((i) => keyItem(i) === k ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  }, []);

  const vaciar = useCallback(() => setItems([]), []);

  const cantidad = items.reduce((s, i) => s + i.cantidad, 0);
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  return (
    <CarritoCtx.Provider value={{ items, agregar, quitar, vaciar, cantidad, subtotal }}>
      {children}
    </CarritoCtx.Provider>
  );
}

export function useCarrito() {
  const ctx = useContext(CarritoCtx);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>');
  return ctx;
}