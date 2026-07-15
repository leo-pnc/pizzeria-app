'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { useEmpleado } from '../../../../contexts/EmpleadoContext';

const METODOS_SUGERIDOS = [
  'Efectivo', 'Transferencia bancaria', 'MercadoPago', 'Tarjeta de débito',
  'Tarjeta de crédito', 'Naranja X', 'Ualá', 'Cuenta DNI', 'MODO', 'Brubank', 'Lemon Cash', 'Prex',
];

export default function PagosPage() {
  const { puede, empleado } = useEmpleado();
  const puedeVer    = empleado.rol === 'dueño' || puede('configuracion', 'ver');
  const puedeEditar = empleado.rol === 'dueño' || puede('configuracion', 'editar');

  const [metodos, setMetodos]             = useState([]);
  const [nuevoMetodo, setNuevoMetodo]     = useState('');
  const [confirmando, setConfirmando]     = useState(null);
  const [guardando, setGuardando]         = useState(false);

  useEffect(() => { if (puedeVer) cargar(); }, [puedeVer]);

  async function cargar() {
    const { data } = await supabase.from('metodos_pago').select('*').order('orden');
    if (data) setMetodos(data);
  }

  function yaExiste(nombre) {
    return metodos.some(m => m.nombre.toLowerCase().trim() === nombre.toLowerCase().trim());
  }

  async function toggleMetodo(m) {
    setMetodos(prev => prev.map(x => x.id === m.id ? { ...x, activo: !x.activo } : x));
    await supabase.from('metodos_pago').update({ activo: !m.activo }).eq('id', m.id);
  }

  async function eliminar(m) {
    await supabase.from('metodos_pago').delete().eq('id', m.id);
    setConfirmando(null);
    cargar();
  }

  async function agregar(nombre) {
    if (!nombre.trim() || yaExiste(nombre)) return;
    setGuardando(true);
    await supabase.from('metodos_pago').insert({ nombre: nombre.trim(), activo: true, orden: metodos.length + 1 });
    setGuardando(false);
    setNuevoMetodo('');
    cargar();
  }

  if (!puedeVer) return <div className="sin-acceso">Sin permiso.</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin/configuracion">← Configuración</a>
      <header><span className="eyebrow">Configuración</span><h1>Métodos de pago</h1></header>

      <section className="tarjeta">
        <h2>Activos</h2>
        <div className="lista">
          {metodos.length === 0 && <p className="vacio">No hay métodos cargados todavía.</p>}
          {metodos.map(m => (
            <div key={m.id} className="fila">
              <span className={m.activo ? 'nombre' : 'nombre tachado'}>{m.nombre}</span>
              {puedeEditar && (
                <div className="fila-acciones">
                  <button className="btn-toggle" onClick={() => toggleMetodo(m)}>
                    {m.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  {confirmando === m.id ? (
                    <>
                      <span className="confirmar-txt">¿Eliminar?</span>
                      <button className="btn-eliminar-si" onClick={() => eliminar(m)}>Sí</button>
                      <button className="btn-cancelar" onClick={() => setConfirmando(null)}>No</button>
                    </>
                  ) : (
                    <button className="btn-eliminar" onClick={() => setConfirmando(m.id)}>Eliminar</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {puedeEditar && (
        <>
          <section className="tarjeta">
            <h2>Sugeridos</h2>
            <div className="sugeridos">
              {METODOS_SUGERIDOS.filter(s => !yaExiste(s)).map(s => (
                <button key={s} className="btn-sugerido" onClick={() => agregar(s)}>{s}</button>
              ))}
              {METODOS_SUGERIDOS.every(s => yaExiste(s)) && (
                <p className="vacio">Ya tenés todos los sugeridos.</p>
              )}
            </div>
          </section>

          <section className="tarjeta">
            <h2>Agregar personalizado</h2>
            <div className="form-nuevo">
              <input
                type="text"
                placeholder="Nombre del método…"
                value={nuevoMetodo}
                onChange={e => setNuevoMetodo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && agregar(nuevoMetodo)}
              />
              <button disabled={!nuevoMetodo.trim() || yaExiste(nuevoMetodo) || guardando} onClick={() => agregar(nuevoMetodo)}>
                Agregar
              </button>
            </div>
            {nuevoMetodo.trim() && yaExiste(nuevoMetodo) && (
              <p className="aviso aviso-error">Ya existe un método con ese nombre.</p>
            )}
          </section>
        </>
      )}

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 560px; margin: 0 auto 28px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 24px; margin: 0; }
        .tarjeta { max-width: 560px; margin: 0 auto 16px; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 22px; }
        .tarjeta h2 { font-family: 'Fraunces', serif; font-size: 16px; margin: 0 0 14px; }
        .lista { display: flex; flex-direction: column; gap: 8px; }
        .fila { display: flex; align-items: center; justify-content: space-between; background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 14px; font-size: 14px; gap: 10px; flex-wrap: wrap; }
        .nombre { flex: 1; }
        .tachado { text-decoration: line-through; opacity: 0.4; }
        .fila-acciones { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .btn-toggle { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
        .btn-toggle:hover { border-color: #c1320a; color: #1a1510; }
        .btn-eliminar { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
        .btn-eliminar:hover { border-color: #9c3a3a; color: #e2574c; }
        .confirmar-txt { font-size: 12px; color: #e2574c; }
        .btn-eliminar-si { background: #9c3a3a; border: none; color: #1a1510; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
        .btn-cancelar { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
        .sugeridos { display: flex; flex-wrap: wrap; gap: 8px; }
        .btn-sugerido { background: #f7f5f2; border: 1px dashed #3a3128; color: #9a8f82; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-family: inherit; cursor: pointer; }
        .btn-sugerido:hover { border-color: #c1320a; color: #1a1510; border-style: solid; }
        .form-nuevo { display: flex; gap: 8px; }
        .form-nuevo input { flex: 1; background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 12px; font-size: 14px; color: #1a1510; font-family: inherit; outline: none; }
        .form-nuevo input:focus-visible { border-color: #c1320a; }
        .form-nuevo button { background: #8a9070; border: none; color: #1a1510; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-family: inherit; cursor: pointer; }
        .form-nuevo button:disabled { opacity: 0.4; cursor: default; }
        .aviso { font-size: 13px; margin: 10px 0 0; padding: 10px 12px; border-radius: 8px; }
        .aviso-error { background: rgba(226,87,76,0.12); border: 1px solid rgba(226,87,76,0.4); color: #e2574c; }
        .vacio { font-size: 13px; color: #b0a898; }
        .cargando, .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}