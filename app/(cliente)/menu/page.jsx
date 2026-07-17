'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '../../../lib/supabaseClient';
import { useCarrito } from '../../../contexts/CarritoContext';
import Checkout from '../../../components/cliente/Checkout';
import { estaAbiertoAhora, proximaApertura } from '../../../lib/clienteUtils';

export default function MenuPage() {
  const { items, agregar, quitar, cantidad, subtotal } = useCarrito();

  const [config, setConfig]               = useState(null);
  const [categorias, setCategorias]       = useState([]);
  const [productos, setProductos]         = useState([]);
  const [promociones, setPromociones]     = useState([]);
  const [metodos, setMetodos]             = useState([]);
  const [abierto, setAbierto]             = useState(null);
  const [proxApertura, setProxApertura]   = useState(null);
  const [categoriaActiva, setCatActiva]   = useState(null);
  const [busqueda, setBusqueda]           = useState('');
  const [showCheckout, setShowCheckout]   = useState(false);
  const [modalProducto, setModalProducto] = useState(null); // producto expandido

  const seccionRefs = useRef({});
  const navRef      = useRef(null);
  const busqRef     = useRef(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const [
      { data: cfg },
      { data: cats },
      { data: prods },
      { data: vars },
      { data: promos },
      { data: promoItems },
      { data: mets },
      { data: horarios },
      { data: franjas },
    ] = await Promise.all([
      supabase.from('local_config').select('*').single(),
      supabase.from('categorias').select('*').eq('activa', true).order('orden'),
      supabase.from('productos').select('*').order('orden'),
      supabase.from('producto_variantes').select('*').eq('disponible', true).order('orden'),
      supabase.from('promociones').select('*').eq('activa', true).order('orden'),
      supabase.from('promocion_items').select('*'),
      supabase.from('metodos_pago').select('*').eq('activo', true).order('orden'),
      supabase.from('horarios').select('*'),
      supabase.from('horario_franjas').select('*'),
    ]);

    if (cfg && horarios && franjas) {
      setConfig(cfg);
      const estaAbierto = estaAbiertoAhora(cfg, horarios, franjas);
      setAbierto(estaAbierto);
      if (!estaAbierto) setProxApertura(proximaApertura(horarios, franjas));
    }
    if (cats) { setCategorias(cats); setCatActiva(cats[0]?.id ?? null); }
    if (prods && vars) {
      setProductos(prods.map(p => ({ ...p, variantes: vars.filter(v => v.producto_id === p.id) })));
    }
    if (promos && promoItems) {
      setPromociones(promos.map(pr => ({ ...pr, items: promoItems.filter(i => i.promocion_id === pr.id) })));
    }
    if (mets) setMetodos(mets);
  }

  // ── Scroll espía ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const els = Object.values(seccionRefs.current).filter(Boolean);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      entries => { entries.forEach(e => { if (e.isIntersecting) setCatActiva(e.target.dataset.catId); }); },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [categorias, promociones]);

  function scrollA(catId) {
    setCatActiva(catId);
    seccionRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────────────
  const busqLower = busqueda.toLowerCase().trim();
  const enBusqueda = busqLower.length > 0;

  const productosFiltrados = enBusqueda
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busqLower) ||
        (p.descripcion || '').toLowerCase().includes(busqLower)
      )
    : null;

  const promosFiltradas = enBusqueda
    ? promociones.filter(p => p.nombre.toLowerCase().includes(busqLower))
    : null;

  const sinResultados = enBusqueda && productosFiltrados.length === 0 && promosFiltradas.length === 0;

  // ── Carrito helpers ───────────────────────────────────────────────────────────
  function cantProd(prodId, varId = null) {
    return items.filter(i => i.tipo === 'producto' && i.id === prodId && (i.variante_id || null) === varId)
                .reduce((s, i) => s + i.cantidad, 0);
  }
  function cantPromo(promoId) {
    return items.filter(i => i.tipo === 'promo' && i.id === promoId).reduce((s, i) => s + i.cantidad, 0);
  }

  // ── Render de una fila de producto ───────────────────────────────────────────
  function FilaProd({ prod }) {
    const tieneVariantes = prod.variantes.length > 0;
    const disponible     = prod.disponible;
    const expandido      = modalProducto?.id === prod.id;

    return (
      <div className={`fila ${!disponible ? 'fila-agotado' : ''}`}>
        <div className="fila-main" onClick={() => disponible && setModalProducto(expandido ? null : prod)}>
          <div className="fila-texto">
            <h3 className="fila-nombre">{prod.nombre}</h3>
            {prod.descripcion && (
              <p className={`fila-desc ${expandido ? 'expandida' : ''}`}>{prod.descripcion}</p>
            )}
            {!disponible && <span className="badge-agotado">Sin stock</span>}
            {!tieneVariantes && disponible && (
              <div className="fila-footer">
                <span className="fila-precio">${prod.precio.toLocaleString('es-AR')}</span>
                <div className="ctrl" onClick={e => e.stopPropagation()}>
                  {cantProd(prod.id) > 0 && (
                    <>
                      <button className="ctrl-btn" onClick={() => quitar({ tipo: 'producto', id: prod.id })}>−</button>
                      <span className="ctrl-n">{cantProd(prod.id)}</span>
                    </>
                  )}
                  <button className="ctrl-btn ctrl-add" onClick={() => agregar({ tipo: 'producto', id: prod.id, nombre_snapshot: prod.nombre, precio: prod.precio, imagen_url: prod.imagen_url })}>+</button>
                </div>
              </div>
            )}
          </div>
          <div className="fila-img-wrap">
            {prod.imagen_url
              ? <img className="fila-img" src={prod.imagen_url} alt={prod.nombre} />
              : <div className="fila-img-ph" />
            }
            {!tieneVariantes && disponible && cantProd(prod.id) > 0 && (
              <span className="img-badge">{cantProd(prod.id)}</span>
            )}
          </div>
        </div>

        {/* Variantes expandidas */}
        {tieneVariantes && disponible && expandido && (
          <div className="variantes-lista" onClick={e => e.stopPropagation()}>
            {prod.variantes.map(v => (
              <div key={v.id} className="variante-fila">
                <div>
                  <span className="var-nombre">{v.nombre}</span>
                  <span className="var-precio">${v.precio.toLocaleString('es-AR')}</span>
                </div>
                <div className="ctrl">
                  {cantProd(prod.id, v.id) > 0 && (
                    <>
                      <button className="ctrl-btn" onClick={() => quitar({ tipo: 'producto', id: prod.id, variante_id: v.id })}>−</button>
                      <span className="ctrl-n">{cantProd(prod.id, v.id)}</span>
                    </>
                  )}
                  <button className="ctrl-btn ctrl-add" onClick={() => agregar({ tipo: 'producto', id: prod.id, variante_id: v.id, variante_nombre: v.nombre, nombre_snapshot: `${prod.nombre} (${v.nombre})`, precio: v.precio, imagen_url: prod.imagen_url })}>+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render de una fila de promo ───────────────────────────────────────────────
  function FilaPromo({ promo }) {
    const cant = cantPromo(promo.id);
    return (
      <div className="fila fila-promo">
        <div className="fila-main">
          <div className="fila-texto">
            <span className="badge-promo">Promoción</span>
            <h3 className="fila-nombre">{promo.nombre}</h3>
            {promo.descripcion && <p className="fila-desc">{promo.descripcion}</p>}
            <div className="fila-footer">
              <span className="fila-precio">${promo.precio_promo.toLocaleString('es-AR')}</span>
              <div className="ctrl">
                {cant > 0 && (
                  <>
                    <button className="ctrl-btn" onClick={() => quitar({ tipo: 'promo', id: promo.id })}>−</button>
                    <span className="ctrl-n">{cant}</span>
                  </>
                )}
                <button className="ctrl-btn ctrl-add" onClick={() => agregar({ tipo: 'promo', id: promo.id, nombre_snapshot: promo.nombre, precio: promo.precio_promo })}>+</button>
              </div>
            </div>
          </div>
          <div className="fila-img-wrap">
            {promo.imagen_url
              ? <img className="fila-img" src={promo.imagen_url} alt={promo.nombre} />
              : <div className="fila-img-ph fila-img-ph-promo" />
            }
            {cant > 0 && <span className="img-badge">{cant}</span>}
          </div>
        </div>
      </div>
    );
  }

  const todasCats = promociones.length > 0
    ? [{ id: '__promos__', nombre: 'Promociones' }, ...categorias]
    : categorias;

  return (
    <div className="pagina">

      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-inner">
          <div className="header-marca">
            <img src="/logo.png" alt="Don Adriano's" className="header-logo" />
            <div>
              <h1 className="header-nombre">Don Adriano's</h1>
              <span className="header-sub">Pizzería & Empanadas · Mendoza</span>
            </div>
          </div>
          <a
            className="btn-consulta"
            href={`https://wa.me/${config?.whatsapp_numero}?text=${encodeURIComponent('Hola, tengo una consulta sobre el menú.')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Consultar
          </a>
        </div>

        {/* Estado del local */}
        {abierto !== null && (
          <div className={`estado-bar ${abierto ? 'abierto' : 'cerrado'}`}>
            <span className="estado-dot" />
            <span>
              {abierto
                ? 'Aceptando pedidos ahora'
                : proxApertura
                  ? `Cerrado ahora · Abrimos ${proxApertura}`
                  : 'Cerrado por el momento'
              }
            </span>
          </div>
        )}

        {/* Buscador */}
        <div className="busq-wrap">
          <div className="busq-inner">
            <svg className="busq-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              ref={busqRef}
              className="busq-input"
              type="search"
              placeholder="Buscar en el menú…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="busq-clear" onClick={() => setBusqueda('')}>✕</button>
            )}
          </div>
        </div>
      </header>

      {/* ── NAV CATEGORÍAS ── */}
      {!enBusqueda && (
        <nav className="cat-nav" ref={navRef}>
          <div className="cat-nav-inner">
            {todasCats.map(cat => (
              <button
                key={cat.id}
                className={`cat-btn ${categoriaActiva === cat.id ? 'activo' : ''}`}
                onClick={() => scrollA(cat.id)}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* ── CONTENIDO ── */}
      <main className="main">

        {/* Resultado de búsqueda */}
        {enBusqueda && (
          <div className="busq-resultados">
            {sinResultados ? (
              <div className="sin-resultados">
                <p>No encontramos "<strong>{busqueda}</strong>" en el menú.</p>
                <button onClick={() => setBusqueda('')}>Ver menú completo</button>
              </div>
            ) : (
              <>
                <p className="busq-total">
                  {(productosFiltrados.length + promosFiltradas.length)} resultado{(productosFiltrados.length + promosFiltradas.length) !== 1 ? 's' : ''} para "<strong>{busqueda}</strong>"
                </p>
                {promosFiltradas.map(pr => <FilaPromo key={pr.id} promo={pr} />)}
                {productosFiltrados.map(p => <FilaProd key={p.id} prod={p} />)}
              </>
            )}
          </div>
        )}

        {/* Menú normal (sin búsqueda) */}
        {!enBusqueda && (
          <>
            {/* Sección promos */}
            {promociones.length > 0 && (
              <section
                className="seccion"
                data-cat-id="__promos__"
                ref={el => { seccionRefs.current['__promos__'] = el; }}
              >
                <h2 className="seccion-titulo">
                  <span className="titulo-bar titulo-bar-promo" />
                  Promociones
                </h2>
                {promociones.map(pr => <FilaPromo key={pr.id} promo={pr} />)}
              </section>
            )}

            {/* Secciones por categoría */}
            {categorias.map(cat => {
              const prods = productos.filter(p => p.categoria_id === cat.id);
              if (!prods.length) return null;
              return (
                <section
                  key={cat.id}
                  className="seccion"
                  data-cat-id={cat.id}
                  ref={el => { seccionRefs.current[cat.id] = el; }}
                >
                  <h2 className="seccion-titulo">
                    <span className="titulo-bar" />
                    {cat.nombre}
                  </h2>
                  {prods.map(p => <FilaProd key={p.id} prod={p} />)}
                </section>
              );
            })}
          </>
        )}
      </main>

      {/* ── CARRITO FAB ── */}
      {cantidad > 0 && !showCheckout && (
        <button className="fab" onClick={() => setShowCheckout(true)}>
          <div className="fab-izq">
            <span className="fab-cant">{cantidad}</span>
            <span className="fab-label">Ver pedido</span>
          </div>
          <span className="fab-total">${subtotal.toLocaleString('es-AR')}</span>
        </button>
      )}

      {/* ── CHECKOUT ── */}
      {showCheckout && (
        <Checkout
          config={config}
          metodos={metodos}
          abierto={abierto}
          proxApertura={proxApertura}
          onClose={() => setShowCheckout(false)}
        />
      )}

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #faf7f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; }

        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&display=swap');

        /* HEADER */
        .header { background: #fff; border-bottom: 1px solid #e8e2d8; position: sticky; top: 0; z-index: 30; }
        .header-inner { max-width: 700px; margin: 0 auto; padding: 14px 16px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .header-marca { display: flex; align-items: center; gap: 10px; }
        .header-logo { width: 52px; height: 52px; object-fit: contain; border-radius: 50%; border: 2px solid #e8e2d8; background: #faf7f2; }
        .header-nombre { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 700; color: #8B0000; line-height: 1.1; }
        .header-sub { font-size: 11px; color: #9a8f82; display: block; margin-top: 2px; }
        .btn-consulta { display: flex; align-items: center; gap: 6px; background: #25d366; color: #fff; border: none; border-radius: 20px; padding: 8px 14px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; text-decoration: none; white-space: nowrap; flex-shrink: 0; transition: filter 0.15s; }
        .btn-consulta:hover { filter: brightness(1.08); }

        /* ESTADO */
        .estado-bar { max-width: 700px; margin: 0 auto; padding: 6px 16px 10px; display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500; }
        .estado-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .abierto { color: #1a6b3a; }
        .abierto .estado-dot { background: #1a6b3a; box-shadow: 0 0 0 3px rgba(26,107,58,0.15); animation: pulso-verde 2s infinite; }
        @keyframes pulso-verde { 0%,100%{box-shadow:0 0 0 3px rgba(26,107,58,0.15)} 50%{box-shadow:0 0 0 5px rgba(26,107,58,0.08)} }
        .cerrado { color: #8B0000; }
        .cerrado .estado-dot { background: #8B0000; }

        /* BUSCADOR */
        .busq-wrap { max-width: 700px; margin: 0 auto; padding: 0 16px 12px; }
        .busq-inner { position: relative; }
        .busq-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9a8f82; pointer-events: none; }
        .busq-input { width: 100%; background: #f5f0e8; border: 1.5px solid #e8e2d8; border-radius: 10px; padding: 10px 36px 10px 36px; font-size: 14px; color: #1a1510; font-family: inherit; outline: none; transition: border-color 0.15s; -webkit-appearance: none; }
        .busq-input:focus { border-color: #c1320a; background: #fff; }
        .busq-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #9a8f82; font-size: 14px; cursor: pointer; padding: 4px; }

        /* NAV CATEGORÍAS */
        .cat-nav { background: #fff; border-bottom: 1px solid #e8e2d8; overflow-x: auto; -webkit-overflow-scrolling: touch; position: sticky; top: 117px; z-index: 25; }
        .cat-nav::-webkit-scrollbar { display: none; }
        .cat-nav-inner { display: flex; max-width: 700px; margin: 0 auto; padding: 0 12px; white-space: nowrap; }
        .cat-btn { background: transparent; border: none; border-bottom: 2px solid transparent; color: #9a8f82; padding: 11px 12px; font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer; white-space: nowrap; transition: color 0.15s, border-color 0.15s; }
        .cat-btn:hover { color: #1a1510; }
        .cat-btn.activo { color: #c1320a; border-bottom-color: #c1320a; font-weight: 600; }

        /* MAIN */
        .main { max-width: 700px; margin: 0 auto; padding: 0 0 120px; }

        /* SECCIONES */
        .seccion { padding-top: 8px; }
        .seccion-titulo { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 700; color: #1a1510; padding: 20px 16px 10px; display: flex; align-items: center; gap: 10px; }
        .titulo-bar { width: 4px; height: 20px; background: #c1320a; border-radius: 2px; flex-shrink: 0; display: inline-block; }
        .titulo-bar-promo { background: #1a6b3a; }

        /* BÚSQUEDA */
        .busq-resultados { padding: 16px 0 0; }
        .busq-total { padding: 0 16px 12px; font-size: 13px; color: #9a8f82; }
        .busq-total strong { color: #1a1510; }
        .sin-resultados { padding: 48px 24px; text-align: center; color: #9a8f82; font-size: 15px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
        .sin-resultados strong { color: #1a1510; }
        .sin-resultados button { background: #1a1510; color: #faf7f2; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-family: inherit; cursor: pointer; }

        /* FILA PRODUCTO */
        .fila { border-bottom: 1px solid #f0ebe3; background: #fff; transition: background 0.1s; }
        .fila:last-child { border-bottom: none; }
        .fila-agotado { opacity: 0.55; }
        .fila-promo { background: #fffdf8; }
        .fila-main { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; cursor: pointer; }
        .fila-main:active { background: #faf7f2; }
        .fila-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .fila-nombre { font-size: 15px; font-weight: 600; color: #1a1510; line-height: 1.3; }
        .fila-desc { font-size: 13px; color: #9a8f82; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .fila-desc.expandida { -webkit-line-clamp: unset; overflow: visible; }
        .fila-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
        .fila-precio { font-size: 16px; font-weight: 700; color: #1a1510; }
        .badge-promo { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #1a6b3a; background: rgba(26,107,58,0.1); border-radius: 4px; padding: 2px 6px; width: fit-content; }
        .badge-agotado { font-size: 11px; font-weight: 600; color: #8B0000; background: rgba(139,0,0,0.08); border-radius: 4px; padding: 2px 8px; width: fit-content; }

        /* IMAGEN */
        .fila-img-wrap { position: relative; flex-shrink: 0; }
        .fila-img { width: 90px; height: 90px; object-fit: cover; border-radius: 10px; border: 1px solid #f0ebe3; display: block; }
        .fila-img-ph { width: 90px; height: 90px; border-radius: 10px; background: #f5f0e8; }
        .fila-img-ph-promo { background: linear-gradient(135deg, #fff8e8, #f5f0e8); }
        .img-badge { position: absolute; top: -6px; right: -6px; background: #c1320a; color: #fff; font-size: 11px; font-weight: 700; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }

        /* VARIANTES */
        .variantes-lista { padding: 0 16px 14px; border-top: 1px solid #f0ebe3; display: flex; flex-direction: column; gap: 10px; margin-top: -2px; padding-top: 12px; }
        .variante-fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .var-nombre { font-size: 14px; color: #1a1510; display: block; }
        .var-precio { font-size: 14px; font-weight: 700; color: #1a1510; display: block; margin-top: 1px; }

        /* CONTROLES +/- */
        .ctrl { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .ctrl-btn { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid #c1320a; background: transparent; color: #c1320a; font-size: 18px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background 0.1s, color 0.1s; }
        .ctrl-btn:active { background: #c1320a; color: #fff; }
        .ctrl-add { background: #c1320a; color: #fff; border-color: #c1320a; }
        .ctrl-add:active { background: #8B0000; }
        .ctrl-n { font-size: 15px; font-weight: 700; min-width: 18px; text-align: center; color: #1a1510; }

        /* FAB CARRITO */
        .fab { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); background: #1a1510; color: #faf7f2; border: none; border-radius: 14px; padding: 0; display: flex; align-items: stretch; font-family: inherit; cursor: pointer; box-shadow: 0 8px 32px rgba(0,0,0,0.22); z-index: 40; overflow: hidden; min-width: 220px; transition: box-shadow 0.15s, transform 0.15s; }
        .fab:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.3); transform: translateX(-50%) translateY(-1px); }
        .fab-izq { display: flex; align-items: center; gap: 10px; padding: 13px 16px; flex: 1; }
        .fab-cant { background: #c1320a; color: #fff; font-size: 12px; font-weight: 700; border-radius: 6px; padding: 2px 8px; }
        .fab-label { font-size: 14px; font-weight: 600; }
        .fab-total { background: rgba(255,255,255,0.1); color: #f2c97e; font-size: 14px; font-weight: 700; display: flex; align-items: center; padding: 13px 16px; border-left: 1px solid rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}