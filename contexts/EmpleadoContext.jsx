'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const EmpleadoContext = createContext(null);

export function EmpleadoProvider({ children }) {
  const [session,  setSession]  = useState(undefined); // undefined = sin resolver
  const [empleado, setEmpleado] = useState(undefined); // undefined = sin resolver
  const [verificando, setVerificando] = useState(true); // true mientras cualquier cosa está pendiente

  useEffect(() => {
    // Carga inicial de sesión
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    // Escuchar cambios de sesión (login / logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Mientras la sesión aún no se resolvió, no hacer nada
    if (session === undefined) return;

    // Sin sesión → no hay empleado que buscar
    if (session === null) {
      setEmpleado(null);
      setVerificando(false);
      return;
    }

    // Hay sesión → buscar la fila del empleado
    setVerificando(true);
    supabase
      .from('empleados')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('activo', true)
      .single()
      .then(({ data, error }) => {
        // error aquí significa "no encontrado" (PGRST116) o error real
        // en ambos casos, el usuario no tiene acceso al panel
        setEmpleado(error ? null : data);
        setVerificando(false);
      });
  }, [session]);

  function puede(recurso, accion) {
    if (!empleado) return false;
    if (empleado.rol === 'dueño') return true;
    return Boolean(empleado?.permisos?.[recurso]?.[accion]);
  }

  async function cerrarSesion() {
    setEmpleado(undefined);
    setVerificando(true);
    await supabase.auth.signOut();
  }

  // cargando es true mientras cualquiera de las dos verificaciones esté pendiente
  const cargando = verificando || session === undefined || (session !== null && empleado === undefined);

  return (
    <EmpleadoContext.Provider value={{ session, empleado, puede, cerrarSesion, cargando }}>
      {children}
    </EmpleadoContext.Provider>
  );
}

export function useEmpleado() {
  const ctx = useContext(EmpleadoContext);
  if (!ctx) throw new Error('useEmpleado debe usarse dentro de <EmpleadoProvider>');
  return ctx;
}