'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCarrito } from '../../../contexts/CarritoContext';
import Checkout from '../../../components/cliente/Checkout';
import { estaAbiertoAhora, proximaApertura, hayAvisoAperturaGuardado, cancelarAvisoApertura, notificarAperturaSiCorresponde } from '../../../lib/clienteUtils';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function MenuPage() {
  const { items, agregar, quitar, cantidad, subtotal } = useCarrito();

  const [config, setConfig]               = useState(null);
  const [categorias, setCategorias]       = useState([]);
  const [productos, setProductos]         = useState([]);
  const [promociones, setPromociones]     = useState([]);
  const [metodos, setMetodos]             = useState([]);
  const [abierto, setAbierto]             = useState(null);
  const [proxApertura, setProxApertura]   = useState(null);
  const [toast, setToast]                 = useState(null);
  const [modalReapertura, setModalReapertura] = useState(false);
  const [modalHorarios, setModalHorarios]     = useState(false);
  const horariosRef = useRef([]);
  const franjasRef  = useRef([]);
  const configRef   = useRef(null);
  const [categoriaActiva, setCatActiva]   = useState(null);
  const [busqueda, setBusqueda]           = useState('');
  const [showCheckout, setShowCheckout]   = useState(false);
  const [expandidoId, setExpandidoId]     = useState(null); // producto con descripción/variantes expandida

  const seccionRefs = useRef({});
  const navRef      = useRef(null);

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!configRef.current || !horariosRef.current.length) return;
      const estabaAbierto = abierto;
      const estaAbierto = estaAbiertoAhora(configRef.current, horariosRef.current, franjasRef.current);
      setAbierto(estaAbierto);
      setProxApertura(estaAbierto ? null : proximaApertura(horariosRef.current, franjasRef.current));
      if (estaAbierto && estabaAbierto === false) manejarReapertura();
    }, 60000);
    return () => clearInterval(interval);
  }, [abierto]);

  useEffect(() => {
    const canal = supabase
      .channel('local-config-cliente')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'local_config' }, (payload) => {
        configRef.current = payload.new;
        setConfig(payload.new);
        if (horariosRef.current.length) {
          const estaAbierto = estaAbiertoAhora(payload.new, horariosRef.current, franjasRef.current);
          setAbierto(estaAbierto);
          setProxApertura(estaAbierto ? null : proximaApertura(horariosRef.current, franjasRef.current));
          if (estaAbierto) manejarReapertura();
        }
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, []);

  function manejarReapertura() {
    if (hayAvisoAperturaGuardado() && items.length > 0) {
      setModalReapertura(true);
      notificarAperturaSiCorresponde();
    } else {
      setToast({ tipo: 'ok', texto: '¡Ya estamos abiertos! Ya podés confirmar tu pedido.' });
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function cargar() {
    const [
      { data: cfg }, { data: cats }, { data: prods }, { data: vars },
      { data: promos }, { data: promoItems }, { data: mets },
      { data: horarios }, { data: franjas },
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
      configRef.current = cfg; horariosRef.current = horarios; franjasRef.current = franjas;
      const estaAbierto = estaAbiertoAhora(cfg, horarios, franjas);
      setAbierto(estaAbierto);
      setProxApertura(estaAbierto ? null : proximaApertura(horarios, franjas));
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

  const busqLower = busqueda.toLowerCase().trim();
  const enBusqueda = busqLower.length > 0;
  const productosFiltrados = enBusqueda
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqLower) || (p.descripcion || '').toLowerCase().includes(busqLower))
    : null;
  const promosFiltradas = enBusqueda
    ? promociones.filter(p => p.nombre.toLowerCase().includes(busqLower))
    : null;
  const sinResultados = enBusqueda && productosFiltrados.length === 0 && promosFiltradas.length === 0;

  function cantProd(prodId, varId = null) {
    return items.filter(i => i.tipo === 'producto' && i.id === prodId && (i.variante_id || null) === varId)
                .reduce((s, i) => s + i.cantidad, 0);
  }
  function cantPromo(promoId) {
    return items.filter(i => i.tipo === 'promo' && i.id === promoId).reduce((s, i) => s + i.cantidad, 0);
  }

  function manejarAgregar(item) {
    agregar(item);
    if (abierto === false) {
      setToast({ tipo: 'info', texto: 'Estamos cerrados ahora — podés armar tu pedido y confirmarlo cuando abramos.' });
      setTimeout(() => setToast(null), 3500);
    }
  }

  // ── Tarjeta de producto ────────────────────────────────────────────────────
  function TarjetaProducto({ prod }) {
    const tieneVariantes = prod.variantes.length > 0;
    const disponible = prod.disponible;
    const expandido = expandidoId === prod.id;
    const descLarga = (prod.descripcion || '').length > 60;

    return (
      <div className={`card ${!disponible ? 'card-agotado' : ''}`}>
        <div className="card-img-wrap">
          {prod.imagen_url
            ? <img className="card-img" src={prod.imagen_url} alt={prod.nombre} />
            : <div className="card-img-ph"><span>Sin foto</span></div>
          }
          {!disponible && <span className="card-badge-agotado">Sin stock</span>}
        </div>

        <div className="card-body">
          <h3 className="card-nombre">{prod.nombre}</h3>

          {prod.descripcion && (
            <p className="card-desc">
              {expandido || !descLarga ? prod.descripcion : `${prod.descripcion.slice(0, 60)}…`}
              {descLarga && (
                <button className="card-vermas" onClick={() => setExpandidoId(expandido ? null : prod.id)}>
                  {expandido ? ' ver menos' : ' ver más'}
                </button>
              )}
            </p>
          )}

          {tieneVariantes ? (
            <div className="card-variantes">
              {prod.variantes.map(v => {
                const c = cantProd(prod.id, v.id);
                return (
                  <div key={v.id} className="variante-row">
                    <div className="variante-info">
                      <span className="variante-nombre">{v.nombre}</span>
                      <span className="variante-precio">${v.precio.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="ctrl">
                      {c > 0 && (
                        <>
                          <button className="ctrl-btn" onClick={() => quitar({ tipo: 'producto', id: prod.id, variante_id: v.id })}>−</button>
                          <span className="ctrl-n">{c}</span>
                        </>
                      )}
                      <button
                        className="ctrl-btn ctrl-add"
                        disabled={!disponible}
                        onClick={() => manejarAgregar({ tipo: 'producto', id: prod.id, variante_id: v.id, variante_nombre: v.nombre, nombre_snapshot: `${prod.nombre} (${v.nombre})`, precio: v.precio, imagen_url: prod.imagen_url })}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card-footer">
              <span className="card-precio">${prod.precio.toLocaleString('es-AR')}</span>
              <div className="ctrl">
                {cantProd(prod.id) > 0 && (
                  <>
                    <button className="ctrl-btn" onClick={() => quitar({ tipo: 'producto', id: prod.id })}>−</button>
                    <span className="ctrl-n">{cantProd(prod.id)}</span>
                  </>
                )}
                <button
                  className="ctrl-btn-agregar"
                  disabled={!disponible}
                  onClick={() => manejarAgregar({ tipo: 'producto', id: prod.id, nombre_snapshot: prod.nombre, precio: prod.precio, imagen_url: prod.imagen_url })}
                >
                  + Agregar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Tarjeta de promo ───────────────────────────────────────────────────────
  function TarjetaPromo({ promo }) {
    const c = cantPromo(promo.id);
    const expandido = expandidoId === `promo_${promo.id}`;
    const descLarga = (promo.descripcion || '').length > 60;

    return (
      <div className="card card-promo">
        <div className="card-img-wrap">
          {promo.imagen_url
            ? <img className="card-img" src={promo.imagen_url} alt={promo.nombre} />
            : <div className="card-img-ph card-img-ph-promo"><span>Promo</span></div>
          }
          <span className="card-badge-promo">Promo</span>
        </div>
        <div className="card-body">
          <h3 className="card-nombre">{promo.nombre}</h3>
          {promo.descripcion && (
            <p className="card-desc">
              {expandido || !descLarga ? promo.descripcion : `${promo.descripcion.slice(0, 60)}…`}
              {descLarga && (
                <button className="card-vermas" onClick={() => setExpandidoId(expandido ? null : `promo_${promo.id}`)}>
                  {expandido ? ' ver menos' : ' ver más'}
                </button>
              )}
            </p>
          )}
          <div className="card-footer">
            <span className="card-precio">${promo.precio_promo.toLocaleString('es-AR')}</span>
            <div className="ctrl">
              {c > 0 && (
                <>
                  <button className="ctrl-btn" onClick={() => quitar({ tipo: 'promo', id: promo.id })}>−</button>
                  <span className="ctrl-n">{c}</span>
                </>
              )}
              <button className="ctrl-btn-agregar" onClick={() => manejarAgregar({ tipo: 'promo', id: promo.id, nombre_snapshot: promo.nombre, precio: promo.precio_promo })}>
                + Agregar
              </button>
            </div>
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
            <div className="header-textos">
              <h1 className="header-nombre">Don Adriano's</h1>
              <span className="header-sub">Pizzería · San José, Guaymallén, Mendoza</span>
            </div>
          </div>

          <div className="header-acciones">
            <a
              className="btn-consulta"
              href={`https://wa.me/${config?.whatsapp_numero}?text=${encodeURIComponent('Hola, tengo una consulta sobre el menú.')}`}
              target="_blank" rel="noopener noreferrer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span className="btn-consulta-txt">Consultar</span>
            </a>

            {/* ── CARRITO — arriba a la derecha ── */}
            {cantidad > 0 && (
              <button className="btn-carrito" onClick={() => setShowCheckout(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <span className="btn-carrito-badge">{cantidad}</span>
                <span className="btn-carrito-precio">${subtotal.toLocaleString('es-AR')}</span>
              </button>
            )}
          </div>
        </div>

        {abierto !== null && (
          <div className={`estado-bar ${abierto ? 'abierto' : 'cerrado'}`}>
            <span className="estado-dot" />
            <span>
              {abierto ? 'Aceptando pedidos ahora' : proxApertura ? `Cerrado ahora · Abrimos ${proxApertura}` : 'Cerrado por el momento'}
            </span>
            <button className="btn-ver-horarios" onClick={() => setModalHorarios(true)}>
              Ver horarios
            </button>
          </div>
        )}

        <div className="busq-wrap">
          <div className="busq-inner">
            <svg className="busq-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="busq-input" type="search" placeholder="Buscar en el menú…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {busqueda && <button className="busq-clear" onClick={() => setBusqueda('')}>✕</button>}
          </div>
        </div>
      </header>

      {!enBusqueda && (
        <nav className="cat-nav">
          <div className="cat-nav-inner">
            {todasCats.map(cat => (
              <button key={cat.id} className={`cat-btn ${categoriaActiva === cat.id ? 'activo' : ''}`} onClick={() => scrollA(cat.id)}>
                {cat.nombre}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="main">
        {enBusqueda && (
          <div className="busq-resultados">
            {sinResultados ? (
              <div className="sin-resultados">
                <p>No encontramos "<strong>{busqueda}</strong>" en el menú.</p>
                <button onClick={() => setBusqueda('')}>Ver menú completo</button>
              </div>
            ) : (
              <>
                <p className="busq-total">{(productosFiltrados.length + promosFiltradas.length)} resultado{(productosFiltrados.length + promosFiltradas.length) !== 1 ? 's' : ''} para "<strong>{busqueda}</strong>"</p>
                <div className="grilla">
                  {promosFiltradas.map(pr => <TarjetaPromo key={pr.id} promo={pr} />)}
                  {productosFiltrados.map(p => <TarjetaProducto key={p.id} prod={p} />)}
                </div>
              </>
            )}
          </div>
        )}

        {!enBusqueda && (
          <>
            {promociones.length > 0 && (
              <section className="seccion" data-cat-id="__promos__" ref={el => { seccionRefs.current['__promos__'] = el; }}>
                <h2 className="seccion-titulo"><span className="titulo-bar titulo-bar-verde" />Promociones</h2>
                <div className="grilla">
                  {promociones.map(pr => <TarjetaPromo key={pr.id} promo={pr} />)}
                </div>
              </section>
            )}

            {categorias.map(cat => {
              const prods = productos.filter(p => p.categoria_id === cat.id);
              if (!prods.length) return null;
              return (
                <section key={cat.id} className="seccion" data-cat-id={cat.id} ref={el => { seccionRefs.current[cat.id] = el; }}>
                  <h2 className="seccion-titulo"><span className="titulo-bar" />{cat.nombre}</h2>
                  <div className="grilla">
                    {prods.map(p => <TarjetaProducto key={p.id} prod={p} />)}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>

      {/* ── MODAL DE HORARIOS ── */}
      {modalHorarios && (
        <div className="modal-horarios-backdrop" onClick={() => setModalHorarios(false)}>
          <div className="modal-horarios" onClick={e => e.stopPropagation()}>
            <div className="modal-horarios-header">
              <h2>Horarios de atención</h2>
              <button className="modal-horarios-close" onClick={() => setModalHorarios(false)}>✕</button>
            </div>

            <div className="modal-horarios-lista">
              {DIAS_SEMANA.map((nombreDia, idx) => {
                const horarioDia = horariosRef.current.find(h => h.dia_semana === idx);
                const franjasDia = horarioDia
                  ? franjasRef.current
                      .filter(f => f.horario_id === horarioDia.id)
                      .sort((a, b) => a.hora_apertura.localeCompare(b.hora_apertura))
                  : [];
                const esHoy = new Date().getDay() === idx;
                const activo = horarioDia?.activo && franjasDia.length > 0;

                return (
                  <div key={idx} className={`horario-fila ${esHoy ? 'horario-hoy' : ''}`}>
                    <span className="horario-dia">
                      {nombreDia}
                      {esHoy && <span className="horario-badge-hoy">Hoy</span>}
                    </span>
                    <span className={`horario-franjas ${!activo ? 'horario-cerrado' : ''}`}>
                      {activo
                        ? franjasDia.map((f, i) => (
                            <span key={i}>
                              {f.hora_apertura.slice(0, 5)} a {f.hora_cierre.slice(0, 5)}
                              {i < franjasDia.length - 1 ? ' · ' : ''}
                            </span>
                          ))
                        : 'Cerrado'
                      }
                    </span>
                  </div>
                );
              })}
            </div>

            {config?.esta_abierto_manual !== null && (
              <p className="modal-horarios-nota">
                {config?.esta_abierto_manual
                  ? 'Nota: el local está forzado a estar abierto en este momento, fuera de su horario habitual.'
                  : 'Nota: el local está cerrado manualmente en este momento, aunque corresponda estar abierto según el horario.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL DE REAPERTURA ── */}
      {modalReapertura && (
        <div className="modal-reap-backdrop" onClick={() => setModalReapertura(false)}>
          <div className="modal-reap" onClick={e => e.stopPropagation()}>
            <div className="modal-reap-icono">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2>¡Ya estamos abiertos!</h2>
            <p>Tenés un pedido armado esperando. ¿Lo confirmamos ahora?</p>
            <button className="modal-reap-btn-si" onClick={() => { cancelarAvisoApertura(); setModalReapertura(false); setShowCheckout(true); }}>
              Revisar y confirmar pedido
            </button>
            <button className="modal-reap-btn-no" onClick={() => setModalReapertura(false)}>Todavía no</button>
          </div>
        </div>
      )}

      {/* ── BOTONES FLOTANTES DE REDES SOCIALES ── */}
      {!showCheckout && (config?.instagram_url || config?.facebook_url) && (
        <div className="redes-flotantes">
          {config.instagram_url && (
            <a className="btn-red btn-red-ig" href={config.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
          )}
          {config.facebook_url && (
            <a className="btn-red btn-red-fb" href={config.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
          )}
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`toast toast-${toast.tipo}`}>
          {toast.tipo === 'ok'
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          }
          <span>{toast.texto}</span>
        </div>
      )}

      {showCheckout && (
        <Checkout config={config} metodos={metodos} abierto={abierto} proxApertura={proxApertura} onClose={() => setShowCheckout(false)} />
      )}

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #fffbf5; color: #22201c; font-family: 'Work Sans', system-ui, sans-serif; }

        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap');

        /* ── HEADER ── */
        .header { background: #fff; border-bottom: 1px solid #ece6dc; position: sticky; top: 0; z-index: 30; }
        .header-inner { max-width: 760px; margin: 0 auto; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .header-marca { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 auto; overflow: hidden; }
        .header-logo { width: 46px; height: 46px; object-fit: contain; border-radius: 50%; border: 2px solid #ece6dc; background: #fffbf5; flex-shrink: 0; }
        .header-textos { min-width: 0; overflow: hidden; }
        .header-nombre { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 700; color: #e23e45; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .header-sub { font-size: 11px; color: #8a8378; display: block; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .header-acciones { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        .btn-consulta { display: flex; align-items: center; gap: 6px; background: #25d366; color: #fff; border: none; border-radius: 20px; padding: 8px 12px; font-size: 13px; font-weight: 600; text-decoration: none; transition: filter 0.15s; }
        .btn-consulta:hover { filter: brightness(1.08); }

        .btn-carrito { display: flex; align-items: center; gap: 7px; background: #22201c; color: #fffbf5; border: none; border-radius: 22px; padding: 9px 14px; cursor: pointer; position: relative; transition: transform 0.15s, box-shadow 0.15s; }
        .btn-carrito:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.18); }
        .btn-carrito-badge { position: absolute; top: -6px; right: -6px; background: #e23e45; color: #fff; font-size: 10px; font-weight: 700; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
        .btn-carrito-precio { font-size: 13px; font-weight: 700; color: #f0c675; }

        /* ── ESTADO ── */
        .estado-bar { max-width: 760px; margin: 0 auto; padding: 6px 16px 10px; display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500; }
        .estado-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .abierto { color: #3c8261; }
        .abierto .estado-dot { background: #3c8261; box-shadow: 0 0 0 3px rgba(61,74,47,0.15); animation: pulso-verde 2s infinite; }
        @keyframes pulso-verde { 0%,100%{box-shadow:0 0 0 3px rgba(61,74,47,0.15)} 50%{box-shadow:0 0 0 5px rgba(61,74,47,0.08)} }
        .cerrado { color: #e23e45; }
        .cerrado .estado-dot { background: #e23e45; }

        .btn-ver-horarios {
          margin-left: auto;
          background: transparent;
          border: none;
          color: inherit;
          font-size: 12px;
          font-weight: 700;
          text-decoration: underline;
          cursor: pointer;
          padding: 2px 0;
          flex-shrink: 0;
        }

        /* ── BUSCADOR ── */
        .busq-wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 12px; }
        .busq-inner { position: relative; }
        .busq-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #8a8378; pointer-events: none; }
        .busq-input { width: 100%; background: #f3efe6; border: 1.5px solid #ece6dc; border-radius: 10px; padding: 10px 36px; font-size: 14px; color: #22201c; font-family: inherit; outline: none; transition: border-color 0.15s; }
        .busq-input:focus { border-color: #e23e45; background: #fff; }
        .busq-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #8a8378; font-size: 14px; cursor: pointer; padding: 4px; }

        /* ── NAV CATEGORÍAS ── */
        .cat-nav { background: #fff; border-bottom: 1px solid #ece6dc; overflow-x: auto; -webkit-overflow-scrolling: touch; position: sticky; top: 117px; z-index: 25; }
        .cat-nav::-webkit-scrollbar { display: none; }
        .cat-nav-inner { display: flex; max-width: 760px; margin: 0 auto; padding: 0 12px; white-space: nowrap; }
        .cat-btn { background: transparent; border: none; border-bottom: 2px solid transparent; color: #8a8378; padding: 11px 12px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: color 0.15s, border-color 0.15s; }
        .cat-btn:hover { color: #22201c; }
        .cat-btn.activo { color: #e23e45; border-bottom-color: #e23e45; font-weight: 700; }

        /* ── MAIN / GRILLA DE TARJETAS ── */
        .main { max-width: 760px; margin: 0 auto; padding: 0 12px 130px; }
        .seccion { padding-top: 24px; }
        .seccion-titulo { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 700; color: #22201c; padding: 0 4px 14px; display: flex; align-items: center; gap: 10px; }
        .titulo-bar { width: 4px; height: 18px; background: #e23e45; border-radius: 2px; }
        .titulo-bar-verde { background: #3c8261; }

        .grilla { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 560px) { .grilla { gap: 14px; } }

        /* ── TARJETA (2 por línea) ── */
        .card { background: #fff; border: 1px solid #ece6dc; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: box-shadow 0.2s, transform 0.2s; }
        .card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.07); transform: translateY(-1px); }
        .card-agotado { opacity: 0.6; }
        .card-promo { border-color: rgba(61,74,47,0.25); }

        .card-img-wrap { position: relative; width: 100%; aspect-ratio: 1/1; background: #f3efe6; }
        .card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .card-img-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #c4bcae; font-size: 12px; }
        .card-img-ph-promo { background: linear-gradient(135deg, #f3efe6, #eae3d4); }
        .card-badge-agotado { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 700; background: #fff; color: #e23e45; border-radius: 6px; padding: 3px 7px; }
        .card-badge-promo { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: #3c8261; color: #fff; border-radius: 6px; padding: 3px 8px; }

        .card-body { padding: 10px 11px 12px; display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .card-nombre { font-size: 13.5px; font-weight: 700; color: #22201c; line-height: 1.3; }
        .card-desc { font-size: 11.5px; color: #8a8378; line-height: 1.45; }
        .card-vermas { background: none; border: none; padding: 0; margin: 0; color: #e23e45; font-size: 11.5px; font-weight: 600; cursor: pointer; }

        .card-footer { display: flex; flex-direction: column; gap: 8px; margin-top: auto; padding-top: 4px; }
        .card-precio { font-size: 15px; font-weight: 700; color: #22201c; }

        .card-variantes { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
        .variante-row { display: flex; flex-direction: column; gap: 5px; padding-top: 6px; border-top: 1px solid #f3efe6; }
        .variante-row:first-child { border-top: none; padding-top: 0; }
        .variante-info { display: flex; align-items: baseline; justify-content: space-between; }
        .variante-nombre { font-size: 11.5px; color: #55504a; }
        .variante-precio { font-size: 12.5px; font-weight: 700; color: #22201c; }

        /* ── CONTROLES +/- ── */
        .ctrl { display: flex; align-items: center; gap: 6px; }
        .ctrl-btn { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #e23e45; background: transparent; color: #e23e45; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background 0.1s, color 0.1s; flex-shrink: 0; }
        .ctrl-btn:hover { background: #e23e45; color: #fff; }
        .ctrl-n { font-size: 13px; font-weight: 700; min-width: 14px; text-align: center; }

        .ctrl-btn-agregar { width: 100%; background: #e23e45; color: #fff; border: none; border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s; }
        .ctrl-btn-agregar:hover:not(:disabled) { background: #c22e35; }
        .ctrl-btn-agregar:disabled { opacity: 0.4; cursor: default; }

        /* ── BÚSQUEDA ── */
        .busq-resultados { padding: 16px 4px 0; }
        .busq-total { padding: 0 4px 12px; font-size: 13px; color: #8a8378; }
        .busq-total strong { color: #22201c; }
        .sin-resultados { padding: 48px 24px; text-align: center; color: #8a8378; font-size: 15px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
        .sin-resultados strong { color: #22201c; }
        .sin-resultados button { background: #22201c; color: #fffbf5; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-family: inherit; cursor: pointer; }

        /* ── MODAL REAPERTURA ── */
        .modal-horarios-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 70; padding: 20px; backdrop-filter: blur(2px); }
        .modal-horarios { background: #fff; border-radius: 20px; padding: 24px; max-width: 380px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.25); animation: modalIn 0.25s cubic-bezier(0.32,0.72,0,1); }
        .modal-horarios-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .modal-horarios-header h2 { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 700; color: #22201c; margin: 0; }
        .modal-horarios-close { background: #f3efe6; border: none; color: #8a8378; border-radius: 50%; width: 30px; height: 30px; font-size: 13px; cursor: pointer; flex-shrink: 0; }
        .modal-horarios-lista { display: flex; flex-direction: column; gap: 2px; }
        .horario-fila { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 10px 8px; border-radius: 8px; }
        .horario-hoy { background: #fff5f3; }
        .horario-dia { font-size: 13.5px; font-weight: 600; color: #22201c; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        .horario-badge-hoy { font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: #e23e45; color: #fff; border-radius: 10px; padding: 1px 6px; }
        .horario-franjas { font-size: 13px; color: #55504a; text-align: right; }
        .horario-cerrado { color: #b0a898; }
        .modal-horarios-nota { font-size: 11.5px; color: #8a8378; line-height: 1.5; margin-top: 14px; padding-top: 14px; border-top: 1px solid #ece6dc; }

        .modal-reap-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 70; padding: 24px; backdrop-filter: blur(2px); }
        .modal-reap { background: #fff; border-radius: 20px; padding: 32px 28px; max-width: 340px; width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); animation: modalIn 0.3s cubic-bezier(0.32,0.72,0,1); }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.92) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .modal-reap-icono { width: 60px; height: 60px; border-radius: 50%; background: rgba(61,74,47,0.1); color: #3c8261; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
        .modal-reap h2 { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 700; color: #22201c; margin: 0; }
        .modal-reap p { font-size: 14px; color: #55504a; line-height: 1.5; margin: 4px 0 18px; }
        .modal-reap-btn-si { width: 100%; background: #e23e45; color: #fff; border: none; border-radius: 12px; padding: 14px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; margin-bottom: 8px; transition: filter 0.15s; }
        .modal-reap-btn-si:hover { filter: brightness(1.1); }
        .modal-reap-btn-no { width: 100%; background: transparent; border: none; color: #8a8378; font-size: 13px; font-family: inherit; cursor: pointer; padding: 6px; }

        /* ── TOAST ── */
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 32px); display: flex; align-items: center; gap: 10px; background: #22201c; color: #fffbf5; padding: 13px 18px; border-radius: 12px; font-size: 13px; line-height: 1.4; box-shadow: 0 8px 28px rgba(0,0,0,0.25); z-index: 45; animation: toastIn 0.25s ease; }
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .toast-info svg { color: #e23e45; flex-shrink: 0; }
        .toast-ok svg { color: #7ec98f; flex-shrink: 0; }

        .redes-flotantes {
          position: fixed;
          bottom: 20px;
          left: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 35;
        }
        .btn-red {
          width: 46px; height: 46px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-red:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 6px 18px rgba(0,0,0,0.24); }
        .btn-red-ig { background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); }
        .btn-red-fb { background: #1877f2; }

        @media (max-width: 380px) {
          .header-sub { display: none; }
          .btn-consulta-txt { display: none; }
          .btn-consulta { padding: 9px; }
        }
      `}</style>
    </div>
  );
}