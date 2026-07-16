'ENDOFFILE'
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../../lib/supabaseClient';
import { useEmpleado } from '../../../../contexts/EmpleadoContext';

const MapaLocal = dynamic(() => import('./MapaLocal'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 280, background: '#f0ebe3', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a8f82', fontSize: 14 }}>
      Cargando mapa…
    </div>
  ),
});

export default function DeliveryPage() {
  const { puede, empleado } = useEmpleado();
  const puedeVer    = empleado.rol === 'dueño' || puede('configuracion', 'ver');
  const puedeEditar = empleado.rol === 'dueño' || puede('configuracion', 'editar');

  const [config, setConfig]         = useState(null);
  const [configOrig, setConfigOrig] = useState(null);
  const [guardando, setGuardando]   = useState(false);
  const [mensaje, setMensaje]       = useState(null);

  useEffect(() => { if (puedeVer) cargar(); }, [puedeVer]);

  async function cargar() {
    const { data } = await supabase.from('local_config').select('*').single();
    if (data) { setConfig(data); setConfigOrig(data); }
  }

  const cambioPrecioRadio = config && configOrig && (
    config.delivery_precio    !== configOrig.delivery_precio ||
    config.delivery_radio_km  !== configOrig.delivery_radio_km
  );

  const cambioUbicacion = config && configOrig && (
    config.latitud_local  !== configOrig.latitud_local ||
    config.longitud_local !== configOrig.longitud_local
  );

  function setMsg(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 3000);
  }

  async function guardarPrecioRadio(e) {
    e.preventDefault();
    setGuardando(true);
    const { error } = await supabase.from('local_config')
      .update({ delivery_precio: config.delivery_precio, delivery_radio_km: config.delivery_radio_km })
      .eq('id', config.id);
    setGuardando(false);
    if (!error) setConfigOrig(p => ({ ...p, delivery_precio: config.delivery_precio, delivery_radio_km: config.delivery_radio_km }));
    setMsg(error ? 'error' : 'ok', error ? error.message : 'Guardado.');
  }

  async function guardarUbicacion() {
    setGuardando(true);
    const { error } = await supabase.from('local_config')
      .update({ latitud_local: config.latitud_local, longitud_local: config.longitud_local })
      .eq('id', config.id);
    setGuardando(false);
    if (!error) setConfigOrig(p => ({ ...p, latitud_local: config.latitud_local, longitud_local: config.longitud_local }));
    setMsg(error ? 'error' : 'ok', error ? error.message : 'Ubicación del local guardada.');
  }

  if (!puedeVer) return <div className="sin-acceso">Sin permiso.</div>;
  if (!config)   return <div className="cargando">Cargando…</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin/configuracion">← Configuración</a>
      <header>
        <span className="eyebrow">Configuración</span>
        <h1>Delivery</h1>
      </header>

      {/* Precio y radio */}
      <section className="tarjeta">
        <h2>Precio y cobertura</h2>
        <form className="form" onSubmit={guardarPrecioRadio}>
          <label className="campo">
            <span>Precio fijo del envío ($)</span>
            <input
              type="number" min="0" step="0.01"
              value={config.delivery_precio}
              disabled={!puedeEditar}
              onChange={e => setConfig(p => ({ ...p, delivery_precio: e.target.value }))}
            />
          </label>
          <label className="campo">
            <span>Radio máximo de cobertura (km)</span>
            <input
              type="number" min="0" step="0.1"
              value={config.delivery_radio_km}
              disabled={!puedeEditar}
              onChange={e => setConfig(p => ({ ...p, delivery_radio_km: e.target.value }))}
            />
          </label>
          <p className="hint">Los pedidos fuera de este radio serán redirigidos a retiro por el local.</p>
          {puedeEditar && (
            <button type="submit" disabled={!cambioPrecioRadio || guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </form>
      </section>

      {/* Ubicación del local */}
      <section className="tarjeta">
        <h2>Ubicación del local</h2>
        <p className="hint" style={{ marginBottom: 14 }}>
          Mové el pin hasta la ubicación exacta del local. Esto se usa para calcular si los clientes están dentro del radio de delivery.
        </p>
        {puedeEditar ? (
          <>
            <MapaLocal
              lat={config.latitud_local}
              lng={config.longitud_local}
              radioKm={Number(config.delivery_radio_km)}
              onUbicar={(lat, lng) => setConfig(p => ({ ...p, latitud_local: lat, longitud_local: lng }))}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#9a8f82' }}>
                Lat: {Number(config.latitud_local).toFixed(6)} · Lng: {Number(config.longitud_local).toFixed(6)}
              </span>
              <button
                className="btn-guardar-ubic"
                disabled={!cambioUbicacion || guardando}
                onClick={guardarUbicacion}
              >
                {guardando ? 'Guardando…' : 'Guardar ubicación'}
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#9a8f82' }}>
            Lat: {config.latitud_local} · Lng: {config.longitud_local}
          </p>
        )}
        {mensaje && <p className={`aviso aviso-${mensaje.tipo}`} style={{ marginTop: 10 }}>{mensaje.texto}</p>}
      </section>

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 520px; margin: 0 auto 28px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 700; font-size: 26px; margin: 0; color: #1a1510; }
        .tarjeta { max-width: 520px; margin: 0 auto 20px; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 24px; }
        .tarjeta h2 { font-family: 'Fraunces', serif; font-size: 17px; margin: 0 0 16px; }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #9a8f82; }
        .campo input { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; }
        .campo input:focus-visible { border-color: #c1320a; box-shadow: 0 0 0 3px rgba(193,50,10,0.1); }
        .campo input:disabled { opacity: 0.5; }
        .hint { font-size: 12px; color: #b0a898; line-height: 1.5; margin: 0; }
        button[type='submit'] { background: #c1320a; color: #fff; border: none; border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; }
        button[type='submit']:disabled { opacity: 0.4; cursor: default; }
        .btn-guardar-ubic { background: #c1320a; color: #fff; border: none; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .btn-guardar-ubic:disabled { opacity: 0.4; cursor: default; }
        .aviso { font-size: 13px; padding: 10px 12px; border-radius: 8px; }
        .aviso-ok { background: rgba(107,113,86,0.1); border: 1px solid rgba(107,113,86,0.3); color: #2a7a4a; }
        .aviso-error { background: rgba(193,50,10,0.06); border: 1px solid rgba(193,50,10,0.2); color: #c1320a; }
        .cargando, .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}