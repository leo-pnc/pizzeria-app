'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const CarritoCtx = createContext(null);
const STORAGE_KEY = 'donadrianos_carrito';

function cargarCarritoGuardado() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CarritoProvider({ children }) {
  const [items, setItems] = useState([]);
  const yaCargado = useRef(false);

  // Cargar carrito guardado al montar (solo en el cliente)
  useEffect(() => {
    setItems(cargarCarritoGuardado());
    yaCargado.current = true;
  }, []);

  // Guardar cada vez que cambia (evita pisar el storage antes de la carga inicial)
  useEffect(() => {
    if (!yaCargado.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Si falla (modo privado, storage lleno, etc.) seguimos sin persistencia
    }
  }, [items]);

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

  const vaciar = useCallback(() => {
    setItems([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

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