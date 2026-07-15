// ── Geolocalización ───────────────────────────────────────────────────────────

export function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu dispositivo no soporta geolocalización.'));
      return;
    }

    const PRECISION_MINIMA = 100; // metros — aceptamos lecturas con menos de 100m de error
    const TIMEOUT_TOTAL    = 20000; // 20 segundos máximo en total
    let watchId = null;
    let resuelto = false;

    const timer = setTimeout(() => {
      if (resuelto) return;
      // Si el tiempo se acabó pero tenemos alguna lectura, la usamos igual
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      reject(new Error('No pudimos obtener tu ubicación con precisión. Asegurate de tener el GPS activado e intentá de nuevo.'));
    }, TIMEOUT_TOTAL);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (resuelto) return;
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;

        // Si la precisión es buena, resolvemos inmediatamente
        // Si no, seguimos esperando hasta el timeout
        if (accuracy <= PRECISION_MINIMA) {
          resuelto = true;
          clearTimeout(timer);
          navigator.geolocation.clearWatch(watchId);
          resolve({ lat, lng, precision: Math.round(accuracy) });
        }
        // Si la precisión no es suficiente, watchPosition seguirá
        // intentando con lecturas más precisas
      },
      (err) => {
        if (resuelto) return;
        resuelto = true;
        clearTimeout(timer);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);

        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Permiso de ubicación denegado. Podés elegir retiro por el local.'));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error('No se pudo obtener tu ubicación. Verificá que el GPS esté activado.'));
        } else {
          reject(new Error('No pudimos obtener tu ubicación. Intentá de nuevo.'));
        }
      },
      {
        enableHighAccuracy: true, // fuerza GPS en vez de red/IP
        timeout: 15000,           // tiempo por intento de watchPosition
        maximumAge: 0,            // no usar ubicaciones cacheadas
      }
    );
  });
}

// Fórmula de Haversine — distancia en km entre dos coordenadas
export function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Generador del mensaje de WhatsApp ────────────────────────────────────────

export function generarMensajeWhatsApp({ items, subtotal, costoDelivery, total, metodoPago, tipoEntrega, cliente, direccion, pisoDepto, indicaciones, lat, lng }) {
  const lineas = [];

  lineas.push('🍕 *NUEVO PEDIDO — Don Adriano\'s*');
  lineas.push('');

  // Detalle de productos
  lineas.push('*Pedido:*');
  items.forEach((it) => {
    let linea = `• ${it.cantidad}× ${it.nombre_snapshot}`;
    if (it.variante_nombre) linea += ` _(${it.variante_nombre})_`;
    if (it.detalle_seleccion?.length) {
      const sel = it.detalle_seleccion.map((s) => `${s.cantidad} ${s.nombre}`).join(', ');
      linea += `\n  ↳ ${sel}`;
    }
    linea += ` — $${(it.precio * it.cantidad).toLocaleString('es-AR')}`;
    lineas.push(linea);
  });

  lineas.push('');
  lineas.push(`*Subtotal:* $${subtotal.toLocaleString('es-AR')}`);

  if (tipoEntrega === 'delivery') {
    lineas.push(`*Envío:* $${costoDelivery.toLocaleString('es-AR')}`);
  }

  lineas.push(`*TOTAL: $${total.toLocaleString('es-AR')}*`);
  lineas.push('');

  // Método de pago
  lineas.push(`*Método de pago:* ${metodoPago}`);
  lineas.push('');

  // Tipo de entrega
  if (tipoEntrega === 'delivery') {
    lineas.push('*Entrega:* 🛵 Delivery');
    lineas.push(`*Dirección:* ${direccion}${pisoDepto ? `, ${pisoDepto}` : ''}`);
    if (indicaciones) lineas.push(`*Indicaciones:* ${indicaciones}`);
    if (lat && lng) {
      lineas.push(`*Ubicación:* https://maps.google.com/?q=${lat},${lng}`);
    }
  } else {
    lineas.push('*Entrega:* 🏠 Retiro por el local');
  }

  lineas.push('');

  // Datos del cliente
  lineas.push(`*Nombre:* ${cliente.nombre}`);
  if (cliente.telefono) lineas.push(`*Teléfono:* ${cliente.telefono}`);
  if (cliente.aclaraciones) lineas.push(`*Aclaraciones:* ${cliente.aclaraciones}`);

  lineas.push('');
  lineas.push('⏱ *¿Cuánto tiempo de demora tiene?*');

  return lineas.join('\n');
}

export function abrirWhatsApp(numero, mensaje) {
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}