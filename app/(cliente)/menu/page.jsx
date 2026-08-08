'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import { useCarrito } from '../../../contexts/CarritoContext';
import Checkout from '../../../components/cliente/Checkout';
import { estaAbiertoAhora, proximaApertura, hayAvisoAperturaGuardado, cancelarAvisoApertura, notificarAperturaSiCorresponde } from '../../../lib/clienteUtils';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ── Revelado en scroll: cada sección de categoría hace un fade + slide sutil al entrar en pantalla
// (una sola vez), en vez de aparecer de golpe con el resto de la página ──
function useEnPantalla({ margen = '0px 0px -80px 0px', umbral = 0.12 } = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.unobserve(el);
      }
    }, { threshold: umbral, rootMargin: margen });
    obs.observe(el);
    return () => obs.disconnect();
  }, [margen, umbral, visible]);
  return [ref, visible];
}

function Seccion({ className = '', children }) {
  const [ref, visible] = useEnPantalla();
  return (
    <section ref={ref} className={`seccion ${visible ? 'seccion-visible' : ''} ${className}`.trim()}>
      {children}
    </section>
  );
}

// ── Fila horizontal con flechas que se esconden solas cuando ya no hay para dónde scrollear
// (antes las dos flechas quedaban siempre visibles, aunque ya estuvieras en una punta) ──
function FilaHorizontal({ children }) {
  const scrollRef = useRef(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);

  function actualizarFlechas() {
    const el = scrollRef.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 4);
    setPuedeDer(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    actualizarFlechas();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', actualizarFlechas, { passive: true });
    window.addEventListener('resize', actualizarFlechas);
    return () => {
      el.removeEventListener('scroll', actualizarFlechas);
      window.removeEventListener('resize', actualizarFlechas);
    };
  }, []);

  function mover(direccion) {
    scrollRef.current?.scrollBy({ left: direccion * 320, behavior: 'smooth' });
  }

  return (
    <div className="fila-horizontal-wrap">
      {puedeIzq && (
        <button className="fila-flecha fila-flecha-izq" onClick={() => mover(-1)} aria-label="Ver anteriores">‹</button>
      )}
      <div className="fila-horizontal" ref={scrollRef}>
        {children}
      </div>
      {puedeDer && (
        <button className="fila-flecha fila-flecha-der" onClick={() => mover(1)} aria-label="Ver siguientes">›</button>
      )}
    </div>
  );
}

// ── Skeleton con forma de "bollo de masa" (blob orgánico) en vez de rectángulos grises genéricos,
// para que la carga se sienta parte de la marca en vez de un placeholder cualquiera ──
function TarjetaSkeleton() {
  return (
    <div className="card card-skeleton" aria-hidden="true">
      <div className="skel-img">
        <span className="skel-bollo" />
      </div>
      <div className="card-body">
        <span className="skel-linea skel-linea-titulo" />
        <span className="skel-linea skel-linea-desc" />
        <span className="skel-linea skel-linea-desc-corta" />
        <span className="skel-precio" />
      </div>
    </div>
  );
}

function SkeletonMenu() {
  return (
    <section className="seccion seccion-visible" aria-hidden="true">
      <h2 className="seccion-titulo skel-titulo-seccion"><span className="titulo-bar" />&nbsp;</h2>
      <div className="grilla grilla-lista">
        {Array.from({ length: 6 }).map((_, i) => <TarjetaSkeleton key={i} />)}
      </div>
    </section>
  );
}

// ── Platos rebotando en la pantalla de carga: uno a la vez, entra con un rebote y pausa, como una vidriera
// asomando lo que se puede pedir mientras se espera ── siluetas propias, mismo estilo que el ícono de la llama ──
const PLATOS = [
  { id: 'pizza', label: 'Pizza' },
  { id: 'empanada', label: 'Empanadas' },
  { id: 'lomo', label: 'Lomitos' },
  { id: 'hamburguesa', label: 'Hamburguesas' },
  { id: 'papas', label: 'Papas fritas' },
];

function IconoPlato({ tipo }) {
  if (tipo === 'pizza') return <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L22.5 21c-3 1.6-6.6 2.5-10.5 2.5S4.5 22.6 1.5 21L12 2z"/></svg>;
  if (tipo === 'empanada') return <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 1 0 18V3z"/><path d="M12 3a9 9 0 0 0 0 18V3z" opacity="0.55"/></svg>;
  if (tipo === 'lomo') return <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="4" rx="2"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="2"/></svg>;
  if (tipo === 'hamburguesa') return <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M4 8a8 6 0 0 1 16 0z"/><rect x="3" y="10" width="18" height="3" rx="1.5"/><rect x="3" y="14" width="18" height="3" rx="1.5"/><rect x="3" y="18" width="18" height="3" rx="1.5"/></svg>;
  if (tipo === 'papas') return <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M5 10h14l-2 12H7z"/><rect x="6" y="4" width="2.4" height="10" rx="1"/><rect x="10.8" y="2" width="2.4" height="12" rx="1"/><rect x="15.6" y="5" width="2.4" height="9" rx="1"/></svg>;
  return null;
}

