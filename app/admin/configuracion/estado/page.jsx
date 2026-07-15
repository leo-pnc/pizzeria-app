'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { useEmpleado } from '../../../../contexts/EmpleadoContext';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function franjaVacia() { return { id: null, hora_apertura: '19:00', hora_cierre: '23:00', esNueva: true }; }

export default function EstadoPage() {
  const { puede, empleado } = useEmpleado();
  const puedeVer    = empleado.rol === 'dueño' || puede('configuracion', 'ver');
  const puedeEditar = empleado.rol === 'dueño' || puede('configuracion', 'editar');

  const [config, setConfig]         = useState(null);
  const [configOrig, setConfigOrig] = useState(null);
  const [horarios, setHorarios]     = useState([]);
  const [horariosOrig, setHorariosOrig] = useState([]);
  const [guardando, setGuardando]   = useState({});
  const [mensajes, setMensajes]     = useState({});

  useEffect(() => { if (puedeVer) cargar(); }, [puedeVer]);

  async function cargar() {
    const [{ data: cfg }, { data: hor }, { data: franjas }] = await Promise.all([
      supabase.from('local_config').select('*').single(),
      supabase.from('horarios').select('*').order('dia_semana'),
      supabase.from('horario_franjas').select('*').order('orden'),
    ]);
    if (cfg) { setConfig(cfg); setConfigOrig(cfg); }
    if (hor && franjas) {
      const h = hor.map(h => ({ ...h, franjas: franjas.filter(f => f.horario_id === h.id).map(f => ({ ...f, esNueva: false })) }));
      setHorarios(h);
      setHorariosOrig(JSON.parse(JSON.stringify(h)));
    }
  }

  function setMsg(k, tipo, texto) {
    setMensajes(p => ({ ...p, [k]: { tipo, texto } }));
    setTimeout(() => setMensajes(p => ({ ...p, [k]: null })), 3000);
  }

  async function cambiarEstado(valor) {
    setConfig(p => ({ ...p, esta_abierto_manual: valor }));
    setConfigOrig(p => ({ ...p, esta_abierto_manual: valor }));
    await supabase.from('local_config').update({ esta_abierto_manual: valor }).eq('id', config.id);
  }

  function horarioCambio(diaIdx) {
    const actual = horarios.find(h => h.dia_semana === diaIdx);
    const orig   = horariosOrig.find(h => h.dia_semana === diaIdx);
    if (!actual || !orig) return false;
    return actual.activo !== orig.activo || !deepEqual(
      actual.franjas.map(({ id, hora_apertura, hora_cierre, orden }) => ({ id, hora_apertura, hora_cierre, orden })),
      orig.franjas.map(({ id, hora_apertura, hora_cierre, orden }) => ({ id, hora_apertura, hora_cierre, orden }))
    );
  }

  function actualizarHorario(diaIdx, campo, valor) {
    setHorarios(prev => prev.map(h => h.dia_semana === diaIdx ? { ...h, [campo]: valor } : h));
  }

  function agregarFranja(diaIdx) {
    setHorarios(prev => prev.map(h => {
      if (h.dia_semana !== diaIdx) return h;
      return { ...h, franjas: [...h.franjas, { ...franjaVacia(), orden: h.franjas.length }] };
    }));
  }

  function actualizarFranja(diaIdx, fi, campo, valor) {
    setHorarios(prev => prev.map(h => {
      if (h.dia_semana !== diaIdx) return h;
      return { ...h, franjas: h.franjas.map((f, i) => i === fi ? { ...f, [campo]: valor } : f) };
    }));
  }

  function eliminarFranja(diaIdx, fi) {
    setHorarios(prev => prev.map(h => {
      if (h.dia_semana !== diaIdx) return h;
      return { ...h, franjas: h.franjas.filter((_, i) => i !== fi) };
    }));
  }

  async function guardarHorario(diaIdx) {
    const horario = horarios.find(h => h.dia_semana === diaIdx);
    if (!horario) return;
    setGuardando(p => ({ ...p, [`hor_${diaIdx}`]: true }));
    await supabase.from('horarios').update({ activo: horario.activo }).eq('id', horario.id);
    await supabase.from('horario_franjas').delete().eq('horario_id', horario.id);
    if (horario.franjas.length > 0) {
      await supabase.from('horario_franjas').insert(
        horario.franjas.map((f, i) => ({ horario_id: horario.id, hora_apertura: f.hora_apertura, hora_cierre: f.hora_cierre, orden: i }))
      );
    }
    setGuardando(p => ({ ...p, [`hor_${diaIdx}`]: false }));
    setMsg(`hor_${diaIdx}`, 'ok', 'Guardado.');
    setHorariosOrig(prev => prev.map(h => h.dia_semana === diaIdx ? JSON.parse(JSON.stringify(horario)) : h));
  }

  if (!puedeVer) return <div className="sin-acceso">Sin permiso.</div>;
  if (!config)   return <div className="cargando">Cargando…</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin/configuracion">← Configuración</a>
      <header><span className="eyebrow">Configuración</span><h1>Estado y horarios</h1></header>

      <section className="tarjeta">
        <h2>Estado del local</h2>
        <p className="desc">Podés sobrescribir el horario automático cuando lo necesites.</p>
        <div className="estado-opciones">
          {[
            { valor: null,  label: 'Automático' },
            { valor: true,  label: 'Forzar abierto',  extra: 'btn-abierto' },
            { valor: false, label: 'Forzar cerrado',  extra: 'btn-cerrado' },
          ].map(({ valor, label, extra }) => (
            <button
              key={String(valor)}
              className={`btn-estado ${extra || ''} ${config.esta_abierto_manual === valor ? 'activo' : ''}`}
              onClick={() => puedeEditar && cambiarEstado(valor)}
              disabled={!puedeEditar}
            >{label}</button>
          ))}
        </div>
        <p className="estado-actual">
          Ahora: <strong>
            {config.esta_abierto_manual === null  ? 'Automático (según horario)' :
             config.esta_abierto_manual === true  ? 'Abierto (forzado)' : 'Cerrado (forzado)'}
          </strong>
        </p>
      </section>

      <section className="tarjeta">
        <h2>Horarios por día</h2>
        <div className="lista-horarios">
          {horarios.map(h => (
            <div key={h.dia_semana} className={`bloque-dia ${!h.activo ? 'inactivo' : ''}`}>
              <div className="dia-header">
                <label className="check">
                  <input type="checkbox" checked={h.activo} disabled={!puedeEditar}
                    onChange={() => actualizarHorario(h.dia_semana, 'activo', !h.activo)} />
                  <span className="dia-nombre">{DIAS[h.dia_semana]}</span>
                </label>
                <div className="dia-acciones">
                  {mensajes[`hor_${h.dia_semana}`] && (
                    <span className={`msg msg-${mensajes[`hor_${h.dia_semana}`].tipo}`}>{mensajes[`hor_${h.dia_semana}`].texto}</span>
                  )}
                  {puedeEditar && (
                    <button className="btn-guardar-chico" disabled={!horarioCambio(h.dia_semana) || guardando[`hor_${h.dia_semana}`]} onClick={() => guardarHorario(h.dia_semana)}>
                      {guardando[`hor_${h.dia_semana}`] ? '…' : 'Guardar'}
                    </button>
                  )}
                </div>
              </div>
              {h.activo && (
                <div className="franjas">
                  {h.franjas.map((f, fi) => (
                    <div key={fi} className="franja">
                      <label className="campo-hora"><span>Apertura</span>
                        <input type="time" value={f.hora_apertura} disabled={!puedeEditar}
                          onChange={e => actualizarFranja(h.dia_semana, fi, 'hora_apertura', e.target.value)} />
                      </label>
                      <span className="sep">–</span>
                      <label className="campo-hora"><span>Cierre</span>
                        <input type="time" value={f.hora_cierre} disabled={!puedeEditar}
                          onChange={e => actualizarFranja(h.dia_semana, fi, 'hora_cierre', e.target.value)} />
                      </label>
                      {puedeEditar && h.franjas.length > 1 && (
                        <button className="btn-quitar" onClick={() => eliminarFranja(h.dia_semana, fi)}>✕</button>
                      )}
                    </div>
                  ))}
                  {puedeEditar && (
                    <button className="btn-agregar-franja" onClick={() => agregarFranja(h.dia_semana)}>+ Agregar franja</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 640px; margin: 0 auto 28px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 24px; margin: 0; }
        .tarjeta { max-width: 640px; margin: 0 auto 20px; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 24px; }
        .tarjeta h2 { font-family: 'Fraunces', serif; font-size: 17px; margin: 0 0 10px; }
        .desc { font-size: 13px; color: #9a8f82; margin: 0 0 16px; line-height: 1.5; }
        .estado-opciones { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .btn-estado { background: #f7f5f2; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 8px; padding: 9px 14px; font-size: 13px; font-family: inherit; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
        .btn-estado.activo { border-color: #c1320a; color: #1a1510; background: rgba(193,50,10,0.1); }
        .btn-estado:disabled { opacity: 0.5; cursor: default; }
        .btn-abierto.activo { border-color: #6b9c6b; background: rgba(107,156,107,0.1); color: #a8d5a8; }
        .btn-cerrado.activo { border-color: #9c3a3a; background: rgba(156,58,58,0.1); color: #d5a8a8; }
        .estado-actual { font-size: 13px; color: #9a8f82; margin: 0; }
        .estado-actual strong { color: #1a1510; }
        .lista-horarios { display: flex; flex-direction: column; gap: 8px; }
        .bloque-dia { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 10px; padding: 12px 14px; }
        .bloque-dia.inactivo { opacity: 0.45; }
        .dia-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .dia-nombre { font-size: 14px; font-weight: 500; }
        .dia-acciones { display: flex; align-items: center; gap: 8px; }
        .franjas { display: flex; flex-direction: column; gap: 8px; }
        .franja { display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; }
        .campo-hora { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #9a8f82; }
        .campo-hora input { background: #fff; border: 1px solid #ede8e0; border-radius: 6px; padding: 6px 8px; font-size: 13px; color: #1a1510; font-family: inherit; outline: none; width: 100px; }
        .campo-hora input:disabled { opacity: 0.4; }
        .campo-hora input:focus-visible { border-color: #c1320a; }
        .sep { font-size: 16px; color: #9a8f82; padding-bottom: 5px; }
        .btn-quitar { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 6px; padding: 5px 8px; font-size: 12px; cursor: pointer; align-self: flex-end; }
        .btn-quitar:hover { border-color: #e2574c; color: #e2574c; }
        .btn-agregar-franja { background: transparent; border: 1px dashed #3a3128; color: #9a8f82; border-radius: 6px; padding: 7px 12px; font-size: 12px; font-family: inherit; cursor: pointer; }
        .btn-agregar-franja:hover { border-color: #c1320a; color: #1a1510; }
        .btn-guardar-chico { background: #8a9070; border: none; color: #1a1510; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-family: inherit; cursor: pointer; }
        .btn-guardar-chico:disabled { opacity: 0.4; cursor: default; }
        .msg { font-size: 12px; }
        .msg-ok { color: #a8d5a8; }
        .msg-error { color: #e2574c; }
        .check { display: flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; }
        .check input { accent-color: #c1320a; }
        .cargando, .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}