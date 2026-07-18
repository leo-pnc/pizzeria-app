'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { useEmpleado } from '../../../../contexts/EmpleadoContext';

export default function WhatsappPage() {
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
    config.whatsapp_numero !== configOrig.whatsapp_numero ||
    (config.instagram_url || '') !== (configOrig.instagram_url || '') ||
    (config.facebook_url  || '') !== (configOrig.facebook_url  || '')
  );

  async function guardar(e) {
    e.preventDefault();
    if (!config.whatsapp_numero.trim()) return;
    setGuardando(true);
    const { error } = await supabase.from('local_config')
      .update({
        whatsapp_numero: config.whatsapp_numero.trim(),
        instagram_url: config.instagram_url?.trim() || null,
        facebook_url: config.facebook_url?.trim() || null,
      })
      .eq('id', config.id);
    setGuardando(false);
    if (!error) setConfigOrig(config);
    setMensaje({ tipo: error ? 'error' : 'ok', texto: error ? error.message : 'Guardado.' });
    setTimeout(() => setMensaje(null), 3000);
  }

  if (!puedeVer) return <div className="sin-acceso">Sin permiso.</div>;
  if (!config)   return <div className="cargando">Cargando…</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin/configuracion">← Configuración</a>
      <header><span className="eyebrow">Configuración</span><h1>WhatsApp y redes sociales</h1></header>

      <section className="tarjeta">
        <h2>WhatsApp de pedidos</h2>
        <div className="form">
          <label className="campo">
            <span>Número de WhatsApp</span>
            <input type="tel" value={config.whatsapp_numero} disabled={!puedeEditar}
              placeholder="Ej: 5492612541034"
              onChange={e => setConfig(p => ({ ...p, whatsapp_numero: e.target.value }))} />
          </label>
          <p className="hint">Incluí el código de país sin el + (ej: <strong>549</strong>2612541034 para Argentina).</p>
          {config.whatsapp_numero && (
            <a className="wa-test" href={`https://wa.me/${config.whatsapp_numero}`} target="_blank" rel="noopener noreferrer">
              Probar este número →
            </a>
          )}
        </div>
      </section>

      <section className="tarjeta">
        <h2>Redes sociales</h2>
        <p className="hint" style={{ marginBottom: 14 }}>
          Si completás estos campos, van a aparecer como botones flotantes en la página del menú para que los clientes te sigan.
        </p>
        <div className="form">
          <label className="campo">
            <span>Instagram (URL completa)</span>
            <input type="url" value={config.instagram_url || ''} disabled={!puedeEditar}
              placeholder="https://instagram.com/donadrianos"
              onChange={e => setConfig(p => ({ ...p, instagram_url: e.target.value }))} />
          </label>
          <label className="campo">
            <span>Facebook (URL completa)</span>
            <input type="url" value={config.facebook_url || ''} disabled={!puedeEditar}
              placeholder="https://facebook.com/donadrianos"
              onChange={e => setConfig(p => ({ ...p, facebook_url: e.target.value }))} />
          </label>
        </div>
      </section>

      {puedeEditar && (
        <div className="acciones-guardar">
          <button onClick={guardar} disabled={!cambio || guardando}>
            {guardando ? 'Guardando…' : 'Guardar todo'}
          </button>
          {mensaje && <p className={`aviso aviso-${mensaje.tipo}`}>{mensaje.texto}</p>}
        </div>
      )}

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 480px; margin: 0 auto 28px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 700; font-size: 24px; margin: 0; color: #1a1510; }
        .tarjeta { max-width: 480px; margin: 0 auto 16px; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 24px; }
        .tarjeta h2 { font-family: 'Fraunces', serif; font-size: 16px; margin: 0 0 14px; }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #9a8f82; }
        .campo input { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; }
        .campo input:focus-visible { border-color: #a32424; box-shadow: 0 0 0 3px rgba(163,36,36,0.1); }
        .campo input:disabled { opacity: 0.5; }
        .hint { font-size: 12px; color: #b0a898; line-height: 1.5; margin: 0; }
        .hint strong { color: #9a8f82; }
        .wa-test { font-size: 13px; color: #25d366; text-decoration: none; }
        .wa-test:hover { text-decoration: underline; }
        .acciones-guardar { max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
        .acciones-guardar button { background: #a32424; color: #fff; border: none; border-radius: 8px; padding: 13px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .acciones-guardar button:disabled { opacity: 0.4; cursor: default; }
        .aviso { font-size: 13px; padding: 10px 12px; border-radius: 8px; margin: 0; }
        .aviso-ok { background: rgba(60,130,97,0.1); border: 1px solid rgba(60,130,97,0.3); color: #3c8261; }
        .aviso-error { background: rgba(163,36,36,0.06); border: 1px solid rgba(163,36,36,0.2); color: #a32424; }
        .cargando, .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}