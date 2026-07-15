'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useEmpleado } from '../../../contexts/EmpleadoContext';

export default function CatalogoPage() {
  const { puede, empleado } = useEmpleado();
  const puedeVer    = empleado.rol === 'dueño' || puede('catalogo', 'ver');
  const puedeEditar = empleado.rol === 'dueño' || puede('catalogo', 'editar');

  const [categorias, setCategorias]         = useState(null);
  const [editandoId, setEditandoId]         = useState(null);   // id de la categoría en edición inline
  const [nombreEdit, setNombreEdit]         = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [guardando, setGuardando]           = useState(false);
  const [mensaje, setMensaje]               = useState(null);

  useEffect(() => { if (puedeVer) cargar(); }, [puedeVer]);

  async function cargar() {
    const { data } = await supabase.from('categorias').select('*').order('orden');
    if (data) setCategorias(data);
  }

  function msg(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 3000);
  }

  // ── CREAR ──────────────────────────────────────────────────
  async function crearCategoria(e) {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;
    setGuardando(true);
    const maxOrden = categorias.length ? Math.max(...categorias.map((c) => c.orden)) + 1 : 0;
    const { error } = await supabase
      .from('categorias')
      .insert({ nombre: nuevaCategoria.trim(), orden: maxOrden, activa: true });
    setGuardando(false);
    if (error) { msg('error', error.message); return; }
    setNuevaCategoria('');
    cargar();
  }

  // ── EDITAR NOMBRE ──────────────────────────────────────────
  function iniciarEdicion(cat) {
    setEditandoId(cat.id);
    setNombreEdit(cat.nombre);
  }

  async function guardarEdicion(cat) {
    if (!nombreEdit.trim()) return;
    await supabase.from('categorias').update({ nombre: nombreEdit.trim() }).eq('id', cat.id);
    setEditandoId(null);
    cargar();
  }

  // ── TOGGLE ACTIVA ──────────────────────────────────────────
  async function toggleActiva(cat) {
    setCategorias((prev) => prev.map((c) => c.id === cat.id ? { ...c, activa: !c.activa } : c));
    await supabase.from('categorias').update({ activa: !cat.activa }).eq('id', cat.id);
  }

  // ── REORDENAR (subir / bajar) ──────────────────────────────
  async function mover(cat, direccion) {
    const lista = [...categorias];
    const idx   = lista.findIndex((c) => c.id === cat.id);
    const swap  = idx + direccion;
    if (swap < 0 || swap >= lista.length) return;

    // Intercambiar órdenes
    const ordenA = lista[idx].orden;
    const ordenB = lista[swap].orden;

    // Actualizar localmente para feedback inmediato
    lista[idx]  = { ...lista[idx],  orden: ordenB };
    lista[swap] = { ...lista[swap], orden: ordenA };
    lista.sort((a, b) => a.orden - b.orden);
    setCategorias(lista);

    await Promise.all([
      supabase.from('categorias').update({ orden: ordenB }).eq('id', cat.id),
      supabase.from('categorias').update({ orden: ordenA }).eq('id', lista[idx].id),
    ]);
  }

  // ── ELIMINAR (solo si no tiene productos) ─────────────────
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  async function eliminarCategoria(cat) {
    // Chequear si tiene productos antes de borrar
    const { count } = await supabase
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('categoria_id', cat.id);

    if (count > 0) {
      msg('error', `No se puede eliminar "${cat.nombre}" porque tiene ${count} producto${count > 1 ? 's' : ''}. Movelos o eliminá los productos primero.`);
      setConfirmandoEliminar(null);
      return;
    }

    await supabase.from('categorias').delete().eq('id', cat.id);
    setConfirmandoEliminar(null);
    cargar();
  }

  if (!puedeVer) return <div className="sin-acceso">No tenés permiso para ver esta sección.</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin">← Volver al panel</a>

      <header>
        <span className="eyebrow">Catálogo</span>
        <h1>Categorías</h1>
      </header>

      {/* Crear nueva categoría */}
      {puedeEditar && (
        <section className="tarjeta">
          <h2>Nueva categoría</h2>
          <form className="form-nueva" onSubmit={crearCategoria}>
            <input
              type="text"
              placeholder='Ej: Pizzas, Empanadas, Bebidas…'
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              required
            />
            <button type="submit" disabled={guardando || !nuevaCategoria.trim()}>
              {guardando ? 'Creando…' : 'Crear'}
            </button>
          </form>
          {mensaje && <p className={`aviso aviso-${mensaje.tipo}`}>{mensaje.texto}</p>}
        </section>
      )}

      {/* Lista de categorías */}
      <section className="tarjeta">
        <h2>Categorías del menú</h2>
        {categorias === null && <p className="cargando">Cargando…</p>}
        {categorias?.length === 0 && <p className="cargando">Todavía no hay categorías. ¡Creá la primera!</p>}

        <div className="lista">
          {categorias?.map((cat, idx) => (
            <a key={cat.id} className={`fila ${!cat.activa ? 'inactiva' : ''}`} href={`/admin/catalogo/${cat.id}`} onClick={e => { if (e.target.closest('.acciones') || e.target.closest('.flechas') || e.target.closest('.nombre-col input')) e.preventDefault(); }}>

              {/* Flechas de reordenamiento */}
              {puedeEditar && (
                <div className="flechas">
                  <button
                    className="btn-flecha"
                    onClick={() => mover(cat, -1)}
                    disabled={idx === 0}
                    title="Subir"
                  >▲</button>
                  <button
                    className="btn-flecha"
                    onClick={() => mover(cat, 1)}
                    disabled={idx === categorias.length - 1}
                    title="Bajar"
                  >▼</button>
                </div>
              )}

              {/* Nombre (edición inline) */}
              <div className="nombre-col">
                {editandoId === cat.id ? (
                  <input
                    className="input-inline"
                    value={nombreEdit}
                    autoFocus
                    onChange={(e) => setNombreEdit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') guardarEdicion(cat);
                      if (e.key === 'Escape') setEditandoId(null);
                    }}
                  />
                ) : (
                  <span className={`nombre ${!cat.activa ? 'tachado' : ''}`}>{cat.nombre}</span>
                )}
              </div>

              {/* Acciones */}
              <div className="acciones">
                {puedeEditar && editandoId === cat.id ? (
                  <>
                    <button className="btn-icono btn-ok" onClick={() => guardarEdicion(cat)} title="Guardar">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button className="btn-icono" onClick={() => setEditandoId(null)} title="Cancelar">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </>
                ) : (
                  <>
                    {puedeEditar && (
                      <>
                        <button className="btn-icono" onClick={() => iniciarEdicion(cat)} title="Editar nombre">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="btn-icono" onClick={() => toggleActiva(cat)} title={cat.activa ? 'Ocultar categoría' : 'Mostrar categoría'}>
                          {cat.activa ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                        {confirmandoEliminar === cat.id ? (
                          <>
                            <span className="confirmar-texto">¿Eliminar?</span>
                            <button className="btn-icono btn-eliminar-confirmar" onClick={() => eliminarCategoria(cat)} title="Confirmar eliminación">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </button>
                            <button className="btn-icono" onClick={() => setConfirmandoEliminar(null)} title="Cancelar">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </>
                        ) : (
                          <button className="btn-icono btn-eliminar" onClick={() => setConfirmandoEliminar(cat.id)} title="Eliminar categoría">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>

      <style jsx>{`
        .pagina {
          min-height: 100vh;
          background: #f7f5f2;
          color: #1a1510;
          font-family: 'Work Sans', system-ui, sans-serif;
          padding: 32px 24px 64px;
        }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 680px; margin: 0 auto 28px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 700; font-size: 26px; margin: 0; color: #1a1510; }
        .tarjeta { max-width: 680px; margin: 0 auto 24px; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 28px; }
        .tarjeta h2 { font-family: 'Fraunces', serif; font-size: 18px; margin: 0 0 16px; }

        .form-nueva { display: flex; gap: 10px; }
        .form-nueva input {
          flex: 1;
          background: #f7f5f2;
          border: 1px solid #ede8e0;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 14px;
          color: #1a1510;
          font-family: inherit;
          outline: none;
        }
        .form-nueva input:focus-visible { border-color: #c1320a; box-shadow: 0 0 0 3px rgba(193,50,10,0.25); }
        .form-nueva button {
          background: #c1440e;
          color: #1a1510;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
        }
        .form-nueva button:disabled { opacity: 0.4; cursor: default; }

        .aviso { font-size: 13px; margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; }
        .aviso-ok { background: rgba(107,113,86,0.15); border: 1px solid rgba(107,113,86,0.5); color: #c7cdb8; }
        .aviso-error { background: rgba(226,87,76,0.12); border: 1px solid rgba(226,87,76,0.4); color: #e2574c; }

        .lista { display: flex; flex-direction: column; gap: 8px; }

        .fila {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f7f5f2;
          border: 1px solid #ede8e0;
          border-radius: 10px;
          padding: 12px 14px;
        }
        .fila.inactiva { opacity: 0.5; }

        .flechas { display: flex; flex-direction: column; gap: 2px; }
        .btn-flecha {
          background: transparent;
          border: 1px solid #ede8e0;
          color: #9a8f82;
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 10px;
          cursor: pointer;
          line-height: 1.6;
        }
        .btn-flecha:disabled { opacity: 0.2; cursor: default; }
        .btn-flecha:hover:not(:disabled) { border-color: #c1320a; color: #1a1510; }

        .nombre-col { flex: 1; min-width: 0; }
        .nombre { font-size: 15px; }
        .tachado { text-decoration: line-through; opacity: 0.5; }

        .input-inline {
          width: 100%;
          background: #fff;
          border: 1px solid #c1440e;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 14px;
          color: #1a1510;
          font-family: inherit;
          outline: none;
        }

        .acciones { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

        .fila { cursor: pointer; }
        .fila:hover { border-color: #c1320a; }
        .btn-icono {
          background: transparent;
          border: 1px solid #ede8e0;
          color: #9a8f82;
          border-radius: 6px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .btn-icono:hover { border-color: #9a8f82; color: #1a1510; }
        .btn-ok { border-color: #6b9c6b; color: #a8d5a8; }
        .btn-ok:hover { background: rgba(107,156,107,0.12); border-color: #6b9c6b; }
        .btn-eliminar:hover { border-color: #9c3a3a; color: #e2574c; }
        .btn-eliminar-confirmar { background: #9c3a3a; border-color: #9c3a3a; color: #1a1510; }
        .btn-eliminar-confirmar:hover { background: #7a2c2c; border-color: #7a2c2c; }
        .confirmar-texto { font-size: 12px; color: #e2574c; }

        .cargando { color: #9a8f82; font-size: 14px; }
        .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}