function PlatosRebotando({ variante = 'clara', reduceMotion = false }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduceMotion) return; // sin ciclo automático: se queda en el primer plato, quieto
    const id = setInterval(() => setIdx(p => (p + 1) % PLATOS.length), 1500);
    return () => clearInterval(id);
  }, [reduceMotion]);
  const plato = PLATOS[idx];
  return (
    <div className={`splash-platos ${variante === 'oscura' ? 'splash-platos-oscura' : ''}`} aria-hidden="true">
      <div className="splash-plato-stage">
        <div key={plato.id} className="splash-plato-icono"><IconoPlato tipo={plato.id} /></div>
        <span key={`sombra-${plato.id}`} className="splash-plato-sombra" />
      </div>
      <span className="splash-plato-label">{plato.label}</span>
    </div>
  );
}

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
  const [scrolled, setScrolled]           = useState(false);
  const horariosRef = useRef([]);
  const franjasRef  = useRef([]);
  const configRef   = useRef(null);
  const [categoriaActiva, setCatActiva]   = useState(null);
  const [busqueda, setBusqueda]           = useState('');
  const [showCheckout, setShowCheckout]   = useState(false);
  const [expandidoId, setExpandidoId]     = useState(null); // producto con descripción/variantes expandida
  const [fotoAmpliada, setFotoAmpliada]   = useState(null); // { url, alt } de la foto de un producto/promo en grande
  const [splashListo, setSplashListo]     = useState(false);
  const [cargando, setCargando]           = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const heroRef       = useRef(null);
  const navRef      = useRef(null);
  const dialogoRefs = {
    lightboxFoto: useRef(null),
    modalHorarios: useRef(null),
    modalReapertura: useRef(null),
    resumenCarrito: useRef(null),
  };
  const focoPrevioRef = useRef(null);
  const cantidadPrevRef = useRef(0);
  const [reboteCarrito, setReboteCarrito] = useState(0);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  useEffect(() => {
    if (cantidad > cantidadPrevRef.current) setReboteCarrito(r => r + 1);
    cantidadPrevRef.current = cantidad;
    if (cantidad === 0) setMostrarResumen(false);
  }, [cantidad]);

  // Accesibilidad de modales/lightboxes: Escape para cerrar (el que esté abierto),
  // foco inicial dentro del diálogo al abrir, y foco de vuelta a quien lo abrió al cerrar.
  useEffect(() => {
    const hayModalAbierto = fotoAmpliada || modalHorarios || modalReapertura || mostrarResumen;

    if (hayModalAbierto) {
      focoPrevioRef.current = document.activeElement;
      const ref = fotoAmpliada ? dialogoRefs.lightboxFoto
        : modalHorarios ? dialogoRefs.modalHorarios
        : modalReapertura ? dialogoRefs.modalReapertura
        : dialogoRefs.resumenCarrito;
      const primero = ref.current?.querySelector('button, a[href], input, [tabindex]:not([tabindex="-1"])');
      primero?.focus();
    } else if (focoPrevioRef.current) {
      focoPrevioRef.current.focus();
      focoPrevioRef.current = null;
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (fotoAmpliada) setFotoAmpliada(null);
        else if (modalHorarios) setModalHorarios(false);
        else if (modalReapertura) setModalReapertura(false);
        else if (mostrarResumen) setMostrarResumen(false);
      }
    }
    if (hayModalAbierto) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [fotoAmpliada, modalHorarios, modalReapertura, mostrarResumen]);

  // Mantiene el foco dentro del diálogo abierto mientras se navega con Tab.
  function atraparFoco(e, ref) {
    if (e.key !== 'Tab' || !ref.current) return;
    const focables = ref.current.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
    if (!focables.length) return;
    const primero = focables[0];
    const ultimo = focables[focables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault(); ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primero.focus();
    }
  }

  useEffect(() => { cargar(); }, []);

  // Momento de marca: la pantalla de carga inicial deja de ser un blanco vacío mientras se trae la info.
  // Se queda un mínimo de tiempo aunque la carga sea instantánea, para que no parpadee.
  useEffect(() => {
    if (config) {
      const t = setTimeout(() => setSplashListo(true), 550);
      return () => clearTimeout(t);
    }
  }, [config]);

  // El header ya no cambia de tamaño con JS: la parte "de más" (subtítulo + estado) vive en el flujo normal
  // de la página y se va con el scroll de forma nativa. Lo único que queda atado a un IntersectionObserver
  // es un detalle puramente cosmético (la sombra de la barra sticky), que no afecta ningún layout — por eso
  // no hay forma de que se retroalimente con nada.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
    if (cats) { setCategorias(cats); setCatActiva('__todo__'); }
    if (prods && vars) {
      setProductos(prods.map(p => ({ ...p, variantes: vars.filter(v => v.producto_id === p.id) })));
    }
    if (promos && promoItems) {
      setPromociones(promos.map(pr => ({ ...pr, items: promoItems.filter(i => i.promocion_id === pr.id) })));
    }
    if (mets) setMetodos(mets);
    setCargando(false);
  }

  function seleccionarCategoria(catId) {
    setCatActiva(catId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const busqLower = busqueda.toLowerCase().trim();
  const enBusqueda = busqLower.length > 0;
  const productosFiltrados = enBusqueda
    ? ordenarDisponibilidad(productos.filter(p => p.nombre.toLowerCase().includes(busqLower) || (p.descripcion || '').toLowerCase().includes(busqLower)))
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

  // Agotados siempre al final; entre disponibles, los nuevos primero.
  function ordenarDisponibilidad(lista) {
    return [...lista].sort((a, b) => {
      const aAgotado = a.disponible === false ? 1 : 0;
      const bAgotado = b.disponible === false ? 1 : 0;
      if (aAgotado !== bAgotado) return aAgotado - bAgotado;
      return (b.es_nuevo ? 1 : 0) - (a.es_nuevo ? 1 : 0);
    });
  }

  // Botón de agregar con feedback visual: al tocarlo, hace un pop de color y muestra
  // una burbuja "+1" que sube y se desvanece, para que quede claro que el producto entró al carrito.
  function BotonAgregar({ pequeno, disponible, onAdd, children }) {
    const [pulso, setPulso] = useState(false);
    const timeoutRef = useRef(null);

    function click() {
      onAdd();
      setPulso(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setPulso(false), 650);
    }
    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    return (
      <button
        type="button"
        className={`${pequeno ? 'ctrl-btn ctrl-add' : 'ctrl-btn-agregar'} ${pulso ? 'btn-agregado' : ''}`}
        disabled={!disponible}
        onClick={click}
      >
        {children}
        {pulso && <span className="flotante-mas1" aria-hidden="true">+1</span>}
      </button>
    );
  }

  function TarjetaProducto({ prod }) {
    const tieneVariantes = prod.variantes.length > 0;
    const disponible = prod.disponible;
    const expandido = expandidoId === prod.id;
    const descLarga = (prod.descripcion || '').length > 60;

    return (
      <div className={`card ${!disponible ? 'card-agotado' : ''}`}>
        {prod.imagen_url ? (
          <button
            type="button"
            className="card-img-wrap card-img-clicable"
            aria-label={`Ver foto de ${prod.nombre} en grande`}
            onClick={() => setFotoAmpliada({ url: prod.imagen_url, alt: prod.nombre })}
          >
            <img className="card-img" src={prod.imagen_url} alt="" />
            {!disponible && <span className="card-badge-agotado">Sin stock</span>}
            {disponible && prod.es_nuevo && <span className="card-badge-nuevo">Nuevo</span>}
          </button>
        ) : (
          <div className="card-img-wrap">
            <div className="card-img-ph"><span>Sin foto</span></div>
            {!disponible && <span className="card-badge-agotado">Sin stock</span>}
            {disponible && prod.es_nuevo && <span className="card-badge-nuevo">Nuevo</span>}
          </div>
        )}

        <div className="card-body">
          <h3 className="card-nombre">{prod.nombre}</h3>

          <p className={`card-desc ${expandido ? 'card-desc-expandida' : ''}`}>
            {prod.descripcion
              ? (expandido || !descLarga ? prod.descripcion : `${prod.descripcion.slice(0, 60)}…`)
              : ''}
            {descLarga && (
              <button className="card-vermas" onClick={() => setExpandidoId(expandido ? null : prod.id)}>
                {expandido ? ' ver menos' : ' ver más'}
              </button>
            )}
          </p>

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
                      <BotonAgregar
                        pequeno
                        disponible={disponible}
                        onAdd={() => manejarAgregar({ tipo: 'producto', id: prod.id, variante_id: v.id, variante_nombre: v.nombre, nombre_snapshot: `${prod.nombre} (${v.nombre})`, precio: v.precio, imagen_url: prod.imagen_url })}
                      >+</BotonAgregar>
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
                <BotonAgregar
                  disponible={disponible}
                  onAdd={() => manejarAgregar({ tipo: 'producto', id: prod.id, nombre_snapshot: prod.nombre, precio: prod.precio, imagen_url: prod.imagen_url })}
                >
                  + Agregar
                </BotonAgregar>
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
        {promo.imagen_url ? (
          <button
            type="button"
            className="card-img-wrap card-img-clicable"
            aria-label={`Ver foto de ${promo.nombre} en grande`}
            onClick={() => setFotoAmpliada({ url: promo.imagen_url, alt: promo.nombre })}
          >
            <img className="card-img" src={promo.imagen_url} alt="" />
            <span className="card-badge-promo">Promo</span>
          </button>
        ) : (
          <div className="card-img-wrap">
            <div className="card-img-ph card-img-ph-promo"><span>Promo</span></div>
            <span className="card-badge-promo">Promo</span>
          </div>
        )}
        <div className="card-body">
          <h3 className="card-nombre">{promo.nombre}</h3>
          <p className={`card-desc ${expandido ? 'card-desc-expandida' : ''}`}>
            {promo.descripcion
              ? (expandido || !descLarga ? promo.descripcion : `${promo.descripcion.slice(0, 60)}…`)
              : ''}
            {descLarga && (
              <button className="card-vermas" onClick={() => setExpandidoId(expandido ? null : `promo_${promo.id}`)}>
                {expandido ? ' ver menos' : ' ver más'}
              </button>
            )}
          </p>
          <div className="card-footer">
            <span className="card-precio">${promo.precio_promo.toLocaleString('es-AR')}</span>
            <div className="ctrl">
              {c > 0 && (
                <>
                  <button className="ctrl-btn" onClick={() => quitar({ tipo: 'promo', id: promo.id })}>−</button>
                  <span className="ctrl-n">{c}</span>
                </>
              )}
              <BotonAgregar
                disponible={true}
                onAdd={() => manejarAgregar({ tipo: 'promo', id: promo.id, nombre_snapshot: promo.nombre, precio: promo.precio_promo, imagen_url: promo.imagen_url })}
              >
                + Agregar
              </BotonAgregar>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hayProductosNuevos = productos.some(p => p.es_nuevo);

  const todasCats = [
    { id: '__todo__', nombre: 'Todo', count: productos.length + promociones.length },
    ...(hayProductosNuevos ? [{ id: '__nuevo__', nombre: 'Nuevo', count: productos.filter(p => p.es_nuevo).length }] : []),
    ...(promociones.length > 0 ? [{ id: '__promos__', nombre: 'Promociones', count: promociones.length }] : []),
    ...categorias.map(cat => ({ ...cat, count: productos.filter(p => p.categoria_id === cat.id).length })),
  ];

  return (
    <div className="pagina">

      {/* ── MOMENTO DE MARCA: pantalla de carga inicial, en vez de blanco vacío mientras se traen los datos ── */}
      {!splashListo && (
        <div className={`marca-splash ${config ? 'marca-splash-salir' : ''}`} aria-hidden={config ? 'true' : undefined}>
          <img src="/logo.png" alt="" className="marca-splash-logo" />
          <p className="marca-splash-nombre">Don Adriano's</p>
          <p className="marca-splash-frase">
            <span className="icono-llama">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.5 3-5 5-5 10a5 5 0 0 0 10 0c0-2-1-3-1.5-4 .2 1.5-.7 2.5-1.5 2.5.5-2-.5-4-2-5 .3 1.5-.5 2-1 1.5.5-2 .5-3.5 1-5z"/></svg>
            </span>
            Amasando la página
            <span className="marca-splash-puntos"><span>.</span><span>.</span><span>.</span></span>
          </p>
        </div>
      )}

      {/* ── HERO: subtítulo. Vive en el flujo normal de la página (no es sticky), así que se va con el scroll
           de forma 100% nativa del navegador, sin ningún JS que decida "cuándo". ── */}
      <div className="header-hero" ref={heroRef}>
        <span className="header-hero-sub">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          San José, Guaymallén, Mendoza
        </span>
      </div>

      {/* ── BARRA STICKY: tamaño siempre constante (nunca anima su layout), por eso no puede retroalimentarse con el scroll.
           Lo único que cambia al scrollear es una sombra (puramente cosmética, no afecta el tamaño de nada). ── */}
      <div className={`sticky-top ${scrolled ? 'con-sombra' : ''}`}>
        <header className="header">
          <div className="header-inner">
            <div className="header-marca">
              <span className="header-logo-wrap">
                <img src="/logo.png" alt="Don Adriano's" className="header-logo" />
              </span>
              <div className="header-texto">
                <h1 className="header-nombre">Don Adriano's</h1>
                {abierto !== null && (
                  <span className={`header-estado ${abierto ? 'abierto' : 'cerrado'}`}>
                    <span className="header-estado-dot" />
                    {abierto ? 'Abierto ahora' : proxApertura ? `Cerrado · Abre ${proxApertura}` : 'Cerrado'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="busq-wrap">
            <div className="busq-inner">
              <label htmlFor="busqueda-input" className="sr-only">Buscar en el menú</label>
              <svg className="busq-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input id="busqueda-input" className="busq-input" type="search" placeholder="Buscar en el menú…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              {busqueda && <button className="busq-clear" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">✕</button>}
            </div>
          </div>
        </header>

      </div>

      {/* ── envuelve la navegación y los productos ── */}
      <div className="contenido-scroll">
        {!enBusqueda && (
          <nav className="cat-nav cat-nav-abajo">
            <div className="cat-nav-inner">
              {todasCats.map(cat => (
                <button key={cat.id} className={`cat-btn ${categoriaActiva === cat.id ? 'activo' : ''}`} onClick={() => seleccionarCategoria(cat.id)}>
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

        {!enBusqueda && cargando && <SkeletonMenu />}

        {!enBusqueda && !cargando && (
          <div key={categoriaActiva} className="cat-contenido-anim">
            {/* Nuevo: productos marcados como recién lanzados */}
            {hayProductosNuevos && categoriaActiva === '__nuevo__' && (
              <Seccion>
                <h2 className="seccion-titulo"><span className="titulo-bar titulo-bar-nuevo" />Nuevo</h2>
                <div className="grilla grilla-lista">
                  {ordenarDisponibilidad(productos.filter(p => p.es_nuevo)).map(p => <TarjetaProducto key={p.id} prod={p} />)}
                </div>
              </Seccion>
            )}

            {/* Promociones: en "Todo" es una fila horizontal, en su propia pestaña es grilla vertical */}
            {promociones.length > 0 && (categoriaActiva === '__todo__' || categoriaActiva === '__promos__') && (
              <Seccion>
                <h2 className="seccion-titulo">
                  <span className="titulo-bar titulo-bar-verde" />
                  Promociones
                  {categoriaActiva === '__todo__' && <span className="seccion-count">{promociones.length} producto{promociones.length !== 1 ? 's' : ''}</span>}
                </h2>
                {categoriaActiva === '__todo__' ? (
                  <FilaHorizontal>
                    {promociones.map(pr => (
                      <div key={pr.id} className="card-h-wrap"><TarjetaPromo promo={pr} /></div>
                    ))}
                  </FilaHorizontal>
                ) : (
                  <div className="grilla grilla-lista">
                    {promociones.map(pr => <TarjetaPromo key={pr.id} promo={pr} />)}
                  </div>
                )}
              </Seccion>
            )}

            {/* Categorías: en "Todo" cada una es una fila horizontal; si hay una elegida, grilla vertical con todo */}
            {categorias
              .filter(cat => categoriaActiva === '__todo__' || categoriaActiva === cat.id)
              .map(cat => {
                const prods = ordenarDisponibilidad(productos.filter(p => p.categoria_id === cat.id));
                if (!prods.length) return null;
                return (
                  <Seccion key={cat.id}>
                    <h2 className="seccion-titulo">
                      <span className="titulo-bar" />
                      {cat.nombre}
                      {categoriaActiva === '__todo__' && <span className="seccion-count">{prods.length} producto{prods.length !== 1 ? 's' : ''}</span>}
                    </h2>
                    {categoriaActiva === '__todo__' ? (
                      <FilaHorizontal>
                        {prods.map(p => (
                          <div key={p.id} className="card-h-wrap"><TarjetaProducto prod={p} /></div>
                        ))}
                      </FilaHorizontal>
                    ) : (
                      <div className="grilla grilla-lista">
                        {prods.map(p => <TarjetaProducto key={p.id} prod={p} />)}
                      </div>
                    )}
                  </Seccion>
                );
              })}

            {/* Categoría específica sin productos */}
            {categoriaActiva !== '__todo__' && categoriaActiva !== '__promos__' && categoriaActiva !== '__nuevo__' &&
              productos.filter(p => p.categoria_id === categoriaActiva).length === 0 && (
                <div className="seccion-vacia">
                  <p>No hay productos cargados en esta categoría todavía.</p>
                  <PlatosRebotando reduceMotion={reduceMotion} />
                </div>
            )}
          </div>
        )}
      </main>
      </div>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-marca">
              <img src="/logo.png" alt="Don Adriano's" className="footer-logo" />
              <div>
                <h3>Don Adriano's</h3>
                <p>Pizzería artesanal · San José, Guaymallén, Mendoza</p>
              </div>
            </div>

            <div className="footer-columnas">
              <div className="footer-col">
                <h4>Contacto</h4>
                <ul className="footer-lista">
                  {config?.whatsapp_numero && (
                    <li>
                      <a href={`https://wa.me/${config.whatsapp_numero}`} target="_blank" rel="noopener noreferrer">
                        <svg className="footer-link-icono" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0012.05 0z"/></svg>
                        WhatsApp
                      </a>
                    </li>
                  )}
                  <li>
                    <button className="footer-link-btn" onClick={() => setModalHorarios(true)}>
                      <svg className="footer-link-icono" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>
                      Horarios de atención
                    </button>
                  </li>
                  {config?.latitud_local && (
                    <li>
                      <a href={`https://maps.google.com/?q=${config.latitud_local},${config.longitud_local}`} target="_blank" rel="noopener noreferrer">
                        <svg className="footer-link-icono" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Cómo llegar
                      </a>
                    </li>
                  )}
                </ul>
              </div>

              {(config?.instagram_url || config?.facebook_url) && (
                <div className="footer-col">
                  <h4>Seguinos</h4>
                  <div className="footer-redes">
                    {config.instagram_url && (
                      <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" className="footer-red footer-red-ig" aria-label="Instagram">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                      </a>
                    )}
                    {config.facebook_url && (
                      <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" className="footer-red footer-red-fb" aria-label="Facebook">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="footer-col">
                <h4>Legal</h4>
                <ul className="footer-lista">
                  <li><Link href="/privacidad">Política de Privacidad</Link></li>
                  <li><Link href="/terminos">Términos y Condiciones</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-platos">
          <PlatosRebotando variante="oscura" reduceMotion={reduceMotion} />
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-inner">
            <span>© {new Date().getFullYear()} Don Adriano's. Todos los derechos reservados.</span>
            <span className="footer-bottom-sep" aria-hidden="true">·</span>
            <span>Pedidos por WhatsApp</span>
          </div>
        </div>
      </footer>

      {/* ── LIGHTBOX DE FOTO DE PRODUCTO/PROMO ── */}
      {fotoAmpliada && (
        <div className="lightbox-backdrop" onClick={() => setFotoAmpliada(null)}>
          <div
            ref={dialogoRefs.lightboxFoto}
            role="dialog"
            aria-modal="true"
            aria-label={fotoAmpliada.alt || 'Foto ampliada'}
            onKeyDown={e => atraparFoco(e, dialogoRefs.lightboxFoto)}
            style={{ display: 'contents' }}
          >
            <button className="lightbox-close" aria-label="Cerrar" onClick={() => setFotoAmpliada(null)}>✕</button>
            <div className="lightbox-contenido" onClick={e => e.stopPropagation()}>
              <img src={fotoAmpliada.url} alt={fotoAmpliada.alt || ''} />
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE HORARIOS ── */}
      {modalHorarios && (
        <div className="modal-horarios-backdrop" onClick={() => setModalHorarios(false)}>
          <div
            className="modal-horarios"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-horarios-titulo"
            ref={dialogoRefs.modalHorarios}
            onKeyDown={e => atraparFoco(e, dialogoRefs.modalHorarios)}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-horarios-header">
              <h2 id="modal-horarios-titulo">Horarios de atención</h2>
              <button className="modal-horarios-close" aria-label="Cerrar" onClick={() => setModalHorarios(false)}>✕</button>
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
          <div
            className="modal-reap"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-reap-titulo"
            ref={dialogoRefs.modalReapertura}
            onKeyDown={e => atraparFoco(e, dialogoRefs.modalReapertura)}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-reap-icono">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 id="modal-reap-titulo">¡Ya estamos abiertos!</h2>
            <p>Tenés un pedido armado esperando. ¿Lo confirmamos ahora?</p>
            <button className="modal-reap-btn-si" onClick={() => { cancelarAvisoApertura(); setModalReapertura(false); setShowCheckout(true); }}>
              Revisar y confirmar pedido
            </button>
            <button className="modal-reap-btn-no" onClick={() => setModalReapertura(false)}>Todavía no</button>
          </div>
        </div>
      )}

      {/* ── CARRITO FLOTANTE — barra + mini-resumen desplegable ── */}
      {cantidad > 0 && !showCheckout && (
        <div className="carrito-flotante-wrap">
          <div className="barra-carrito">
            <button className="barra-carrito-principal" onClick={() => setShowCheckout(true)}>
              <span className="barra-carrito-icono" key={reboteCarrito}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                <span className="barra-carrito-badge">{cantidad}</span>
              </span>
              <span className="barra-carrito-texto">
                <strong>Realizar pedido</strong>
                <span>{cantidad} {cantidad === 1 ? 'producto' : 'productos'}</span>
              </span>
              <span className="barra-carrito-precio">${subtotal.toLocaleString('es-AR')}</span>
            </button>
            <button
              className="barra-carrito-toggle"
              aria-expanded={mostrarResumen}
              aria-label={mostrarResumen ? 'Ocultar resumen del pedido' : 'Ver resumen del pedido'}
              onClick={() => setMostrarResumen(v => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: mostrarResumen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>

          {mostrarResumen && (
            <div
              className="resumen-carrito"
              role="dialog"
              aria-modal="true"
              aria-labelledby="resumen-carrito-titulo"
              ref={dialogoRefs.resumenCarrito}
              onKeyDown={e => atraparFoco(e, dialogoRefs.resumenCarrito)}
            >
              <div className="resumen-carrito-header">
                <div>
                  <span className="resumen-carrito-eyebrow">Comanda</span>
                  <h2 id="resumen-carrito-titulo">Tu pedido</h2>
                </div>
                <button className="resumen-carrito-close" aria-label="Cerrar resumen" onClick={() => setMostrarResumen(false)}>✕</button>
              </div>

              <div className="resumen-carrito-lista">
                {items.map(it => (
                  <div key={`${it.tipo}_${it.id}_${it.variante_id || 'x'}`} className="resumen-fila">
                    <div className="resumen-fila-info">
                      <span className="resumen-fila-nombre">{it.nombre_snapshot}</span>
                      <span className="resumen-fila-preciounit">${it.precio.toLocaleString('es-AR')} c/u</span>
                    </div>
                    <div className="ctrl">
                      <button className="ctrl-btn" aria-label={`Quitar una unidad de ${it.nombre_snapshot}`} onClick={() => quitar({ tipo: it.tipo, id: it.id, variante_id: it.variante_id })}>−</button>
                      <span className="ctrl-n">{it.cantidad}</span>
                      <button className="ctrl-btn" aria-label={`Agregar una unidad más de ${it.nombre_snapshot}`} onClick={() => manejarAgregar(it)}>+</button>
                    </div>
                    <span className="resumen-fila-total">${(it.precio * it.cantidad).toLocaleString('es-AR')}</span>
                  </div>
                ))}
              </div>

              <div className="resumen-carrito-footer">
                <span className="resumen-carrito-subtotal">Subtotal <strong>${subtotal.toLocaleString('es-AR')}</strong></span>
                <button className="resumen-carrito-btn" onClick={() => { setMostrarResumen(false); setShowCheckout(true); }}>
                  Confirmar pedido
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BOTONES FLOTANTES: WhatsApp + redes sociales, discretos en la esquina en vez de competir con la marca arriba ── */}
      {!showCheckout && (config?.whatsapp_numero || config?.instagram_url || config?.facebook_url) && (
        <div className={`redes-flotantes ${cantidad > 0 ? 'redes-con-carrito' : ''}`}>
          {config.whatsapp_numero && (
            <a
              className="btn-red btn-red-wa"
              href={`https://wa.me/${config.whatsapp_numero}?text=${encodeURIComponent('Hola, tengo una consulta sobre el menú.')}`}
              target="_blank" rel="noopener noreferrer" aria-label="Consultar por WhatsApp"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          )}
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
        <Checkout
          config={config}
          metodos={metodos}
          abierto={abierto}
          proxApertura={proxApertura}
          horarios={horariosRef.current}
          franjas={franjasRef.current}
          onClose={() => setShowCheckout(false)}
        />
      )}

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body {
          background-color: #fffbf5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          color: #22201c; font-family: 'Work Sans', system-ui, sans-serif;
        }
        /* Selección de texto y scrollbar con la paleta de la marca en vez del gris de sistema */
        ::selection { background: #F0623E; color: #fffbf5; }
        ::-moz-selection { background: #F0623E; color: #fffbf5; }
        html { scrollbar-color: #ddcfb8 #f3efe6; scrollbar-width: thin; }
        ::-webkit-scrollbar { width: 11px; height: 11px; }
        ::-webkit-scrollbar-track { background: #f3efe6; }
        ::-webkit-scrollbar-thumb { background: #ddcfb8; border-radius: 10px; border: 2px solid #f3efe6; }
        ::-webkit-scrollbar-thumb:hover { background: #c9b896; }

        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap');

        /* ── MOMENTO DE MARCA: pantalla de carga inicial ── */
        .marca-splash {
          position: fixed; inset: 0; z-index: 100; background: #fffbf5;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .marca-splash-salir { opacity: 0; transform: scale(1.03); pointer-events: none; }
        .marca-splash-logo {
          width: 82px; height: 82px; object-fit: contain; border-radius: 50%;
          border: 3px solid #F0623E; background: #fff; padding: 4px;
          animation: splash-respirar 2.1s ease-in-out infinite;
        }
        @keyframes splash-respirar { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
        .marca-splash-nombre { font-family: 'Fraunces', serif; font-size: 21px; font-weight: 700; color: #22201c; }
        .marca-splash-frase { font-size: 13px; color: #8a8378; display: flex; align-items: center; gap: 2px; }
        .marca-splash-puntos span { animation: splash-punto 1.4s infinite; opacity: 0.2; }
        .marca-splash-puntos span:nth-child(2) { animation-delay: 0.2s; }
        .marca-splash-puntos span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes splash-punto { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .marca-splash-logo { animation: none; }
          .marca-splash-puntos span { animation: none; opacity: 0.6; }
          .icono-llama { animation: none; }
          .splash-plato-icono, .splash-plato-sombra { animation: none; }
        }

        /* ── Platos rebotando: uno a la vez, entra con rebote (bun/sombra), pausa, y el siguiente lo reemplaza ── */
        .splash-platos { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 8px; }
        .splash-plato-stage { position: relative; width: 44px; height: 40px; display: flex; align-items: flex-end; justify-content: center; }
        .splash-plato-icono { color: #F0623E; display: flex; animation: plato-rebote 0.55s cubic-bezier(0.34,1.56,0.64,1) both; }
        .splash-plato-sombra { position: absolute; bottom: -1px; width: 24px; height: 5px; border-radius: 50%; background: rgba(34,32,28,0.16); animation: sombra-rebote 0.55s cubic-bezier(0.34,1.56,0.64,1) both; }
        @keyframes plato-rebote { 0% { opacity: 0; transform: translateY(-16px) scale(0.6); } 60% { opacity: 1; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes sombra-rebote { 0% { opacity: 0; transform: scaleX(0.3); } 60% { opacity: 0.4; } 100% { opacity: 1; transform: scaleX(1); } }
        .splash-plato-label { font-size: 10.5px; color: #b0a898; font-weight: 600; letter-spacing: 0.02em; }

        /* ── Variante oscura: misma animación, ajustada para el fondo negro del footer (la sombra y el label
           necesitan contraste distinto que sobre fondo claro) ── */
        .footer-platos { padding: 26px 16px; display: flex; justify-content: center; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .splash-platos-oscura .splash-plato-sombra { background: rgba(255,255,255,0.14); }
        .splash-platos-oscura .splash-plato-label { color: #8a8378; }

        /* ── ELEMENTO GRÁFICO PROPIO: la llama se repite en los puntos donde se habla de cocina/horno
           (pantalla de carga, confirmación de pedido) ── vuelve reconocible a la marca ── */
        .icono-llama { color: #F0623E; display: inline-flex; flex-shrink: 0; animation: llama-titilar 2.4s ease-in-out infinite; }
        @keyframes llama-titilar { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.08) rotate(-3deg); } }

        /* ── HERO: subtítulo. Flujo normal, no sticky → se va con el scroll de forma 100% nativa ── */
        .header-hero { max-width: 760px; margin: 0 auto; padding: 8px 16px 0; }
        .header-hero-sub { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 500; color: #8a8378; padding: 6px 0 8px; }
        .header-hero-sub svg { color: #c9a876; flex-shrink: 0; }

        /* ── BARRA STICKY: tamaño siempre constante, nunca anima layout. Solo cambia una sombra cosmética ── */
        .sticky-top { position: sticky; top: 0; z-index: 30; background: rgba(255,251,245,0.96); backdrop-filter: blur(26px) saturate(1.5); -webkit-backdrop-filter: blur(26px) saturate(1.5); transition: box-shadow 0.25s ease; }
        .sticky-top.con-sombra { box-shadow: 0 2px 14px rgba(0,0,0,0.08); }

        .header { border-bottom: 1px solid rgba(236,230,220,0.7); position: relative; }
        .header::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #F0623E, #d9a534 50%, #3c8261);
          opacity: 0.85;
        }
        .header-inner { max-width: 760px; margin: 0 auto; padding: 12px 16px 11px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .header-marca { display: flex; align-items: center; gap: 13px; min-width: 0; flex: 1 1 auto; overflow: hidden; }
        .header-logo-wrap {
          width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
          background: #fffbf5; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(34,32,28,0.14), 0 0 0 2px #fffbf5, 0 0 0 3.5px rgba(240,98,62,0.35);
        }
        .header-logo { width: 35px; height: 35px; object-fit: contain; }
        .header-texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .header-nombre { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 700; color: #22201c; letter-spacing: -0.015em; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .header-estado {
          display: inline-flex; align-items: center; gap: 5px; width: fit-content;
          font-size: 11px; font-weight: 600; padding: 2px 8px 2px 6px; border-radius: 20px;
        }
        .header-estado.abierto { color: #3c8261; background: rgba(61,130,97,0.1); }
        .header-estado.cerrado { color: #b5401f; background: rgba(217,78,44,0.09); }
        .header-estado-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .header-estado.abierto .header-estado-dot { background: #3c8261; box-shadow: 0 0 0 2.5px rgba(61,130,97,0.18); animation: pulso-verde 2s infinite; }
        .header-estado.cerrado .header-estado-dot { background: #D94E2C; }
        .header-acciones { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        /* ── CARRITO FLOTANTE — wrapper fijo que apila barra + resumen ── */
        .carrito-flotante-wrap {
          position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 45;
          display: flex; flex-direction: column-reverse; gap: 8px;
          max-width: 520px; margin: 0 auto; max-height: calc(100vh - 24px);
        }

        .barra-carrito {
          flex-shrink: 0;
          background: #22201c; color: #fffbf5; border-radius: 18px;
          display: flex; align-items: stretch;
          box-shadow: 0 8px 28px rgba(0,0,0,0.28);
          animation: barraEntrar 0.35s cubic-bezier(0.32,0.72,0,1);
        }
        @keyframes barraEntrar { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .barra-carrito-principal {
          flex: 1; min-width: 0; background: none; border: none; color: inherit; font: inherit;
          padding: 14px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer;
          border-radius: 18px 0 0 18px;
        }
        .barra-carrito-principal:active { transform: scale(0.98); }
        .barra-carrito-toggle {
          flex-shrink: 0; width: 42px; display: flex; align-items: center; justify-content: center;
          background: none; border: none; border-left: 1px solid rgba(255,255,255,0.14); color: inherit;
          cursor: pointer; border-radius: 0 18px 18px 0;
        }
        .barra-carrito-toggle:active { background: rgba(255,255,255,0.08); }
        .barra-carrito-icono { position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #F0623E; width: 46px; height: 46px; border-radius: 50%; animation: iconoRebote 0.45s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes iconoRebote { 0% { transform: scale(1); } 40% { transform: scale(1.22) rotate(-8deg); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } }
        .barra-carrito-badge { position: absolute; top: -4px; right: -4px; background: #fffbf5; color: #22201c; font-size: 12px; font-weight: 800; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border: 2px solid #22201c; }
        .barra-carrito-texto { flex: 1; text-align: left; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .barra-carrito-texto strong { font-size: 16px; font-weight: 800; }
        .barra-carrito-texto span { font-size: 12.5px; color: #c9c2b6; }
        .barra-carrito-precio { font-size: 18px; font-weight: 800; color: #f0c675; flex-shrink: 0; font-family: 'Courier New', ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }

        /* ── MINI-RESUMEN DEL PEDIDO: tratado como una comanda real de pizzería — borde superior perforado
           (como si se arrancara de un talonario), números alineados como impresora térmica, separadores
           punteados en vez de líneas planas. Es el momento en que más se usa la app, así que el carácter
           va acá y no en decoración de fondo. ── */
        .resumen-carrito {
          flex-shrink: 1; min-height: 0; display: flex; flex-direction: column;
          background: #fffbf5; border-radius: 16px; box-shadow: 0 8px 28px rgba(0,0,0,0.22);
          overflow: hidden; animation: resumenEntrar 0.22s ease;
          position: relative; padding-top: 9px;
        }
        .resumen-carrito::before {
          content: '';
          position: absolute; top: 0; left: 16px; right: 16px; height: 9px;
          background-image: radial-gradient(circle, rgba(34,32,28,0.16) 1.7px, transparent 1.9px);
          background-size: 12px 9px;
          background-repeat: repeat-x;
          background-position: top center;
          pointer-events: none;
        }
        @keyframes resumenEntrar { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .resumen-carrito-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 16px 10px; flex-shrink: 0; border-bottom: 1px dashed #ddd3c2; }
        .resumen-carrito-eyebrow { display: block; font-family: 'Courier New', ui-monospace, Menlo, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #b0a898; margin-bottom: 1px; }
        .resumen-carrito-header h2 { font-size: 15px; font-weight: 800; color: #22201c; margin: 0; }
        .resumen-carrito-close { background: #f3efe6; border: none; width: 26px; height: 26px; border-radius: 50%; color: #8a8378; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .resumen-carrito-lista { overflow-y: auto; min-height: 0; padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
        .resumen-fila { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px dashed #ddd3c2; }
        .resumen-fila:first-child { padding-top: 12px; }
        .resumen-fila:last-child { border-bottom: none; padding-bottom: 4px; }
        .resumen-fila-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .resumen-fila-nombre { font-size: 13px; font-weight: 700; color: #22201c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .resumen-fila-preciounit { font-size: 11.5px; color: #8a8378; font-family: 'Courier New', ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
        .resumen-fila-total { font-size: 13.5px; font-weight: 800; color: #22201c; flex-shrink: 0; min-width: 56px; text-align: right; font-family: 'Courier New', ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
        .resumen-carrito-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 16px 16px; border-top: 1px dashed #ddd3c2; margin-top: 2px; }
        .resumen-carrito-subtotal { font-size: 11.5px; color: #8a8378; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
        .resumen-carrito-subtotal strong { font-size: 17px; color: #22201c; margin-left: 6px; font-family: 'Courier New', ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .resumen-carrito-btn { background: #F0623E; color: #fff; border: none; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; flex-shrink: 0; }
        .resumen-carrito-btn:hover { background: #D94E2C; }


        /* ── ESTADO ── */
        .estado-bar { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500; padding: 4px 0 8px; }
        .estado-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .abierto { color: #3c8261; }
        .abierto .estado-dot { background: #3c8261; box-shadow: 0 0 0 3px rgba(61,74,47,0.15); animation: pulso-verde 2s infinite; }
        @keyframes pulso-verde { 0%,100%{box-shadow:0 0 0 3px rgba(61,74,47,0.15)} 50%{box-shadow:0 0 0 5px rgba(61,74,47,0.08)} }

        @keyframes boton-resplandor { 0%,100%{ box-shadow: 0 2px 8px rgba(240,98,62,0.25); } 50%{ box-shadow: 0 3px 14px rgba(240,98,62,0.5); } }
        .cerrado { color: #D94E2C; }
        .cerrado .estado-dot { background: #D94E2C; }

        /* ── BUSCADOR ── */
        .busq-wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 12px; }
        .busq-inner { position: relative; }
        .busq-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #b0a898; pointer-events: none; }
        .busq-input { width: 100%; background: #f6f2e9; border: 1.5px solid transparent; border-radius: 12px; padding: 11px 38px; font-size: 14px; color: #22201c; font-family: inherit; outline: none; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .busq-input::placeholder { color: #ab9f8c; }
        .busq-input:focus { border-color: #F0623E; background: #fff; box-shadow: 0 0 0 4px rgba(240,98,62,0.1); }
        .busq-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #ece2d0; border: none; color: #6b6255; font-size: 11px; cursor: pointer; padding: 5px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

        /* ── NAV CATEGORÍAS ── */
        .cat-nav { border-bottom: 1px solid rgba(236,230,220,0.7); overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .cat-nav-abajo { background: #fffbf5; border-top: 1px solid rgba(236,230,220,0.7); }
        .cat-nav::-webkit-scrollbar { display: none; }
        .cat-nav-inner { display: flex; gap: 8px; max-width: 760px; margin: 0 auto; padding: 10px 12px; white-space: nowrap; }
        .cat-btn { background: #f3efe6; border: none; border-radius: 20px; color: #6b6255; padding: 9px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease; }
        .cat-btn:hover { background: #ece2d0; color: #22201c; }
        .cat-btn.activo { background: #22201c; color: #fffbf5; font-weight: 700; transform: scale(1.04); box-shadow: 0 4px 12px rgba(34,32,28,0.2); }
        .seccion-count { font-size: 11.5px; font-weight: 500; color: #b0a898; margin-left: auto; }

        /* ── MAIN / GRILLA DE TARJETAS ── */
        .main { max-width: 760px; margin: 0 auto; padding: 0 12px 130px; }
        .seccion { padding-top: 24px; }

        /* ── Scroll-reveal: cada sección entra con un fade + slide sutil, y las tarjetas de adentro
           se escalonan (stagger) en vez de aparecer todas de golpe ── */
        .seccion { opacity: 0; transform: translateY(18px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1); }
        .seccion-visible { opacity: 1; transform: translateY(0); }
        .seccion .grilla > *, .seccion .fila-horizontal > * {
          opacity: 0; transform: translateY(12px);
          transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1);
          transition-delay: 0ms;
        }
        .seccion-visible .grilla > *, .seccion-visible .fila-horizontal > * { opacity: 1; transform: translateY(0); }
        .seccion-visible .grilla > *:nth-child(1),  .seccion-visible .fila-horizontal > *:nth-child(1)  { transition-delay: 0ms; }
        .seccion-visible .grilla > *:nth-child(2),  .seccion-visible .fila-horizontal > *:nth-child(2)  { transition-delay: 45ms; }
        .seccion-visible .grilla > *:nth-child(3),  .seccion-visible .fila-horizontal > *:nth-child(3)  { transition-delay: 90ms; }
        .seccion-visible .grilla > *:nth-child(4),  .seccion-visible .fila-horizontal > *:nth-child(4)  { transition-delay: 135ms; }
        .seccion-visible .grilla > *:nth-child(5),  .seccion-visible .fila-horizontal > *:nth-child(5)  { transition-delay: 180ms; }
        .seccion-visible .grilla > *:nth-child(6),  .seccion-visible .fila-horizontal > *:nth-child(6)  { transition-delay: 225ms; }
        .seccion-visible .grilla > *:nth-child(n+7) { transition-delay: 260ms; }
        @media (prefers-reduced-motion: reduce) {
          .seccion, .seccion .grilla > *, .seccion .fila-horizontal > * { transition: none; opacity: 1; transform: none; }
        }

        /* ── Transición de categoría: fade + slide en vez de corte seco al tocar una pestaña ── */
        .cat-contenido-anim { animation: catFadeSlide 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes catFadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .cat-contenido-anim { animation: none; } }

        /* ── Skeleton "bollo de masa": misma silueta que la tarjeta real, con forma orgánica de bollo
           en vez de un rectángulo gris genérico, y un brillo cálido en vez de shimmer gris ── */
        .card-skeleton { pointer-events: none; }
        .card-skeleton .skel-img { position: relative; width: 100%; aspect-ratio: 1/1; background: #f6f1e7; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .skel-bollo {
          width: 66%; height: 66%;
          border-radius: 42% 58% 55% 45% / 45% 40% 60% 55%;
          background: linear-gradient(120deg, #ece2d0 25%, #f8f1e5 45%, #ece2d0 65%);
          background-size: 220% 100%;
          animation: skel-brillo 1.7s ease-in-out infinite;
        }
        .skel-linea {
          display: block; height: 10px; border-radius: 6px; width: 92%;
          background: linear-gradient(120deg, #ece2d0 25%, #f8f1e5 45%, #ece2d0 65%);
          background-size: 220% 100%;
          animation: skel-brillo 1.7s ease-in-out infinite;
        }
        .skel-linea-titulo { width: 78%; height: 12px; }
        .skel-linea-desc-corta { width: 55%; }
        .skel-precio {
          display: block; width: 38%; height: 14px; border-radius: 6px; margin-top: 6px;
          background: linear-gradient(120deg, #fbe3d8 25%, #fdece3 45%, #fbe3d8 65%);
          background-size: 220% 100%;
          animation: skel-brillo 1.7s ease-in-out infinite;
        }
        .skel-titulo-seccion { color: transparent; }
        @keyframes skel-brillo { 0% { background-position: 220% 0; } 100% { background-position: -220% 0; } }
        @media (prefers-reduced-motion: reduce) { .skel-bollo, .skel-linea, .skel-precio { animation: none; } }
        .seccion-titulo { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 700; color: #22201c; padding: 0 4px 14px; display: flex; align-items: center; gap: 10px; }
        .titulo-bar { width: 4px; height: 18px; background: #F0623E; border-radius: 2px; }
        .titulo-bar-verde { background: #3c8261; }
        .titulo-bar-nuevo { background: #d9a534; }

        .grilla { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 560px) { .grilla { gap: 14px; } }

        /* ── Lista de categoría (una tarjeta alargada por fila, de extremo a extremo) ── */
        .grilla-lista { grid-template-columns: 1fr; gap: 10px; }
        .grilla-lista .card { flex-direction: row; }
        .grilla-lista .card-img-wrap { width: 110px; min-width: 110px; aspect-ratio: 1/1; }
        .grilla-lista .card-body { flex: 1; min-width: 0; padding: 10px 12px; gap: 4px; }
        .grilla-lista .card-nombre { min-height: 0; -webkit-line-clamp: 1; }
        .grilla-lista .card-desc { min-height: 0; }
        .grilla-lista .card-footer { flex-direction: row; align-items: center; justify-content: space-between; margin-top: 6px; }
        .grilla-lista .card-variantes { gap: 6px; }
        @media (min-width: 480px) { .grilla-lista .card-img-wrap { width: 130px; min-width: 130px; } }

        .fila-horizontal {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 4px;
          scroll-snap-type: x proximity;
        }
        .fila-horizontal::-webkit-scrollbar { height: 4px; }
        .fila-horizontal::-webkit-scrollbar-thumb { background: #ece6dc; border-radius: 4px; }
        .card-h-wrap { flex-shrink: 0; width: 150px; scroll-snap-align: start; }
        @media (min-width: 560px) { .card-h-wrap { width: 170px; } }

        .fila-horizontal-wrap { position: relative; }
        .fila-flecha {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 34px; height: 34px; border-radius: 50%;
          background: #fff; border: 1px solid #ece6dc; color: #55504a;
          font-size: 20px; line-height: 1; display: flex; align-items: center; justify-content: center;
          cursor: pointer; z-index: 10; box-shadow: 0 2px 10px rgba(0,0,0,0.12);
        }
        .fila-flecha:hover { border-color: #F0623E; color: #F0623E; }
        .fila-flecha-izq { left: -6px; }
        .fila-flecha-der { right: -6px; }
        @media (max-width: 460px) {
          .fila-flecha { width: 30px; height: 30px; font-size: 17px; }
        }

        /* ── TARJETA (2 por línea) ── */
        .card { background: #fff; border: 1px solid #ece6dc; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: box-shadow 0.25s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1); }
        .card:hover { box-shadow: 0 12px 26px rgba(34,32,28,0.14); transform: translateY(-4px) rotate(-0.55deg); }
        .grilla-lista .card:hover { transform: translateY(-2px) rotate(-0.3deg); }
        .card-agotado { opacity: 0.6; }
        .card-promo { border-color: rgba(61,74,47,0.25); }

        .card-img-wrap { position: relative; width: 100%; aspect-ratio: 1/1; background: #f3efe6; }
        button.card-img-wrap { display: block; padding: 0; margin: 0; border: none; font: inherit; text-align: inherit; }
        .card-img-clicable { cursor: zoom-in; }
        .card-img-clicable:focus-visible { outline: 3px solid #F0623E; outline-offset: -3px; }

        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        .card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .card-img-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #c4bcae; font-size: 12px; }
        .card-img-ph-promo { background: linear-gradient(135deg, #f3efe6, #eae3d4); }
        .card-badge-agotado { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 700; background: #fff; color: #F0623E; border-radius: 6px; padding: 3px 7px; }
        /* ── Sellos "Nuevo"/"Promo": estampitas de tinta rotadas, como el sello de una comanda,
           en vez de etiquetas redondeadas planas ── */
        .card-badge-nuevo, .card-badge-promo {
          position: absolute; top: 10px; left: 10px;
          font-family: 'Courier New', ui-monospace, Menlo, monospace;
          font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
          padding: 3px 8px 3.5px;
          border: 1.5px solid currentColor;
          border-radius: 3px;
          background: rgba(255,251,245,0.88);
          box-shadow: 0 2px 5px rgba(34,32,28,0.18);
        }
        .card-badge-nuevo { color: #b5791a; transform: rotate(-7deg); animation: sello-estampar 0.35s cubic-bezier(0.2,1.4,0.4,1) both; }
        .card-badge-promo { color: #3c8261; transform: rotate(5deg); animation: sello-estampar 0.35s cubic-bezier(0.2,1.4,0.4,1) both; }
        @keyframes sello-estampar { from { opacity: 0; transform: scale(1.6) rotate(0deg); } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .card-badge-nuevo, .card-badge-promo { animation: none; }
        }

        .card-body { padding: 10px 11px 12px; display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .card-nombre { font-size: 13.5px; font-weight: 700; color: #22201c; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 35px; }
        .card-desc { font-size: 11.5px; color: #8a8378; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 33px; }
        .card-desc-expandida { -webkit-line-clamp: unset; overflow: visible; min-height: 0; }
        .card-vermas { background: none; border: none; padding: 0; margin: 0; color: #F0623E; font-size: 11.5px; font-weight: 600; cursor: pointer; }

        .card-footer { display: flex; flex-direction: column; gap: 8px; margin-top: auto; padding-top: 4px; }
        .card-precio { font-size: 15px; font-weight: 600; color: #F0623E; }

        .card-variantes { display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
        .variante-row { display: flex; flex-direction: column; gap: 5px; padding-top: 6px; border-top: 1px solid #f3efe6; }
        .variante-row:first-child { border-top: none; padding-top: 0; }
        .variante-info { display: flex; align-items: baseline; justify-content: space-between; }
        .variante-nombre { font-size: 11.5px; color: #55504a; }
        .variante-precio { font-size: 12.5px; font-weight: 600; color: #F0623E; }

        /* ── CONTROLES +/- ── */
        .ctrl { display: flex; align-items: center; gap: 6px; }
        .ctrl-btn { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #F0623E; background: transparent; color: #F0623E; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background 0.1s, color 0.1s; flex-shrink: 0; position: relative; }
        .ctrl-btn:hover { background: #F0623E; color: #fff; }
        .ctrl-n { font-size: 13px; font-weight: 700; min-width: 14px; text-align: center; }

        .ctrl-btn-agregar { width: 100%; background: #F0623E; color: #fff; border: none; border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s, box-shadow 0.2s ease; animation: boton-resplandor 2.8s ease-in-out infinite; position: relative; }
        .ctrl-btn-agregar:hover:not(:disabled) { background: #D94E2C; }
        .ctrl-btn-agregar:disabled { opacity: 0.4; cursor: default; }

        /* ── Feedback al agregar al carrito ── */
        .ctrl-btn-agregar.btn-agregado, .ctrl-btn.ctrl-add.btn-agregado { background: #2f9e57; border-color: #2f9e57; color: #fff; animation: botonPop 0.4s ease; }
        @keyframes botonPop { 0% { transform: scale(1); } 35% { transform: scale(1.14); } 100% { transform: scale(1); } }
        .flotante-mas1 {
          position: absolute; top: -4px; left: 50%; pointer-events: none;
          font-size: 12px; font-weight: 800; color: #2f9e57;
          animation: flotarMas1 0.65s ease forwards;
        }
        @keyframes flotarMas1 {
          0%   { opacity: 0; transform: translate(-50%, 2px) scale(0.8); }
          20%  { opacity: 1; transform: translate(-50%, -2px) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -26px) scale(1); }
        }

        /* ── BÚSQUEDA ── */
        .busq-resultados { padding: 16px 4px 0; }
        .busq-total { padding: 0 4px 12px; font-size: 13px; color: #8a8378; }
        .busq-total strong { color: #22201c; }
        .sin-resultados { padding: 48px 24px; text-align: center; color: #8a8378; font-size: 15px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
        .seccion-vacia { padding: 40px 20px; text-align: center; color: #8a8378; font-size: 14px; }
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
        .horario-hoy { background: #FDEEE7; }
        .horario-dia { font-size: 13.5px; font-weight: 600; color: #22201c; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        .horario-badge-hoy { font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: #F0623E; color: #fff; border-radius: 10px; padding: 1px 6px; }
        .horario-franjas { font-size: 13px; color: #55504a; text-align: right; }
        .horario-cerrado { color: #b0a898; }
        .modal-horarios-nota { font-size: 11.5px; color: #8a8378; line-height: 1.5; margin-top: 14px; padding-top: 14px; border-top: 1px solid #ece6dc; }

        .modal-reap-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 70; padding: 24px; backdrop-filter: blur(2px); }
        .modal-reap { background: #fff; border-radius: 20px; padding: 32px 28px; max-width: 340px; width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); animation: modalIn 0.3s cubic-bezier(0.32,0.72,0,1); }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.92) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .modal-reap-icono { width: 60px; height: 60px; border-radius: 50%; background: rgba(61,74,47,0.1); color: #3c8261; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
        .modal-reap h2 { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 700; color: #22201c; margin: 0; }
        .modal-reap p { font-size: 14px; color: #55504a; line-height: 1.5; margin: 4px 0 18px; }
        .modal-reap-btn-si { width: 100%; background: #F0623E; color: #fff; border: none; border-radius: 12px; padding: 14px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; margin-bottom: 8px; transition: filter 0.15s; }
        .modal-reap-btn-si:hover { filter: brightness(1.1); }
        .modal-reap-btn-no { width: 100%; background: transparent; border: none; color: #8a8378; font-size: 13px; font-family: inherit; cursor: pointer; padding: 6px; }

        /* ── TOAST ── */
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 32px); display: flex; align-items: center; gap: 10px; background: #22201c; color: #fffbf5; padding: 13px 18px; border-radius: 12px; font-size: 13px; line-height: 1.4; box-shadow: 0 8px 28px rgba(0,0,0,0.25); z-index: 45; animation: toastIn 0.25s ease; }
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .toast-info svg { color: #F0623E; flex-shrink: 0; }
        .toast-ok svg { color: #7ec98f; flex-shrink: 0; }

        .redes-flotantes {
          position: fixed;
          bottom: 20px;
          left: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 35;
          transition: bottom 0.2s;
        }
        .redes-con-carrito { bottom: 92px; }
        .btn-red {
          width: 46px; height: 46px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-red:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 6px 18px rgba(0,0,0,0.24); }
        .btn-red-ig { background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); }
        .btn-red-fb { background: #1877f2; }
        .btn-red-wa { background: #25d366; }

        /* ── FOOTER ── */
        .footer { background: #1c1a17; color: #d8d2c8; margin-top: 0; position: relative; }
        .footer::before {
          content: ''; display: block; height: 3px; width: 100%;
          background: linear-gradient(90deg, #F0623E, #d9a534 50%, #3c8261);
          opacity: 0.9;
        }
        .footer-inner { max-width: 760px; margin: 0 auto; padding: 40px 16px 28px; }
        .footer-top { display: flex; justify-content: space-between; gap: 40px; flex-wrap: wrap; padding-bottom: 32px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .footer-marca { display: flex; align-items: flex-start; gap: 14px; flex: 1 1 220px; min-width: 220px; }
        .footer-logo { width: 48px; height: 48px; border-radius: 50%; object-fit: contain; background: #fff; flex-shrink: 0; box-shadow: 0 3px 10px rgba(0,0,0,0.3); }
        .footer-marca h3 { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 700; color: #fff; margin: 0; letter-spacing: -0.01em; }
        .footer-marca p { font-size: 12.5px; color: #a39c8f; margin: 4px 0 0; line-height: 1.5; }
        .footer-columnas { display: flex; gap: 56px; flex-wrap: wrap; }
        .footer-col { display: flex; flex-direction: column; gap: 10px; min-width: 120px; }
        .footer-col h4 { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8378; margin: 0 0 2px; }
        .footer-lista { list-style: none; display: flex; flex-direction: column; gap: 9px; }
        .footer-col a, .footer-link-btn {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 13.5px; color: #d8d2c8; text-decoration: none; background: none; border: none;
          padding: 0; text-align: left; cursor: pointer; font-family: inherit; width: fit-content;
          transition: color 0.15s ease;
        }
        .footer-link-icono { color: #8a8378; flex-shrink: 0; transition: color 0.15s ease; }
        .footer-col a:hover, .footer-link-btn:hover { color: #fff; }
        .footer-col a:hover .footer-link-icono, .footer-link-btn:hover .footer-link-icono { color: #F0623E; }
        .footer-redes { display: flex; gap: 10px; }
        .footer-red { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.3); transition: transform 0.15s ease; }
        .footer-red:hover { transform: translateY(-2px); }
        .footer-red-ig { background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); }
        .footer-red-fb { background: #1877f2; }
        .footer-bottom { border-top: 1px solid rgba(255,255,255,0.07); padding: 16px 16px; background: #17150f; }
        .footer-bottom-inner { max-width: 760px; margin: 0 auto; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px 10px; text-align: center; font-size: 11.5px; color: #8a8378; letter-spacing: 0.01em; }
        .footer-bottom-sep { color: #4a463e; }
        @media (max-width: 480px) {
          .footer-top { flex-direction: column; gap: 26px; }
          .footer-columnas { gap: 32px; }
        }

        /* ── LIGHTBOX ── */
        .lightbox-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 80; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .lightbox-close { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 38px; height: 38px; border-radius: 50%; font-size: 16px; cursor: pointer; z-index: 2; }
        .lightbox-contenido { max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .lightbox-contenido img { max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 8px; }

        @media (max-width: 380px) {
          .header-hero-sub { display: none; }
        }
      `}</style>
    </div>
  );
}