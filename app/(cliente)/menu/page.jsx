'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCarrito } from '../../../contexts/CarritoContext';
import Checkout from '../../../components/cliente/Checkout';
import { estaAbiertoAhora, proximaApertura, hayAvisoAperturaGuardado, cancelarAvisoApertura, notificarAperturaSiCorresponde } from '../../../lib/clienteUtils';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ── Galería "foto por foto": mazo apilado, se puede deslizar con el dedo o avanza sola ──
function GaleriaCocina({ fotos, onSelect }) {
  const [idx, setIdx] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const [sinTransicion, setSinTransicion] = useState(false);
  const [arrastreX, setArrastreX] = useState(0);
  const arrastrando = useRef(false);
  const inicioX = useRef(0);
  const fueArrastre = useRef(false);
  const timerRef = useRef(null);

  function programarSiguiente() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (fotos.length <= 1) return;
    timerRef.current = setInterval(() => avanzar(), 3000);
  }

  useEffect(() => {
    programarSiguiente();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fotos.length]);

  function avanzar() {
    setSaliendo(true);
    setTimeout(() => {
      setSinTransicion(true);
      setIdx(prev => (prev + 1) % fotos.length);
      setSaliendo(false);
      setArrastreX(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSinTransicion(false));
      });
    }, 480);
  }

  function manejarInicio(clientX) {
    arrastrando.current = true;
    fueArrastre.current = false;
    inicioX.current = clientX;
  }
  function manejarMovimiento(clientX) {
    if (!arrastrando.current) return;
    const delta = clientX - inicioX.current;
    if (Math.abs(delta) > 6) fueArrastre.current = true;
    setArrastreX(delta);
  }
  function manejarFin() {
    if (!arrastrando.current) return;
    arrastrando.current = false;
    if (Math.abs(arrastreX) > 55 && fotos.length > 1) {
      programarSiguiente();
      avanzar();
    } else {
      setArrastreX(0);
    }
  }

  if (!fotos.length) return null;
  const len = fotos.length;
  const visibles = [0, 1, 2]
    .filter(o => o < len)
    .map(o => ({ foto: fotos[(idx + o) % len], indiceReal: (idx + o) % len, pos: o }));

  return (
    <div className="galeria-slider">
      <div
        className="galeria-stack"
        onPointerDown={e => manejarInicio(e.clientX)}
        onPointerMove={e => manejarMovimiento(e.clientX)}
        onPointerUp={manejarFin}
        onPointerLeave={manejarFin}
      >
        {visibles.slice().reverse().map(({ foto, indiceReal, pos }) => (
          <button
            key={foto.id}
            className={`galeria-carta galeria-carta-p${pos} ${saliendo && pos === 0 ? 'galeria-carta-sale' : ''} ${sinTransicion ? 'galeria-sin-transicion' : ''}`}
            style={pos === 0 && arrastreX !== 0 ? { transform: `translateX(${arrastreX}px) rotate(${arrastreX / 18}deg)`, transition: 'none' } : undefined}
            onClick={() => { if (!fueArrastre.current) onSelect(indiceReal); }}
          >
            <img src={foto.imagen_url} alt={foto.descripcion || 'Foto del negocio'} draggable="false" />
          </button>
        ))}
      </div>
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
  const [galeria, setGaleria]             = useState([]);
  const [lightboxIdx, setLightboxIdx]     = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const [finPaginaVisible, setFinPaginaVisible] = useState(false);
  const [charcoPegado, setCharcoPegado] = useState(false);
  const charcoCentinelaRef = useRef(null);
  const [headerAltura, setHeaderAltura] = useState(72);
  const [distanciaGota, setDistanciaGota] = useState(320);
  const charcoInicioRef = useRef(null);
  const charcoEpochRef = useRef(null);
  const [carritoAnimDelay, setCarritoAnimDelay] = useState('0ms');
  const footerRef    = useRef(null);
  const stickyTopRef = useRef(null);
  const heroRef       = useRef(null);

  const navRef      = useRef(null);

  useEffect(() => { cargar(); }, []);

  // Detecta cuando se llega al final de la página (footer) para que el charco y la flecha guía desaparezcan ahí
  useEffect(() => {
    const el = footerRef.current;
    if (!el) { setFinPaginaVisible(false); return; }
    const obs = new IntersectionObserver(
      ([entry]) => setFinPaginaVisible(entry.isIntersecting),
      { threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [galeria.length, categoriaActiva, busqueda]);

  // Detecta el instante EXACTO en que el charco pasa de su posición normal (junto a la foto) a quedar
  // "pegado" (sticky) debajo del header. Se usa un centinela sin altura, ubicado justo donde el charco nace:
  // mientras ese punto siga dentro de la pantalla (por debajo del header), el charco todavía NO se pegó.
  // Recién cuando ese punto queda tapado por el header (sale del área observada) es que el sticky se activó
  // de verdad — y solo ahí arranca el goteo. Antes de eso, charcoPegado es false y no hay ninguna gota.
  useEffect(() => {
    const el = charcoCentinelaRef.current;
    if (!el || !mostrarCharco) { setCharcoPegado(false); return; }
    const obs = new IntersectionObserver(
      ([entry]) => setCharcoPegado(!entry.isIntersecting),
      { threshold: 0, rootMargin: `-${headerAltura}px 0px 0px 0px` }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mostrarCharco, headerAltura, categoriaActiva, busqueda]);

  // Mide la distancia REAL en pantalla entre el charco (pegado a top: headerAltura al hacer sticky) y la flecha
  // (fija abajo del todo), para que la gota siempre caiga exactamente hasta ahí, sea cual sea el alto del celular.
  useEffect(() => {
    function calcularDistancia() {
      const ALTURA_ONDA = 32;      // .galeria-goteo-wrap
      const OFFSET_FLECHA = 18 + 20; // bottom de la flecha + mitad de su tamaño, para apuntar a su centro
      const dist = window.innerHeight - headerAltura - ALTURA_ONDA - OFFSET_FLECHA;
      setDistanciaGota(Math.max(dist, 80));
    }
    calcularDistancia();
    window.addEventListener('resize', calcularDistancia);
    return () => window.removeEventListener('resize', calcularDistancia);
  }, [headerAltura]);

  // Sigue la altura REAL de la barra sticky (ahora constante, pero puede variar por resize/orientación/breakpoints),
  // para que el charco quede anclado exactamente a la altura del buscador y nunca se desfase
  useEffect(() => {
    const el = stickyTopRef.current;
    if (!el) return;
    function aplicarAltura(altura) {
      setHeaderAltura(altura);
    }
    aplicarAltura(el.offsetHeight || 72);
    const ro = new ResizeObserver(([entry]) => {
      const altura = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      aplicarAltura(Math.round(altura));
    });
    ro.observe(el);
    function alRedimensionar() { aplicarAltura(el.offsetHeight || 72); }
    window.addEventListener('resize', alRedimensionar);
    return () => { ro.disconnect(); window.removeEventListener('resize', alRedimensionar); };
  }, []);

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
      { data: horarios }, { data: franjas }, { data: fotos },
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
      supabase.from('galeria_fotos').select('*').order('created_at', { ascending: false }),
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
    if (fotos) setGaleria(fotos);
  }

  function scrollFila(e, direccion) {
    const cont = e.currentTarget.parentElement.querySelector('.fila-horizontal');
    if (cont) cont.scrollBy({ left: direccion * 320, behavior: 'smooth' });
  }

  function seleccionarCategoria(catId) {
    setCatActiva(catId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          {disponible && prod.es_nuevo && <span className="card-badge-nuevo">Nuevo</span>}
        </div>

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
              <button className="ctrl-btn-agregar" onClick={() => manejarAgregar({ tipo: 'promo', id: promo.id, nombre_snapshot: promo.nombre, precio: promo.precio_promo, imagen_url: promo.imagen_url })}>
                + Agregar
              </button>
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

  // ── Charco: sticky nativo — nace pegado a la foto (posición normal en el flujo) y, al scrollear, el propio navegador
  // lo deja "pegado" debajo del header sin que haga falta ningún cálculo en JS. Se despega recién al llegar al pie de página.
  const mostrarCharco       = galeria.length > 0 && categoriaActiva === '__todo__' && !enBusqueda;
  const flechaGuiaVisible   = mostrarCharco && !finPaginaVisible && cantidad === 0;
  const carritoIluminado    = mostrarCharco && charcoPegado && !finPaginaVisible && cantidad > 0;

  // Reloj maestro del charco: arranca recién en el instante en que el charco queda pegado (sticky) al header —
  // nunca antes. Si el usuario scrollea de nuevo hacia arriba y el charco se despega, el reloj se reinicia
  // (vuelve a null), así que si vuelve a pegarse el goteo arranca de cero, nunca "viene arrastrando" nada.
  useEffect(() => {
    if (charcoPegado && charcoEpochRef.current === null) charcoEpochRef.current = performance.now();
    if (!charcoPegado) charcoEpochRef.current = null;
  }, [charcoPegado]);

  // Calcula, para CUALQUIER elemento sincronizado al charco (gota, mancha, flecha, carrito), el mismo desfasaje exacto
  // respecto del reloj maestro — así todos quedan atados al MISMO instante real sin importar cuándo monta cada uno,
  // y la gota SIEMPRE toca la flecha en el punto justo del ciclo (68%), sea cual sea el momento en que se dibujaron.
  function faseDesdeEpoch(duracionMs = 3600) {
    if (charcoEpochRef.current === null) return '0ms';
    const transcurrido = performance.now() - charcoEpochRef.current;
    return `${-(transcurrido % duracionMs)}ms`;
  }

  // El carrito recién se monta al agregar el primer producto: en vez de arrancar su brillo en un instante al azar,
  // lo arranca ya desfasado a la misma fase del reloj maestro, para que ilumine justo en el mismo instante que la flecha
  useEffect(() => {
    if (cantidad > 0 && charcoPegado && charcoEpochRef.current !== null) {
      const transcurrido = performance.now() - charcoEpochRef.current;
      setCarritoAnimDelay(`${-(transcurrido % 3600)}ms`);
    }
  }, [cantidad > 0, charcoPegado]);

  return (
    <div className="pagina">

      {/* ── HERO: subtítulo + estado. Vive en el flujo normal de la página (no es sticky), así que se va con el scroll
           de forma 100% nativa del navegador, sin ningún JS que decida "cuándo". Esto es lo que hace que arriba del todo
           se vea el header "expandido" y, apenas se hace scroll, se vea "comprimido" — sin posibilidad de parpadeos
           ni loops, porque no hay ningún estado de React decidiendo el tamaño de nada. ── */}
      <div className="header-hero" ref={heroRef}>
        <span className="header-hero-sub">Pizzería · San José, Guaymallén, Mendoza</span>
        {abierto !== null && (
          <div className={`estado-bar ${abierto ? 'abierto' : 'cerrado'}`}>
            <span className="estado-dot" />
            <span>
              {abierto ? 'Aceptando pedidos ahora' : proxApertura ? `Cerrado ahora · Abrimos ${proxApertura}` : 'Cerrado por el momento'}
            </span>
          </div>
        )}
      </div>

      {/* ── BARRA STICKY: tamaño siempre constante (nunca anima su layout), por eso no puede retroalimentarse con el scroll.
           Lo único que cambia al scrollear es una sombra (puramente cosmética, no afecta el tamaño de nada). ── */}
      <div className={`sticky-top ${scrolled ? 'con-sombra' : ''}`} ref={stickyTopRef}>
        <header className="header">
          <div className="header-inner">
            <div className="header-marca">
              <img src="/logo.png" alt="Don Adriano's" className="header-logo" />
              <h1 className="header-nombre">Don Adriano's</h1>
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
            </div>
          </div>

          <div className="busq-wrap">
            <div className="busq-inner">
              <svg className="busq-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input className="busq-input" type="search" placeholder="Buscar en el menú…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
              {busqueda && <button className="busq-clear" onClick={() => setBusqueda('')}>✕</button>}
            </div>
          </div>
        </header>

      </div>

      {/* ── GALERÍA: foto por foto, salto rápido y pausa ── solo se ve en "Todo" ── */}
      {mostrarCharco && (
        <section className="galeria-seccion">
          <div className="galeria-fondo" />
          <div className="galeria-overlay" />
          <div className="galeria-inner">
            <h2 className="galeria-titulo">
              <span className="galeria-icono">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c-3 3-4 6-4 9a4 4 0 0 0 8 0c0-1-.5-2-1-3 .5 2-1 3-1 3 .5-2-1-4-2-4 0 2-1 3-2 3 0-3 1-5 2-8z"/><path d="M6 14a6 6 0 0 0 12 0"/></svg>
              </span>
              Nuestra cocina
            </h2>
            <GaleriaCocina fotos={galeria} onSelect={setLightboxIdx} />

            <div className="galeria-ubicacion">
              <p className="galeria-direccion">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                San José, Guaymallén
              </p>
              <div className="galeria-ubicacion-botones">
                {config?.latitud_local && (
                  <a className="galeria-btn-primario" href={`https://maps.google.com/?q=${config.latitud_local},${config.longitud_local}`} target="_blank" rel="noopener noreferrer">
                    Cómo llegar
                  </a>
                )}
                <button className="galeria-btn-secundario" onClick={() => setModalHorarios(true)}>Ver horarios</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {mostrarCharco && (
        /* guía visual de que se puede seguir bajando: no es un botón, no dispara ninguna acción.
           La flecha en sí siempre está visible como guía; el brillo de "impacto" (charco-goteando) solo
           corre una vez que el charco realmente está pegado (sticky) y empezó a gotear de verdad. */
        <div className={`galeria-flecha-fixed ${flechaGuiaVisible ? 'flecha-visible' : ''} ${charcoPegado ? 'charco-goteando' : ''}`} aria-hidden="true">
          <span className="galeria-mancha" style={{ animationDelay: faseDesdeEpoch() }} />
          <div className="galeria-flecha-abajo" style={{ animationDelay: faseDesdeEpoch() }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      )}

      {/* envuelve el charco junto con la navegación y los productos: le da "recorrido" para quedarse pegado (sticky) mientras
          se scrollea todo el menú, y recién se despega cuando este bloque termina, justo antes del pie de página */}
      <div className="contenido-scroll">
        {mostrarCharco && (
          <>
            {/* punto sin altura, ubicado exactamente donde nace el charco: mientras siga visible, el charco todavía
                no se pegó al header. No tiene ningún estilo visual, es puramente un marcador para el observer. */}
            <div ref={charcoCentinelaRef} className="charco-centinela" aria-hidden="true" />

            {/* el mismo charco: nace pegado a la foto (posición normal) y, al scrollear, queda "sticky" debajo del header —
                es un único elemento que cambia de comportamiento, no uno que se apaga y otro que se prende */}
            <div className="galeria-charco-local" ref={charcoInicioRef} style={{ top: headerAltura, '--dist-gota': `${distanciaGota}px` }} aria-hidden="true">
              <div className="galeria-goteo-wrap">
                <svg className="galeria-goteo-svg" viewBox="0 0 400 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="quesoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F7B267" />
                      <stop offset="100%" stopColor="#F0623E" />
                    </linearGradient>
                  </defs>
                  <path
                    fill="url(#quesoGrad)"
                    d="M0,0 L400,0 L400,10 C 385,10 381,18 368,18 C 355,18 351,10 338,10 C 322,10 317,34 300,34 C 283,34 279,11 262,11 C 244,11 238,14 216,14 C 194,14 189,13 170,13 C 152,13 147,20 130,20 C 113,20 109,10 92,10 C 75,10 70,19 52,19 C 35,19 31,9 15,9 C 7,9 3,10 0,12 Z"
                  >
                    {!reduceMotion && (
                      <animate
                        attributeName="d"
                        dur="4.8s"
                        repeatCount="indefinite"
                        values="M0,0 L400,0 L400,10 C 385,10 381,18 368,18 C 355,18 351,10 338,10 C 322,10 317,34 300,34 C 283,34 279,11 262,11 C 244,11 238,14 216,14 C 194,14 189,13 170,13 C 152,13 147,20 130,20 C 113,20 109,10 92,10 C 75,10 70,19 52,19 C 35,19 31,9 15,9 C 7,9 3,10 0,12 Z;
                                M0,0 L400,0 L400,8 C 385,8 381,21 368,21 C 355,21 351,12 338,12 C 322,12 317,29 300,29 C 283,29 279,14 262,14 C 244,14 238,18 216,18 C 194,18 189,9 170,9 C 152,9 147,23 130,23 C 113,23 109,8 92,8 C 75,8 70,22 52,22 C 35,22 31,12 15,12 C 7,12 3,8 0,10 Z;
                                M0,0 L400,0 L400,10 C 385,10 381,18 368,18 C 355,18 351,10 338,10 C 322,10 317,34 300,34 C 283,34 279,11 262,11 C 244,11 238,14 216,14 C 194,14 189,13 170,13 C 152,13 147,20 130,20 C 113,20 109,10 92,10 C 75,10 70,19 52,19 C 35,19 31,9 15,9 C 7,9 3,10 0,12 Z"
                      />
                    )}
                  </path>
                </svg>
              </div>
              <div className="galeria-caida">
                {/* la gota NO existe en el DOM hasta que el charco está realmente pegado al header:
                    así es literalmente imposible que haya goteo antes de ese instante */}
                {charcoPegado && (
                  <span className="galeria-gota" style={{ animationDelay: faseDesdeEpoch() }} />
                )}
              </div>
            </div>
          </>
        )}

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

        {!enBusqueda && (
          <>
            {/* Nuevo: productos marcados como recién lanzados */}
            {hayProductosNuevos && categoriaActiva === '__nuevo__' && (
              <section className="seccion">
                <h2 className="seccion-titulo"><span className="titulo-bar titulo-bar-nuevo" />Nuevo</h2>
                <div className="grilla">
                  {productos.filter(p => p.es_nuevo).map(p => <TarjetaProducto key={p.id} prod={p} />)}
                </div>
              </section>
            )}

            {/* Promociones: en "Todo" es una fila horizontal, en su propia pestaña es grilla vertical */}
            {promociones.length > 0 && (categoriaActiva === '__todo__' || categoriaActiva === '__promos__') && (
              <section className="seccion">
                <h2 className="seccion-titulo">
                  <span className="titulo-bar titulo-bar-verde" />
                  Promociones
                  {categoriaActiva === '__todo__' && <span className="seccion-count">{promociones.length} producto{promociones.length !== 1 ? 's' : ''}</span>}
                </h2>
                {categoriaActiva === '__todo__' ? (
                  <div className="fila-horizontal-wrap">
                    <button className="fila-flecha fila-flecha-izq" onClick={e => scrollFila(e, -1)} aria-label="Ver anteriores">‹</button>
                    <div className="fila-horizontal">
                      {promociones.map(pr => (
                        <div key={pr.id} className="card-h-wrap"><TarjetaPromo promo={pr} /></div>
                      ))}
                    </div>
                    <button className="fila-flecha fila-flecha-der" onClick={e => scrollFila(e, 1)} aria-label="Ver siguientes">›</button>
                  </div>
                ) : (
                  <div className="grilla">
                    {promociones.map(pr => <TarjetaPromo key={pr.id} promo={pr} />)}
                  </div>
                )}
              </section>
            )}

            {/* Categorías: en "Todo" cada una es una fila horizontal; si hay una elegida, grilla vertical con todo */}
            {categorias
              .filter(cat => categoriaActiva === '__todo__' || categoriaActiva === cat.id)
              .map(cat => {
                const prods = productos
                  .filter(p => p.categoria_id === cat.id)
                  .sort((a, b) => (b.es_nuevo ? 1 : 0) - (a.es_nuevo ? 1 : 0));
                if (!prods.length) return null;
                return (
                  <section key={cat.id} className="seccion">
                    <h2 className="seccion-titulo">
                      <span className="titulo-bar" />
                      {cat.nombre}
                      {categoriaActiva === '__todo__' && <span className="seccion-count">{prods.length} producto{prods.length !== 1 ? 's' : ''}</span>}
                    </h2>
                    {categoriaActiva === '__todo__' ? (
                      <div className="fila-horizontal-wrap">
                        <button className="fila-flecha fila-flecha-izq" onClick={e => scrollFila(e, -1)} aria-label="Ver anteriores">‹</button>
                        <div className="fila-horizontal">
                          {prods.map(p => (
                            <div key={p.id} className="card-h-wrap"><TarjetaProducto prod={p} /></div>
                          ))}
                        </div>
                        <button className="fila-flecha fila-flecha-der" onClick={e => scrollFila(e, 1)} aria-label="Ver siguientes">›</button>
                      </div>
                    ) : (
                      <div className="grilla">
                        {prods.map(p => <TarjetaProducto key={p.id} prod={p} />)}
                      </div>
                    )}
                  </section>
                );
              })}

            {/* Categoría específica sin productos */}
            {categoriaActiva !== '__todo__' && categoriaActiva !== '__promos__' && categoriaActiva !== '__nuevo__' &&
              productos.filter(p => p.categoria_id === categoriaActiva).length === 0 && (
                <div className="seccion-vacia">
                  <p>No hay productos cargados en esta categoría todavía.</p>
                </div>
            )}
          </>
        )}
      </main>
      </div>

      {/* ── FOOTER ── */}
      <footer className="footer" ref={footerRef}>
        <div className="footer-inner">
          <div className="footer-marca">
            <img src="/logo.png" alt="Don Adriano's" className="footer-logo" />
            <div>
              <h3>Don Adriano's</h3>
              <p>Pizzería · San José, Guaymallén, Mendoza</p>
            </div>
          </div>

          <div className="footer-columnas">
            <div className="footer-col">
              <h4>Contacto</h4>
              {config?.whatsapp_numero && (
                <a href={`https://wa.me/${config.whatsapp_numero}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              )}
              <button className="footer-link-btn" onClick={() => setModalHorarios(true)}>Horarios</button>
              {config?.latitud_local && (
                <a href={`https://maps.google.com/?q=${config.latitud_local},${config.longitud_local}`} target="_blank" rel="noopener noreferrer">
                  Cómo llegar
                </a>
              )}
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
          </div>
        </div>

        <div className="footer-bottom">
          © {new Date().getFullYear()} Don Adriano's · Todos los derechos reservados
        </div>
      </footer>

      {/* ── LIGHTBOX DE GALERÍA ── */}
      {lightboxIdx !== null && (
        <div className="lightbox-backdrop" onClick={() => setLightboxIdx(null)}>
          <button className="lightbox-close" onClick={() => setLightboxIdx(null)}>✕</button>

          {lightboxIdx > 0 && (
            <button className="lightbox-nav lightbox-prev" onClick={e => { e.stopPropagation(); setLightboxIdx(i => i - 1); }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}

          <div className="lightbox-contenido" onClick={e => e.stopPropagation()}>
            <img src={galeria[lightboxIdx].imagen_url} alt={galeria[lightboxIdx].descripcion || ''} />
            {galeria[lightboxIdx].descripcion && (
              <p className="lightbox-desc">{galeria[lightboxIdx].descripcion}</p>
            )}
          </div>

          {lightboxIdx < galeria.length - 1 && (
            <button className="lightbox-nav lightbox-next" onClick={e => { e.stopPropagation(); setLightboxIdx(i => i + 1); }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
        </div>
      )}

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

      {/* ── BARRA DE CARRITO — grande, fija abajo, bien visible ── */}
      {cantidad > 0 && !showCheckout && (
        <button
          className={`barra-carrito ${carritoIluminado ? 'barra-carrito-brillo' : ''}`}
          style={carritoIluminado ? { animationDelay: `0ms, ${carritoAnimDelay}` } : undefined}
          onClick={() => setShowCheckout(true)}
        >
          <span
            className="barra-carrito-icono"
            style={carritoIluminado ? { animationDelay: carritoAnimDelay } : undefined}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span className="barra-carrito-badge">{cantidad}</span>
          </span>
          <span className="barra-carrito-texto">
            <strong>Realizar pedido</strong>
            <span>{cantidad} {cantidad === 1 ? 'producto' : 'productos'}</span>
          </span>
          <span className="barra-carrito-precio">${subtotal.toLocaleString('es-AR')}</span>
        </button>
      )}

      {/* ── BOTONES FLOTANTES DE REDES SOCIALES ── */}
      {!showCheckout && (config?.instagram_url || config?.facebook_url) && (
        <div className={`redes-flotantes ${cantidad > 0 ? 'redes-con-carrito' : ''}`}>
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
        body { background: #fffbf5; color: #22201c; font-family: 'Work Sans', system-ui, sans-serif; }

        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&display=swap');

        /* ── HERO: subtítulo + estado. Flujo normal, no sticky → se va con el scroll de forma 100% nativa ── */
        .header-hero { max-width: 760px; margin: 0 auto; padding: 6px 16px 0; }
        .header-hero-sub { display: block; font-size: 11px; color: #8a8378; padding: 6px 0 2px; }

        /* ── BARRA STICKY: tamaño siempre constante, nunca anima layout. Solo cambia una sombra cosmética ── */
        .sticky-top { position: sticky; top: 0; z-index: 30; background: rgba(255,251,245,0.96); backdrop-filter: blur(26px) saturate(1.5); -webkit-backdrop-filter: blur(26px) saturate(1.5); transition: box-shadow 0.25s ease; }
        .sticky-top.con-sombra { box-shadow: 0 2px 14px rgba(0,0,0,0.08); }

        .header { border-bottom: 1px solid rgba(236,230,220,0.7); }
        .header-inner { max-width: 760px; margin: 0 auto; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .header-marca { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 auto; overflow: hidden; }
        .header-logo { width: 34px; height: 34px; object-fit: contain; border-radius: 50%; border: 2px solid #ece6dc; background: #fffbf5; flex-shrink: 0; }
        .header-nombre { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 700; color: #E0562F; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .header-acciones { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        .btn-consulta { display: flex; align-items: center; gap: 6px; background: #25d366; color: #fff; border: none; border-radius: 20px; padding: 8px 12px; font-size: 13px; font-weight: 600; text-decoration: none; transition: filter 0.15s; }
        .btn-consulta:hover { filter: brightness(1.08); }

        /* ── BARRA DE CARRITO GRANDE ── */
        .barra-carrito {
          position: fixed; left: 12px; right: 12px; bottom: 12px; z-index: 45;
          background: #22201c; color: #fffbf5; border: none; border-radius: 18px;
          padding: 14px 16px; display: flex; align-items: center; gap: 12px;
          cursor: pointer; box-shadow: 0 8px 28px rgba(0,0,0,0.28);
          animation: barraEntrar 0.35s cubic-bezier(0.32,0.72,0,1);
          max-width: 520px; margin: 0 auto;
        }
        @keyframes barraEntrar { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .barra-carrito:active { transform: scale(0.98); }
        .barra-carrito-icono { position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #F0623E; width: 46px; height: 46px; border-radius: 50%; }
        .barra-carrito-badge { position: absolute; top: -4px; right: -4px; background: #fffbf5; color: #22201c; font-size: 12px; font-weight: 800; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border: 2px solid #22201c; }
        .barra-carrito-texto { flex: 1; text-align: left; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .barra-carrito-texto strong { font-size: 16px; font-weight: 800; }
        .barra-carrito-texto span { font-size: 12.5px; color: #c9c2b6; }
        .barra-carrito-precio { font-size: 18px; font-weight: 800; color: #f0c675; flex-shrink: 0; }

        /* ── el carrito se ilumina al contacto con la gota (reemplaza a la flecha cuando ya hay productos agregados) ── */
        .barra-carrito-brillo { animation: barraEntrar 0.35s cubic-bezier(0.32,0.72,0,1), carrito-ilumina 3.6s ease-in-out infinite; }
        .barra-carrito-brillo .barra-carrito-icono { animation: carrito-icono-ilumina 3.6s ease-in-out infinite; }
        @keyframes carrito-ilumina {
          0%, 66%  { box-shadow: 0 8px 28px rgba(0,0,0,0.28); }
          68%      { box-shadow: 0 8px 28px rgba(0,0,0,0.28), 0 0 24px 8px rgba(240,98,62,0.65); }
          72%      { box-shadow: 0 8px 28px rgba(0,0,0,0.28); }
          100%     { box-shadow: 0 8px 28px rgba(0,0,0,0.28); }
        }
        @keyframes carrito-icono-ilumina {
          0%, 66%  { background: #F0623E; }
          68%      { background: #F7B267; }
          72%      { background: #F0623E; }
          100%     { background: #F0623E; }
        }

        /* ── ESTADO ── */
        .estado-bar { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500; padding: 4px 0 8px; }
        .estado-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .abierto { color: #3c8261; }
        .abierto .estado-dot { background: #3c8261; box-shadow: 0 0 0 3px rgba(61,74,47,0.15); animation: pulso-verde 2s infinite; }
        @keyframes pulso-verde { 0%,100%{box-shadow:0 0 0 3px rgba(61,74,47,0.15)} 50%{box-shadow:0 0 0 5px rgba(61,74,47,0.08)} }
        @keyframes insignia-flotar { 0%,100%{ transform: translateY(0) rotate(0deg); } 50%{ transform: translateY(-3px) rotate(-3deg); } }
        @keyframes boton-resplandor { 0%,100%{ box-shadow: 0 2px 8px rgba(240,98,62,0.25); } 50%{ box-shadow: 0 3px 14px rgba(240,98,62,0.5); } }
        .cerrado { color: #D94E2C; }
        .cerrado .estado-dot { background: #D94E2C; }

        /* ── BUSCADOR ── */
        .busq-wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 10px; }
        .busq-inner { position: relative; }
        .busq-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #8a8378; pointer-events: none; }
        .busq-input { width: 100%; background: #f3efe6; border: 1.5px solid #ece6dc; border-radius: 10px; padding: 10px 36px; font-size: 14px; color: #22201c; font-family: inherit; outline: none; transition: border-color 0.15s; }
        .busq-input:focus { border-color: #F0623E; background: #fff; }
        .busq-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #8a8378; font-size: 14px; cursor: pointer; padding: 4px; }

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
        .seccion-titulo { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 700; color: #22201c; padding: 0 4px 14px; display: flex; align-items: center; gap: 10px; }
        .titulo-bar { width: 4px; height: 18px; background: #F0623E; border-radius: 2px; }
        .titulo-bar-verde { background: #3c8261; }
        .titulo-bar-nuevo { background: #d9a534; }

        .grilla { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 560px) { .grilla { gap: 14px; } }

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
        .card { background: #fff; border: 1px solid #ece6dc; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: box-shadow 0.2s, transform 0.2s; }
        .card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.07); transform: translateY(-1px); }
        .card-agotado { opacity: 0.6; }
        .card-promo { border-color: rgba(61,74,47,0.25); }

        .card-img-wrap { position: relative; width: 100%; aspect-ratio: 1/1; background: #f3efe6; }
        .card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .card-img-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #c4bcae; font-size: 12px; }
        .card-img-ph-promo { background: linear-gradient(135deg, #f3efe6, #eae3d4); }
        .card-badge-agotado { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 700; background: #fff; color: #F0623E; border-radius: 6px; padding: 3px 7px; }
        .card-badge-nuevo { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: #d9a534; color: #fff; border-radius: 6px; padding: 3px 8px; box-shadow: 0 2px 6px rgba(217,165,52,0.4); animation: insignia-flotar 2.6s ease-in-out infinite; }
        .card-badge-promo { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: #3c8261; color: #fff; border-radius: 6px; padding: 3px 8px; }

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
        .ctrl-btn { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #F0623E; background: transparent; color: #F0623E; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; transition: background 0.1s, color 0.1s; flex-shrink: 0; }
        .ctrl-btn:hover { background: #F0623E; color: #fff; }
        .ctrl-n { font-size: 13px; font-weight: 700; min-width: 14px; text-align: center; }

        .ctrl-btn-agregar { width: 100%; background: #F0623E; color: #fff; border: none; border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s, box-shadow 0.2s ease; animation: boton-resplandor 2.8s ease-in-out infinite; }
        .ctrl-btn-agregar:hover:not(:disabled) { background: #D94E2C; }
        .ctrl-btn-agregar:disabled { opacity: 0.4; cursor: default; }

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

        /* ── GALERÍA: foto por foto, mazo apilado, con fondo de cocina ── pensada para entrar en una sola pantalla ── */
        .galeria-seccion { position: relative; padding: 18px 0 16px; overflow: hidden; animation: galeria-aparecer 0.45s cubic-bezier(0.22,0.8,0.3,1) both; }
        @keyframes galeria-aparecer { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .galeria-fondo { position: absolute; inset: -12px; background-image: url('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=70'); background-size: cover; background-position: center 40%; filter: blur(5px) brightness(0.6) saturate(1.15); transform: scale(1.08); z-index: 0; }
        .galeria-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(18,12,7,0.55) 0%, rgba(18,12,7,0.78) 65%, rgba(18,12,7,0.9) 100%); z-index: 0; }

        /* ── el charco: onda de queso + gota, siempre sobre el fondo claro de la página (fuera de la sección oscura), arranca justo donde termina la foto ── */
        .charco-centinela { position: relative; height: 0; margin: 0; padding: 0; pointer-events: none; }
        .galeria-charco-local { position: sticky; top: 0; z-index: 25; background: transparent; pointer-events: none; }
        .galeria-goteo-wrap { position: relative; height: 32px; z-index: 2; }
        .galeria-goteo-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        .galeria-caida { position: relative; height: 4px; overflow: visible; }
        .galeria-gota {
          position: absolute; top: 0; right: 46px; width: 13px; height: 13px;
          background: linear-gradient(180deg, #F7B267 0%, #F0623E 100%);
          box-shadow: 0 1px 3px rgba(178,58,30,0.35);
          border-radius: 50% 50% 42% 42% / 62% 62% 38% 38%;
          transform-origin: top center;
          animation: gota-cae 3.6s cubic-bezier(0.45,0.05,0.55,1) infinite;
        }
        /* 0%-22%: todavía pegada al charco, se estira formando un cuello fino; 23% en adelante: se desprende (snap)
           y cae en línea recta hasta tocar la flecha EXACTO en el 76% — el recorrido (var(--dist-gota)) se mide en
           tiempo real contra la posición de la flecha, así que la gota SIEMPRE aterriza ahí, sea cual sea el alto de pantalla */
        @keyframes gota-cae {
          0%   { transform: translateY(-3px) translateX(0) scaleY(0.4) scaleX(1.15); opacity: 0.9; }
          10%  { transform: translateY(-2px) translateX(0) scaleY(1) scaleX(0.85); opacity: 1; }
          19%  { transform: translateY(3px) translateX(0) scaleY(1.7) scaleX(0.62); opacity: 1; }
          23%  { transform: translateY(9px) translateX(0) scaleY(1) scaleX(1.1); opacity: 1; }
          40%  { transform: translateY(calc(var(--dist-gota, 108px) * 0.33)) translateX(-2px) scaleY(1.5) scaleX(1); opacity: 1; }
          58%  { transform: translateY(calc(var(--dist-gota, 108px) * 0.72)) translateX(2px) scaleY(2.1) scaleX(1); opacity: 1; }
          68%  { transform: translateY(calc(var(--dist-gota, 108px) * 0.96)) translateX(0) scaleY(2.7) scaleX(1); opacity: 0.9; }
          76%  { opacity: 0; transform: translateY(var(--dist-gota, 108px)) translateX(0) scaleY(2.7) scaleX(1); }
          100% { opacity: 0; transform: translateY(var(--dist-gota, 108px)) translateX(0) scaleY(2.7) scaleX(1); }
        }

        /* ── flecha: guía visual de que se puede seguir bajando (no es un botón), visible mientras se recorre el menú y hasta llegar al pie de página ── */
        .galeria-flecha-fixed {
          position: fixed; right: 28px; bottom: 18px; width: 40px;
          display: flex; align-items: center; justify-content: center;
          z-index: 40; opacity: 0; pointer-events: none;
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .galeria-flecha-fixed.flecha-visible { opacity: 1; pointer-events: auto; }
        .galeria-mancha {
          position: absolute; bottom: -4px; width: 52px; height: 24px;
          background: radial-gradient(ellipse at center, rgba(240,98,62,0.45) 0%, rgba(247,178,103,0.28) 45%, rgba(240,98,62,0) 75%);
          border-radius: 50%; filter: blur(1.5px); pointer-events: none;
          opacity: 0; transform: scale(0.85);
        }
        /* el brillo de "impacto" solo corre una vez que el charco está realmente pegado al header y goteando de verdad
           (clase .charco-goteando en el contenedor); antes de eso no hay animación ninguna, quedan estáticos e invisibles */
        .charco-goteando .galeria-mancha { animation: mancha-aparece 3.6s ease-in-out infinite; }
        /* el brillo solo aparece en el instante exacto en que la gota toca (68% del ciclo, igual que gota-cae/charco-cae-viajero): ni antes ni después */
        @keyframes mancha-aparece {
          0%, 66%  { opacity: 0; transform: scale(0.85); }
          68%      { opacity: 1; transform: scale(1.3); }
          72%      { opacity: 0; transform: scale(0.95); }
          100%     { opacity: 0; transform: scale(0.85); }
        }
        .galeria-flecha-abajo {
          position: relative; width: 40px; height: 40px; border-radius: 50%;
          background: #fffbf5; color: #F0623E;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.22);
        }
        .charco-goteando .galeria-flecha-abajo { animation: flecha-ilumina 3.6s ease-in-out infinite; }
        @keyframes flecha-ilumina {
          0%, 66%  { background: #fffbf5; box-shadow: 0 4px 14px rgba(0,0,0,0.22); color: #F0623E; }
          68%      { background: #F0623E; box-shadow: 0 0 22px 8px rgba(240,98,62,0.7); color: #fff; }
          72%      { background: #fffbf5; box-shadow: 0 4px 14px rgba(0,0,0,0.22); color: #F0623E; }
          100%     { background: #fffbf5; box-shadow: 0 4px 14px rgba(0,0,0,0.22); color: #F0623E; }
        }
        .galeria-inner { position: relative; max-width: 760px; margin: 0 auto; padding: 0 16px; z-index: 1; }
        .galeria-titulo { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 700; color: #fffbf5; display: flex; align-items: center; gap: 7px; margin-bottom: 10px; text-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .galeria-icono { display: flex; color: #F0956F; animation: galeria-icono-mover 2.2s ease-in-out infinite; }
        @keyframes galeria-icono-mover { 0%,100%{ transform: rotate(0deg) scale(1); } 50%{ transform: rotate(-10deg) scale(1.18); } }

        .galeria-slider { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .galeria-stack { position: relative; width: 100%; max-width: 172px; aspect-ratio: 4/5; margin: 0 auto; touch-action: pan-y; }
        .galeria-carta { position: absolute; inset: 0; border: none; padding: 0; margin: 0; cursor: grab; border-radius: 18px; overflow: hidden; background: #f3efe6; box-shadow: 0 12px 26px rgba(0,0,0,0.35); transition: transform 0.7s cubic-bezier(0.22,1,0.36,1), opacity 0.5s ease; touch-action: pan-y; }
        .galeria-carta:active { cursor: grabbing; }
        .galeria-carta img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; -webkit-user-select: none; user-select: none; }
        .galeria-carta-p0 { transform: translateY(0) scale(1); z-index: 3; }
        .galeria-carta-p1 { transform: translateY(16px) scale(0.93); z-index: 2; opacity: 0.85; }
        .galeria-carta-p2 { transform: translateY(28px) scale(0.86); z-index: 1; opacity: 0.55; }
        .galeria-carta-sale { transition: transform 0.48s cubic-bezier(0.5,-0.2,0.7,0.4), opacity 0.4s ease 0.15s; transform: translate(130%,-10%) rotate(16deg) scale(0.92) !important; opacity: 0 !important; z-index: 4 !important; }
        .galeria-sin-transicion { transition: none !important; }

        .galeria-ubicacion { margin-top: 12px; padding-top: 12px; padding-bottom: 6px; border-top: 1px solid rgba(255,255,255,0.18); display: flex; flex-direction: column; gap: 8px; align-items: center; }
        .galeria-direccion { display: flex; align-items: center; gap: 6px; color: #fffbf5; font-size: 12.5px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.3); }
        .galeria-direccion svg { color: #F0956F; flex-shrink: 0; }
        .galeria-ubicacion-botones { display: flex; gap: 8px; width: 100%; max-width: 300px; }
        .galeria-btn-primario { flex: 1; text-align: center; background: #F0623E; color: #fff; border: none; border-radius: 10px; padding: 9px; font-size: 12px; font-weight: 700; text-decoration: none; transition: filter 0.15s; }
        .galeria-btn-primario:hover { filter: brightness(1.08); }
        .galeria-btn-secundario { flex: 1; background: rgba(255,255,255,0.08); color: #fffbf5; border: 1px solid rgba(255,255,255,0.25); border-radius: 10px; padding: 9px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .galeria-btn-secundario:hover { background: rgba(255,255,255,0.16); }

        @media (prefers-reduced-motion: reduce) {
          .galeria-carta { transition: none; }
          .galeria-icono { animation: none; }
          .galeria-gota, .galeria-mancha, .galeria-flecha-abajo, .barra-carrito-brillo, .barra-carrito-brillo .barra-carrito-icono { animation: none; }
        }

        /* ── FOOTER ── */
        .footer { background: #22201c; color: #d8d2c8; margin-top: 0; }
        .footer-inner { max-width: 760px; margin: 0 auto; padding: 32px 16px 24px; display: flex; flex-direction: column; gap: 24px; }
        .footer-marca { display: flex; align-items: center; gap: 12px; }
        .footer-logo { width: 44px; height: 44px; border-radius: 50%; object-fit: contain; background: #fff; flex-shrink: 0; }
        .footer-marca h3 { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 700; color: #fff; margin: 0; }
        .footer-marca p { font-size: 12px; color: #a39c8f; margin: 2px 0 0; }
        .footer-columnas { display: flex; gap: 40px; flex-wrap: wrap; }
        .footer-col { display: flex; flex-direction: column; gap: 8px; }
        .footer-col h4 { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #a39c8f; margin: 0 0 4px; }
        .footer-col a, .footer-link-btn { font-size: 13.5px; color: #d8d2c8; text-decoration: none; background: none; border: none; padding: 0; text-align: left; cursor: pointer; font-family: inherit; width: fit-content; }
        .footer-col a:hover, .footer-link-btn:hover { color: #fff; text-decoration: underline; }
        .footer-redes { display: flex; gap: 8px; }
        .footer-red { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .footer-red-ig { background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); }
        .footer-red-fb { background: #1877f2; }
        .footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding: 14px 16px; text-align: center; font-size: 11.5px; color: #8a8378; }

        /* ── LIGHTBOX ── */
        .lightbox-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 80; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .lightbox-close { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 38px; height: 38px; border-radius: 50%; font-size: 16px; cursor: pointer; z-index: 2; }
        .lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.1); border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2; }
        .lightbox-prev { left: 16px; }
        .lightbox-next { right: 16px; }
        .lightbox-contenido { max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .lightbox-contenido img { max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 8px; }
        .lightbox-desc { color: #fff; font-size: 13px; text-align: center; max-width: 400px; }

        @media (max-width: 380px) {
          .header-hero-sub { display: none; }
          .btn-consulta-txt { display: none; }
          .btn-consulta { padding: 9px; }
        }
      `}</style>
    </div>
  );
}