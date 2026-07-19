'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useEmpleado } from '../../../contexts/EmpleadoContext';

export default function GaleriaPage() {
  const { puede, empleado } = useEmpleado();
  const puedeVer    = empleado.rol === 'dueño' || puede('catalogo', 'ver');
  const puedeEditar = empleado.rol === 'dueño' || puede('catalogo', 'editar');

  const [fotos, setFotos]           = useState(null);
  const [subiendo, setSubiendo]     = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [error, setError]           = useState('');
  const [confirmando, setConfirmando] = useState(null);

  useEffect(() => { if (puedeVer) cargar(); }, [puedeVer]);

  async function cargar() {
    const { data } = await supabase.from('galeria_fotos').select('*').order('created_at', { ascending: false });
    if (data) setFotos(data);
  }

  async function subirFoto(archivo) {
    if (!archivo) return;
    setError('');
    setSubiendo(true);

    const ext = archivo.name.split('.').pop();
    const nombre = `galeria/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: errorUpload } = await supabase.storage.from('productos').upload(nombre, archivo, {
      cacheControl: '3600',
      upsert: false,
    });

    if (errorUpload) {
      setError('Error al subir la foto: ' + errorUpload.message);
      setSubiendo(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('productos').getPublicUrl(nombre);

    const { error: errorInsert } = await supabase.from('galeria_fotos').insert({
      imagen_url: urlData.publicUrl,
      descripcion: descripcion.trim() || null,
    });

    if (errorInsert) {
      setError('Error al guardar la foto: ' + errorInsert.message);
      setSubiendo(false);
      return;
    }

    setDescripcion('');
    setSubiendo(false);
    cargar();
  }

  async function eliminarFoto(foto) {
    // Borramos también el archivo del storage, no solo el registro
    const ruta = foto.imagen_url.split('/productos/')[1];
    if (ruta) await supabase.storage.from('productos').remove([ruta]);
    await supabase.from('galeria_fotos').delete().eq('id', foto.id);
    setConfirmando(null);
    cargar();
  }

  if (!puedeVer) return <div className="sin-acceso">Sin permiso.</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin">← Volver al panel</a>
      <header><span className="eyebrow">Panel interno</span><h1>Galería</h1></header>

      {puedeEditar && (
        <section className="tarjeta">
          <h2>Subir nueva foto</h2>
          <p className="hint">
            Fotos de preparaciones, mercadería, el local o el equipo — cualquier cosa que le muestre a los clientes el detrás de escena.
          </p>

          <label className="campo">
            <span>Descripción (opcional)</span>
            <input
              type="text"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Amasando la masa madre de hoy"
            />
          </label>

          <label className="btn-subir">
            {subiendo ? 'Subiendo…' : '📷 Elegir foto'}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={subiendo}
              onChange={e => subirFoto(e.target.files[0])}
            />
          </label>

          {error && <p className="aviso aviso-error">{error}</p>}
        </section>
      )}

      <section className="tarjeta">
        <h2>Fotos subidas</h2>
        {fotos === null && <p className="cargando">Cargando…</p>}
        {fotos?.length === 0 && <p className="cargando">Todavía no subiste ninguna foto.</p>}

        <div className="grilla-fotos">
          {fotos?.map(foto => (
            <div key={foto.id} className="foto-item">
              <img src={foto.imagen_url} alt={foto.descripcion || 'Foto de la galería'} className="foto-img" />
              {foto.descripcion && <p className="foto-desc">{foto.descripcion}</p>}
              {puedeEditar && (
                <div className="foto-acciones">
                  {confirmando === foto.id ? (
                    <>
                      <span className="confirmar-texto">¿Eliminar?</span>
                      <button className="btn-icono btn-icono-ok" onClick={() => eliminarFoto(foto)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button className="btn-icono" onClick={() => setConfirmando(null)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </>
                  ) : (
                    <button className="btn-icono btn-icono-danger" onClick={() => setConfirmando(foto.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
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
        header { max-width: 680px; margin: 0 auto 24px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 700; font-size: 26px; margin: 0; color: #1a1510; }
        .tarjeta { max-width: 680px; margin: 0 auto 20px; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 24px; }
        .tarjeta h2 { font-family: 'Fraunces', serif; font-size: 17px; margin: 0 0 10px; }
        .hint { font-size: 13px; color: #9a8f82; margin: 0 0 16px; line-height: 1.5; }

        .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #9a8f82; margin-bottom: 14px; }
        .campo input { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 12px; font-size: 14px; color: #1a1510; font-family: inherit; outline: none; }
        .campo input:focus-visible { border-color: #a32424; box-shadow: 0 0 0 3px rgba(163,36,36,0.1); }

        .btn-subir { display: inline-flex; align-items: center; gap: 8px; background: #f7f5f2; border: 1px dashed #ede8e0; color: #9a8f82; border-radius: 8px; padding: 12px 18px; font-size: 14px; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
        .btn-subir:hover { border-color: #a32424; color: #1a1510; }

        .aviso { font-size: 13px; margin: 12px 0 0; padding: 10px 12px; border-radius: 8px; }
        .aviso-error { background: rgba(163,36,36,0.06); border: 1px solid rgba(163,36,36,0.2); color: #a32424; }

        .grilla-fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
        .foto-item { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 10px; overflow: hidden; }
        .foto-img { width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; }
        .foto-desc { font-size: 11.5px; color: #6b6259; padding: 8px 10px 4px; line-height: 1.4; }
        .foto-acciones { display: flex; align-items: center; gap: 6px; padding: 6px 10px 10px; }

        .btn-icono { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .btn-icono:hover { border-color: #9a8f82; color: #1a1510; }
        .btn-icono-ok { border-color: #6b9c6b; color: #3c8261; }
        .btn-icono-ok:hover { background: rgba(60,130,97,0.1); }
        .btn-icono-danger:hover { border-color: #a32424; color: #a32424; }
        .confirmar-texto { font-size: 11px; color: #a32424; white-space: nowrap; }

        .cargando { font-size: 14px; color: #9a8f82; }
        .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}