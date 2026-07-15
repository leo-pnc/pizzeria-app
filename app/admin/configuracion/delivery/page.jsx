'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { useEmpleado } from '../../../../contexts/EmpleadoContext';

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

  const cambio = config && configOrig && (
    config.delivery_precio !== configOrig.delivery_precio ||
    config.delivery_radio_km !== configOrig.delivery_radio_km
  );

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    const { error } = await supabase.from('local_config')
      .update({ delivery_precio: config.delivery_precio, delivery_radio_km: config.delivery_radio_km })
      .eq('id', config.id);
    setGuardando(false);
    if (!error) setConfigOrig(p => ({ ...p, delivery_precio: config.delivery_precio, delivery_radio_km: config.delivery_radio_km }));
    setMensaje({ tipo: error ? 'error' : 'ok', texto: error ? error.message : 'Guardado.' });
    setTimeout(() => setMensaje(null), 3000);
  }

  if (!puedeVer) return <div className="sin-acceso">Sin permiso.</div>;
  if (!config)   return <div className="cargando">Cargando…</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin/configuracion">← Configuración</a>
      <header><span className="eyebrow">Configuración</span><h1>Delivery</h1></header>

      <section className="tarjeta">
        <form className="form" onSubmit={guardar}>
          <label className="campo">
            <span>Precio fijo del envío ($)</span>
            <input type="number" min="0" step="0.01" value={config.delivery_precio} disabled={!puedeEditar}
              onChange={e => setConfig(p => ({ ...p, delivery_precio: e.target.value }))} />
          </label>
          <label className="campo">
            <span>Radio máximo de cobertura (km)</span>
            <input type="number" min="0" step="0.1" value={config.delivery_radio_km} disabled={!puedeEditar}
              onChange={e => setConfig(p => ({ ...p, delivery_radio_km: e.target.value }))} />
          </label>
          <p className="hint">Los pedidos fuera de este radio serán redirigidos a retiro por el local automáticamente.</p>
          {puedeEditar && (
            <button type="submit" disabled={!cambio || guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          )}
          {mensaje && <p className={`aviso aviso-${mensaje.tipo}`}>{mensaje.texto}</p>}
        </form>
      </section>

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 480px; margin: 0 auto 28px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 24px; margin: 0; }
        .tarjeta { max-width: 480px; margin: 0 auto; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 24px; }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #9a8f82; }
        .campo input { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; }
        .campo input:focus-visible { border-color: #c1320a; box-shadow: 0 0 0 3px rgba(193,50,10,0.2); }
        .campo input:disabled { opacity: 0.5; }
        .hint { font-size: 12px; color: #b0a898; line-height: 1.5; margin: 0; }
        button { background: #c1440e; color: #1a1510; border: none; border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; }
        button:disabled { opacity: 0.4; cursor: default; }
        .aviso { font-size: 13px; margin: 0; padding: 10px 12px; border-radius: 8px; }
        .aviso-ok { background: rgba(107,113,86,0.15); border: 1px solid rgba(107,113,86,0.5); color: #c7cdb8; }
        .aviso-error { background: rgba(226,87,76,0.12); border: 1px solid rgba(226,87,76,0.4); color: #e2574c; }
        .cargando, .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}