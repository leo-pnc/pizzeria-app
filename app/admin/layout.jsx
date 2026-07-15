'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { EmpleadoProvider, useEmpleado } from '../../contexts/EmpleadoContext';

function Guardia({ children }) {
  const { session, empleado, cargando } = useEmpleado();
  const pathname    = usePathname();
  const router      = useRouter();
  const esPaginaLogin = pathname === '/admin/login';

  useEffect(() => {
    // Mientras carga, no hacer nada — evita el falso "sin acceso"
    if (cargando) return;

    // Sin sesión y no estamos en el login → mandar al login
    if (!session && !esPaginaLogin) {
      router.replace('/admin/login');
      return;
    }

    // Hay sesión pero el usuario no tiene fila en "empleados" → no autorizado
    if (session && empleado === null && !esPaginaLogin) {
      router.replace('/admin/login?error=sin-acceso');
    }
  }, [cargando, session, empleado, esPaginaLogin, router]);

  // Siempre mostrar el login directamente, sin pantalla de carga
  if (esPaginaLogin) return children;

  // Mientras verifica sesión o carga el empleado → pantalla de carga neutral
  if (cargando || !session || !empleado) {
    return (
      <div className="admin-cargando">
        <div className="spinner" />
        <style jsx>{`
          .admin-cargando {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f7f5f2;
          }
          .spinner {
            width: 28px;
            height: 28px;
            border: 2.5px solid #e4ddd3;
            border-top-color: #c1320a;
            border-radius: 50%;
            animation: girar 0.7s linear infinite;
          }
          @keyframes girar {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return children;
}

export default function AdminLayout({ children }) {
  return (
    <EmpleadoProvider>
      <Guardia>{children}</Guardia>
    </EmpleadoProvider>
  );
}