'use client';

import { useState } from 'react';
import { useCarrito } from '../../contexts/CarritoContext';
import { obtenerUbicacion, distanciaKm, generarMensajeWhatsApp, abrirWhatsApp } from '../../lib/clienteUtils';

const PASOS = ['carrito', 'entrega', 'datos', 'pago'];

export default function Checkout({ config, metodos, onClose }) {
  const { items, subtotal, quitar, agregar, vaciar } = useCarrito();
  const [paso, setPaso]             = useState('carrito');
  const [tipoEntrega, setTipoEntrega] = useState(null);
  const [ubicacion, setUbicacion]   = useState(null);
  const [errorUbic, setErrorUbic]   = useState('');
  const [loadingUbic, setLoadingUbic] = useState(false);
  const [direccion, setDireccion]   = useState('');
  const [pisoDepto, setPisoDepto]   = useState('');
  const [indicaciones, setIndicaciones] = useState('');
  const [cliente, setCliente]       = useState({ nombre: '', telefono: '', aclaraciones: '' });
  const [metodoPago, setMetodoPago] = useState('');
  const [errores, setErrores]       = useState({});

  const costoDelivery = tipoEntrega === 'delivery' ? (config?.delivery_precio || 0) : 0;
  const total         = subtotal + Number(costoDelivery);

  // ── GEOLOCALIZACIÓN ──────────────────────────────────────────────────────────
  async function pedirUbicacion() {
    setLoadingUbic(true);
    setErrorUbic(null);
    setUbicacion(null);

    // Detectar si es Android o iOS para dar instrucciones específicas
    const esIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const esAndroid = /android/i.test(navigator.userAgent);

    try {
      const { lat, lng, precision } = await obtenerUbicacion();
      const dist = distanciaKm(lat, lng, config.latitud_local, config.longitud_local);

      if (dist > config.delivery_radio_km) {
        setErrorUbic({
          titulo: `Tu ubicación está a ${dist.toFixed(1)} km. Solo hacemos delivery hasta ${config.delivery_radio_km} km del local.`,
          puedeReintentar: false,
        });
        setUbicacion(null);
      } else {
        setUbicacion({ lat, lng, dist: dist.toFixed(1), precision });
      }
    } catch (e) {
      const msg = e.message || '';

      if (msg.includes('denegado') || msg.includes('PERMISSION_DENIED')) {
        // El usuario negó el permiso
        setErrorUbic({
          titulo: 'Bloqueaste el permiso de ubicación para esta página.',
          pasos: esIOS
            ? ['Abrí Configuración', 'Entrá a Safari (o tu navegador)', 'Ubicación → Permitir']
            : esAndroid
            ? ['Tocá el candado o ícono de info en la barra del navegador', 'Buscá "Ubicación" y cambialo a "Permitir"', 'Recargá la página e intentá de nuevo']
            : ['Hacé click en el ícono de candado en la barra de dirección', 'Cambiá el permiso de Ubicación a "Permitir"', 'Recargá la página e intentá de nuevo'],
          puedeReintentar: false,
        });
      } else if (msg.includes('GPS') || msg.includes('activado') || msg.includes('POSITION_UNAVAILABLE')) {
        // GPS apagado
        setErrorUbic({
          titulo: 'El GPS está desactivado en tu celular.',
          pasos: esIOS
            ? ['Abrí Configuración', 'Tocá "Privacidad y seguridad"', 'Tocá "Localización"', 'Activá "Localización"']
            : esAndroid
            ? ['Deslizá desde arriba para abrir el panel de notificaciones', 'Tocá el ícono de "Ubicación" para activarlo', 'Volvé a la app e intentá de nuevo']
            : ['Activá la ubicación/GPS en la configuración de tu dispositivo'],
          puedeReintentar: true,
        });
      } else {
        setErrorUbic({
          titulo: 'No pudimos obtener tu ubicación.',
          pasos: ['Asegurate de tener el GPS activado', 'Verificá que la app tenga permiso de ubicación', 'Intentá de nuevo'],
          puedeReintentar: true,
        });
      }
    }
    setLoadingUbic(false);
  }

  // ── VALIDACIONES ─────────────────────────────────────────────────────────────
  function validarDatos() {
    const errs = {};
    if (!cliente.nombre.trim()) errs.nombre = 'El nombre es obligatorio.';
    setErrores(errs);
    return Object.keys(errs).length === 0;
  }

  function validarPago() {
    if (!metodoPago) { setErrores({ pago: 'Elegí un método de pago.' }); return false; }
    return true;
  }

  // ── CONFIRMAR PEDIDO ─────────────────────────────────────────────────────────
  async function confirmarPedido() {
    if (!validarPago()) return;

    // Guardar pedido en la base de datos
    const { data: pedido, error } = await import('../../lib/supabaseClient')
      .then(m => m.supabase.from('pedidos').insert({
        cliente_nombre: cliente.nombre,
        cliente_telefono: cliente.telefono || null,
        tipo_entrega: tipoEntrega,
        direccion: tipoEntrega === 'delivery' ? direccion : null,
        piso_depto: tipoEntrega === 'delivery' ? pisoDepto : null,
        indicaciones: indicaciones || null,
        latitud: ubicacion?.lat || null,
        longitud: ubicacion?.lng || null,
        metodo_pago: metodoPago,
        subtotal,
        costo_delivery: costoDelivery,
        total,
        estado: 'nuevo',
      }).select().single());

    if (!error && pedido) {
      // Insertar items del pedido
      await import('../../lib/supabaseClient').then(m =>
        m.supabase.from('pedido_items').insert(
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
        )
      );
    }

    // Generar y abrir WhatsApp
    const mensaje = generarMensajeWhatsApp({
      items: items.map(it => ({ ...it, precio: it.precio })),
      subtotal,
      costoDelivery,
      total,
      metodoPago,
      tipoEntrega,
      cliente,
      direccion,
      pisoDepto,
      indicaciones,
      lat: ubicacion?.lat,
      lng: ubicacion?.lng,
    });

    abrirWhatsApp(config.whatsapp_numero, mensaje);
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
              <button className="ch-back" onClick={() => setPaso(PASOS[pasoIdx - 1])}>←</button>
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

        {/* ── PASOS ── */}
        <div className="ch-steps">
          {['Pedido','Entrega','Datos','Pago'].map((s, i) => (
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
              <div className="ch-opciones-entrega">
                <button
                  className={`ch-opcion-entrega ${tipoEntrega === 'retiro' ? 'activa' : ''}`}
                  onClick={() => { setTipoEntrega('retiro'); setUbicacion(null); setErrorUbic(''); }}
                >
                  <span className="ch-opcion-icon">🏠</span>
                  <div>
                    <span className="ch-opcion-titulo">Retiro por el local</span>
                    <span className="ch-opcion-sub">Gratis · Lo retirás vos</span>
                  </div>
                </button>
                <button
                  className={`ch-opcion-entrega ${tipoEntrega === 'delivery' ? 'activa' : ''}`}
                  onClick={() => setTipoEntrega('delivery')}
                >
                  <span className="ch-opcion-icon">🛵</span>
                  <div>
                    <span className="ch-opcion-titulo">Delivery a domicilio</span>
                    <span className="ch-opcion-sub">+${Number(config?.delivery_precio || 0).toLocaleString('es-AR')} · Hasta {config?.delivery_radio_km} km</span>
                  </div>
                </button>
              </div>

              {tipoEntrega === 'delivery' && (
                <div className="ch-delivery-bloque">
                  <button className="ch-btn-ubic" onClick={pedirUbicacion} disabled={loadingUbic}>
                    {loadingUbic
                      ? <span className="ch-ubic-loading"><span className="ch-ubic-spinner" /> Esperando señal GPS…</span>
                      : ubicacion
                        ? 'Ubicación obtenida'
                        : 'Usar mi ubicación actual'
                    }
                  </button>
                  {ubicacion && (
                    <p className="ch-ubic-ok">
                      Ubicación obtenida · {ubicacion.dist} km del local
                      {ubicacion.precision && (
                        <span className="ch-ubic-precision"> · precisión ±{ubicacion.precision}m</span>
                      )}
                    </p>
                  )}
                  {errorUbic && (
                    <div className="ch-error-ubic">
                      <p className="ch-error-titulo">{errorUbic.titulo}</p>
                      {errorUbic.pasos && (
                        <ol className="ch-error-pasos">
                          {errorUbic.pasos.map((p, i) => <li key={i}>{p}</li>)}
                        </ol>
                      )}
                      <div className="ch-error-btns">
                        {errorUbic.puedeReintentar && (
                          <button className="ch-btn-reintentar" onClick={pedirUbicacion}>
                            Intentar de nuevo
                          </button>
                        )}
                        <button className="ch-btn-retiro-fallback" onClick={() => { setTipoEntrega('retiro'); setErrorUbic(null); }}>
                          Mejor retiro por el local
                        </button>
                      </div>
                    </div>
                  )}
                  <label className="ch-campo">
                    <span>Calle y número *</span>
                    <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej: Av. San Martín 1234" />
                    {errores.direccion && <span className="ch-err">{errores.direccion}</span>}
                  </label>
                  <label className="ch-campo">
                    <span>Piso / Depto (opcional)</span>
                    <input type="text" value={pisoDepto} onChange={e => setPisoDepto(e.target.value)} placeholder="Ej: 3° B" />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* PASO 3: DATOS DEL CLIENTE */}
          {paso === 'datos' && (
            <div className="ch-seccion">
              <label className="ch-campo">
                <span>Nombre *</span>
                <input type="text" value={cliente.nombre} onChange={e => setCliente(p => ({ ...p, nombre: e.target.value }))} placeholder="Tu nombre" />
                {errores.nombre && <span className="ch-err">{errores.nombre}</span>}
              </label>
              <label className="ch-campo">
                <span>Teléfono (opcional)</span>
                <input type="tel" value={cliente.telefono} onChange={e => setCliente(p => ({ ...p, telefono: e.target.value }))} placeholder="Ej: 261 555-1234" />
              </label>
              <label className="ch-campo">
                <span>Aclaraciones del pedido (opcional)</span>
                <textarea rows={3} value={cliente.aclaraciones} onChange={e => setCliente(p => ({ ...p, aclaraciones: e.target.value }))} placeholder="Sin cebolla, extra salsa, alergia a…" />
              </label>
              <label className="ch-campo">
                <span>Indicaciones de la dirección (opcional)</span>
                <textarea rows={2} value={indicaciones} onChange={e => setIndicaciones(e.target.value)} placeholder="Timbre roto, portón verde…" />
              </label>
            </div>
          )}

          {/* PASO 4: MÉTODO DE PAGO */}
          {paso === 'pago' && (
            <div className="ch-seccion">
              <div className="ch-metodos">
                {metodos.map(m => (
                  <button
                    key={m.id}
                    className={`ch-metodo ${metodoPago === m.nombre ? 'activo' : ''}`}
                    onClick={() => { setMetodoPago(m.nombre); setErrores({}); }}
                  >
                    {m.nombre}
                  </button>
                ))}
              </div>
              {errores.pago && <p className="ch-err">{errores.pago}</p>}

              <div className="ch-resumen">
                <div className="ch-resumen-row"><span>Subtotal</span><span>${subtotal.toLocaleString('es-AR')}</span></div>
                {costoDelivery > 0 && <div className="ch-resumen-row"><span>Envío</span><span>${Number(costoDelivery).toLocaleString('es-AR')}</span></div>}
                <div className="ch-resumen-row ch-resumen-total"><span>Total</span><span>${total.toLocaleString('es-AR')}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="ch-footer">
          {paso === 'carrito' && (
            <button className="ch-btn-primario" onClick={() => setPaso('entrega')}>
              Continuar
            </button>
          )}
          {paso === 'entrega' && (
            <button
              className="ch-btn-primario"
              disabled={
                !tipoEntrega ||
                (tipoEntrega === 'delivery' && !ubicacion) ||
                (tipoEntrega === 'delivery' && !direccion.trim())
              }
              onClick={() => {
                if (tipoEntrega === 'delivery' && !direccion.trim()) {
                  setErrores({ direccion: 'Ingresá tu dirección antes de continuar.' });
                  return;
                }
                setErrores({});
                setPaso('datos');
              }}
            >
              Continuar
            </button>
          )}
          {paso === 'datos' && (
            <button className="ch-btn-primario" onClick={() => { if (validarDatos()) setPaso('pago'); }}>
              Continuar
            </button>
          )}
          {paso === 'pago' && (
            <button className="ch-btn-whatsapp" onClick={confirmarPedido}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Confirmar por WhatsApp
            </button>
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
        .ch-titulo { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; }
        .ch-close { background: #f0ebe3; border: none; color: #9a8f82; border-radius: 50%; width: 32px; height: 32px; font-size: 14px; cursor: pointer; }

        /* Pasos */
        .ch-steps { display: flex; align-items: center; padding: 0 20px 14px; gap: 0; flex-shrink: 0; border-bottom: 1px solid #ede8e0; }
        .ch-step { display: flex; align-items: center; gap: 6px; flex: 1; }
        .ch-step:not(:last-child)::after { content: ''; flex: 1; height: 1px; background: #ddd8d0; margin: 0 6px; }
        .ch-step-dot { width: 22px; height: 22px; border-radius: 50%; background: #ddd8d0; color: #9a8f82; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s, color 0.2s; }
        .ch-step-done .ch-step-dot { background: #c1440e; color: #fff; }
        .ch-step-label { font-size: 11px; color: #9a8f82; white-space: nowrap; }
        .ch-step-done .ch-step-label { color: #1a1510; font-weight: 500; }

        /* Body */
        .ch-body { overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
        .ch-seccion { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px; }

        /* Items del carrito */
        .ch-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #ede8e0; }
        .ch-item:last-of-type { border-bottom: none; }
        .ch-item-info { flex: 1; }
        .ch-item-nombre { font-size: 14px; font-weight: 500; display: block; }
        .ch-item-precio { font-size: 13px; color: #6b6259; display: block; margin-top: 2px; }
        .ch-item-ctrl { display: flex; align-items: center; gap: 8px; }
        .ch-ctrl { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #c1440e; background: transparent; color: #c1440e; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ch-ctrl-cant { font-size: 15px; font-weight: 700; min-width: 18px; text-align: center; }
        .ch-subtotal { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; padding-top: 4px; border-top: 1px solid #ede8e0; margin-top: 4px; }

        /* Entrega */
        .ch-opciones-entrega { display: flex; flex-direction: column; gap: 10px; }
        .ch-opcion-entrega { display: flex; align-items: center; gap: 14px; background: #fff; border: 2px solid #ede8e0; border-radius: 12px; padding: 14px 16px; cursor: pointer; font-family: inherit; text-align: left; transition: border-color 0.15s; }
        .ch-opcion-entrega.activa { border-color: #c1440e; background: #fff8f5; }
        .ch-opcion-icon { font-size: 24px; flex-shrink: 0; }
        .ch-opcion-titulo { font-size: 15px; font-weight: 600; color: #1a1510; display: block; }
        .ch-opcion-sub { font-size: 12px; color: #9a8f82; display: block; margin-top: 2px; }
        .ch-delivery-bloque { display: flex; flex-direction: column; gap: 12px; }
        .ch-btn-ubic { background: #1a1510; color: #faf7f2; border: none; border-radius: 10px; padding: 13px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; width: 100%; }
        .ch-btn-ubic:disabled { opacity: 0.6; cursor: default; }
        .ch-ubic-ok { font-size: 13px; color: #2d7a3a; font-weight: 500; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .ch-ubic-precision { font-size: 12px; color: #9a8f82; font-weight: 400; }
        .ch-ubic-loading { display: flex; align-items: center; gap: 8px; }
        .ch-ubic-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ch-error-ubic { background: #fff5f3; border: 1px solid #fcd0c8; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .ch-error-titulo { font-size: 13px; font-weight: 600; color: #c1320a; margin: 0; line-height: 1.4; }
        .ch-error-pasos { font-size: 13px; color: #6b6259; margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; line-height: 1.5; }
        .ch-error-btns { display: flex; flex-direction: column; gap: 8px; }
        .ch-btn-reintentar { background: #c1320a; color: #fff; border: none; border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; }
        .ch-btn-retiro-fallback { background: transparent; border: 1px solid #e4ddd3; color: #6b6259; border-radius: 8px; padding: 10px 14px; font-size: 13px; font-family: inherit; cursor: pointer; }

        /* Campos */
        .ch-campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #6b6259; }
        .ch-campo input, .ch-campo textarea { background: #fff; border: 1.5px solid #ddd8d0; border-radius: 10px; padding: 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; transition: border-color 0.15s; resize: none; }
        .ch-campo input:focus, .ch-campo textarea:focus { border-color: #c1440e; }
        .ch-err { font-size: 12px; color: #c1440e; }

        /* Métodos de pago */
        .ch-metodos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .ch-metodo { background: #fff; border: 2px solid #ede8e0; border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; transition: border-color 0.15s; }
        .ch-metodo.activo { border-color: #c1440e; background: #fff8f5; color: #c1440e; font-weight: 600; }

        /* Resumen */
        .ch-resumen { background: #fff; border: 1px solid #ede8e0; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .ch-resumen-row { display: flex; justify-content: space-between; font-size: 14px; color: #6b6259; }
        .ch-resumen-total { font-size: 18px; font-weight: 700; color: #1a1510; padding-top: 8px; border-top: 1px solid #ede8e0; margin-top: 4px; }

        /* Footer */
        .ch-footer { padding: 12px 20px; padding-bottom: max(12px, env(safe-area-inset-bottom)); border-top: 1px solid #ede8e0; flex-shrink: 0; }
        .ch-btn-primario { width: 100%; background: #1a1510; color: #faf7f2; border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer; transition: filter 0.15s; }
        .ch-btn-primario:hover { filter: brightness(1.15); }
        .ch-btn-primario:disabled { opacity: 0.4; cursor: default; }
        .ch-btn-whatsapp { width: 100%; background: #25d366; color: #fff; border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: 700; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: filter 0.15s; }
        .ch-btn-whatsapp:hover { filter: brightness(1.08); }
      `}</style>
    </>
  );
}