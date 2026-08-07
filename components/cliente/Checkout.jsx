'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useCarrito } from '../../contexts/CarritoContext';
import {
  obtenerUbicacion, distanciaKm, generarMensajeWhatsApp, abrirWhatsApp,
  guardarAvisoApertura, cancelarAvisoApertura, hayAvisoAperturaGuardado,
  pedirPermisoNotificaciones,
  guardarBorradorCheckout, cargarBorradorCheckout, limpiarBorradorCheckout,
  guardarPreferenciasCliente, cargarPreferenciasCliente,
  horaValidaHoy,
} from '../../lib/clienteUtils';

const MapSelector = dynamic(() => import('./MapSelector'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 260, background: '#f0ebe3', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a8f82', fontSize: 14 }}>
      Cargando mapa…
    </div>
  ),
});

function iconoMetodo(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('transferencia')) return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/></svg>;
  if (n.includes('mercado')) return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><circle cx="12" cy="12.5" r="2.3"/></svg>;
  if (n.includes('visa') || n.includes('master') || n.includes('tarjeta') || n.includes('débito') || n.includes('crédito')) return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/></svg>;
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/><path d="M21 12h-6a2 2 0 0 0 0 4h6z"/></svg>;
}
const ICONO_EFECTIVO = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>;
const ICONO_MOTO = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M12 17.5L14 10h4l2 3"/><path d="M7 17.5h6l3-6.5h2"/><path d="M9 10h4l-1-3H8"/></svg>;

const PASOS = ['carrito', 'entrega', 'pago', 'horario', 'resumen'];
const LABELS_PASO = { carrito: 'Pedido', entrega: 'Entrega', pago: 'Pago', horario: 'Horario', resumen: 'Resumen' };

