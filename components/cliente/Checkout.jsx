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

// ── Íconos de métodos de pago (genéricos, sin reproducir logos de marca) ────
function iconoMetodo(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('transferencia')) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/></svg>;
  }
  if (n.includes('mercado')) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><circle cx="12" cy="12.5" r="2.3"/></svg>;
  }
  if (n.includes('visa') || n.includes('master') || n.includes('tarjeta') || n.includes('débito') || n.includes('credito') || n.includes('crédito')) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/></svg>;
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/><path d="M21 12h-6a2 2 0 0 0 0 4h6z"/></svg>;
}

const ICONO_EFECTIVO = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 6v0M18 6v0M6 18v0M18 18v0"/></svg>
);

const ICONO_MOTO = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M12 17.5L14 10h4l2 3"/><path d="M7 17.5h6l3-6.5h2"/><path d="M9 10h4l-1-3H8"/></svg>
);

export default function Checkout({ config, metodos, abierto, proxApertura, horarios, franjas, onClose }) {
  const { items, subtotal, quitar, agregar, vaciar } = useCarrito();

  const [paso, setPaso] = useState('carrito'); // 'carrito' | 'checkout'

  // Entrega
  const [tipoEntrega, setTipoEntrega]     = useState('delivery');
  const [editandoEntrega, setEditandoEntrega] = useState(false);
  const [modoDireccion, setModoDireccion] = useState(null); // 'gps' | 'mapa' | 'manual'
  const [editandoDireccion, setEditandoDireccion] = useState(false);
  const [ubicacion, setUbicacion]         = useState(null);
  const [errorUbic, setErrorUbic]         = useState(null);
  const [loadingUbic, setLoadingUbic]     = useState(false);
  const [mostrarMapa, setMostrarMapa]     = useState(false);
  const [direccion, setDireccion]         = useState('');
  const [pisoDepto, setPisoDepto]         = useState('');
  const [indicaciones, setIndicaciones]   = useState('');

  // Datos personales
  const [cliente, setCliente] = useState({ nombre: '', telefono: '' });

  // Horario deseado
  const [horarioDeseado, setHorarioDeseado] = useState('antes_posible');
  const [horaPersonalizada, setHoraPersonalizada] = useState('');
  const horaInputRef = useRef(null);

  // Pago
  const [metodoPago, setMetodoPago]     = useState('');
  const [efectivoAbierto, setEfectivoAbierto] = useState(false);
  const [montoEfectivo, setMontoEfectivo] = useState('');

  // Aviso "avisarme cuando abran"
  const [avisando, setAvisando] = useState(false);

  // Ítem revelado para eliminar (desliza y muestra papelera)
  const [itemRevelado, setItemRevelado] = useState(null);

  // Envío / guardado
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [errorGuardado, setErrorGuardado]     = useState('');
  const [errorPaso, setErrorPaso]             = useState(null);

  const hidratado = useRef(false);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);

  // ── Bloquear scroll del fondo ────────────────────────────────────────────────
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // ── Cargar borrador en progreso, o si no hay, precargar preferencias guardadas ──
  useEffect(() => {
    const borrador = cargarBorradorCheckout();
    if (borrador) {
      const tieneProgreso = borrador.paso === 'checkout' || borrador.cliente?.nombre || borrador.direccion || borrador.metodoPago;
      if (tieneProgreso) setBorradorRestaurado(true);
      if (borrador.paso) setPaso(borrador.paso);
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
    } else {
      const prefs = cargarPreferenciasCliente();
      if (prefs) {
        if (prefs.nombre) setCliente({ nombre: prefs.nombre, telefono: prefs.telefono || '' });
        if (prefs.tipoEntrega) setTipoEntrega(prefs.tipoEntrega);
        if (prefs.direccion) setDireccion(prefs.direccion);
        if (prefs.pisoDepto) setPisoDepto(prefs.pisoDepto);
        if (prefs.indicaciones) setIndicaciones(prefs.indicaciones);
        if (prefs.latitud && prefs.longitud) {
          setUbicacion({ lat: prefs.latitud, lng: prefs.longitud, dist: prefs.dist || '—' });
          setModoDireccion(prefs.modoDireccion || 'gps');
        } else if (prefs.direccion) {
          setModoDireccion('manual');
        }
      }
    }
    hidratado.current = true;
  }, []);

  useEffect(() => {
    if (!hidratado.current) return;
    guardarBorradorCheckout({
      paso, tipoEntrega, modoDireccion, direccion, pisoDepto, indicaciones,
      cliente, metodoPago, montoEfectivo, horarioDeseado, horaPersonalizada, ubicacion,
    });
  }, [paso, tipoEntrega, modoDireccion, direccion, pisoDepto, indicaciones, cliente, metodoPago, montoEfectivo, horarioDeseado, horaPersonalizada, ubicacion]);

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

  const costoDelivery = tipoEntrega === 'delivery' ? Number(config?.delivery_precio || 0) : 0;
  const total         = subtotal + costoDelivery;
  const horaEsValida  = horarioDeseado !== 'personalizado' || horaValidaHoy(horaPersonalizada, horarios, franjas);

  function keyItem(it) { return `${it.tipo}_${it.id}_${it.variante_id || ''}`; }

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
      if (msg.includes('denegado') || msg.includes('Permiso')) {
        setErrorUbic({ titulo: 'Bloqueaste el permiso de ubicación.', pasos: esIOS ? ['Configuración → Safari → Ubicación → Permitir'] : esAndroid ? ['Tocá el candado en la barra del navegador', 'Ubicación → Permitir'] : ['Click en el candado de la barra de direcciones → Permitir'], puedeReintentar: false });
      } else if (msg.includes('GPS') || msg.includes('activado')) {
        setErrorUbic({ titulo: 'El GPS está desactivado.', pasos: esIOS ? ['Configuración → Privacidad → Localización → Activar'] : esAndroid ? ['Deslizá desde arriba', 'Tocá el ícono de Ubicación'] : ['Activá el GPS del dispositivo'], puedeReintentar: true });
      } else {
        setErrorUbic({ titulo: 'No pudimos obtener tu ubicación.', pasos: ['Verificá el GPS y los permisos'], puedeReintentar: true });
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

  function elegirModoManual() {
    setModoDireccion('manual');
    setUbicacion(null);
    setErrorUbic(null);
    setMostrarMapa(false);
  }

  // ── CARRITO: revelar / eliminar ──────────────────────────────────────────────
  function manejarMenos(it) {
    if (it.cantidad === 1) {
      setItemRevelado(keyItem(it)); // no elimina directo: desliza y pide confirmar
    } else {
      quitar(it);
    }
  }

  function eliminarDefinitivo(it) {
    quitar(it);
    setItemRevelado(null);
  }

  // ── GUARDAR MONTO EFECTIVO ────────────────────────────────────────────────────
  function guardarMontoEfectivo() {
    setMetodoPago('Efectivo');
    setEfectivoAbierto(false);
    setErrorPaso(null);
  }

  // ── VALIDACIÓN FINAL ANTES DE "PEDIR" ─────────────────────────────────────────
  function validarTodo() {
    if (!cliente.nombre.trim()) { setErrorPaso({ campo: 'nombre', mensaje: 'Falta tu nombre.' }); return false; }
    if (tipoEntrega === 'delivery') {
      if (!direccion.trim()) { setErrorPaso({ campo: 'direccion', mensaje: 'Falta la calle y número de tu domicilio.' }); return false; }
      if (modoDireccion !== 'manual' && !ubicacion) { setErrorPaso({ campo: 'ubicacion', mensaje: 'Necesitamos tu ubicación para el delivery.' }); return false; }
    }
    if (horarioDeseado === 'personalizado') {
      if (!horaPersonalizada) { setErrorPaso({ campo: 'hora', mensaje: 'Elegí un horario en el reloj.' }); return false; }
      if (!horaEsValida) { setErrorPaso({ campo: 'hora', mensaje: 'Ese horario está fuera de nuestra atención de hoy.' }); return false; }
    }
    if (!metodoPago) { setErrorPaso({ campo: 'pago', mensaje: 'Elegí un método de pago.' }); return false; }
    setErrorPaso(null);
    return true;
  }

  // ── CONFIRMAR PEDIDO ─────────────────────────────────────────────────────────
  async function confirmarPedido() {
    if (!validarTodo()) return;

    setGuardandoPedido(true);
    setErrorGuardado('');

    const { supabase } = await import('../../lib/supabaseClient');

    const aclaracionesPago = metodoPago === 'Efectivo' && montoEfectivo
      ? `Paga con $${montoEfectivo}`
      : null;

    const payloadPedido = {
      cliente_nombre:       cliente.nombre,
      cliente_telefono:     cliente.telefono || null,
      cliente_aclaraciones: aclaracionesPago,
      tipo_entrega:         tipoEntrega,
      direccion:            tipoEntrega === 'delivery' ? direccion : null,
      piso_depto:           tipoEntrega === 'delivery' ? pisoDepto : null,
      indicaciones:         indicaciones || null,
      latitud:              tipoEntrega === 'delivery' ? (ubicacion?.lat || null) : null,
      longitud:             tipoEntrega === 'delivery' ? (ubicacion?.lng || null) : null,
      metodo_pago:          metodoPago,
      subtotal,
      costo_delivery:       costoDelivery,
      total,
      estado:               'nuevo',
      horario_deseado:      horarioDeseado,
      hora_personalizada:   horarioDeseado === 'personalizado' ? horaPersonalizada : null,
    };

    const { data: pedido, error: errorPedido } = await supabase.from('pedidos').insert(payloadPedido).select().single();

    if (errorPedido || !pedido) {
      console.error('Error guardando el pedido:', errorPedido);
      setErrorGuardado('No pudimos guardar tu pedido. Revisá tu conexión e intentá de nuevo.');
      setGuardandoPedido(false);
      return;
    }

    await supabase.from('pedido_items').insert(
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

    const mensaje = generarMensajeWhatsApp({
      items, subtotal, costoDelivery, total, metodoPago, tipoEntrega, cliente,
      direccion, pisoDepto, indicaciones, lat: ubicacion?.lat, lng: ubicacion?.lng,
      horarioDeseado, horaPersonalizada,
    });

    // Guardar preferencias para la próxima compra (nombre, dirección, indicaciones...)
    guardarPreferenciasCliente({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      tipoEntrega,
      direccion,
      pisoDepto,
      indicaciones,
      modoDireccion,
      latitud: ubicacion?.lat || null,
      longitud: ubicacion?.lng || null,
      dist: ubicacion?.dist || null,
    });

    abrirWhatsApp(config.whatsapp_numero, mensaje);
    limpiarBorradorCheckout();
    setGuardandoPedido(false);
    vaciar();
    onClose();
  }

  return (
    <>
      <div className="ch-backdrop" onClick={onClose} />
      <div className="ch-drawer">
        <div className="ch-handle" />

        {/* ── HEADER ── */}
        <div className="ch-header">
          <div className="ch-header-l">
            {paso === 'checkout' && (
              <button className="ch-back" onClick={() => { setErrorPaso(null); setPaso('carrito'); }}>←</button>
            )}
            <h2 className="ch-titulo">{paso === 'carrito' ? 'Tu pedido' : 'Finalizar pedido'}</h2>
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

        {errorPaso && (
          <div className="ch-banner-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{errorPaso.mensaje}</span>
            <button onClick={() => setErrorPaso(null)} aria-label="Cerrar aviso">✕</button>
          </div>
        )}

        <div className="ch-body">

          {/* ══════════════ PANTALLA 1: CARRITO ══════════════ */}
          {paso === 'carrito' && (
            <div className="ch-seccion">
              <div className="ch-envio-info">
                {ICONO_MOTO}
                <span>Envío: ${Number(config?.delivery_precio || 0).toLocaleString('es-AR')}</span>
              </div>

              {items.map((it) => {
                const k = keyItem(it);
                const revelado = itemRevelado === k;
                return (
                  <div key={k} className="ch-item-wrap">
                    <div className={`ch-item ${revelado ? 'ch-item-revelado' : ''}`} onClick={() => revelado && setItemRevelado(null)}>
                      <div className="ch-item-img">
                        {it.imagen_url ? <img src={it.imagen_url} alt="" /> : <div className="ch-item-img-ph" />}
                      </div>
                      <div className="ch-item-info">
                        <span className="ch-item-nombre">{it.nombre_snapshot}</span>
                        <span className="ch-item-precio-unit">${it.precio.toLocaleString('es-AR')} c/u</span>
                      </div>
                      <div className="ch-item-ctrl" onClick={e => e.stopPropagation()}>
                        <button className="ch-ctrl" onClick={() => manejarMenos(it)}>−</button>
                        <span className="ch-ctrl-cant">{it.cantidad}</span>
                        <button className="ch-ctrl" onClick={() => agregar(it)}>+</button>
                      </div>
                    </div>
                    <button className="ch-item-trash" onClick={() => eliminarDefinitivo(it)} aria-label="Eliminar producto">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                  </div>
                );
              })}

              <div className="ch-resumen">
                <div className="ch-resumen-row"><span>Subtotal</span><span>${subtotal.toLocaleString('es-AR')}</span></div>
                <div className="ch-resumen-row"><span>Envío</span><span>${costoDelivery.toLocaleString('es-AR')}</span></div>
                <div className="ch-resumen-row ch-resumen-total"><span>Total</span><span>${total.toLocaleString('es-AR')}</span></div>
              </div>
            </div>
          )}

          {/* ══════════════ PANTALLA 2: MÉTODO DE PAGO + ENTREGA + RESUMEN ══════════════ */}
          {paso === 'checkout' && (
            <div className="ch-seccion">

              {/* ¿Cómo querés pagar? */}
              <div className="ch-bloque">
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
                      <input
                        type="number"
                        min="0"
                        className="ch-monto-input"
                        placeholder="Ej: 5000"
                        value={montoEfectivo}
                        onChange={e => setMontoEfectivo(e.target.value)}
                      />
                      <button className="ch-btn-guardar-monto" onClick={guardarMontoEfectivo}>GUARDAR MONTO</button>
                    </div>
                  )}
                </div>

                <div className="ch-pago-otros">
                  {metodos.filter(m => m.nombre.toLowerCase() !== 'efectivo').map(m => (
                    <button
                      key={m.id}
                      className={`ch-pago-otro ${metodoPago === m.nombre ? 'activo' : ''}`}
                      onClick={() => { setMetodoPago(m.nombre); setErrorPaso(null); }}
                    >
                      <span className="ch-pago-icono">{iconoMetodo(m.nombre)}</span>
                      <strong>{m.nombre}</strong>
                      {metodoPago === m.nombre && (
                        <svg className="ch-pago-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                  ))}
                </div>

                <p className="ch-pago-seguridad">
                  Por motivos de seguridad, el pago no se realiza desde esta página. El método elegido se usa al momento de recibir o retirar el pedido.
                </p>
              </div>

              {/* Datos de entrega */}
              <div className="ch-bloque">
                <h3 className="ch-bloque-titulo">Datos de entrega</h3>

                {/* Tipo de entrega */}
                {!editandoEntrega ? (
                  <div className="ch-resumen-campo">
                    <div>
                      <span className="ch-resumen-campo-lbl">Tipo de entrega</span>
                      <span className="ch-resumen-campo-val">{tipoEntrega === 'delivery' ? 'Delivery a domicilio' : 'Retiro por el local'}</span>
                    </div>
                    <button className="ch-btn-cambiar-chico" onClick={() => setEditandoEntrega(true)}>Cambiar</button>
                  </div>
                ) : (
                  <div className="ch-opciones-entrega">
                    <button
                      className={`ch-opcion-entrega ${tipoEntrega === 'retiro' ? 'activa' : ''}`}
                      onClick={() => { setTipoEntrega('retiro'); setEditandoEntrega(false); }}
                    >
                      <span className="ch-opcion-titulo">Retiro por el local</span>
                      <span className="ch-opcion-sub">Gratis</span>
                    </button>
                    <button
                      className={`ch-opcion-entrega ${tipoEntrega === 'delivery' ? 'activa' : ''}`}
                      onClick={() => { setTipoEntrega('delivery'); setEditandoEntrega(false); }}
                    >
                      <span className="ch-opcion-titulo">Delivery a domicilio</span>
                      <span className="ch-opcion-sub">+${Number(config?.delivery_precio || 0).toLocaleString('es-AR')}</span>
                    </button>
                  </div>
                )}

                {/* Dirección (solo delivery) */}
                {tipoEntrega === 'delivery' && !editandoDireccion && (
                  <div className="ch-resumen-campo">
                    <div>
                      <span className="ch-resumen-campo-lbl">Dirección</span>
                      <span className="ch-resumen-campo-val">
                        {direccion ? `${direccion}${pisoDepto ? ', ' + pisoDepto : ''}` : 'Sin definir'}
                      </span>
                    </div>
                    <button className="ch-btn-cambiar-chico" onClick={() => setEditandoDireccion(true)}>Cambiar</button>
                  </div>
                )}

                {tipoEntrega === 'delivery' && editandoDireccion && (
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
                      <MapSelector
                        lat={config?.latitud_local || -32.889458}
                        lng={config?.longitud_local || -68.845839}
                        radioKm={config?.delivery_radio_km || 5}
                        onConfirmar={confirmarUbicacionMapa}
                        onCancelar={() => setMostrarMapa(false)}
                      />
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
                        <button className="ch-btn-listo-direccion" onClick={() => setEditandoDireccion(false)}>Listo</button>
                      </>
                    )}
                  </div>
                )}

                {/* Nombre / Teléfono */}
                <label className="ch-campo">
                  <span><span className="req-marca">*</span> Tu nombre</span>
                  <input type="text" value={cliente.nombre} onChange={e => setCliente(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre y apellido" />
                </label>
                <label className="ch-campo">
                  <span>Teléfono <span className="opt-marca">(opcional)</span></span>
                  <input type="tel" value={cliente.telefono} onChange={e => setCliente(p => ({ ...p, telefono: e.target.value }))} placeholder="Ej: 261 555-1234" />
                </label>

                {/* Instrucciones de entrega (persisten para la próxima) */}
                <label className="ch-campo">
                  <span>Instrucciones de entrega <span className="opt-marca">(opcional)</span></span>
                  <textarea rows={2} value={indicaciones} onChange={e => setIndicaciones(e.target.value)} placeholder="Tocar timbre, no golpear la puerta, entregar en portería…" />
                  <span className="ch-hint-persistente">Se guarda para tus próximas compras.</span>
                </label>

                {/* Horario deseado */}
                <div className="ch-campo">
                  <span>¿Para cuándo lo querés? <span className="opt-marca">(opcional)</span></span>
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
                </div>
              </div>

              {/* Resumen del pedido */}
              <div className="ch-bloque">
                <h3 className="ch-bloque-titulo">Resumen del pedido</h3>
                <div className="ch-resumen">
                  <div className="ch-resumen-row"><span>Productos</span><span>${subtotal.toLocaleString('es-AR')}</span></div>
                  <div className="ch-resumen-row"><span>Envío</span><span>${costoDelivery.toLocaleString('es-AR')}</span></div>
                  <div className="ch-resumen-row ch-resumen-total"><span>TOTAL</span><span>${total.toLocaleString('es-AR')}</span></div>
                </div>
              </div>

              {abierto !== false && (
                <p className="ch-explicacion-envio">
                  Al tocar <strong>PEDIR</strong>, tu pedido queda anotado en nuestro sistema y se abre WhatsApp con el mensaje ya armado — solo tenés que apretar <strong>Enviar</strong> ahí.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="ch-footer">
          {paso === 'carrito' && (
            <button className="ch-btn-primario" disabled={items.length === 0} onClick={() => setPaso('checkout')}>
              ELEGIR MÉTODO DE PAGO
            </button>
          )}

          {paso === 'checkout' && (
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
                  <button className="ch-btn-avisar" onClick={activarAviso}>Avisarme cuando abran</button>
                )}
              </div>
            ) : (
              <>
                <button className="ch-btn-pedir" onClick={confirmarPedido} disabled={guardandoPedido}>
                  {guardandoPedido ? <span className="ch-btn-loading"><span className="ch-spinner-blanco" /> Guardando…</span> : 'PEDIR'}
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

        .ch-banner-error { flex-shrink: 0; margin: 0 20px 10px; display: flex; align-items: flex-start; gap: 10px; background: #fff0ee; border: 1.5px solid #f3b8b0; color: #b5281f; border-radius: 12px; padding: 13px 14px; font-size: 13.5px; font-weight: 600; line-height: 1.4; }
        .ch-banner-error svg { flex-shrink: 0; margin-top: 1px; }
        .ch-banner-error span { flex: 1; }
        .ch-banner-error button { background: none; border: none; color: #b5281f; font-size: 14px; cursor: pointer; padding: 0; flex-shrink: 0; }

        .ch-body { overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
        .ch-seccion { display: flex; flex-direction: column; gap: 18px; padding: 16px 20px; }

        .ch-envio-info { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #ede8e0; border-radius: 10px; padding: 10px 14px; font-size: 13.5px; font-weight: 600; color: #55504a; width: fit-content; }
        .ch-envio-info svg { color: #e23e45; }

        /* Ítems del carrito con swipe-to-delete */
        .ch-item-wrap { position: relative; overflow: hidden; border-radius: 10px; }
        .ch-item { display: flex; align-items: center; gap: 12px; padding: 10px; background: #faf7f2; transition: transform 0.2s; position: relative; z-index: 1; border-bottom: 1px solid #ede8e0; }
        .ch-item-revelado { transform: translateX(-64px); }
        .ch-item-trash { position: absolute; top: 0; right: 0; bottom: 0; width: 64px; background: #e23e45; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .ch-item-img { width: 46px; height: 46px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: #f0ebe3; }
        .ch-item-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ch-item-img-ph { width: 100%; height: 100%; background: #f0ebe3; }
        .ch-item-info { flex: 1; min-width: 0; }
        .ch-item-nombre { font-size: 14px; font-weight: 600; display: block; color: #1a1510; }
        .ch-item-precio-unit { font-size: 12px; color: #9a8f82; display: block; margin-top: 2px; }
        .ch-item-ctrl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .ch-ctrl { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #e23e45; background: transparent; color: #e23e45; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ch-ctrl-cant { font-size: 14px; font-weight: 700; min-width: 16px; text-align: center; color: #1a1510; }

        .ch-resumen { background: #fff; border: 1px solid #ede8e0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .ch-resumen-row { display: flex; justify-content: space-between; font-size: 14px; color: #6b6259; }
        .ch-resumen-total { font-size: 18px; font-weight: 700; color: #1a1510; padding-top: 8px; border-top: 1px solid #ede8e0; margin-top: 4px; }

        /* Bloques de la pantalla de checkout */
        .ch-bloque { display: flex; flex-direction: column; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #ede8e0; }
        .ch-bloque:last-of-type { border-bottom: none; }
        .ch-bloque-titulo { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 700; color: #1a1510; margin: 0; }

        /* Método de pago: Efectivo */
        .ch-pago-efectivo { background: #fff; border: 2px solid #ede8e0; border-radius: 12px; overflow: hidden; }
        .ch-pago-efectivo.activo { border-color: #e23e45; }
        .ch-pago-efectivo-cabecera { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: transparent; border: none; cursor: pointer; text-align: left; font-family: inherit; }
        .ch-pago-icono { color: #55504a; flex-shrink: 0; }
        .ch-pago-efectivo.activo .ch-pago-icono { color: #e23e45; }
        .ch-pago-textos { flex: 1; display: flex; flex-direction: column; gap: 1px; }
        .ch-pago-textos strong { font-size: 14.5px; color: #1a1510; }
        .ch-pago-textos span { font-size: 12px; color: #9a8f82; }
        .ch-chevron { color: #9a8f82; transition: transform 0.2s; flex-shrink: 0; }
        .ch-chevron-abierto { transform: rotate(180deg); }
        .ch-pago-efectivo-panel { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; }
        .ch-pago-pregunta { font-size: 14px; font-weight: 600; color: #1a1510; margin: 0; }
        .ch-pago-recordatorio { font-size: 12.5px; color: #9a8f82; margin: 0 0 4px; }
        .ch-monto-input { background: #f7f5f2; border: 1.5px solid #ddd8d0; border-radius: 10px; padding: 11px 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; }
        .ch-monto-input:focus { border-color: #e23e45; }
        .ch-btn-guardar-monto { background: #1a1510; color: #faf7f2; border: none; border-radius: 10px; padding: 12px; font-size: 13.5px; font-weight: 700; letter-spacing: 0.02em; font-family: inherit; cursor: pointer; }

        .ch-pago-otros { display: flex; flex-direction: column; gap: 8px; }
        .ch-pago-otro { display: flex; align-items: center; gap: 12px; background: #fff; border: 2px solid #ede8e0; border-radius: 12px; padding: 13px 16px; cursor: pointer; font-family: inherit; text-align: left; transition: border-color 0.15s; }
        .ch-pago-otro.activo { border-color: #e23e45; background: #fff8f5; }
        .ch-pago-otro strong { flex: 1; font-size: 14px; color: #1a1510; font-weight: 600; }
        .ch-pago-check { color: #e23e45; flex-shrink: 0; }
        .ch-pago-seguridad { font-size: 12px; color: #9a8f82; line-height: 1.6; background: #f3efe9; border-radius: 10px; padding: 12px 14px; margin: 0; }

        /* Datos de entrega */
        .ch-resumen-campo { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #fff; border: 1px solid #ede8e0; border-radius: 10px; padding: 12px 14px; }
        .ch-resumen-campo-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9a8f82; display: block; margin-bottom: 2px; }
        .ch-resumen-campo-val { font-size: 14px; color: #1a1510; font-weight: 500; }
        .ch-btn-cambiar-chico { background: transparent; border: none; color: #e23e45; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; flex-shrink: 0; }

        .ch-opciones-entrega { display: flex; gap: 8px; }
        .ch-opcion-entrega { flex: 1; display: flex; flex-direction: column; gap: 2px; background: #fff; border: 2px solid #ede8e0; border-radius: 10px; padding: 12px; cursor: pointer; font-family: inherit; text-align: left; }
        .ch-opcion-entrega.activa { border-color: #e23e45; background: #fff8f5; }
        .ch-opcion-titulo { font-size: 13px; font-weight: 700; color: #1a1510; }
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
        .ch-error-titulo { font-size: 12.5px; font-weight: 600; color: #e23e45; margin: 0; }
        .ch-error-btns { display: flex; flex-direction: column; gap: 6px; }
        .ch-btn-listo-direccion { background: #3c8261; color: #fff; border: none; border-radius: 10px; padding: 11px; font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer; }

        .ch-campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #6b6259; font-weight: 500; }
        .ch-campo input, .ch-campo textarea { background: #fff; border: 1.5px solid #ddd8d0; border-radius: 10px; padding: 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; transition: border-color 0.15s; resize: none; }
        .ch-campo input:focus, .ch-campo textarea:focus { border-color: #e23e45; }
        .ch-hint-persistente { font-size: 11px; color: #b0a898; }
        .req-marca { color: #e23e45; font-weight: 800; }
        .opt-marca { color: #9a8f82; font-weight: 400; font-size: 12px; }

        .ch-horario-opciones { display: flex; gap: 6px; flex-wrap: wrap; }
        .ch-horario-btn { flex: 1; min-width: 90px; background: #fff; border: 1.5px solid #e4ddd3; color: #55504a; border-radius: 10px; padding: 10px 8px; font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .ch-horario-btn.activo { border-color: #e23e45; background: #fff5f3; color: #e23e45; }
        .ch-hora-input { margin-top: 8px; width: 100%; background: #fff; border: 1.5px solid #e4ddd3; border-radius: 10px; padding: 11px 12px; font-size: 15px; color: #22201c; font-family: inherit; outline: none; }
        .ch-hora-invalida { border-color: #e23e45; background: #fff5f3; }
        .ch-hora-error { font-size: 12px; color: #e23e45; margin: 6px 0 0; font-weight: 600; }

        .ch-explicacion-envio { font-size: 12.5px; color: #6b6259; line-height: 1.6; background: #f3efe9; border-radius: 10px; padding: 12px 14px; margin: 0; }
        .ch-explicacion-envio strong { color: #1a1510; }

        .ch-footer { padding: 12px 20px; padding-bottom: max(12px, env(safe-area-inset-bottom)); border-top: 1px solid #ede8e0; flex-shrink: 0; }
        .ch-btn-primario { width: 100%; background: #1a1510; color: #faf7f2; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; font-family: inherit; cursor: pointer; }
        .ch-btn-primario:disabled { background: #ddd8d0; color: #a39c8f; cursor: default; }
        .ch-btn-pedir { width: 100%; background: #25d366; color: #fff; border: none; border-radius: 12px; padding: 17px; font-size: 17px; font-weight: 800; letter-spacing: 0.03em; font-family: inherit; cursor: pointer; }
        .ch-btn-pedir:hover:not(:disabled) { filter: brightness(1.06); }
        .ch-btn-pedir:disabled { background: #ddd8d0; color: #a39c8f; cursor: default; }
        .ch-btn-loading { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .ch-spinner-blanco { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: chspin 0.7s linear infinite; display: inline-block; }
        @keyframes chspin { to { transform: rotate(360deg); } }
        .ch-err-guardado { text-align: center; margin-top: 8px; font-size: 12px; color: #e23e45; }

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
        .ch-btn-avisar { width: 100%; background: #1a1510; color: #faf7f2; border: none; border-radius: 12px; padding: 15px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; }
        .ch-avisando { display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(45,122,58,0.08); border: 1px solid rgba(45,122,58,0.25); color: #2d7a3a; border-radius: 12px; padding: 13px; font-size: 14px; font-weight: 600; }
        .ch-btn-cancelar-aviso { background: transparent; border: none; color: #9a8f82; font-size: 12px; text-decoration: underline; cursor: pointer; font-family: inherit; padding: 4px; }
      `}</style>
    </>
  );
}