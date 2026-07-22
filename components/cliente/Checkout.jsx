'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useCarrito } from '../../contexts/CarritoContext';
import {
  obtenerUbicacion, distanciaKm, generarMensajeWhatsApp, abrirWhatsApp,
  guardarAvisoApertura, cancelarAvisoApertura, hayAvisoAperturaGuardado,
  pedirPermisoNotificaciones,
  guardarBorradorCheckout, cargarBorradorCheckout, limpiarBorradorCheckout,
  horaValidaHoy,
} from '../../lib/clienteUtils';

const MapSelector = dynamic(() => import('./MapSelector'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 280, background: '#f0ebe3', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a8f82', fontSize: 14 }}>
      Cargando mapa…
    </div>
  ),
});

const PASOS = ['carrito', 'entrega', 'datos', 'pago'];

export default function Checkout({ config, metodos, abierto, proxApertura, horarios, franjas, onClose }) {
  const { items, subtotal, quitar, agregar, vaciar } = useCarrito();
  const [paso, setPaso]               = useState('carrito');
  const [tipoEntrega, setTipoEntrega] = useState(null);
  const [modoDireccion, setModoDireccion] = useState(null); // 'gps' | 'mapa' | 'manual'
  const [ubicacion, setUbicacion]     = useState(null);
  const [errorUbic, setErrorUbic]     = useState(null);
  const [loadingUbic, setLoadingUbic] = useState(false);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [direccion, setDireccion]     = useState('');
  const [pisoDepto, setPisoDepto]     = useState('');
  const [indicaciones, setIndicaciones] = useState('');
  const [cliente, setCliente]         = useState({ nombre: '', telefono: '', aclaraciones: '' });
  const [metodoPago, setMetodoPago]   = useState('');
  const [avisando, setAvisando]       = useState(false);
  const [horarioDeseado, setHorarioDeseado] = useState('antes_posible');
  const [horaPersonalizada, setHoraPersonalizada] = useState('');
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [errorGuardado, setErrorGuardado]     = useState('');
  const [errorPaso, setErrorPaso]     = useState(null); // banner persistente de "qué falta"
  const hidratado = useRef(false);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const horaInputRef = useRef(null);

  // Bloquear el scroll del fondo (menú) mientras el checkout está abierto
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Cargar borrador guardado
  useEffect(() => {
    const borrador = cargarBorradorCheckout();
    if (borrador) {
      const tieneProgreso = borrador.paso !== 'carrito' || borrador.cliente?.nombre || borrador.direccion || borrador.metodoPago;
      if (tieneProgreso) setBorradorRestaurado(true);
      if (borrador.paso) setPaso(borrador.paso);
      if (borrador.tipoEntrega) setTipoEntrega(borrador.tipoEntrega);
      if (borrador.modoDireccion) setModoDireccion(borrador.modoDireccion);
      if (borrador.direccion) setDireccion(borrador.direccion);
      if (borrador.pisoDepto) setPisoDepto(borrador.pisoDepto);
      if (borrador.indicaciones) setIndicaciones(borrador.indicaciones);
      if (borrador.cliente) setCliente(borrador.cliente);
      if (borrador.metodoPago) setMetodoPago(borrador.metodoPago);
      if (borrador.horarioDeseado) setHorarioDeseado(borrador.horarioDeseado);
      if (borrador.horaPersonalizada) setHoraPersonalizada(borrador.horaPersonalizada);
      if (borrador.ubicacion) setUbicacion(borrador.ubicacion);
    }
    hidratado.current = true;
  }, []);

  useEffect(() => {
    if (!hidratado.current) return;
    guardarBorradorCheckout({
      paso, tipoEntrega, modoDireccion, direccion, pisoDepto, indicaciones,
      cliente, metodoPago, horarioDeseado, horaPersonalizada, ubicacion,
    });
  }, [paso, tipoEntrega, modoDireccion, direccion, pisoDepto, indicaciones, cliente, metodoPago, horarioDeseado, horaPersonalizada, ubicacion]);

  useEffect(() => { setAvisando(hayAvisoAperturaGuardado()); }, []);

  // Abrir el selector de hora nativo automáticamente al elegir "personalizado"
  useEffect(() => {
    if (horarioDeseado === 'personalizado' && horaInputRef.current) {
      try { horaInputRef.current.focus(); horaInputRef.current.showPicker?.(); } catch {}
    }
  }, [horarioDeseado]);

  // Limpiar el banner de error apenas el campo problemático se corrige
  useEffect(() => {
    if (!errorPaso) return;
    if (errorPaso.campo === 'nombre' && cliente.nombre.trim()) setErrorPaso(null);
    if (errorPaso.campo === 'direccion' && direccion.trim()) setErrorPaso(null);
    if (errorPaso.campo === 'ubicacion' && (ubicacion || modoDireccion === 'manual')) setErrorPaso(null);
    if (errorPaso.campo === 'pago' && metodoPago) setErrorPaso(null);
    if (errorPaso.campo === 'hora' && horaPersonalizada) setErrorPaso(null);
  }, [cliente.nombre, direccion, ubicacion, modoDireccion, metodoPago, horaPersonalizada]);

  async function activarAviso() {
    guardarAvisoApertura();
    setAvisando(true);
    await pedirPermisoNotificaciones();
  }

  function desactivarAviso() {
    cancelarAvisoApertura();
    setAvisando(false);
  }

  const costoDelivery = tipoEntrega === 'delivery' ? (config?.delivery_precio || 0) : 0;
  const total         = subtotal + Number(costoDelivery);
  const horaEsValida  = horarioDeseado !== 'personalizado' || horaValidaHoy(horaPersonalizada, horarios, franjas);

  // ── GEOLOCALIZACIÓN ──────────────────────────────────────────────────────────
  async function pedirUbicacion() {
    setLoadingUbic(true);
    setErrorUbic(null);
    setUbicacion(null);
    setModoDireccion('gps');

    const esIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const esAndroid = /android/i.test(navigator.userAgent);

    try {
      const { lat, lng, precision } = await obtenerUbicacion();
      const dist = distanciaKm(lat, lng, config.latitud_local, config.longitud_local);

      if (dist > config.delivery_radio_km) {
        setErrorUbic({ titulo: `Tu ubicación está a ${dist.toFixed(1)} km. Solo llegamos hasta ${config.delivery_radio_km} km del local.`, puedeReintentar: false });
      } else {
        setUbicacion({ lat, lng, dist: dist.toFixed(1), precision });
      }
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('denegado') || msg.includes('PERMISSION_DENIED') || msg.includes('Permiso')) {
        setErrorUbic({
          titulo: 'Bloqueaste el permiso de ubicación.',
          pasos: esIOS
            ? ['Abrí Configuración del celular', 'Entrá a Safari → Ubicación', 'Cambialo a "Permitir"']
            : esAndroid
            ? ['Tocá el ícono de candado en la barra del navegador', 'Buscá "Ubicación" y cambialo a "Permitir"', 'Volvé e intentá de nuevo']
            : ['Hacé click en el candado de la barra de dirección', 'Cambiá el permiso de Ubicación a "Permitir"'],
          puedeReintentar: false,
        });
      } else if (msg.includes('GPS') || msg.includes('activado') || msg.includes('POSITION_UNAVAILABLE')) {
        setErrorUbic({
          titulo: 'El GPS está desactivado.',
          pasos: esIOS
            ? ['Abrí Configuración', 'Tocá "Privacidad y seguridad" → "Localización"', 'Activá la localización']
            : esAndroid
            ? ['Deslizá desde arriba de la pantalla', 'Tocá el ícono de "Ubicación" para activarlo', 'Volvé e intentá de nuevo']
            : ['Activá el GPS en la configuración de tu dispositivo'],
          puedeReintentar: true,
        });
      } else {
        setErrorUbic({ titulo: 'No pudimos obtener tu ubicación.', pasos: ['Verificá que el GPS esté activado', 'Asegurate de haber dado permiso de ubicación'], puedeReintentar: true });
      }
    }
    setLoadingUbic(false);
  }

  function confirmarUbicacionMapa(lat, lng) {
    const dist = distanciaKm(lat, lng, config.latitud_local, config.longitud_local);
    if (dist > config.delivery_radio_km) {
      setErrorUbic({ titulo: `Ese domicilio está a ${dist.toFixed(1)} km. Solo llegamos hasta ${config.delivery_radio_km} km del local.`, puedeReintentar: false });
    } else {
      setUbicacion({ lat, lng, dist: dist.toFixed(1) });
      setMostrarMapa(false);
      setErrorUbic(null);
    }
  }

  function elegirModoManual() {
    setModoDireccion('manual');
    setUbicacion(null);
    setErrorUbic(null);
    setMostrarMapa(false);
  }

  // ── VALIDACIONES POR PASO (con mensaje persistente de qué falta) ────────────
  function validarEntrega() {
    if (!tipoEntrega) {
      setErrorPaso({ campo: 'tipo', mensaje: 'Elegí una opción: Retiro por el local o Delivery.' });
      return false;
    }
    if (tipoEntrega === 'delivery') {
      if (!direccion.trim()) {
        setErrorPaso({ campo: 'direccion', mensaje: 'Falta escribir tu calle y número.' });
        return false;
      }
      if (modoDireccion !== 'manual' && !ubicacion) {
        setErrorPaso({ campo: 'ubicacion', mensaje: 'Necesitamos tu ubicación (automática, en el mapa, o marcá "solo escribir mi dirección").' });
        return false;
      }
    }
    setErrorPaso(null);
    return true;
  }

  function validarDatos() {
    if (!cliente.nombre.trim()) {
      setErrorPaso({ campo: 'nombre', mensaje: 'Falta tu nombre — es el único dato obligatorio de esta pantalla.' });
      return false;
    }
    if (horarioDeseado === 'personalizado') {
      if (!horaPersonalizada) {
        setErrorPaso({ campo: 'hora', mensaje: 'Elegí un horario en el reloj, o cambiá a "Lo antes posible" / "Sin apuro".' });
        return false;
      }
      if (!horaEsValida) {
        setErrorPaso({ campo: 'hora', mensaje: 'Ese horario está fuera de nuestro horario de atención. Elegí otro.' });
        return false;
      }
    }
    setErrorPaso(null);
    return true;
  }

  function validarPago() {
    if (!metodoPago) {
      setErrorPaso({ campo: 'pago', mensaje: 'Elegí un método de pago para poder enviar el pedido.' });
      return false;
    }
    setErrorPaso(null);
    return true;
  }

  // ── CONFIRMAR PEDIDO ─────────────────────────────────────────────────────────
  async function confirmarPedido() {
    if (!validarPago()) return;

    setGuardandoPedido(true);
    setErrorGuardado('');

    const { supabase } = await import('../../lib/supabaseClient');

    const payloadPedido = {
      cliente_nombre:        cliente.nombre,
      cliente_telefono:      cliente.telefono || null,
      cliente_aclaraciones:  cliente.aclaraciones || null,
      tipo_entrega:          tipoEntrega,
      direccion:             tipoEntrega === 'delivery' ? direccion : null,
      piso_depto:            tipoEntrega === 'delivery' ? pisoDepto : null,
      indicaciones:          indicaciones || null,
      latitud:               tipoEntrega === 'delivery' ? (ubicacion?.lat || null) : null,
      longitud:              tipoEntrega === 'delivery' ? (ubicacion?.lng || null) : null,
      metodo_pago:           metodoPago,
      subtotal,
      costo_delivery:        costoDelivery,
      total,
      estado:                'nuevo',
      horario_deseado:       horarioDeseado,
      hora_personalizada:    horarioDeseado === 'personalizado' ? horaPersonalizada : null,
    };

    const { data: pedido, error: errorPedido } = await supabase.from('pedidos').insert(payloadPedido).select().single();

    if (errorPedido || !pedido) {
      console.error('Error guardando el pedido:', errorPedido);
      setErrorGuardado('No pudimos guardar tu pedido. Revisá tu conexión e intentá de nuevo.');
      setGuardandoPedido(false);
      return;
    }

    const { error: errorItems } = await supabase.from('pedido_items').insert(
      items.map(it => ({
        pedido_id: pedido.id,
        producto_id: it.tipo === 'producto' ? it.id : null,
        promocion_id: it.tipo === 'promo' ? it.id : null,
        variante_id: it.variante_id || null,
        nombre_snapshot: it.nombre_snapshot,
        precio_unitario: it.precio,
        cantidad: it.cantidad,
        detalle_seleccion: it.detalle_seleccion || null,
      }))
    );

    if (errorItems) {
      console.error('Error guardando los items del pedido:', errorItems);
      setErrorGuardado('Tu pedido se guardó pero hubo un problema con el detalle. Igual te mandamos el WhatsApp.');
    }

    const mensaje = generarMensajeWhatsApp({
      items, subtotal, costoDelivery, total, metodoPago, tipoEntrega, cliente,
      direccion, pisoDepto, indicaciones, lat: ubicacion?.lat, lng: ubicacion?.lng,
      horarioDeseado, horaPersonalizada,
    });

    abrirWhatsApp(config.whatsapp_numero, mensaje);
    limpiarBorradorCheckout();
    setGuardandoPedido(false);
    vaciar();
    onClose();
  }

  const pasoIdx = PASOS.indexOf(paso);

  return (
    <>
      <div className="ch-backdrop" onClick={onClose} />
      <div className="ch-drawer">
        <div className="ch-handle" />

        {/* ── HEADER ── */}
        <div className="ch-header">
          <div className="ch-header-l">
            {pasoIdx > 0 && (
              <button className="ch-back" onClick={() => { setErrorPaso(null); setPaso(PASOS[pasoIdx - 1]); }}>←</button>
            )}
            <h2 className="ch-titulo">
              {paso === 'carrito' && 'Tu pedido'}
              {paso === 'entrega' && 'Tipo de entrega'}
              {paso === 'datos'   && 'Tus datos'}
              {paso === 'pago'    && 'Método de pago'}
            </h2>
          </div>
          <button className="ch-close" onClick={onClose}>✕</button>
        </div>

        {borradorRestaurado && (
          <div className="ch-aviso-restaurado">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Retomamos tu pedido donde lo dejaste</span>
            <button onClick={() => setBorradorRestaurado(false)}>✕</button>
          </div>
        )}

        {abierto === false && (
          <div className="ch-aviso-cerrado">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>
              <strong>Estamos cerrados ahora</strong>
              <span>{proxApertura ? `Abrimos ${proxApertura}. ` : ''}Podés armar tu pedido y confirmarlo apenas abramos.</span>
            </div>
          </div>
        )}

        {/* ── BANNER PERSISTENTE: qué falta completar (siempre visible, no scrollea) ── */}
        {errorPaso && (
          <div className="ch-banner-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{errorPaso.mensaje}</span>
            <button onClick={() => setErrorPaso(null)} aria-label="Cerrar aviso">✕</button>
          </div>
        )}

        {/* ── PASOS ── */}
        <div className="ch-steps">
          {['Pedido', 'Entrega', 'Datos', 'Pago'].map((s, i) => (
            <div key={i} className={`ch-step ${i <= pasoIdx ? 'ch-step-done' : ''}`}>
              <div className="ch-step-dot">{i < pasoIdx ? '✓' : i + 1}</div>
              <span className="ch-step-label">{s}</span>
            </div>
          ))}
        </div>

        {/* ── CONTENIDO ── */}
        <div className="ch-body">

          {/* PASO 1: CARRITO */}
          {paso === 'carrito' && (
            <div className="ch-seccion">
              {items.map((it, idx) => (
                <div key={idx} className="ch-item">
                  <div className="ch-item-info">
                    <span className="ch-item-nombre">{it.nombre_snapshot}</span>
                    <span className="ch-item-precio">${(it.precio * it.cantidad).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="ch-item-ctrl">
                    <button className="ch-ctrl" onClick={() => quitar(it)}>−</button>
                    <span className="ch-ctrl-cant">{it.cantidad}</span>
                    <button className="ch-ctrl" onClick={() => agregar(it)}>+</button>
                  </div>
                </div>
              ))}
              <div className="ch-subtotal">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString('es-AR')}</span>
              </div>
            </div>
          )}

          {/* PASO 2: TIPO DE ENTREGA */}
          {paso === 'entrega' && (
            <div className="ch-seccion">
              <p className="ch-leyenda-obligatorio">
                <span className="req-marca">*</span> Obligatorio · el resto es opcional
              </p>

              <div className="ch-opciones-entrega">
                <button
                  className={`ch-opcion-entrega ${tipoEntrega === 'retiro' ? 'activa' : ''}`}
                  onClick={() => { setTipoEntrega('retiro'); setUbicacion(null); setErrorUbic(null); setMostrarMapa(false); setModoDireccion(null); }}
                >
                  <span className="ch-opcion-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </span>
                  <div>
                    <span className="ch-opcion-titulo">Retiro por el local</span>
                    <span className="ch-opcion-sub">Gratis · Retirás vos</span>
                  </div>
                </button>

                <button
                  className={`ch-opcion-entrega ${tipoEntrega === 'delivery' ? 'activa' : ''}`}
                  onClick={() => setTipoEntrega('delivery')}
                >
                  <span className="ch-opcion-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  </span>
                  <div>
                    <span className="ch-opcion-titulo">Delivery a domicilio</span>
                    <span className="ch-opcion-sub">+${Number(config?.delivery_precio || 0).toLocaleString('es-AR')} · Hasta {config?.delivery_radio_km} km</span>
                  </div>
                </button>
              </div>

              {tipoEntrega === 'delivery' && (
                <div className="ch-delivery-bloque">

                  {ubicacion && !mostrarMapa && (
                    <div className="ch-ubic-ok-wrap">
                      <div className="ch-ubic-ok">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Ubicación confirmada · {ubicacion.dist} km del local
                      </div>
                      <button className="ch-btn-cambiar" onClick={() => { setUbicacion(null); setMostrarMapa(false); setModoDireccion(null); }}>Cambiar</button>
                    </div>
                  )}

                  {modoDireccion === 'manual' && (
                    <div className="ch-ubic-ok-wrap ch-ubic-manual">
                      <div className="ch-ubic-ok ch-ubic-manual-texto">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Escribiendo la dirección manualmente
                      </div>
                      <button className="ch-btn-cambiar" onClick={() => setModoDireccion(null)}>Cambiar</button>
                    </div>
                  )}

                  {!ubicacion && modoDireccion !== 'manual' && !mostrarMapa && (
                    <div className="ch-ubic-opciones">
                      <p className="ch-ubic-intro">Necesitamos saber dónde estás para calcular si llegamos y el costo del envío.</p>

                      <button className="ch-btn-ubic" onClick={pedirUbicacion} disabled={loadingUbic}>
                        {loadingUbic
                          ? <span className="ch-ubic-loading"><span className="ch-ubic-spinner" /> Obteniendo ubicación…</span>
                          : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg> Usar mi ubicación automática</>
                        }
                      </button>

                      <div className="ch-o">o</div>

                      <button className="ch-btn-mapa" onClick={() => setMostrarMapa(true)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Ubicar en el mapa
                      </button>

                      <div className="ch-o">o</div>

                      <button className="ch-btn-manual" onClick={elegirModoManual}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Solo escribir mi dirección (sin mapa)
                      </button>
                      <p className="ch-manual-hint">Ideal si no podés usar el mapa — te confirmamos por WhatsApp si llegamos a tu zona.</p>
                    </div>
                  )}

                  {mostrarMapa && !ubicacion && (
                    <div className="ch-mapa-wrap">
                      <p className="ch-mapa-intro">Mové el pin hasta tu domicilio y tocá <strong>Confirmar ubicación</strong>.</p>
                      <MapSelector
                        lat={config?.latitud_local || -32.889458}
                        lng={config?.longitud_local || -68.845839}
                        radioKm={config?.delivery_radio_km || 5}
                        onConfirmar={confirmarUbicacionMapa}
                        onCancelar={() => setMostrarMapa(false)}
                      />
                    </div>
                  )}

                  {errorUbic && !mostrarMapa && (
                    <div className="ch-error-ubic">
                      <p className="ch-error-titulo">{errorUbic.titulo}</p>
                      {errorUbic.pasos && (
                        <ol className="ch-error-pasos">{errorUbic.pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                      )}
                      <div className="ch-error-btns">
                        {errorUbic.puedeReintentar && (
                          <button className="ch-btn-ubic" onClick={pedirUbicacion}>Intentar de nuevo</button>
                        )}
                        <button className="ch-btn-mapa" onClick={() => { setMostrarMapa(true); setErrorUbic(null); }}>Ubicar en el mapa</button>
                        <button className="ch-btn-manual" onClick={elegirModoManual}>Solo escribir mi dirección</button>
                        <button className="ch-btn-retiro" onClick={() => { setTipoEntrega('retiro'); setErrorUbic(null); }}>Mejor retiro por el local</button>
                      </div>
                    </div>
                  )}

                  {(ubicacion || modoDireccion === 'manual') && (
                    <>
                      <label className="ch-campo">
                        <span><span className="req-marca">*</span> Calle y número</span>
                        <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej: Av. San Martín 1234" />
                      </label>
                      <label className="ch-campo">
                        <span>Piso / Depto <span className="opt-marca">(opcional)</span></span>
                        <input type="text" value={pisoDepto} onChange={e => setPisoDepto(e.target.value)} placeholder="Ej: 3° B" />
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PASO 3: DATOS DEL CLIENTE */}
          {paso === 'datos' && (
            <div className="ch-seccion">
              <p className="ch-leyenda-obligatorio">
                <span className="req-marca">*</span> Obligatorio · el resto es opcional
              </p>

              <label className="ch-campo">
                <span><span className="req-marca">*</span> Nombre</span>
                <input type="text" value={cliente.nombre} onChange={e => setCliente(p => ({ ...p, nombre: e.target.value }))} placeholder="Tu nombre" />
              </label>
              <label className="ch-campo">
                <span>Teléfono <span className="opt-marca">(opcional)</span></span>
                <input type="tel" value={cliente.telefono} onChange={e => setCliente(p => ({ ...p, telefono: e.target.value }))} placeholder="Ej: 261 555-1234" />
              </label>
              <label className="ch-campo">
                <span>Aclaraciones del pedido <span className="opt-marca">(opcional)</span></span>
                <textarea rows={3} value={cliente.aclaraciones} onChange={e => setCliente(p => ({ ...p, aclaraciones: e.target.value }))} placeholder="Sin cebolla, extra salsa, alergia a…" />
              </label>
              <label className="ch-campo">
                <span>{tipoEntrega === 'delivery' ? 'Indicaciones de la dirección' : 'Indicaciones adicionales'} <span className="opt-marca">(opcional)</span></span>
                <textarea rows={2} value={indicaciones} onChange={e => setIndicaciones(e.target.value)} placeholder={tipoEntrega === 'delivery' ? 'Timbre roto, portón verde…' : 'Aviso cuando llego, voy en moto…'} />
              </label>

              <div className="ch-campo">
                <span>¿Para cuándo lo querés? <span className="opt-marca">(opcional, es una preferencia)</span></span>
                <div className="ch-horario-opciones">
                  <button type="button" className={`ch-horario-btn ${horarioDeseado === 'antes_posible' ? 'activo' : ''}`} onClick={() => setHorarioDeseado('antes_posible')}>Lo antes posible</button>
                  <button type="button" className={`ch-horario-btn ${horarioDeseado === 'sin_apuro' ? 'activo' : ''}`} onClick={() => setHorarioDeseado('sin_apuro')}>Sin apuro</button>
                  <button type="button" className={`ch-horario-btn ${horarioDeseado === 'personalizado' ? 'activo' : ''}`} onClick={() => setHorarioDeseado('personalizado')}>Elegir horario</button>
                </div>
                {horarioDeseado === 'personalizado' && (
                  <>
                    <input
                      ref={horaInputRef}
                      type="time"
                      className={`ch-hora-input ${!horaEsValida && horaPersonalizada ? 'ch-hora-invalida' : ''}`}
                      value={horaPersonalizada}
                      onChange={e => setHoraPersonalizada(e.target.value)}
                    />
                    {horaPersonalizada && !horaEsValida && (
                      <p className="ch-hora-error">Ese horario está fuera de nuestra atención de hoy. Elegí otro.</p>
                    )}
                  </>
                )}
                <p className="ch-horario-hint">Te confirmamos el horario real por WhatsApp apenas tomamos tu pedido.</p>
              </div>
            </div>
          )}

          {/* PASO 4: MÉTODO DE PAGO */}
          {paso === 'pago' && (
            <div className="ch-seccion">
              <p className="ch-leyenda-obligatorio">
                <span className="req-marca">*</span> Elegí un método de pago para continuar
              </p>
              <div className="ch-metodos">
                {metodos.map(m => (
                  <button key={m.id} className={`ch-metodo ${metodoPago === m.nombre ? 'activo' : ''}`} onClick={() => { setMetodoPago(m.nombre); setErrorPaso(null); }}>
                    {m.nombre}
                  </button>
                ))}
              </div>

              <div className="ch-resumen">
                <div className="ch-resumen-row"><span>Subtotal</span><span>${subtotal.toLocaleString('es-AR')}</span></div>
                {costoDelivery > 0 && <div className="ch-resumen-row"><span>Envío</span><span>${Number(costoDelivery).toLocaleString('es-AR')}</span></div>}
                <div className="ch-resumen-row ch-resumen-total"><span>Total</span><span>${total.toLocaleString('es-AR')}</span></div>
              </div>

              {abierto !== false && (
                <p className="ch-explicacion-envio">
                  Al tocar el botón de abajo, tu pedido queda anotado en nuestro sistema y se abre WhatsApp con el mensaje ya armado — solo tenés que apretar <strong>Enviar</strong> ahí.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="ch-footer">
          {paso === 'carrito' && (
            <button className="ch-btn-primario" onClick={() => setPaso('entrega')}>Continuar</button>
          )}

          {paso === 'entrega' && (
            <button
              className="ch-btn-primario"
              disabled={!tipoEntrega || (tipoEntrega === 'delivery' && (!direccion.trim() || (modoDireccion !== 'manual' && !ubicacion)))}
              onClick={() => { if (validarEntrega()) setPaso('datos'); }}
            >
              Continuar
            </button>
          )}

          {paso === 'datos' && (
            <button
              className="ch-btn-primario"
              disabled={!cliente.nombre.trim() || (horarioDeseado === 'personalizado' && (!horaPersonalizada || !horaEsValida))}
              onClick={() => { if (validarDatos()) setPaso('pago'); }}
            >
              Continuar
            </button>
          )}

          {paso === 'pago' && (
            abierto === false ? (
              <div className="ch-bloqueado">
                <p>No podemos enviar tu pedido hasta que abramos{proxApertura ? ` (${proxApertura})` : ''}.</p>
                {avisando ? (
                  <>
                    <div className="ch-avisando">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Te vamos a avisar apenas abramos
                    </div>
                    <button className="ch-btn-cancelar-aviso" onClick={desactivarAviso}>Cancelar aviso</button>
                  </>
                ) : (
                  <button className="ch-btn-avisar" onClick={activarAviso}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    Avisarme cuando abran
                  </button>
                )}
              </div>
            ) : (
              <>
                <button className="ch-btn-whatsapp" onClick={confirmarPedido} disabled={guardandoPedido || !metodoPago}>
                  {guardandoPedido ? (
                    <span className="ch-btn-loading"><span className="ch-spinner-blanco" /> Guardando pedido…</span>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Confirmar por WhatsApp
                    </>
                  )}
                </button>
                {errorGuardado && <p className="ch-err ch-err-guardado">{errorGuardado}</p>}
              </>
            )
          )}
        </div>
      </div>

      <style jsx global>{`
        .ch-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; backdrop-filter: blur(2px); }
        .ch-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: #faf7f2; border-top: 1px solid #ede8e0; border-radius: 20px 20px 0 0; z-index: 60; display: flex; flex-direction: column; max-height: 92vh; animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1); }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .ch-handle { width: 36px; height: 4px; background: #ddd8d0; border-radius: 2px; margin: 12px auto 0; flex-shrink: 0; }
        .ch-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px 10px; flex-shrink: 0; }
        .ch-header-l { display: flex; align-items: center; gap: 10px; }
        .ch-back { background: #f0ebe3; border: none; color: #1a1510; border-radius: 50%; width: 32px; height: 32px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ch-titulo { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; color: #1a1510; margin: 0; }
        .ch-close { background: #f0ebe3; border: none; color: #9a8f82; border-radius: 50%; width: 32px; height: 32px; font-size: 14px; cursor: pointer; }

        .ch-banner-error {
          flex-shrink: 0; margin: 0 20px 10px; display: flex; align-items: flex-start; gap: 10px;
          background: #fff0ee; border: 1.5px solid #f3b8b0; color: #b5281f; border-radius: 12px;
          padding: 13px 14px; font-size: 13.5px; font-weight: 600; line-height: 1.4;
        }
        .ch-banner-error svg { flex-shrink: 0; margin-top: 1px; }
        .ch-banner-error span { flex: 1; }
        .ch-banner-error button { background: none; border: none; color: #b5281f; font-size: 14px; cursor: pointer; padding: 0; flex-shrink: 0; }

        .ch-steps { display: flex; align-items: center; padding: 0 20px 14px; flex-shrink: 0; border-bottom: 1px solid #ede8e0; }
        .ch-step { display: flex; align-items: center; gap: 6px; flex: 1; }
        .ch-step:not(:last-child)::after { content: ''; flex: 1; height: 1px; background: #ddd8d0; margin: 0 6px; }
        .ch-step-dot { width: 22px; height: 22px; border-radius: 50%; background: #ddd8d0; color: #9a8f82; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ch-step-done .ch-step-dot { background: #e23e45; color: #fff; }
        .ch-step-label { font-size: 11px; color: #9a8f82; white-space: nowrap; }
        .ch-step-done .ch-step-label { color: #1a1510; font-weight: 500; }
        .ch-body { overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
        .ch-seccion { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }

        .ch-leyenda-obligatorio { font-size: 12px; color: #9a8f82; margin: 0 0 -4px; }
        .req-marca { color: #e23e45; font-weight: 800; }
        .opt-marca { color: #9a8f82; font-weight: 400; font-size: 12px; }

        .ch-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #ede8e0; }
        .ch-item:last-of-type { border-bottom: none; }
        .ch-item-info { flex: 1; }
        .ch-item-nombre { font-size: 14px; font-weight: 500; display: block; color: #1a1510; }
        .ch-item-precio { font-size: 13px; color: #6b6259; display: block; margin-top: 2px; }
        .ch-item-ctrl { display: flex; align-items: center; gap: 8px; }
        .ch-ctrl { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #e23e45; background: transparent; color: #e23e45; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ch-ctrl-cant { font-size: 15px; font-weight: 700; min-width: 18px; text-align: center; color: #1a1510; }
        .ch-subtotal { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; padding-top: 4px; border-top: 1px solid #ede8e0; margin-top: 4px; color: #1a1510; }

        .ch-opciones-entrega { display: flex; flex-direction: column; gap: 10px; }
        .ch-opcion-entrega { display: flex; align-items: center; gap: 14px; background: #fff; border: 2px solid #ede8e0; border-radius: 12px; padding: 14px 16px; cursor: pointer; font-family: inherit; text-align: left; transition: border-color 0.15s; }
        .ch-opcion-entrega.activa { border-color: #e23e45; background: #fff8f5; }
        .ch-opcion-icon { color: #9a8f82; flex-shrink: 0; }
        .ch-opcion-entrega.activa .ch-opcion-icon { color: #e23e45; }
        .ch-opcion-titulo { font-size: 15px; font-weight: 600; color: #1a1510; display: block; }
        .ch-opcion-sub { font-size: 12px; color: #9a8f82; display: block; margin-top: 2px; }
        .ch-delivery-bloque { display: flex; flex-direction: column; gap: 12px; }
        .ch-ubic-intro { font-size: 13px; color: #9a8f82; margin: 0; line-height: 1.5; }
        .ch-ubic-opciones { display: flex; flex-direction: column; gap: 10px; }
        .ch-o { text-align: center; font-size: 12px; color: #ccc5bb; }
        .ch-ubic-ok-wrap { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f0faf4; border: 1px solid #b8dfc8; border-radius: 10px; padding: 12px 14px; }
        .ch-ubic-manual { background: #f5f2ec; border-color: #e4ddd3; }
        .ch-ubic-manual-texto { color: #6b6259 !important; }
        .ch-ubic-ok { font-size: 13px; color: #2a7a4a; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .ch-btn-cambiar { background: transparent; border: none; color: #9a8f82; font-size: 12px; cursor: pointer; font-family: inherit; text-decoration: underline; flex-shrink: 0; }
        .ch-ubic-loading { display: flex; align-items: center; gap: 8px; }
        .ch-ubic-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ch-btn-ubic { background: #1a1510; color: #faf7f2; border: none; border-radius: 10px; padding: 13px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .ch-btn-ubic:disabled { opacity: 0.6; cursor: default; }
        .ch-btn-mapa, .ch-btn-manual { display: flex; align-items: center; justify-content: center; gap: 8px; background: #fff; border: 1.5px solid #e4ddd3; color: #1a1510; border-radius: 10px; padding: 13px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; width: 100%; transition: border-color 0.15s; }
        .ch-btn-mapa:hover, .ch-btn-manual:hover { border-color: #e23e45; }
        .ch-manual-hint { font-size: 11.5px; color: #9a8f82; text-align: center; margin: -4px 0 0; line-height: 1.4; }
        .ch-mapa-wrap { display: flex; flex-direction: column; gap: 10px; }
        .ch-mapa-intro { font-size: 13px; color: #9a8f82; margin: 0; line-height: 1.5; }
        .ch-error-ubic { background: #fff5f3; border: 1px solid #fcd0c8; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .ch-error-titulo { font-size: 13px; font-weight: 600; color: #e23e45; margin: 0; line-height: 1.4; }
        .ch-error-pasos { font-size: 13px; color: #6b6259; margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; line-height: 1.5; }
        .ch-error-btns { display: flex; flex-direction: column; gap: 8px; }
        .ch-btn-retiro { background: transparent; border: 1px solid #e4ddd3; color: #6b6259; border-radius: 8px; padding: 10px 14px; font-size: 13px; font-family: inherit; cursor: pointer; }
        .ch-campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #6b6259; font-weight: 500; }
        .ch-campo input, .ch-campo textarea { background: #fff; border: 1.5px solid #ddd8d0; border-radius: 10px; padding: 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; transition: border-color 0.15s; resize: none; }
        .ch-campo input:focus, .ch-campo textarea:focus { border-color: #e23e45; }
        .ch-err { font-size: 12px; color: #e23e45; }
        .ch-metodos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .ch-metodo { background: #fff; border: 2px solid #ede8e0; border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; transition: border-color 0.15s; color: #1a1510; }
        .ch-metodo.activo { border-color: #e23e45; background: #fff8f5; color: #e23e45; font-weight: 600; }
        .ch-resumen { background: #fff; border: 1px solid #ede8e0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .ch-resumen-row { display: flex; justify-content: space-between; font-size: 14px; color: #6b6259; }
        .ch-resumen-total { font-size: 18px; font-weight: 700; color: #1a1510; padding-top: 8px; border-top: 1px solid #ede8e0; margin-top: 4px; }
        .ch-explicacion-envio { font-size: 12.5px; color: #6b6259; line-height: 1.6; background: #f3efe9; border-radius: 10px; padding: 12px 14px; margin: 0; }
        .ch-explicacion-envio strong { color: #1a1510; }

        .ch-hora-input { margin-top: 8px; width: 100%; background: #fff; border: 1.5px solid #e4ddd3; border-radius: 10px; padding: 11px 12px; font-size: 15px; color: #22201c; font-family: inherit; outline: none; }
        .ch-hora-input:focus { border-color: #e23e45; }
        .ch-hora-invalida { border-color: #e23e45; background: #fff5f3; }
        .ch-hora-error { font-size: 12px; color: #e23e45; margin: 6px 0 0; font-weight: 600; }
        .ch-horario-opciones { display: flex; gap: 6px; flex-wrap: wrap; }
        .ch-horario-btn { flex: 1; min-width: 90px; background: #fff; border: 1.5px solid #e4ddd3; color: #55504a; border-radius: 10px; padding: 10px 8px; font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s; }
        .ch-horario-btn.activo { border-color: #e23e45; background: #fff5f3; color: #e23e45; }
        .ch-horario-hint { font-size: 11.5px; color: #9a8f82; margin-top: 6px; line-height: 1.4; }

        .ch-footer { padding: 12px 20px; padding-bottom: max(12px, env(safe-area-inset-bottom)); border-top: 1px solid #ede8e0; flex-shrink: 0; }
        .ch-btn-primario { width: 100%; background: #1a1510; color: #faf7f2; border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer; transition: filter 0.15s, background 0.2s; }
        .ch-btn-primario:hover:not(:disabled) { filter: brightness(1.15); }
        .ch-btn-primario:disabled { background: #ddd8d0; color: #a39c8f; cursor: default; }
        .ch-btn-whatsapp { width: 100%; background: #25d366; color: #fff; border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .ch-btn-whatsapp:hover:not(:disabled) { filter: brightness(1.08); }
        .ch-btn-whatsapp:disabled { background: #ddd8d0; color: #a39c8f; cursor: default; }
        .ch-btn-loading { display: flex; align-items: center; gap: 10px; }
        .ch-spinner-blanco { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: chspin 0.7s linear infinite; display: inline-block; }
        @keyframes chspin { to { transform: rotate(360deg); } }
        .ch-err-guardado { text-align: center; margin-top: 8px; }

        .ch-aviso-restaurado { flex-shrink: 0; margin: 12px 20px 0; display: flex; align-items: center; gap: 8px; background: #f3efe9; border: 1px solid #e4ddd3; border-radius: 12px; padding: 10px 14px; color: #6b6259; font-size: 12.5px; }
        .ch-aviso-restaurado svg { flex-shrink: 0; color: #9a8f82; }
        .ch-aviso-restaurado span { flex: 1; }
        .ch-aviso-restaurado button { background: none; border: none; color: #9a8f82; cursor: pointer; font-size: 13px; padding: 2px; }

        .ch-aviso-cerrado { flex-shrink: 0; margin: 12px 20px 0; display: flex; gap: 10px; background: #fff5f3; border: 1px solid #fcd0c8; border-radius: 12px; padding: 12px 14px; color: #e23e45; }
        .ch-aviso-cerrado svg { flex-shrink: 0; margin-top: 1px; }
        .ch-aviso-cerrado div { display: flex; flex-direction: column; gap: 2px; }
        .ch-aviso-cerrado strong { font-size: 13px; }
        .ch-aviso-cerrado span { font-size: 12px; line-height: 1.5; color: #a8502f; }

        .ch-bloqueado { display: flex; flex-direction: column; gap: 10px; }
        .ch-bloqueado p { font-size: 12px; color: #9a8f82; text-align: center; margin: 0; line-height: 1.4; }
        .ch-btn-avisar { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: #1a1510; color: #faf7f2; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; }
        .ch-btn-avisar:hover { filter: brightness(1.2); }
        .ch-avisando { display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(45,122,58,0.08); border: 1px solid rgba(45,122,58,0.25); color: #2d7a3a; border-radius: 12px; padding: 13px; font-size: 14px; font-weight: 600; }
        .ch-btn-cancelar-aviso { background: transparent; border: none; color: #9a8f82; font-size: 12px; text-decoration: underline; cursor: pointer; font-family: inherit; padding: 4px; }
      `}</style>
    </>
  );
}