export default function Checkout({ config, metodos, abierto, proxApertura, horarios, franjas, onClose }) {
  const { items, subtotal, quitar, agregar, vaciar } = useCarrito();

  const [paso, setPaso] = useState('carrito');
  const [origenEdicion, setOrigenEdicion] = useState(null); // 'resumen' si venimos a editar y hay que volver ahí

  // Pago
  const [metodoPago, setMetodoPago] = useState('');
  const [efectivoAbierto, setEfectivoAbierto] = useState(false);
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [totalConfirmadoEfectivo, setTotalConfirmadoEfectivo] = useState(null);

  // Entrega
  const [tipoEntrega, setTipoEntrega]     = useState(null);
  const [prefsGuardadas, setPrefsGuardadas] = useState(null);
  const [usarGuardada, setUsarGuardada]   = useState(null); // null=sin decidir, true/false
  const [modoDireccion, setModoDireccion] = useState(null);
  const [ubicacion, setUbicacion]         = useState(null);
  const [errorUbic, setErrorUbic]         = useState(null);
  const [loadingUbic, setLoadingUbic]     = useState(false);
  const [mostrarMapa, setMostrarMapa]     = useState(false);
  const [direccion, setDireccion]         = useState('');
  const [pisoDepto, setPisoDepto]         = useState('');
  const [indicaciones, setIndicaciones]   = useState('');
  const [cliente, setCliente]             = useState({ nombre: '', telefono: '' });

  // Horario
  const [horarioDeseado, setHorarioDeseado] = useState('antes_posible');
  const [horaPersonalizada, setHoraPersonalizada] = useState('');
  const horaInputRef = useRef(null);

  const [avisando, setAvisando] = useState(false);
  const [itemRevelado, setItemRevelado] = useState(null);
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [errorGuardado, setErrorGuardado]     = useState('');
  const [errorPaso, setErrorPaso]             = useState(null);
  const [pedidoConfirmado, setPedidoConfirmado] = useState(false);
  const ultimoMensajeRef = useRef(null);

  const hidratado = useRef(false);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const drawerRef  = useRef(null);
  const arrastreY  = useRef({ inicio: 0, actual: 0, activo: false });

  function onArrastreInicio(e) {
    arrastreY.current = { inicio: e.touches ? e.touches[0].clientY : e.clientY, actual: 0, activo: true };
    if (drawerRef.current) drawerRef.current.style.transition = 'none';
  }
  function onArrastreMover(e) {
    if (!arrastreY.current.activo) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = Math.max(0, y - arrastreY.current.inicio);
    arrastreY.current.actual = delta;
    if (drawerRef.current) drawerRef.current.style.transform = `translateY(${delta}px)`;
  }
  function onArrastreFin() {
    if (!arrastreY.current.activo) return;
    arrastreY.current.activo = false;
    if (drawerRef.current) {
      drawerRef.current.style.transition = 'transform 0.25s cubic-bezier(0.32,0.72,0,1)';
      if (arrastreY.current.actual > 110) {
        drawerRef.current.style.transform = 'translateY(100%)';
        setTimeout(() => onClose(), 200);
      } else {
        drawerRef.current.style.transform = 'translateY(0)';
      }
    }
  }

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  useEffect(() => {
    const prefs = cargarPreferenciasCliente();
    if (prefs) setPrefsGuardadas(prefs);

    const borrador = cargarBorradorCheckout();
    if (borrador) {
      const tieneProgreso = PASOS.includes(borrador.paso) && borrador.paso !== 'carrito';
      if (tieneProgreso) setBorradorRestaurado(true);
      if (PASOS.includes(borrador.paso)) setPaso(borrador.paso);
      if (borrador.tipoEntrega) setTipoEntrega(borrador.tipoEntrega);
      if (borrador.modoDireccion) setModoDireccion(borrador.modoDireccion);
      if (borrador.direccion) setDireccion(borrador.direccion);
      if (borrador.pisoDepto) setPisoDepto(borrador.pisoDepto);
      if (borrador.indicaciones) setIndicaciones(borrador.indicaciones);
      if (borrador.cliente) setCliente(borrador.cliente);
      if (borrador.metodoPago) setMetodoPago(borrador.metodoPago);
      if (borrador.montoEfectivo) setMontoEfectivo(borrador.montoEfectivo);
      if (borrador.horarioDeseado) setHorarioDeseado(borrador.horarioDeseado);
      if (borrador.horaPersonalizada) setHoraPersonalizada(borrador.horaPersonalizada);
      if (borrador.ubicacion) setUbicacion(borrador.ubicacion);
      if (typeof borrador.usarGuardada === 'boolean') setUsarGuardada(borrador.usarGuardada);
    }
    hidratado.current = true;
  }, []);

  useEffect(() => {
    if (!hidratado.current) return;
    guardarBorradorCheckout({
      paso, tipoEntrega, modoDireccion, direccion, pisoDepto, indicaciones,
      cliente, metodoPago, montoEfectivo, horarioDeseado, horaPersonalizada, ubicacion, usarGuardada,
    });
  }, [paso, tipoEntrega, modoDireccion, direccion, pisoDepto, indicaciones, cliente, metodoPago, montoEfectivo, horarioDeseado, horaPersonalizada, ubicacion, usarGuardada]);

  useEffect(() => { setAvisando(hayAvisoAperturaGuardado()); }, []);

  useEffect(() => {
    if (horarioDeseado === 'personalizado' && horaInputRef.current) {
      try { horaInputRef.current.focus(); horaInputRef.current.showPicker?.(); } catch {}
    }
  }, [horarioDeseado]);

  useEffect(() => {
    if (!errorPaso) return;
    if (errorPaso.campo === 'nombre' && cliente.nombre.trim()) setErrorPaso(null);
    if (errorPaso.campo === 'direccion' && direccion.trim()) setErrorPaso(null);
    if (errorPaso.campo === 'ubicacion' && (ubicacion || modoDireccion === 'manual')) setErrorPaso(null);
    if (errorPaso.campo === 'pago' && metodoPago) setErrorPaso(null);
    if (errorPaso.campo === 'hora' && horaPersonalizada) setErrorPaso(null);
    if (errorPaso.campo === 'tipo' && tipoEntrega) setErrorPaso(null);
  }, [cliente.nombre, direccion, ubicacion, modoDireccion, metodoPago, horaPersonalizada, tipoEntrega]);

  async function activarAviso() { guardarAvisoApertura(); setAvisando(true); await pedirPermisoNotificaciones(); }
  function desactivarAviso() { cancelarAvisoApertura(); setAvisando(false); }

  const costoDelivery = tipoEntrega === 'delivery' ? Number(config?.delivery_precio || 0) : 0;
  const total         = subtotal + costoDelivery;
  const horaEsValida  = horarioDeseado !== 'personalizado' || horaValidaHoy(horaPersonalizada, horarios, franjas);
  const necesitaReconfirmarEfectivo = metodoPago === 'Efectivo' && totalConfirmadoEfectivo !== null && totalConfirmadoEfectivo !== total;

  // Si cambió el total (agregaron/sacaron productos) después de confirmar el
  // monto en efectivo, pedimos el monto de nuevo — el vuelto ya no es el mismo
  useEffect(() => {
    if (necesitaReconfirmarEfectivo) setMontoEfectivo('');
  }, [necesitaReconfirmarEfectivo]);

  function keyItem(it) { return `${it.tipo}_${it.id}_${it.variante_id || ''}`; }

  async function pedirUbicacion() {
    setLoadingUbic(true); setErrorUbic(null); setUbicacion(null); setModoDireccion('gps');
    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const esAndroid = /android/i.test(navigator.userAgent);
    try {
      const { lat, lng, precision } = await obtenerUbicacion();
      const dist = distanciaKm(lat, lng, config.latitud_local, config.longitud_local);
      if (dist > config.delivery_radio_km) {
        setErrorUbic({ titulo: `Tu ubicación está a ${dist.toFixed(1)} km. Solo llegamos hasta ${config.delivery_radio_km} km.`, puedeReintentar: false });
      } else {
        setUbicacion({ lat, lng, dist: dist.toFixed(1), precision });
      }
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('denegado') || msg.includes('Permiso')) {
        setErrorUbic({ titulo: 'Bloqueaste el permiso de ubicación.', pasos: esIOS ? ['Configuración → Safari → Ubicación → Permitir'] : esAndroid ? ['Candado en el navegador → Ubicación → Permitir'] : ['Candado en la barra → Permitir'], puedeReintentar: false });
      } else if (msg.includes('GPS') || msg.includes('activado')) {
        setErrorUbic({ titulo: 'El GPS está desactivado.', pasos: esIOS ? ['Configuración → Privacidad → Localización'] : esAndroid ? ['Deslizá arriba → Ubicación'] : ['Activá el GPS'], puedeReintentar: true });
      } else {
        setErrorUbic({ titulo: 'No pudimos obtener tu ubicación.', pasos: ['Verificá GPS y permisos'], puedeReintentar: true });
      }
    }
    setLoadingUbic(false);
  }

  function confirmarUbicacionMapa(lat, lng) {
    const dist = distanciaKm(lat, lng, config.latitud_local, config.longitud_local);
    if (dist > config.delivery_radio_km) {
      setErrorUbic({ titulo: `Ese domicilio está a ${dist.toFixed(1)} km. Solo llegamos hasta ${config.delivery_radio_km} km.`, puedeReintentar: false });
    } else {
      setUbicacion({ lat, lng, dist: dist.toFixed(1) });
      setMostrarMapa(false);
      setErrorUbic(null);
    }
  }

  function elegirModoManual() { setModoDireccion('manual'); setUbicacion(null); setErrorUbic(null); setMostrarMapa(false); }

  function usarDireccionGuardada() {
    setCliente({ nombre: prefsGuardadas.nombre || '', telefono: prefsGuardadas.telefono || '' });
    setDireccion(prefsGuardadas.direccion || '');
    setPisoDepto(prefsGuardadas.pisoDepto || '');
    setIndicaciones(prefsGuardadas.indicaciones || '');
    if (prefsGuardadas.latitud && prefsGuardadas.longitud) {
      setUbicacion({ lat: prefsGuardadas.latitud, lng: prefsGuardadas.longitud, dist: prefsGuardadas.dist || '—' });
      setModoDireccion('gps');
    } else {
      setModoDireccion('manual');
    }
    setUsarGuardada(true);
  }

  function usarDireccionNueva() {
    setUsarGuardada(false);
    setDireccion(''); setPisoDepto(''); setUbicacion(null); setModoDireccion(null);
  }

  function manejarMenos(it) {
    if (it.cantidad === 1) setItemRevelado(keyItem(it));
    else quitar(it);
  }
  function eliminarDefinitivo(it) { quitar(it); setItemRevelado(null); }

  function guardarMontoEfectivo() { setMetodoPago('Efectivo'); setEfectivoAbierto(false); setErrorPaso(null); setTotalConfirmadoEfectivo(total); }

  function irA(pasoDestino, comoEdicion) {
    setErrorPaso(null);
    setOrigenEdicion(comoEdicion ? 'resumen' : null);
    setPaso(pasoDestino);
  }

  function continuarDesde(pasoActual) {
    if (origenEdicion === 'resumen') { setOrigenEdicion(null); setPaso('resumen'); return; }
    const idx = PASOS.indexOf(pasoActual);
    setPaso(PASOS[idx + 1]);
  }

  function volverA(pasoActual) {
    setErrorPaso(null);
    if (origenEdicion === 'resumen') { setOrigenEdicion(null); setPaso('resumen'); return; }
    const idx = PASOS.indexOf(pasoActual);
    setPaso(PASOS[Math.max(0, idx - 1)]);
  }

  // ── Validaciones por paso ────────────────────────────────────────────────────
  function validarPago() {
    if (!metodoPago) { setErrorPaso({ campo: 'pago', mensaje: 'Elegí un método de pago para continuar.' }); return false; }
    return true;
  }

  function validarEntrega() {
    if (!tipoEntrega) { setErrorPaso({ campo: 'tipo', mensaje: 'Elegí Retiro por el local o Delivery.' }); return false; }
    if (!cliente.nombre.trim()) { setErrorPaso({ campo: 'nombre', mensaje: 'Falta tu nombre.' }); return false; }
    if (tipoEntrega === 'delivery') {
      if (!direccion.trim()) { setErrorPaso({ campo: 'direccion', mensaje: 'Falta la calle y número.' }); return false; }
      if (modoDireccion !== 'manual' && !ubicacion) { setErrorPaso({ campo: 'ubicacion', mensaje: 'Necesitamos tu ubicación para el delivery.' }); return false; }
    }
    // Estos datos se guardan siempre para la próxima compra
    guardarPreferenciasCliente({
      nombre: cliente.nombre, telefono: cliente.telefono, tipoEntrega,
      direccion, pisoDepto, indicaciones, modoDireccion,
      latitud: ubicacion?.lat || null, longitud: ubicacion?.lng || null, dist: ubicacion?.dist || null,
    });
    return true;
  }

  function validarHorario() {
    if (horarioDeseado === 'personalizado') {
      if (!horaPersonalizada) { setErrorPaso({ campo: 'hora', mensaje: 'Elegí un horario en el reloj.' }); return false; }
      if (!horaEsValida) { setErrorPaso({ campo: 'hora', mensaje: 'Ese horario está fuera de nuestra atención de hoy.' }); return false; }
    }
    return true;
  }

  // ── CONFIRMAR PEDIDO ─────────────────────────────────────────────────────────
  async function confirmarPedido() {
    setGuardandoPedido(true);
    setErrorGuardado('');
    const { supabase } = await import('../../lib/supabaseClient');

    const aclaracionesPago = metodoPago === 'Efectivo' && montoEfectivo ? `Paga con $${montoEfectivo}` : null;

    const payloadPedido = {
      cliente_nombre: cliente.nombre,
      cliente_telefono: cliente.telefono || null,
      cliente_aclaraciones: aclaracionesPago,
      tipo_entrega: tipoEntrega,
      direccion: tipoEntrega === 'delivery' ? direccion : null,
      piso_depto: tipoEntrega === 'delivery' ? pisoDepto : null,
      indicaciones: indicaciones || null,
      latitud: tipoEntrega === 'delivery' ? (ubicacion?.lat || null) : null,
      longitud: tipoEntrega === 'delivery' ? (ubicacion?.lng || null) : null,
      metodo_pago: metodoPago,
      subtotal, costo_delivery: costoDelivery, total,
      estado: 'nuevo',
      horario_deseado: horarioDeseado,
      hora_personalizada: horarioDeseado === 'personalizado' ? horaPersonalizada : null,
    };

    const { data: pedido, error: errorPedido } = await supabase.from('pedidos').insert(payloadPedido).select().single();
    if (errorPedido || !pedido) {
      setErrorGuardado('No pudimos guardar tu pedido. Revisá tu conexión e intentá de nuevo.');
      setGuardandoPedido(false);
      return;
    }

    await supabase.from('pedido_items').insert(
      items.map(it => ({
        pedido_id: pedido.id, producto_id: it.tipo === 'producto' ? it.id : null,
        promocion_id: it.tipo === 'promo' ? it.id : null, variante_id: it.variante_id || null,
        nombre_snapshot: it.nombre_snapshot, precio_unitario: it.precio, cantidad: it.cantidad,
        detalle_seleccion: it.detalle_seleccion || null,
      }))
    );

    const mensaje = generarMensajeWhatsApp({
      items, subtotal, costoDelivery, total, metodoPago, tipoEntrega, cliente,
      direccion, pisoDepto, indicaciones, lat: ubicacion?.lat, lng: ubicacion?.lng,
      horarioDeseado, horaPersonalizada,
    });

    guardarPreferenciasCliente({
      nombre: cliente.nombre, telefono: cliente.telefono, tipoEntrega, direccion, pisoDepto,
      indicaciones, modoDireccion, latitud: ubicacion?.lat || null, longitud: ubicacion?.lng || null, dist: ubicacion?.dist || null,
    });

    ultimoMensajeRef.current = mensaje;
    abrirWhatsApp(config.whatsapp_numero, mensaje);
    limpiarBorradorCheckout();
    setGuardandoPedido(false);
    vaciar();
    setPedidoConfirmado(true);
  }

  function reintentarWhatsapp() {
    if (ultimoMensajeRef.current) abrirWhatsApp(config.whatsapp_numero, ultimoMensajeRef.current);
  }

  const pasoIdx = PASOS.indexOf(paso);

  function TarjetaItem({ it }) {
    const k = keyItem(it);
    // Solo puede estar "revelado" (con la papelera visible) si la cantidad es 1.
    // Si vuelve a 2 o más, se oculta automáticamente sin importar el estado guardado.
    const revelado = itemRevelado === k && it.cantidad === 1;
    const itemElRef = useRef(null);
    const arrastreItem = useRef({ inicioX: 0, activo: false });

    function onDragInicio(e) {
      if (it.cantidad !== 1) return; // solo se puede arrastrar si está por eliminarse
      arrastreItem.current = { inicioX: e.touches ? e.touches[0].clientX : e.clientX, activo: true };
      if (itemElRef.current) itemElRef.current.style.transition = 'none';
    }
    function onDragMover(e) {
      if (!arrastreItem.current.activo || !itemElRef.current) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const delta = x - arrastreItem.current.inicioX;
      // Clamp entre -64 (revelado) y 0 (oculto)
      const base = revelado ? -64 : 0;
      const nuevo = Math.min(0, Math.max(-64, base + delta));
      itemElRef.current.style.transform = `translateX(${nuevo}px)`;
    }
    function onDragFin(e) {
      if (!arrastreItem.current.activo || !itemElRef.current) return;
      arrastreItem.current.activo = false;
      itemElRef.current.style.transition = 'transform 0.2s ease';
      const x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
      const delta = x - arrastreItem.current.inicioX;
      const base = revelado ? -64 : 0;
      const posFinal = Math.min(0, Math.max(-64, base + delta));
      if (posFinal < -32) {
        setItemRevelado(k);
        itemElRef.current.style.transform = 'translateX(-64px)';
      } else {
        setItemRevelado(null);
        itemElRef.current.style.transform = 'translateX(0)';
      }
    }

    return (
      <div className="ch-item-wrap">
        <div
          ref={itemElRef}
          className={`ch-item ${revelado ? 'ch-item-revelado' : ''}`}
          onClick={() => revelado && setItemRevelado(null)}
          onTouchStart={onDragInicio}
          onTouchMove={onDragMover}
          onTouchEnd={onDragFin}
          onPointerDown={onDragInicio}
          onPointerMove={onDragMover}
          onPointerUp={onDragFin}
        >
          <div className="ch-item-img">{it.imagen_url ? <img src={it.imagen_url} alt="" /> : <div className="ch-item-img-ph" />}</div>
          <div className="ch-item-info">
            <span className="ch-item-nombre">{it.nombre_snapshot}</span>
            <span className="ch-item-precio-unit">${it.precio.toLocaleString('es-AR')} c/u</span>
          </div>
          <span className="ch-item-total">${(it.precio * it.cantidad).toLocaleString('es-AR')}</span>
          <div className="ch-item-ctrl" onClick={e => e.stopPropagation()}>
            <button className="ch-ctrl" onClick={() => manejarMenos(it)}>−</button>
            <span className="ch-ctrl-cant">{it.cantidad}</span>
            <button className="ch-ctrl" onClick={() => { agregar(it); setItemRevelado(null); }}>+</button>
          </div>
        </div>
        <button className="ch-item-trash" onClick={() => eliminarDefinitivo(it)} aria-label="Eliminar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="ch-backdrop" onClick={onClose} />
      <div className="ch-drawer" ref={drawerRef}>
        {pedidoConfirmado ? (
          <div className="ch-confirmacion">
            <button className="ch-close ch-close-confirmacion" onClick={onClose}>✕</button>
            <div className="ch-confirmacion-check">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 className="ch-confirmacion-titulo">
              <span className="icono-llama">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-1.5 3-5 5-5 10a5 5 0 0 0 10 0c0-2-1-3-1.5-4 .2 1.5-.7 2.5-1.5 2.5.5-2-.5-4-2-5 .3 1.5-.5 2-1 1.5.5-2 .5-3.5 1-5z"/></svg>
              </span>
              ¡Directo a la cocina!
            </h2>
            <p className="ch-confirmacion-texto">
              {cliente.nombre ? `Gracias, ${cliente.nombre.split(' ')[0]}. ` : 'Gracias. '}
              Ya abrimos WhatsApp con tu pedido armado — solo falta que apretes <strong>Enviar</strong> ahí para confirmarlo.
            </p>
            <button className="ch-confirmacion-reintentar" onClick={reintentarWhatsapp}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
              ¿No se abrió WhatsApp? Reintentar
            </button>
            <button className="ch-btn-primario ch-confirmacion-listo" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <>
        <div className="ch-arrastrable" onTouchStart={onArrastreInicio} onTouchMove={onArrastreMover} onTouchEnd={onArrastreFin} onPointerDown={onArrastreInicio} onPointerMove={onArrastreMover} onPointerUp={onArrastreFin}>
          <div className="ch-handle" />
          <div className="ch-header">
            <div className="ch-header-l">
              {pasoIdx > 0 && <button className="ch-back" onClick={() => volverA(paso)}>←</button>}
              <div className="ch-titulo-wrap">
                {paso === 'carrito' && <span className="ch-eyebrow">COMANDA</span>}
                <h2 className="ch-titulo">{LABELS_PASO[paso] === 'Pedido' ? 'Tu pedido' : LABELS_PASO[paso]}</h2>
              </div>
            </div>
            <button className="ch-close" onClick={onClose}>✕</button>
          </div>
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
            <div><strong>Estamos cerrados ahora</strong><span>{proxApertura ? `Abrimos ${proxApertura}. ` : ''}Podés armar tu pedido y confirmarlo apenas abramos.</span></div>
          </div>
        )}

        {errorPaso && (
          <div className="ch-banner-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{errorPaso.mensaje}</span>
            <button onClick={() => setErrorPaso(null)} aria-label="Cerrar">✕</button>
          </div>
        )}

        <div className="ch-steps">
          {PASOS.map((p, i) => (
            <div key={p} className={`ch-step ${i <= pasoIdx ? 'ch-step-done' : ''}`}>
              <div className="ch-step-dot">{i < pasoIdx ? '✓' : i + 1}</div>
              <span className="ch-step-label">{LABELS_PASO[p]}</span>
            </div>
          ))}
        </div>

        <div className="ch-body">

          {/* ══════ CARRITO ══════ */}
          {paso === 'carrito' && (
            <div className="ch-seccion">
              <div className="ch-envio-info">{ICONO_MOTO}<span>Envío: ${Number(config?.delivery_precio || 0).toLocaleString('es-AR')}</span></div>
              {items.map(it => <TarjetaItem key={keyItem(it)} it={it} />)}
              <div className="ch-resumen">
                <div className="ch-resumen-row"><span>Subtotal</span><span>${subtotal.toLocaleString('es-AR')}</span></div>
              </div>
            </div>
          )}

          {/* ══════ PAGO (SOLO método de pago) ══════ */}
          {paso === 'pago' && (
            <div className="ch-seccion">
              <h3 className="ch-bloque-titulo">¿Cómo querés pagar?</h3>

              <div className={`ch-pago-efectivo ${metodoPago === 'Efectivo' ? 'activo' : ''}`}>
                <button className="ch-pago-efectivo-cabecera" onClick={() => setEfectivoAbierto(v => !v)}>
                  <span className="ch-pago-icono">{ICONO_EFECTIVO}</span>
                  <div className="ch-pago-textos">
                    <strong>Efectivo</strong>
                    <span>{metodoPago === 'Efectivo' && montoEfectivo ? `Pagás con $${montoEfectivo}` : 'Ingresar monto'}</span>
                  </div>
                  <svg className={`ch-chevron ${efectivoAbierto ? 'ch-chevron-abierto' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {efectivoAbierto && (
                  <div className="ch-pago-efectivo-panel">
                    <p className="ch-pago-pregunta">¿Con cuánto vas a pagar?</p>
                    <p className="ch-pago-recordatorio">Recordá que el valor del pedido es de ${total.toLocaleString('es-AR')}</p>
                    <input type="number" min="0" className="ch-monto-input" placeholder="Ej: 5000" value={montoEfectivo} onChange={e => setMontoEfectivo(e.target.value)} />
                    <button className="ch-btn-guardar-monto" onClick={guardarMontoEfectivo}>GUARDAR MONTO</button>
                  </div>
                )}
              </div>

              <div className="ch-pago-otros">
                {metodos.filter(m => m.nombre.toLowerCase() !== 'efectivo').map(m => (
                  <button key={m.id} className={`ch-pago-otro ${metodoPago === m.nombre ? 'activo' : ''}`} onClick={() => { setMetodoPago(m.nombre); setErrorPaso(null); }}>
                    <span className="ch-pago-icono">{iconoMetodo(m.nombre)}</span>
                    <strong>{m.nombre}</strong>
                    {metodoPago === m.nombre && <svg className="ch-pago-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
              </div>

              <p className="ch-pago-seguridad">Por motivos de seguridad, el pago no se realiza desde esta página. El método elegido se usa al momento de recibir o retirar el pedido.</p>
            </div>
          )}

          {/* ══════ ENTREGA ══════ */}
          {paso === 'entrega' && (
            <div className="ch-seccion">
              <div className="ch-opciones-entrega">
                <button className={`ch-opcion-entrega ${tipoEntrega === 'retiro' ? 'activa' : ''}`} onClick={() => { setTipoEntrega('retiro'); }}>
                  <span className="ch-opcion-titulo">Retiro por el local</span>
                  <span className="ch-opcion-sub">Gratis</span>
                </button>
                <button className={`ch-opcion-entrega ${tipoEntrega === 'delivery' ? 'activa' : ''}`} onClick={() => setTipoEntrega('delivery')}>
                  <span className="ch-opcion-titulo">Delivery a domicilio</span>
                  <span className="ch-opcion-sub">+${Number(config?.delivery_precio || 0).toLocaleString('es-AR')}</span>
                </button>
              </div>

              {tipoEntrega === 'retiro' && (
                <label className="ch-campo">
                  <span><span className="req-marca">*</span> Tu nombre</span>
                  <input type="text" value={cliente.nombre} onChange={e => setCliente(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre y apellido" />
                </label>
              )}

              {tipoEntrega === 'delivery' && (
                <>
                  {prefsGuardadas?.direccion && usarGuardada === null && (
                    <div className="ch-confirmar-guardada">
                      <p className="ch-confirmar-titulo">¿Enviamos tu pedido a esta dirección?</p>
                      <p className="ch-confirmar-direccion">{prefsGuardadas.direccion}{prefsGuardadas.pisoDepto ? `, ${prefsGuardadas.pisoDepto}` : ''}</p>
                      <div className="ch-confirmar-btns">
                        <button className="ch-btn-si-guardada" onClick={usarDireccionGuardada}>Sí, enviar acá</button>
                        <button className="ch-btn-no-guardada" onClick={usarDireccionNueva}>Usar otra dirección</button>
                      </div>
                    </div>
                  )}

                  {(usarGuardada === true) && (
                    <div className="ch-ubic-ok-wrap">
                      <div className="ch-ubic-ok">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Entregamos en: {direccion}{pisoDepto ? `, ${pisoDepto}` : ''}
                      </div>
                      <button className="ch-btn-cambiar" onClick={usarDireccionNueva}>Usar otra</button>
                    </div>
                  )}

                  {(usarGuardada === false || (usarGuardada === null && !prefsGuardadas?.direccion)) && (
                    <div className="ch-delivery-bloque">
                      {(ubicacion || modoDireccion === 'manual') && (
                        <div className="ch-ubic-ok-wrap">
                          <div className="ch-ubic-ok">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            {ubicacion ? `Ubicación confirmada · ${ubicacion.dist} km` : 'Dirección manual'}
                          </div>
                          <button className="ch-btn-cambiar" onClick={() => { setUbicacion(null); setModoDireccion(null); }}>Reelegir</button>
                        </div>
                      )}

                      {!ubicacion && modoDireccion !== 'manual' && !mostrarMapa && (
                        <div className="ch-ubic-opciones">
                          <button className="ch-btn-ubic" onClick={pedirUbicacion} disabled={loadingUbic}>
                            {loadingUbic ? <span className="ch-ubic-loading"><span className="ch-ubic-spinner" /> Obteniendo ubicación…</span> : 'Usar mi ubicación automática'}
                          </button>
                          <div className="ch-o">o</div>
                          <button className="ch-btn-mapa" onClick={() => setMostrarMapa(true)}>Ubicar en el mapa</button>
                          <div className="ch-o">o</div>
                          <button className="ch-btn-manual" onClick={elegirModoManual}>Solo escribir mi dirección</button>
                        </div>
                      )}

                      {mostrarMapa && !ubicacion && (
                        <MapSelector lat={config?.latitud_local || -32.889458} lng={config?.longitud_local || -68.845839} radioKm={config?.delivery_radio_km || 5} onConfirmar={confirmarUbicacionMapa} onCancelar={() => setMostrarMapa(false)} />
                      )}

                      {errorUbic && !mostrarMapa && (
                        <div className="ch-error-ubic">
                          <p className="ch-error-titulo">{errorUbic.titulo}</p>
                          <div className="ch-error-btns">
                            {errorUbic.puedeReintentar && <button className="ch-btn-ubic" onClick={pedirUbicacion}>Intentar de nuevo</button>}
                            <button className="ch-btn-manual" onClick={elegirModoManual}>Solo escribir mi dirección</button>
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

                      <label className="ch-campo">
                        <span><span className="req-marca">*</span> Tu nombre</span>
                        <input type="text" value={cliente.nombre} onChange={e => setCliente(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre y apellido" />
                      </label>
                      <label className="ch-campo">
                        <span>Teléfono <span className="opt-marca">(opcional)</span></span>
                        <input type="tel" value={cliente.telefono} onChange={e => setCliente(p => ({ ...p, telefono: e.target.value }))} placeholder="Ej: 261 555-1234" />
                      </label>
                      <label className="ch-campo">
                        <span>Instrucciones de entrega <span className="opt-marca">(opcional)</span></span>
                        <textarea rows={2} value={indicaciones} onChange={e => setIndicaciones(e.target.value)} placeholder="Tocar timbre, no golpear la puerta…" />
                        <span className="ch-hint-persistente">Se guarda para tus próximas compras.</span>
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════ HORARIO ══════ */}
          {paso === 'horario' && (
            <div className="ch-seccion">
              <h3 className="ch-bloque-titulo">¿Para cuándo lo querés?</h3>
              <div className="ch-horario-opciones">
                <button type="button" className={`ch-horario-btn ${horarioDeseado === 'antes_posible' ? 'activo' : ''}`} onClick={() => setHorarioDeseado('antes_posible')}>Lo antes posible</button>
                <button type="button" className={`ch-horario-btn ${horarioDeseado === 'sin_apuro' ? 'activo' : ''}`} onClick={() => setHorarioDeseado('sin_apuro')}>Sin apuro</button>
                <button type="button" className={`ch-horario-btn ${horarioDeseado === 'personalizado' ? 'activo' : ''}`} onClick={() => setHorarioDeseado('personalizado')}>Elegir horario</button>
              </div>
              {horarioDeseado === 'personalizado' && (
                <>
                  <input ref={horaInputRef} type="time" className={`ch-hora-input ${!horaEsValida && horaPersonalizada ? 'ch-hora-invalida' : ''}`} value={horaPersonalizada} onChange={e => setHoraPersonalizada(e.target.value)} />
                  {horaPersonalizada && !horaEsValida && <p className="ch-hora-error">Ese horario está fuera de nuestra atención de hoy.</p>}
                </>
              )}
              <p className="ch-horario-hint">Te confirmamos el horario real por WhatsApp apenas tomamos tu pedido.</p>
            </div>
          )}

          {/* ══════ RESUMEN ══════ */}
          {paso === 'resumen' && (
            <div className="ch-seccion">
              {necesitaReconfirmarEfectivo ? (
                <div className="ch-confirmar-guardada">
                  <p className="ch-confirmar-titulo">El total cambió — ¿con cuánto vas a pagar ahora?</p>
                  <p className="ch-pago-recordatorio">Nuevo total: ${total.toLocaleString('es-AR')}</p>
                  <input type="number" min="0" className="ch-monto-input" placeholder="Ej: 5000" value={montoEfectivo} onChange={e => setMontoEfectivo(e.target.value)} />
                  <button className="ch-btn-guardar-monto" onClick={guardarMontoEfectivo}>GUARDAR MONTO</button>
                </div>
              ) : (
                <div className="ch-resumen-campo">
                  <div><span className="ch-resumen-campo-lbl">Método de pago</span><span className="ch-resumen-campo-val">{metodoPago}{metodoPago === 'Efectivo' && montoEfectivo ? ` · $${montoEfectivo}` : ''}</span></div>
                  <button className="ch-btn-cambiar-chico" onClick={() => irA('pago', true)}>Cambiar</button>
                </div>
              )}

              <div className="ch-resumen-campo">
                <div>
                  <span className="ch-resumen-campo-lbl">Entrega</span>
                  <span className="ch-resumen-campo-val">
                    {tipoEntrega === 'delivery' ? `Delivery · ${direccion}${pisoDepto ? ', ' + pisoDepto : ''}` : 'Retiro por el local'}
                  </span>
                </div>
                <button className="ch-btn-cambiar-chico" onClick={() => irA('entrega', true)}>Cambiar</button>
              </div>

              <div className="ch-resumen-campo">
                <div>
                  <span className="ch-resumen-campo-lbl">Horario</span>
                  <span className="ch-resumen-campo-val">
                    {horarioDeseado === 'personalizado' ? `A las ${horaPersonalizada}` : horarioDeseado === 'sin_apuro' ? 'Sin apuro' : 'Lo antes posible'}
                  </span>
                </div>
                <button className="ch-btn-cambiar-chico" onClick={() => irA('horario', true)}>Cambiar</button>
              </div>

              <div className="ch-productos-resumen">
                <span className="ch-resumen-campo-lbl">Productos</span>
                {items.map(it => <TarjetaItem key={keyItem(it)} it={it} />)}
              </div>

              <div className="ch-resumen">
                <div className="ch-resumen-row"><span>Productos</span><span>${subtotal.toLocaleString('es-AR')}</span></div>
                <div className="ch-resumen-row"><span>Envío</span><span>${costoDelivery.toLocaleString('es-AR')}</span></div>
                <div className="ch-resumen-row ch-resumen-total"><span>TOTAL</span><span>${total.toLocaleString('es-AR')}</span></div>
              </div>

              {abierto !== false && (
                <p className="ch-explicacion-envio">Al tocar <strong>PEDIR</strong>, tu pedido queda anotado en nuestro sistema y se abre WhatsApp con el mensaje ya armado — solo tenés que apretar <strong>Enviar</strong> ahí.</p>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="ch-footer">
          {paso === 'carrito' && (
            <button className="ch-btn-primario" disabled={items.length === 0} onClick={() => setPaso('entrega')}>CONTINUAR</button>
          )}
          {paso === 'pago' && (
            <button className="ch-btn-primario" disabled={!metodoPago} onClick={() => { if (validarPago()) continuarDesde('pago'); }}>Continuar</button>
          )}
          {paso === 'entrega' && (
            <button
              className="ch-btn-primario"
              disabled={!tipoEntrega || !cliente.nombre.trim() || (tipoEntrega === 'delivery' && usarGuardada !== true && (!direccion.trim() || (modoDireccion !== 'manual' && !ubicacion)))}
              onClick={() => { if (validarEntrega()) continuarDesde('entrega'); }}
            >
              Continuar
            </button>
          )}
          {paso === 'horario' && (
            <button className="ch-btn-primario" disabled={horarioDeseado === 'personalizado' && (!horaPersonalizada || !horaEsValida)} onClick={() => { if (validarHorario()) continuarDesde('horario'); }}>
              Continuar
            </button>
          )}
          {paso === 'resumen' && (
            abierto === false ? (
              <div className="ch-bloqueado">
                <p>No podemos enviar tu pedido hasta que abramos{proxApertura ? ` (${proxApertura})` : ''}.</p>
                {avisando ? (
                  <>
                    <div className="ch-avisando"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Te vamos a avisar apenas abramos</div>
                    <button className="ch-btn-cancelar-aviso" onClick={desactivarAviso}>Cancelar aviso</button>
                  </>
                ) : (
                  <button className="ch-btn-avisar" onClick={activarAviso}>Avisarme cuando abran</button>
                )}
              </div>
            ) : (
              <>
                <button className="ch-btn-pedir" onClick={confirmarPedido} disabled={guardandoPedido || necesitaReconfirmarEfectivo}>
                  {guardandoPedido ? <span className="ch-btn-loading"><span className="ch-spinner-blanco" /> Guardando…</span> : 'PEDIR'}
                </button>
                {errorGuardado && <p className="ch-err ch-err-guardado">{errorGuardado}</p>}
              </>
            )
          )}
        </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .ch-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 50; backdrop-filter: blur(2px); }
        .ch-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: #faf7f2; border-top: 1px solid #ede8e0; border-radius: 20px 20px 0 0; z-index: 60; display: flex; flex-direction: column; max-height: 92vh; animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1); }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .ch-arrastrable { flex-shrink: 0; touch-action: none; cursor: grab; }
        .ch-handle { width: 36px; height: 4px; background: #ddd8d0; border-radius: 2px; margin: 12px auto 0; flex-shrink: 0; }
        .ch-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px 10px; }
        .ch-header-l { display: flex; align-items: center; gap: 10px; }
        .ch-titulo-wrap { display: flex; flex-direction: column; gap: 2px; }
        .ch-eyebrow { font-family: 'Courier New', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; color: #b0a898; }
        .ch-back { background: #f0ebe3; border: none; color: #1a1510; border-radius: 50%; width: 32px; height: 32px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ch-titulo { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; color: #1a1510; margin: 0; }
        .ch-close { background: #f0ebe3; border: none; color: #9a8f82; border-radius: 50%; width: 32px; height: 32px; font-size: 14px; cursor: pointer; }

        .ch-banner-error { flex-shrink: 0; margin: 0 20px 10px; display: flex; align-items: flex-start; gap: 10px; background: #fff0ee; border: 1.5px solid #f3b8b0; color: #b5281f; border-radius: 12px; padding: 13px 14px; font-size: 13.5px; font-weight: 600; line-height: 1.4; }
        .ch-banner-error svg { flex-shrink: 0; margin-top: 1px; }
        .ch-banner-error span { flex: 1; }
        .ch-banner-error button { background: none; border: none; color: #b5281f; font-size: 14px; cursor: pointer; padding: 0; flex-shrink: 0; }

        .ch-steps { display: flex; align-items: center; padding: 0 16px 12px; flex-shrink: 0; border-bottom: 1px dashed #ddd8d0; gap: 2px; overflow-x: auto; }
        .ch-step { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .ch-step:not(:last-child)::after { content: ''; width: 14px; height: 1px; background: #ddd8d0; margin: 0 3px; }
        .ch-step-dot { width: 20px; height: 20px; border-radius: 50%; background: #ddd8d0; color: #9a8f82; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ch-step-done .ch-step-dot { background: #F0623E; color: #fff; }
        .ch-step-label { font-size: 10px; color: #9a8f82; white-space: nowrap; }
        .ch-step-done .ch-step-label { color: #1a1510; font-weight: 500; }

        .ch-body { overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
        .ch-seccion { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }
        .ch-bloque-titulo { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 700; color: #1a1510; margin: 0; }

        .ch-envio-info { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #ede8e0; border-radius: 10px; padding: 10px 14px; font-size: 13.5px; font-weight: 600; color: #55504a; width: fit-content; }
        .ch-envio-info svg { color: #F0623E; }

        .ch-item-wrap { position: relative; overflow: hidden; border-radius: 10px; }
        .ch-item { display: flex; align-items: center; gap: 12px; padding: 10px; background: #faf7f2; transition: transform 0.2s; position: relative; z-index: 1; border-bottom: 1px dashed #ddd8d0; touch-action: pan-y; cursor: grab; }
        .ch-item-revelado { transform: translateX(-64px); }
        .ch-item-trash { position: absolute; top: 0; right: 0; bottom: 0; width: 64px; background: #F0623E; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .ch-item-img { width: 46px; height: 46px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #f0ebe3; }
        .ch-item-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ch-item-img-ph { width: 100%; height: 100%; background: #f0ebe3; }
        .ch-item-info { flex: 1; min-width: 0; }
        .ch-item-nombre { font-size: 14px; font-weight: 600; display: block; color: #1a1510; }
        .ch-item-precio-unit { font-size: 12px; color: #9a8f82; display: block; margin-top: 2px; font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
        .ch-item-total { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 700; color: #1a1510; flex-shrink: 0; }
        .ch-item-ctrl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .ch-ctrl { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #F0623E; background: transparent; color: #F0623E; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ch-ctrl-cant { font-size: 14px; font-weight: 700; min-width: 16px; text-align: center; color: #1a1510; }

        .ch-resumen { position: relative; background: #fff; border: 1px solid #ede8e0; border-radius: 12px; padding: 20px 14px 14px; display: flex; flex-direction: column; gap: 8px; }
        .ch-resumen::before {
          content: '';
          position: absolute; top: -1px; left: 12px; right: 12px; height: 3px;
          background-image: radial-gradient(circle, #ddd8d0 1.4px, transparent 1.5px);
          background-size: 9px 3px; background-repeat: repeat-x; background-position: top center;
        }
        .ch-resumen-row { display: flex; justify-content: space-between; font-size: 14px; color: #6b6259; }
        .ch-resumen-row span:last-child { font-family: 'Courier New', monospace; font-variant-numeric: tabular-nums; }
        .ch-resumen-total { font-size: 18px; font-weight: 700; color: #1a1510; padding-top: 8px; border-top: 1px dashed #ddd8d0; margin-top: 4px; }

        .ch-pago-efectivo { background: #fff; border: 2px solid #ede8e0; border-radius: 12px; overflow: hidden; }
        .ch-pago-efectivo.activo { border-color: #F0623E; }
        .ch-pago-efectivo-cabecera { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: transparent; border: none; cursor: pointer; text-align: left; font-family: inherit; }
        .ch-pago-icono { color: #55504a; flex-shrink: 0; }
        .ch-pago-efectivo.activo .ch-pago-icono { color: #F0623E; }
        .ch-pago-textos { flex: 1; display: flex; flex-direction: column; gap: 1px; }
        .ch-pago-textos strong { font-size: 14.5px; color: #1a1510; }
        .ch-pago-textos span { font-size: 12px; color: #9a8f82; }
        .ch-chevron { color: #9a8f82; transition: transform 0.2s; flex-shrink: 0; }
        .ch-chevron-abierto { transform: rotate(180deg); }
        .ch-pago-efectivo-panel { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; }
        .ch-pago-pregunta { font-size: 14px; font-weight: 600; color: #1a1510; margin: 0; }
        .ch-pago-recordatorio { font-size: 12.5px; color: #9a8f82; margin: 0 0 4px; }
        .ch-monto-input { background: #f7f5f2; border: 1.5px solid #ddd8d0; border-radius: 10px; padding: 11px 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; }
        .ch-monto-input:focus { border-color: #F0623E; }
        .ch-btn-guardar-monto { background: #1a1510; color: #faf7f2; border: none; border-radius: 10px; padding: 12px; font-size: 13.5px; font-weight: 700; letter-spacing: 0.02em; font-family: inherit; cursor: pointer; }

        .ch-pago-otros { display: flex; flex-direction: column; gap: 8px; }
        .ch-pago-otro { display: flex; align-items: center; gap: 12px; background: #fff; border: 2px solid #ede8e0; border-radius: 12px; padding: 13px 16px; cursor: pointer; font-family: inherit; text-align: left; }
        .ch-pago-otro.activo { border-color: #F0623E; background: #fff8f5; }
        .ch-pago-otro strong { flex: 1; font-size: 14px; color: #1a1510; font-weight: 600; }
        .ch-pago-check { color: #F0623E; flex-shrink: 0; }
        .ch-pago-seguridad { font-size: 12px; color: #9a8f82; line-height: 1.6; background: #f3efe9; border-radius: 10px; padding: 12px 14px; margin: 0; }

        .ch-confirmar-guardada { background: #fff; border: 2px solid #F0623E; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .ch-confirmar-titulo { font-size: 14px; font-weight: 700; color: #1a1510; margin: 0; }
        .ch-confirmar-direccion { font-size: 13.5px; color: #55504a; margin: 0; }
        .ch-confirmar-btns { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
        .ch-btn-si-guardada { background: #3c8261; color: #fff; border: none; border-radius: 10px; padding: 12px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; }
        .ch-btn-no-guardada { background: transparent; border: 1.5px solid #e4ddd3; color: #6b6259; border-radius: 10px; padding: 11px; font-size: 13px; font-family: inherit; cursor: pointer; }

        .ch-resumen-campo { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #fff; border: 1px solid #ede8e0; border-radius: 10px; padding: 12px 14px; }
        .ch-resumen-campo-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9a8f82; display: block; margin-bottom: 2px; }
        .ch-resumen-campo-val { font-size: 14px; color: #1a1510; font-weight: 500; }
        .ch-btn-cambiar-chico { background: transparent; border: none; color: #F0623E; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; flex-shrink: 0; }
        .ch-productos-resumen { display: flex; flex-direction: column; gap: 6px; }

        .ch-opciones-entrega { display: flex; gap: 8px; }
        .ch-opcion-entrega { flex: 1; display: flex; flex-direction: column; gap: 2px; background: #fff; border: 2px solid #ede8e0; border-radius: 10px; padding: 14px 12px; cursor: pointer; font-family: inherit; text-align: left; }
        .ch-opcion-entrega.activa { border-color: #F0623E; background: #fff8f5; }
        .ch-opcion-titulo { font-size: 13.5px; font-weight: 700; color: #1a1510; }
        .ch-opcion-sub { font-size: 11.5px; color: #9a8f82; }

        .ch-delivery-bloque { display: flex; flex-direction: column; gap: 10px; }
        .ch-ubic-ok-wrap { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f0faf4; border: 1px solid #b8dfc8; border-radius: 10px; padding: 11px 14px; }
        .ch-ubic-ok { font-size: 13px; color: #2a7a4a; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        .ch-btn-cambiar { background: transparent; border: none; color: #9a8f82; font-size: 12px; cursor: pointer; font-family: inherit; text-decoration: underline; flex-shrink: 0; }
        .ch-ubic-opciones { display: flex; flex-direction: column; gap: 8px; }
        .ch-o { text-align: center; font-size: 11px; color: #ccc5bb; }
        .ch-btn-ubic { background: #1a1510; color: #faf7f2; border: none; border-radius: 10px; padding: 12px; font-size: 13.5px; font-weight: 600; font-family: inherit; cursor: pointer; width: 100%; }
        .ch-ubic-loading { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .ch-ubic-spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ch-btn-mapa, .ch-btn-manual { background: #fff; border: 1.5px solid #e4ddd3; color: #1a1510; border-radius: 10px; padding: 12px; font-size: 13.5px; font-weight: 600; font-family: inherit; cursor: pointer; width: 100%; }
        .ch-error-ubic { background: #fff5f3; border: 1px solid #fcd0c8; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .ch-error-titulo { font-size: 12.5px; font-weight: 600; color: #F0623E; margin: 0; }
        .ch-error-btns { display: flex; flex-direction: column; gap: 6px; }

        .ch-campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #6b6259; font-weight: 500; }
        .ch-campo input, .ch-campo textarea { background: #fff; border: 1.5px solid #ddd8d0; border-radius: 10px; padding: 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; transition: border-color 0.15s; resize: none; }
        .ch-campo input:focus, .ch-campo textarea:focus { border-color: #F0623E; }
        .ch-hint-persistente { font-size: 11px; color: #b0a898; }
        .req-marca { color: #F0623E; font-weight: 800; }
        .opt-marca { color: #9a8f82; font-weight: 400; font-size: 12px; }

        .ch-horario-opciones { display: flex; gap: 6px; flex-wrap: wrap; }
        .ch-horario-btn { flex: 1; min-width: 90px; background: #fff; border: 1.5px solid #e4ddd3; color: #55504a; border-radius: 10px; padding: 12px 8px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .ch-horario-btn.activo { border-color: #F0623E; background: #FDEEE7; color: #F0623E; }
        .ch-hora-input { width: 100%; background: #fff; border: 1.5px solid #e4ddd3; border-radius: 10px; padding: 11px 12px; font-size: 15px; color: #22201c; font-family: inherit; outline: none; }
        .ch-hora-invalida { border-color: #F0623E; background: #FDEEE7; }
        .ch-hora-error { font-size: 12px; color: #F0623E; margin: 0; font-weight: 600; }
        .ch-horario-hint { font-size: 11.5px; color: #9a8f82; margin: 0; line-height: 1.4; }

        .ch-explicacion-envio { font-size: 12.5px; color: #6b6259; line-height: 1.6; background: #f3efe9; border-radius: 10px; padding: 12px 14px; margin: 0; }
        .ch-explicacion-envio strong { color: #1a1510; }

        .ch-footer { padding: 12px 20px; padding-bottom: max(12px, env(safe-area-inset-bottom)); border-top: 1px dashed #ddd8d0; flex-shrink: 0; }
        .ch-btn-primario { width: 100%; background: #1a1510; color: #faf7f2; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; font-family: inherit; cursor: pointer; }
        .ch-btn-primario:disabled { background: #ddd8d0; color: #a39c8f; cursor: default; }
        .ch-btn-pedir { width: 100%; background: #25d366; color: #fff; border: none; border-radius: 12px; padding: 17px; font-size: 17px; font-weight: 800; letter-spacing: 0.03em; font-family: inherit; cursor: pointer; }
        .ch-btn-pedir:disabled { background: #ddd8d0; color: #a39c8f; cursor: default; }
        .ch-btn-loading { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .ch-spinner-blanco { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: chspin 0.7s linear infinite; display: inline-block; }
        @keyframes chspin { to { transform: rotate(360deg); } }
        .ch-err-guardado { text-align: center; margin-top: 8px; font-size: 12px; color: #F0623E; }

        .ch-aviso-restaurado { flex-shrink: 0; margin: 12px 20px 0; display: flex; align-items: center; gap: 8px; background: #f3efe9; border: 1px solid #e4ddd3; border-radius: 12px; padding: 10px 14px; color: #6b6259; font-size: 12.5px; }
        .ch-aviso-restaurado svg { flex-shrink: 0; color: #9a8f82; }
        .ch-aviso-restaurado span { flex: 1; }
        .ch-aviso-restaurado button { background: none; border: none; color: #9a8f82; cursor: pointer; font-size: 13px; padding: 2px; }

        .ch-aviso-cerrado { flex-shrink: 0; margin: 12px 20px 0; display: flex; gap: 10px; background: #FDEEE7; border: 1px solid #F5C3AB; border-radius: 12px; padding: 12px 14px; color: #F0623E; }
        .ch-aviso-cerrado svg { flex-shrink: 0; margin-top: 1px; }
        .ch-aviso-cerrado div { display: flex; flex-direction: column; gap: 2px; }
        .ch-aviso-cerrado strong { font-size: 13px; }
        .ch-aviso-cerrado span { font-size: 12px; line-height: 1.5; color: #a8502f; }

        .ch-bloqueado { display: flex; flex-direction: column; gap: 10px; }
        .ch-bloqueado p { font-size: 12px; color: #9a8f82; text-align: center; margin: 0; line-height: 1.4; }
        .ch-btn-avisar { width: 100%; background: #1a1510; color: #faf7f2; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; }
        .ch-avisando { display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(45,122,58,0.08); border: 1px solid rgba(45,122,58,0.25); color: #2d7a3a; border-radius: 12px; padding: 13px; font-size: 14px; font-weight: 600; }
        .ch-btn-cancelar-aviso { background: transparent; border: none; color: #9a8f82; font-size: 12px; text-decoration: underline; cursor: pointer; font-family: inherit; padding: 4px; }

        /* ── CONFIRMACIÓN DE PEDIDO ── */
        .ch-confirmacion { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 44px 28px calc(28px + env(safe-area-inset-bottom)); gap: 6px; }
        .ch-close-confirmacion { position: absolute; top: 16px; right: 16px; }
        .ch-confirmacion-check {
          width: 62px; height: 62px; border-radius: 50%; background: #F0623E; color: #fff;
          display: flex; align-items: center; justify-content: center; margin-bottom: 14px;
          box-shadow: 0 6px 18px rgba(240,98,62,0.35);
          animation: confirmacion-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes confirmacion-pop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
        .ch-confirmacion-titulo { font-family: 'Fraunces', serif; font-size: 21px; font-weight: 700; color: #1a1510; margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .icono-llama { color: #F0623E; display: inline-flex; flex-shrink: 0; animation: llama-titilar 2.4s ease-in-out infinite; }
        @keyframes llama-titilar { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.08) rotate(-3deg); } }
        .ch-confirmacion-texto { font-size: 13.5px; color: #6b6259; line-height: 1.55; margin: 8px 0 4px; max-width: 320px; }
        .ch-confirmacion-texto strong { color: #1a1510; }
        .ch-confirmacion-reintentar {
          display: flex; align-items: center; gap: 7px; background: none; border: none;
          color: #25d366; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit;
          padding: 8px; margin-top: 6px;
        }
        .ch-confirmacion-listo { margin-top: 18px; }
        @media (prefers-reduced-motion: reduce) {
          .ch-confirmacion-check { animation: none; }
          .icono-llama { animation: none; }
        }
      `}</style>
    </>
  );
}