'use client';

import { useEffect, useState } from 'react';
import { useEmpleado } from '../../contexts/EmpleadoContext';
import { supabase } from '../../lib/supabaseClient';

const SECCIONES = [
  {
    id: 'pedidos',
    titulo: 'Pedidos',
    descripcion: 'Pedidos en tiempo real',
    href: '/admin/pedidos',
    icono: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
    color: '#c1320a',
    bg: 'rgba(193,50,10,0.08)',
  },
  {
    id: 'catalogo',
    titulo: 'Catálogo',
    descripcion: 'Productos y promociones',
    href: '/admin/catalogo',
    icono: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
    color: '#b07d2a',
    bg: 'rgba(176,125,42,0.08)',
  },
  {
    id: 'configuracion',
    titulo: 'Configuración',
    descripcion: 'Horarios, delivery y pagos',
    href: '/admin/configuracion',
    icono: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    color: '#2a7a4a',
    bg: 'rgba(42,122,74,0.08)',
  },
];

export default function AdminDashboard() {
  const { empleado, cerrarSesion, puede } = useEmpleado();
  const esDueño = empleado.rol === 'dueño';
  const [estadoLocal, setEstadoLocal] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.from('local_config').select('esta_abierto_manual').single()
      .then(({ data }) => { if (data) setEstadoLocal(data.esta_abierto_manual); });
  }, []);

  const seccionesVisibles = SECCIONES.filter(s => esDueño || puede(s.id, 'ver'));

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  const localAbierto = estadoLocal === true || estadoLocal === null;

  return (
    <div className={`pagina ${mounted ? 'mounted' : ''}`}>

      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-marca">
          <div className={`estado-dot ${localAbierto ? 'abierto' : 'cerrado'}`}>
            <div className="estado-dot-inner" />
            {localAbierto && <div className="estado-dot-ring" />}
          </div>
          <span className="header-estado">
            {estadoLocal === null ? 'Automático' : estadoLocal ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
        <button className="btn-salir" onClick={cerrarSesion} title="Cerrar sesión" aria-label="Cerrar sesión">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      {/* ── BIENVENIDA ── */}
      <section className="bienvenida">
        <p className="saludo">{saludo}</p>
        <h1 className="nombre">{empleado.nombre}</h1>
        <span className="rol-badge">{esDueño ? 'Propietario' : 'Empleado'}</span>
      </section>

      {/* ── TARJETAS ── */}
      <div className="lista">

        {esDueño && (
          <a className="tarjeta tarjeta-empleados" href="/admin/empleados" style={{ '--delay': '0ms' }}>
            <div className="tarjeta-icono-wrap" style={{ background: 'rgba(80,80,100,0.07)', color: '#6b6b8a' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="tarjeta-texto">
              <h2>Empleados</h2>
              <p>Cuentas y permisos del equipo</p>
            </div>
            <div className="tarjeta-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </a>
        )}

        {seccionesVisibles.map((s, i) => (
          <a
            key={s.id}
            className="tarjeta"
            href={s.href}
            style={{ '--delay': `${(i + (esDueño ? 1 : 0)) * 60}ms` }}
          >
            <div className="tarjeta-icono-wrap" style={{ background: s.bg, color: s.color }}>
              {s.icono}
            </div>
            <div className="tarjeta-texto">
              <h2>{s.titulo}</h2>
              <p>{s.descripcion}</p>
            </div>
            <div className="tarjeta-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </a>
        ))}

        {seccionesVisibles.length === 0 && !esDueño && (
          <div className="sin-permisos">
            <p>Tu cuenta no tiene acceso a ninguna sección todavía.</p>
            <p>Pedile al dueño que te asigne permisos.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&display=swap');

        /* ── BASE ── */
        .pagina {
          min-height: 100vh;
          background: #f7f5f2;
          color: #1a1510;
          font-family: 'Work Sans', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ── HEADER ── */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          background: #fff;
          border-bottom: 1px solid #ede8e0;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .header-marca {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Punto de estado animado */
        .estado-dot {
          position: relative;
          width: 12px;
          height: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .estado-dot-inner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          position: relative;
          z-index: 2;
          transition: background 0.4s ease;
        }

        .abierto .estado-dot-inner {
          background: #2a7a4a;
          box-shadow: 0 0 0 0 rgba(42,122,74,0.4);
          animation: latido 2.4s ease-in-out infinite;
        }

        .cerrado .estado-dot-inner {
          background: #c1320a;
        }

        .estado-dot-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: rgba(42,122,74,0.15);
          animation: expandir 2.4s ease-in-out infinite;
          z-index: 1;
        }

        @keyframes latido {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(42,122,74,0.4); }
          50%       { transform: scale(1.1); box-shadow: 0 0 0 5px rgba(42,122,74,0); }
        }

        @keyframes expandir {
          0%   { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2);   opacity: 0; }
        }

        .header-estado {
          font-size: 13px;
          font-weight: 500;
          color: #6b6259;
        }

        .btn-salir {
          background: #f0ebe3;
          border: 1px solid #e4ddd3;
          color: #9a8f82;
          border-radius: 8px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }

        .btn-salir:hover {
          background: #fde8e3;
          border-color: #f0c4b8;
          color: #c1320a;
        }

        /* ── BIENVENIDA ── */
        .bienvenida {
          padding: 36px 24px 28px;
          max-width: 520px;
          margin: 0 auto;
          width: 100%;
          animation: fadeDown 0.5s ease both;
        }

        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .saludo {
          font-size: 14px;
          color: #9a8f82;
          margin: 0 0 4px;
        }

        .nombre {
          font-family: 'Fraunces', serif;
          font-size: 30px;
          font-weight: 700;
          color: #1a1510;
          margin: 0 0 10px;
          line-height: 1.1;
        }

        .rol-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9a8f82;
          background: #ede8e0;
          border-radius: 20px;
          padding: 3px 10px;
        }

        /* ── LISTA ── */
        .lista {
          padding: 8px 16px 48px;
          max-width: 520px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* ── TARJETA ── */
        .tarjeta {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #fff;
          border: 1px solid #ede8e0;
          border-radius: 16px;
          padding: 16px 18px;
          text-decoration: none;
          color: inherit;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
          opacity: 0;
          transform: translateY(10px);
        }

        .mounted .tarjeta {
          animation: slideUp 0.45s ease both;
          animation-delay: var(--delay, 0ms);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .tarjeta:hover {
          box-shadow: 0 6px 24px rgba(0,0,0,0.09);
          transform: translateY(-2px);
          border-color: #ddd6cc;
        }

        .tarjeta-empleados {
          border-color: #e8e4f0;
        }

        .tarjeta-icono-wrap {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s;
        }

        .tarjeta:hover .tarjeta-icono-wrap {
          transform: scale(1.06);
        }

        .tarjeta-texto {
          flex: 1;
          min-width: 0;
        }

        .tarjeta-texto h2 {
          font-family: 'Fraunces', serif;
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 3px;
          color: #1a1510;
        }

        .tarjeta-texto p {
          font-size: 12px;
          color: #9a8f82;
          margin: 0;
        }

        .tarjeta-arrow {
          color: #ccc5bb;
          flex-shrink: 0;
          transition: color 0.2s, transform 0.2s;
        }

        .tarjeta:hover .tarjeta-arrow {
          color: #9a8f82;
          transform: translateX(3px);
        }

        /* Sin permisos */
        .sin-permisos {
          padding: 32px 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sin-permisos p {
          font-size: 14px;
          color: #9a8f82;
          margin: 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}