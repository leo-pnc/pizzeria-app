'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useEmpleado } from '../../../contexts/EmpleadoContext';

const ICONOS = {
  estado: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  delivery: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  pagos: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  whatsapp: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
};

const SECCIONES = [
  { href: '/admin/configuracion/estado',   titulo: 'Estado y horarios',   desc: 'Abrí o cerrá el local y configurá los horarios por día', icono: 'estado' },
  { href: '/admin/configuracion/delivery', titulo: 'Delivery',            desc: 'Precio del envío y radio máximo de cobertura',          icono: 'delivery' },
  { href: '/admin/configuracion/pagos',    titulo: 'Métodos de pago',     desc: 'Activá o desactivá los medios de pago aceptados',       icono: 'pagos' },
  { href: '/admin/configuracion/whatsapp', titulo: 'WhatsApp de pedidos', desc: 'Número al que llegan los pedidos confirmados',          icono: 'whatsapp' },
];

export default function ConfiguracionPage() {
  const { puede, empleado } = useEmpleado();
  const puedeVer = empleado.rol === 'dueño' || puede('configuracion', 'ver');
  const [estadoActual, setEstadoActual] = useState(null);

  useEffect(() => {
    supabase.from('local_config').select('esta_abierto_manual').single()
      .then(({ data }) => { if (data) setEstadoActual(data.esta_abierto_manual); });
  }, []);

  if (!puedeVer) return <div className="sin-acceso">No tenés permiso para ver esta sección.</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin">← Volver al panel</a>

      <header>
        <span className="eyebrow">Panel interno</span>
        <h1>Configuración</h1>
      </header>

      {/* Badge de estado rápido */}
      {estadoActual !== null && (
        <div className={`estado-badge ${estadoActual === true ? 'abierto' : estadoActual === false ? 'cerrado' : 'auto'}`}>
          <span className="estado-dot" />
          {estadoActual === true ? 'Local forzado abierto' : estadoActual === false ? 'Local forzado cerrado' : 'Estado automático según horario'}
          <a href="/admin/configuracion/estado" className="estado-cambiar">Cambiar</a>
        </div>
      )}

      <div className="grilla">
        {SECCIONES.map((s) => (
          <a key={s.href} href={s.href} className="tarjeta">
            <span className="tarjeta-icono">{ICONOS[s.icono]}</span>
            <div className="tarjeta-texto">
              <h2>{s.titulo}</h2>
              <p>{s.desc}</p>
            </div>
            <span className="tarjeta-flecha">→</span>
          </a>
        ))}
      </div>

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 640px; margin: 0 auto 24px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 700; font-size: 26px; margin: 0; color: #1a1510; }

        .estado-badge { max-width: 640px; margin: 0 auto 20px; display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #ede8e0; border-radius: 10px; padding: 12px 16px; font-size: 13px; }
        .estado-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .abierto { color: #a8d5a8; }
        .abierto .estado-dot { background: #6b9c6b; }
        .cerrado { color: #d5a8a8; }
        .cerrado .estado-dot { background: #9c3a3a; }
        .auto { color: #9a8f82; }
        .auto .estado-dot { background: #8a9070; }
        .estado-cambiar { margin-left: auto; color: #c1440e; text-decoration: none; font-size: 12px; font-weight: 600; flex-shrink: 0; }

        .grilla { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }

        .tarjeta { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid #ede8e0; border-radius: 12px; padding: 18px 20px; text-decoration: none; color: inherit; transition: border-color 0.15s, transform 0.15s; }
        .tarjeta:hover { border-color: #c1320a; transform: translateX(2px); }
        .tarjeta-icono { flex-shrink: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #c1440e; }
        .tarjeta-texto { flex: 1; }
        .tarjeta-texto h2 { font-family: 'Fraunces', serif; font-size: 16px; margin: 0 0 3px; }
        .tarjeta-texto p { font-size: 13px; color: #9a8f82; margin: 0; line-height: 1.4; }
        .tarjeta-flecha { color: #3a3128; font-size: 18px; flex-shrink: 0; transition: color 0.15s; }
        .tarjeta:hover .tarjeta-flecha { color: #c1440e; }

        .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}