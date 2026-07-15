'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { supabase } from '../../../../lib/supabaseClient';
import { useEmpleado } from '../../../../contexts/EmpleadoContext';

const ESTADO_INICIAL_PRODUCTO = {
  nombre: '', descripcion: '', precio: '', imagen_url: '', disponible: true,
  variantes: [],
  tieneVariantes: false,
  subiendoImagen: false,
};

const ASPECT = 4 / 3; // ratio de las cards del menú (cambialo si querés cuadrado: 1/1)

const ESTADO_INICIAL_PROMO = {
  nombre: '', descripcion: '', precio_promo: '', imagen_url: '', activa: true,
  items: [], // [{ tipo: 'fijo'|'seleccionable', producto_id, categoria_id, cantidad, nombre_display }]
};

export default function CategoriaProductosPage() {
  const { id: categoriaId } = useParams();
  const { puede, empleado } = useEmpleado();
  const puedeVer    = empleado.rol === 'dueño' || puede('catalogo', 'ver');
  const puedeEditar = empleado.rol === 'dueño' || puede('catalogo', 'editar');

  const [categoria, setCategoria]   = useState(null);
  const [productos, setProductos]   = useState(null);
  const [promociones, setPromociones] = useState(null);
  const [todasCategorias, setTodasCategorias] = useState([]);
  const [todosProductos, setTodosProductos]   = useState([]);

  // Modales
  const [modalProducto, setModalProducto] = useState(null);  // null | 'nuevo' | producto
  const [modalPromo, setModalPromo]       = useState(null);  // null | 'nueva' | promo
  const [formProducto, setFormProducto]   = useState(ESTADO_INICIAL_PRODUCTO);
  const [formPromo, setFormPromo]         = useState(ESTADO_INICIAL_PROMO);
  const [guardando, setGuardando]         = useState(false);
  const [errModal, setErrModal]           = useState('');

  // Recortador de imagen
  const [imagenSrc, setImagenSrc]         = useState(null);  // dataURL de la imagen elegida
  const [crop, setCrop]                   = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef                            = useRef(null);
  const [modalCrop, setModalCrop]         = useState(false);

  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  useEffect(() => { if (puedeVer) cargar(); }, [puedeVer, categoriaId]);

  async function cargar() {
    const [{ data: cat }, { data: prods }, { data: vars }, { data: promos }, { data: promoItems }, { data: cats }, { data: allProds }] =
      await Promise.all([
        supabase.from('categorias').select('*').eq('id', categoriaId).single(),
        supabase.from('productos').select('*').eq('categoria_id', categoriaId).order('orden'),
        supabase.from('producto_variantes').select('*').order('orden'),
        supabase.from('promociones').select('*').order('orden'),
        supabase.from('promocion_items').select('*'),
        supabase.from('categorias').select('*').order('orden'),
        supabase.from('productos').select('id, nombre, categoria_id').order('nombre'),
      ]);

    if (cat) setCategoria(cat);
    if (cats) setTodasCategorias(cats);
    if (allProds) setTodosProductos(allProds);

    if (prods && vars) {
      setProductos(prods.map((p) => ({
        ...p,
        variantes: vars.filter((v) => v.producto_id === p.id),
      })));
    }

    if (promos && promoItems) {
      setPromociones(promos.map((pr) => ({
        ...pr,
        items: promoItems.filter((i) => i.promocion_id === pr.id),
      })));
    }
  }

  // ── PRODUCTO: abrir modal ──────────────────────────────────
  function abrirModalNuevoProducto() {
    setFormProducto(ESTADO_INICIAL_PRODUCTO);
    setErrModal('');
    setModalProducto('nuevo');
  }

  function abrirModalEditarProducto(prod) {
    setFormProducto({
      nombre: prod.nombre,
      descripcion: prod.descripcion || '',
      precio: prod.precio,
      imagen_url: prod.imagen_url || '',
      disponible: prod.disponible,
      tieneVariantes: prod.variantes.length > 0,
      variantes: prod.variantes.map((v) => ({ ...v })),
    });
    setErrModal('');
    setModalProducto(prod);
  }

  function agregarVariante() {
    setFormProducto((prev) => ({
      ...prev,
      variantes: [...prev.variantes, { nombre: '', precio: '', disponible: true }],
    }));
  }

  function actualizarVariante(idx, campo, valor) {
    setFormProducto((prev) => ({
      ...prev,
      variantes: prev.variantes.map((v, i) => i === idx ? { ...v, [campo]: valor } : v),
    }));
  }

  function quitarVariante(idx) {
    setFormProducto((prev) => ({
      ...prev,
      variantes: prev.variantes.filter((_, i) => i !== idx),
    }));
  }

  // Cuando el usuario elige un archivo, lo leemos y abrimos el recortador
  function onArchivoElegido(archivo) {
    if (!archivo) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagenSrc(reader.result);
      setCrop(null);
      setCompletedCrop(null);
      setModalCrop(true);
    };
    reader.readAsDataURL(archivo);
  }

  // Cuando la imagen carga en el recortador, centramos el crop inicial
  function onImageLoad(e) {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    const cropCentrado = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, ASPECT, width, height),
      width,
      height
    );
    setCrop(cropCentrado);
  }

  // Genera un blob del área recortada y lo sube a Supabase
  async function confirmarRecorte() {
    if (!completedCrop || !imgRef.current) return;
    setFormProducto((prev) => ({ ...prev, subiendoImagen: true }));
    setModalCrop(false);

    const img    = imgRef.current;
    const scaleX = img.naturalWidth  / img.width;
    const scaleY = img.naturalHeight / img.height;

    const canvas = document.createElement('canvas');
    const OUTPUT_SIZE = 800; // px del lado más largo del output
    canvas.width  = OUTPUT_SIZE;
    canvas.height = Math.round(OUTPUT_SIZE / ASPECT);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width  * scaleX,
      completedCrop.height * scaleY,
      0, 0, canvas.width, canvas.height
    );

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const { error } = await supabase.storage.from('productos').upload(nombre, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      setErrModal('Error al subir la imagen: ' + error.message);
      setFormProducto((prev) => ({ ...prev, subiendoImagen: false }));
      return;
    }

    const { data } = supabase.storage.from('productos').getPublicUrl(nombre);
    setFormProducto((prev) => ({ ...prev, imagen_url: data.publicUrl, subiendoImagen: false }));
    setImagenSrc(null);
  }

  async function guardarProducto() {
    if (!formProducto.nombre.trim()) { setErrModal('El nombre es obligatorio.'); return; }
    if (!formProducto.tieneVariantes && !formProducto.precio) { setErrModal('Ingresá un precio base.'); return; }
    if (formProducto.tieneVariantes && formProducto.variantes.length === 0) { setErrModal('Agregá al menos una variante.'); return; }

    setGuardando(true);
    setErrModal('');

    const payload = {
      nombre: formProducto.nombre.trim(),
      descripcion: formProducto.descripcion.trim() || null,
      precio: formProducto.tieneVariantes ? 0 : Number(formProducto.precio),
      imagen_url: formProducto.imagen_url.trim() || null,
      disponible: formProducto.disponible,
      categoria_id: categoriaId,
    };

    let productoId;

    if (modalProducto === 'nuevo') {
      const maxOrden = productos.length ? Math.max(...productos.map((p) => p.orden)) + 1 : 0;
      const { data, error } = await supabase.from('productos').insert({ ...payload, orden: maxOrden }).select().single();
      if (error) { setErrModal(error.message); setGuardando(false); return; }
      productoId = data.id;
    } else {
      const { error } = await supabase.from('productos').update(payload).eq('id', modalProducto.id);
      if (error) { setErrModal(error.message); setGuardando(false); return; }
      productoId = modalProducto.id;
      // Borrar variantes viejas para reinsertarlas
      await supabase.from('producto_variantes').delete().eq('producto_id', productoId);
    }

    if (formProducto.tieneVariantes && formProducto.variantes.length > 0) {
      await supabase.from('producto_variantes').insert(
        formProducto.variantes.map((v, i) => ({
          producto_id: productoId,
          nombre: v.nombre,
          precio: Number(v.precio),
          disponible: v.disponible,
          orden: i,
        }))
      );
    }

    setGuardando(false);
    setModalProducto(null);
    cargar();
  }

  async function toggleDisponible(prod) {
    setProductos((prev) => prev.map((p) => p.id === prod.id ? { ...p, disponible: !p.disponible } : p));
    await supabase.from('productos').update({ disponible: !prod.disponible }).eq('id', prod.id);
  }

  async function eliminarProducto(prod) {
    await supabase.from('productos').delete().eq('id', prod.id);
    setConfirmandoEliminar(null);
    cargar();
  }

  // ── PROMO: abrir modal ─────────────────────────────────────
  function abrirModalNuevaPromo() {
    setFormPromo(ESTADO_INICIAL_PROMO);
    setErrModal('');
    setModalPromo('nueva');
  }

  function abrirModalEditarPromo(promo) {
    setFormPromo({
      nombre: promo.nombre,
      descripcion: promo.descripcion || '',
      precio_promo: promo.precio_promo,
      imagen_url: promo.imagen_url || '',
      activa: promo.activa,
      items: promo.items.map((i) => ({
        tipo: i.seleccionable ? 'seleccionable' : 'fijo',
        producto_id: i.producto_id,
        categoria_id: i.categoria_id,
        cantidad: i.cantidad,
        nombre_display: i.seleccionable
          ? `${i.cantidad}x de categoría`
          : todosProductos.find((p) => p.id === i.producto_id)?.nombre || 'Producto',
      })),
    });
    setErrModal('');
    setModalPromo(promo);
  }

  function agregarItemPromo(tipo) {
    setFormPromo((prev) => ({
      ...prev,
      items: [...prev.items, {
        tipo,
        producto_id: tipo === 'fijo' ? '' : null,
        categoria_id: tipo === 'seleccionable' ? '' : null,
        cantidad: 1,
        nombre_display: '',
      }],
    }));
  }

  function actualizarItemPromo(idx, campo, valor) {
    setFormPromo((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, [campo]: valor } : it),
    }));
  }

  function quitarItemPromo(idx) {
    setFormPromo((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  }

  async function guardarPromo() {
    if (!formPromo.nombre.trim()) { setErrModal('El nombre es obligatorio.'); return; }
    if (!formPromo.precio_promo)  { setErrModal('El precio de la promo es obligatorio.'); return; }

    setGuardando(true);
    setErrModal('');

    const payload = {
      nombre: formPromo.nombre.trim(),
      descripcion: formPromo.descripcion.trim() || null,
      precio_promo: Number(formPromo.precio_promo),
      imagen_url: formPromo.imagen_url.trim() || null,
      activa: formPromo.activa,
    };

    let promoId;

    if (modalPromo === 'nueva') {
      const maxOrden = (promociones?.length ? Math.max(...promociones.map((p) => p.orden)) + 1 : 0);
      const { data, error } = await supabase.from('promociones').insert({ ...payload, orden: maxOrden }).select().single();
      if (error) { setErrModal(error.message); setGuardando(false); return; }
      promoId = data.id;
    } else {
      const { error } = await supabase.from('promociones').update(payload).eq('id', modalPromo.id);
      if (error) { setErrModal(error.message); setGuardando(false); return; }
      promoId = modalPromo.id;
      await supabase.from('promocion_items').delete().eq('promocion_id', promoId);
    }

    if (formPromo.items.length > 0) {
      await supabase.from('promocion_items').insert(
        formPromo.items.map((it) => ({
          promocion_id: promoId,
          producto_id: it.tipo === 'fijo' ? it.producto_id : null,
          categoria_id: it.tipo === 'seleccionable' ? it.categoria_id : null,
          cantidad: Number(it.cantidad),
          seleccionable: it.tipo === 'seleccionable',
        }))
      );
    }

    setGuardando(false);
    setModalPromo(null);
    cargar();
  }

  async function togglePromoActiva(promo) {
    setPromociones((prev) => prev.map((p) => p.id === promo.id ? { ...p, activa: !p.activa } : p));
    await supabase.from('promociones').update({ activa: !promo.activa }).eq('id', promo.id);
  }

  async function eliminarPromo(promo) {
    await supabase.from('promociones').delete().eq('id', promo.id);
    setConfirmandoEliminar(null);
    cargar();
  }

  if (!puedeVer) return <div className="sin-acceso">No tenés permiso para ver esta sección.</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin/catalogo">← Volver a categorías</a>

      <header>
        <span className="eyebrow">Catálogo</span>
        <h1>{categoria?.nombre ?? '…'}</h1>
      </header>

      {/* ── PRODUCTOS ── */}
      <section className="tarjeta">
        <div className="seccion-header">
          <h2>Productos</h2>
          {puedeEditar && (
            <button className="btn-nuevo" onClick={abrirModalNuevoProducto}>+ Nuevo producto</button>
          )}
        </div>

        {productos === null && <p className="cargando">Cargando…</p>}
        {productos?.length === 0 && <p className="cargando">No hay productos en esta categoría todavía.</p>}

        <div className="lista">
          {productos?.map((prod) => (
            <div key={prod.id} className={`fila-prod ${!prod.disponible ? 'sin-stock' : ''}`}>
              <div className="prod-info">
                <span className="prod-nombre">{prod.nombre}</span>
                {prod.variantes.length > 0 ? (
                  <span className="prod-precio">
                    {prod.variantes.map((v) => `${v.nombre} $${v.precio}`).join(' · ')}
                  </span>
                ) : (
                  <span className="prod-precio">${prod.precio}</span>
                )}
                {!prod.disponible && <span className="badge-stock">Sin stock</span>}
              </div>
              {puedeEditar && (
                <div className="prod-acciones">
                  <button className="btn-icono" title="Editar" onClick={() => abrirModalEditarProducto(prod)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="btn-icono" title={prod.disponible ? 'Marcar sin stock' : 'Marcar disponible'} onClick={() => toggleDisponible(prod)}>
                    {prod.disponible
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    }
                  </button>
                  {confirmandoEliminar === `prod_${prod.id}` ? (
                    <>
                      <span className="confirmar-texto">¿Eliminar?</span>
                      <button className="btn-icono btn-icono-ok" title="Confirmar" onClick={() => eliminarProducto(prod)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button className="btn-icono" title="Cancelar" onClick={() => setConfirmandoEliminar(null)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </>
                  ) : (
                    <button className="btn-icono btn-icono-danger" title="Eliminar" onClick={() => setConfirmandoEliminar(`prod_${prod.id}`)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── PROMOCIONES ── */}
      <section className="tarjeta">
        <div className="seccion-header">
          <h2>Promociones</h2>
          {puedeEditar && (
            <button className="btn-nuevo" onClick={abrirModalNuevaPromo}>+ Nueva promoción</button>
          )}
        </div>

        {promociones === null && <p className="cargando">Cargando…</p>}
        {promociones?.length === 0 && <p className="cargando">No hay promociones todavía.</p>}

        <div className="lista">
          {promociones?.map((promo) => (
            <div key={promo.id} className={`fila-prod ${!promo.activa ? 'sin-stock' : ''}`}>
              <div className="prod-info">
                <span className="prod-nombre">{promo.nombre}</span>
                <span className="prod-precio">${promo.precio_promo}</span>
                {!promo.activa && <span className="badge-stock">Inactiva</span>}
                {promo.items.length > 0 && (
                  <span className="promo-items">
                    {promo.items.map((it, i) => (
                      <span key={i} className="promo-item-tag">
                        {it.seleccionable
                          ? `${it.cantidad}× a elección`
                          : `${it.cantidad}× ${todosProductos.find((p) => p.id === it.producto_id)?.nombre || '…'}`
                        }
                      </span>
                    ))}
                  </span>
                )}
              </div>
              {puedeEditar && (
                <div className="prod-acciones">
                  <button className="btn-icono" title="Editar" onClick={() => abrirModalEditarPromo(promo)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button className="btn-icono" title={promo.activa ? 'Desactivar' : 'Activar'} onClick={() => togglePromoActiva(promo)}>
                    {promo.activa ? ((<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>)) : ((<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>))}
                  </button>
                  {confirmandoEliminar === `promo_${promo.id}` ? (
                    <>
                      <span className="confirmar-texto">¿Eliminar?</span>
                      <button className="btn-icono btn-icono-ok" title="Confirmar" onClick={() => eliminarPromo(promo)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg></button>
                      <button className="btn-icono" title="Cancelar" onClick={() => setConfirmandoEliminar(null)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </>
                  ) : (
                    <button className="btn-icono btn-icono-danger" title="Eliminar" onClick={() => setConfirmandoEliminar(`promo_${promo.id}`)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── MODAL PRODUCTO ── */}
      {modalProducto && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalProducto(null)}>
          <div className="modal">
            <h2>{modalProducto === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}</h2>

            <label className="campo">
              <span>Nombre *</span>
              <input type="text" value={formProducto.nombre} onChange={(e) => setFormProducto((p) => ({ ...p, nombre: e.target.value }))} />
            </label>

            <label className="campo">
              <span>Descripción</span>
              <textarea rows={2} value={formProducto.descripcion} onChange={(e) => setFormProducto((p) => ({ ...p, descripcion: e.target.value }))} />
            </label>

            <div className="campo">
              <span>Imagen (opcional)</span>
              <div className="imagen-upload">
                {formProducto.imagen_url ? (
                  <div className="imagen-preview">
                    <img src={formProducto.imagen_url} alt="Preview" />
                    <button
                      type="button"
                      className="btn-quitar-imagen"
                      onClick={() => setFormProducto((p) => ({ ...p, imagen_url: '' }))}
                    >
                      ✕ Quitar foto
                    </button>
                  </div>
                ) : (
                  <label className="btn-subir">
                    {formProducto.subiendoImagen ? 'Subiendo…' : '📷 Elegir foto'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={formProducto.subiendoImagen}
                      onChange={(e) => onArchivoElegido(e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>

            <label className="check-campo">
              <input type="checkbox" checked={formProducto.tieneVariantes} onChange={(e) => setFormProducto((p) => ({ ...p, tieneVariantes: e.target.checked, variantes: e.target.checked ? p.variantes : [] }))} />
              Este producto tiene variantes de tamaño (ej: chica, mediana, grande)
            </label>

            {!formProducto.tieneVariantes && (
              <label className="campo">
                <span>Precio *</span>
                <input type="number" min="0" step="0.01" value={formProducto.precio} onChange={(e) => setFormProducto((p) => ({ ...p, precio: e.target.value }))} />
              </label>
            )}

            {formProducto.tieneVariantes && (
              <div className="variantes-bloque">
                <span className="variantes-titulo">Variantes</span>
                {formProducto.variantes.map((v, i) => (
                  <div key={i} className="variante-fila">
                    <input className="variante-input" placeholder="Nombre (ej: Grande)" value={v.nombre} onChange={(e) => actualizarVariante(i, 'nombre', e.target.value)} />
                    <input className="variante-input variante-precio" type="number" min="0" placeholder="Precio" value={v.precio} onChange={(e) => actualizarVariante(i, 'precio', e.target.value)} />
                    <label className="check-mini">
                      <input type="checkbox" checked={v.disponible} onChange={(e) => actualizarVariante(i, 'disponible', e.target.checked)} /> Stock
                    </label>
                    <button className="btn-quitar" onClick={() => quitarVariante(i)}>✕</button>
                  </div>
                ))}
                <button className="btn-agregar-variante" onClick={agregarVariante}>+ Agregar tamaño</button>
              </div>
            )}

            <label className="check-campo">
              <input type="checkbox" checked={formProducto.disponible} onChange={(e) => setFormProducto((p) => ({ ...p, disponible: e.target.checked }))} />
              Disponible (si está sin tilde = "Sin stock")
            </label>

            {errModal && <p className="aviso aviso-error">{errModal}</p>}

            <div className="modal-acciones">
              <button className="btn-cancelar-modal" onClick={() => setModalProducto(null)}>Cancelar</button>
              <button className="btn-guardar-modal" onClick={guardarProducto} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PROMO ── */}
      {modalPromo && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setModalPromo(null)}>
          <div className="modal">
            <h2>{modalPromo === 'nueva' ? 'Nueva promoción' : 'Editar promoción'}</h2>

            <label className="campo">
              <span>Nombre *</span>
              <input type="text" value={formPromo.nombre} onChange={(e) => setFormPromo((p) => ({ ...p, nombre: e.target.value }))} />
            </label>

            <label className="campo">
              <span>Descripción</span>
              <textarea rows={2} value={formPromo.descripcion} onChange={(e) => setFormPromo((p) => ({ ...p, descripcion: e.target.value }))} />
            </label>

            <label className="campo">
              <span>Precio de la promo *</span>
              <input type="number" min="0" step="0.01" value={formPromo.precio_promo} onChange={(e) => setFormPromo((p) => ({ ...p, precio_promo: e.target.value }))} />
            </label>

            <label className="campo">
              <span>URL de imagen (opcional)</span>
              <input type="url" placeholder="https://…" value={formPromo.imagen_url} onChange={(e) => setFormPromo((p) => ({ ...p, imagen_url: e.target.value }))} />
            </label>

            {/* Items de la promo */}
            <div className="variantes-bloque">
              <span className="variantes-titulo">Componentes de la promo</span>
              <p className="campo-hint">
                "Fijo" = producto específico. "A elección" = el cliente elige N unidades de una categoría (ideal para docena de empanadas, etc.)
              </p>
              {formPromo.items.map((it, i) => (
                <div key={i} className="promo-item-fila">
                  <input
                    className="variante-input"
                    type="number" min="1" placeholder="Cant."
                    value={it.cantidad}
                    onChange={(e) => actualizarItemPromo(i, 'cantidad', e.target.value)}
                  />
                  {it.tipo === 'fijo' ? (
                    <select className="variante-input" value={it.producto_id || ''} onChange={(e) => actualizarItemPromo(i, 'producto_id', e.target.value)}>
                      <option value="">— Elegir producto —</option>
                      {todosProductos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  ) : (
                    <select className="variante-input" value={it.categoria_id || ''} onChange={(e) => actualizarItemPromo(i, 'categoria_id', e.target.value)}>
                      <option value="">— Elegir categoría —</option>
                      {todasCategorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  )}
                  <span className="tipo-tag">{it.tipo === 'fijo' ? 'Fijo' : 'A elección'}</span>
                  <button className="btn-quitar" onClick={() => quitarItemPromo(i)}>✕</button>
                </div>
              ))}
              <div className="promo-item-botones">
                <button className="btn-agregar-variante" onClick={() => agregarItemPromo('fijo')}>+ Producto fijo</button>
                <button className="btn-agregar-variante" onClick={() => agregarItemPromo('seleccionable')}>+ A elección (categoría)</button>
              </div>
            </div>

            <label className="check-campo">
              <input type="checkbox" checked={formPromo.activa} onChange={(e) => setFormPromo((p) => ({ ...p, activa: e.target.checked }))} />
              Promoción activa
            </label>

            {errModal && <p className="aviso aviso-error">{errModal}</p>}

            <div className="modal-acciones">
              <button className="btn-cancelar-modal" onClick={() => setModalPromo(null)}>Cancelar</button>
              <button className="btn-guardar-modal" onClick={guardarPromo} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RECORTADOR ── */}
      {modalCrop && imagenSrc && (
        <div className="overlay overlay-crop">
          <div className="modal modal-crop">
            <h2>Encuadrá la foto</h2>
            <p className="crop-hint">Mové y redimensioná el recuadro para centrar el producto. Así es exactamente como va a verse en el menú.</p>

            <div className="crop-preview-wrap">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={ASPECT}
                minWidth={50}
              >
                <img
                  ref={imgRef}
                  src={imagenSrc}
                  alt="Recortar"
                  onLoad={onImageLoad}
                  style={{ maxHeight: '55vh', maxWidth: '100%', display: 'block' }}
                />
              </ReactCrop>
            </div>

            <div className="modal-acciones">
              <button
                className="btn-cancelar-modal"
                onClick={() => { setModalCrop(false); setImagenSrc(null); }}
              >
                Cancelar
              </button>
              <button
                className="btn-guardar-modal"
                onClick={confirmarRecorte}
                disabled={!completedCrop?.width}
              >
                ✓ Usar esta foto
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 720px; margin: 0 auto 28px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 700; font-size: 26px; margin: 0; color: #1a1510; }
        .tarjeta { max-width: 720px; margin: 0 auto 24px; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 28px; }
        .tarjeta h2 { font-family: 'Fraunces', serif; font-size: 18px; margin: 0; }
        .seccion-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .btn-nuevo { background: #c1440e; color: #1a1510; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; }

        .lista { display: flex; flex-direction: column; gap: 8px; }
        .fila-prod { display: flex; align-items: center; gap: 12px; background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 10px; padding: 12px 14px; flex-wrap: wrap; }
        .fila-prod.sin-stock { opacity: 0.5; }
        .prod-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .prod-nombre { font-size: 15px; font-weight: 500; }
        .prod-precio { font-size: 13px; color: #9a8f82; }
        .badge-stock { font-size: 11px; background: rgba(226,87,76,0.15); color: #e2574c; border: 1px solid rgba(226,87,76,0.3); border-radius: 20px; padding: 2px 8px; width: fit-content; }
        .promo-items { display: flex; flex-wrap: wrap; gap: 4px; }
        .promo-item-tag { font-size: 11px; background: rgba(107,113,86,0.2); color: #c7cdb8; border-radius: 20px; padding: 2px 8px; }

        .prod-acciones { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .btn-icono { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 6px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: border-color 0.15s, color 0.15s, background 0.15s; }
        .btn-icono:hover { border-color: #9a8f82; color: #1a1510; }
        .btn-icono-ok { border-color: #6b9c6b; color: #a8d5a8; }
        .btn-icono-ok:hover { background: rgba(107,156,107,0.12); border-color: #6b9c6b; }
        .btn-icono-danger:hover { border-color: #9c3a3a; color: #e2574c; }
        .confirmar-texto { font-size: 12px; color: #e2574c; }

        .cargando { color: #9a8f82; font-size: 14px; }

        /* Modal */
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: #fff; border: 1px solid #ede8e0; border-radius: 16px; padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
        .modal h2 { font-family: 'Fraunces', serif; font-size: 20px; margin: 0; }

        .campo { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: #9a8f82; }
        .campo input, .campo textarea, .campo select { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 9px 12px; font-size: 14px; color: #1a1510; font-family: inherit; outline: none; resize: vertical; }
        .campo input:focus-visible, .campo textarea:focus-visible { border-color: #c1320a; box-shadow: 0 0 0 3px rgba(193,50,10,0.2); }
        .campo-hint { font-size: 12px; color: #b0a898; margin: 0; line-height: 1.5; }

        .check-campo { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #9a8f82; cursor: pointer; }
        .check-campo input { accent-color: #c1320a; }

        .variantes-bloque { display: flex; flex-direction: column; gap: 8px; background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 10px; padding: 14px; }
        .variantes-titulo { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #9a8f82; }
        .variante-fila, .promo-item-fila { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .variante-input { flex: 1; min-width: 80px; background: #fff; border: 1px solid #ede8e0; border-radius: 6px; padding: 7px 10px; font-size: 13px; color: #1a1510; font-family: inherit; outline: none; }
        .variante-precio { max-width: 100px; }
        .check-mini { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #9a8f82; white-space: nowrap; cursor: pointer; }
        .check-mini input { accent-color: #c1320a; }
        .btn-quitar { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 6px; padding: 5px 8px; font-size: 12px; cursor: pointer; }
        .btn-quitar:hover { border-color: #e2574c; color: #e2574c; }
        .btn-agregar-variante { background: transparent; border: 1px dashed #3a3128; color: #9a8f82; border-radius: 6px; padding: 7px 12px; font-size: 12px; font-family: inherit; cursor: pointer; }
        .btn-agregar-variante:hover { border-color: #c1320a; color: #1a1510; }
        .promo-item-botones { display: flex; gap: 8px; flex-wrap: wrap; }
        .tipo-tag { font-size: 11px; color: #b0a898; white-space: nowrap; }

        .aviso { font-size: 13px; margin: 0; padding: 10px 12px; border-radius: 8px; }
        .aviso-error { background: rgba(226,87,76,0.12); border: 1px solid rgba(226,87,76,0.4); color: #e2574c; }

        .modal-acciones { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
        .btn-cancelar-modal { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 8px; padding: 10px 18px; font-size: 14px; font-family: inherit; cursor: pointer; }
        .btn-guardar-modal { background: #c1440e; color: #1a1510; border: none; border-radius: 8px; padding: 10px 18px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .btn-guardar-modal:disabled { opacity: 0.5; cursor: default; }

        .imagen-upload { display: flex; flex-direction: column; gap: 10px; }
        .imagen-preview { display: flex; flex-direction: column; gap: 8px; }
        .imagen-preview img { width: 100%; max-height: 180px; object-fit: cover; border-radius: 8px; border: 1px solid #ede8e0; }
        .btn-quitar-imagen { background: transparent; border: 1px solid #9c3a3a; color: #e2574c; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: inherit; width: fit-content; }
        .btn-subir { display: inline-flex; align-items: center; gap: 8px; background: #f7f5f2; border: 1px dashed #3a3128; color: #9a8f82; border-radius: 8px; padding: 12px 18px; font-size: 14px; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
        .btn-subir:hover { border-color: #c1320a; color: #1a1510; }

        .overlay-crop { z-index: 200; }
        .modal-crop { max-width: 640px; }
        .crop-hint { font-size: 13px; color: #9a8f82; margin: 0; line-height: 1.5; }
        .crop-preview-wrap { display: flex; justify-content: center; background: #f7f5f2; border-radius: 8px; padding: 12px; overflow: hidden; }

        .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}