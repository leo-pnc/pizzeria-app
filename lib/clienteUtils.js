// ── Geolocalización ───────────────────────────────────────────────────────────

export function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu dispositivo no soporta geolocalización.'));
      return;
    }

    const PRECISION_IDEAL  = 100;   // metros — intentamos conseguir esto
    const TIMEOUT_TOTAL    = 15000; // 15 segundos máximo
    let mejorLectura       = null;  // guardamos la mejor lectura aunque no sea ideal
    let watchId            = null;
    let resuelto           = false;

    function resolver(lat, lng, accuracy) {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      resolve({ lat, lng, precision: Math.round(accuracy) });
    }

    const timer = setTimeout(() => {
      if (resuelto) return;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      // Si tenemos alguna lectura aunque sea imprecisa, la usamos
      if (mejorLectura) {
        resolver(mejorLectura.lat, mejorLectura.lng, mejorLectura.accuracy);
      } else {
        reject(new Error('No pudimos obtener tu ubicación. Verificá que el GPS esté activado e intentá de nuevo.'));
      }
    }, TIMEOUT_TOTAL);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (resuelto) return;
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;

        // Guardamos siempre la lectura más precisa que hayamos visto
        if (!mejorLectura || accuracy < mejorLectura.accuracy) {
          mejorLectura = { lat, lng, accuracy };
        }

        // Si ya alcanzamos la precisión ideal, resolvemos sin esperar más
        if (accuracy <= PRECISION_IDEAL) {
          resolver(lat, lng, accuracy);
        }
      },
      (err) => {
        if (resuelto) return;

        // Si hay error pero tenemos alguna lectura previa, la usamos
        if (mejorLectura) {
          resolver(mejorLectura.lat, mejorLectura.lng, mejorLectura.accuracy);
          return;
        }

        resuelto = true;
        clearTimeout(timer);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);

        if (err.code === 1) { // PERMISSION_DENIED
          reject(new Error('Permiso de ubicación denegado. Podés elegir retiro por el local.'));
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          reject(new Error('No se pudo obtener tu ubicación. Verificá que el GPS esté activado.'));
        } else {
          reject(new Error('No pudimos obtener tu ubicación. Intentá de nuevo.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
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

export function generarMensajeWhatsApp({ items, subtotal, costoDelivery, total, metodoPago, tipoEntrega, cliente, direccion, pisoDepto, indicaciones, lat, lng, horarioDeseado, horaPersonalizada }) {
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
    if (indicaciones) lineas.push(`*Indicaciones:* ${indicaciones}`);
  }

  // Horario deseado
  const textoHorario = horarioDeseado === 'personalizado'
    ? `Horario elegido: ${horaPersonalizada || '(sin especificar)'}`
    : horarioDeseado === 'sin_apuro'
      ? 'Sin apuro'
      : 'Lo antes posible';
  lineas.push(`*¿Para cuándo?* ${textoHorario}`);

  lineas.push('');

  // Datos del cliente
  lineas.push(`*Nombre:* ${cliente.nombre}`);
  if (cliente.telefono) lineas.push(`*Teléfono:* ${cliente.telefono}`);
  if (cliente.aclaraciones) lineas.push(`*Aclaraciones:* ${cliente.aclaraciones}`);

  lineas.push('');
  lineas.push('⏱ *¿Me confirmás el horario de entrega?*');

  return lineas.join('\n');
}

export function abrirWhatsApp(numero, mensaje) {
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}

// ── Cálculo de apertura según horarios y franjas ────────────────────────────

export function estaAbiertoAhora(cfg, horarios, franjas) {
  // Override manual del dueño tiene prioridad absoluta
  if (cfg.esta_abierto_manual === true) return true;
  if (cfg.esta_abierto_manual === false) return false;

  const ahora = new Date();
  const dia = ahora.getDay();
  const minutosActual = ahora.getHours() * 60 + ahora.getMinutes();

  const horarioDia = horarios.find(h => h.dia_semana === dia && h.activo);
  if (!horarioDia) return false;

  const franjasDia = franjas.filter(f => f.horario_id === horarioDia.id);

  return franjasDia.some(f => {
    const [aH, aM] = f.hora_apertura.split(':').map(Number);
    const [cH, cM] = f.hora_cierre.split(':').map(Number);
    const apertura = aH * 60 + aM;
    const cierre = cH * 60 + cM;
    return minutosActual >= apertura && minutosActual <= cierre;
  });
}

const NOMBRES_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function proximaApertura(horarios, franjas) {
  const ahora = new Date();
  const minutosActual = ahora.getHours() * 60 + ahora.getMinutes();

  for (let offset = 0; offset < 7; offset++) {
    const diaRevisado = (ahora.getDay() + offset) % 7;
    const horarioDia = horarios.find(h => h.dia_semana === diaRevisado && h.activo);
    if (!horarioDia) continue;

    let franjasDia = franjas
      .filter(f => f.horario_id === horarioDia.id)
      .sort((a, b) => a.hora_apertura.localeCompare(b.hora_apertura));

    if (offset === 0) {
      // Hoy: solo franjas que todavía no empezaron
      franjasDia = franjasDia.filter(f => {
        const [aH, aM] = f.hora_apertura.split(':').map(Number);
        return aH * 60 + aM > minutosActual;
      });
    }

    if (franjasDia.length > 0) {
      const [aH, aM] = franjasDia[0].hora_apertura.split(':').map(Number);
      const horaStr = `${String(aH).padStart(2, '0')}:${String(aM).padStart(2, '0')}`;
      if (offset === 0) return `Hoy a las ${horaStr}`;
      if (offset === 1) return `Mañana a las ${horaStr}`;
      return `El ${NOMBRES_DIAS[diaRevisado]} a las ${horaStr}`;
    }
  }

  return null;
}

// ── Aviso de "pedido pendiente de confirmar cuando abran" ──────────────────

const FLAG_KEY = 'donadrianos_avisar_apertura';

export function guardarAvisoApertura() {
  try { localStorage.setItem(FLAG_KEY, '1'); } catch {}
}

export function cancelarAvisoApertura() {
  try { localStorage.removeItem(FLAG_KEY); } catch {}
}

export function hayAvisoAperturaGuardado() {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(FLAG_KEY) === '1'; } catch { return false; }
}

// Pide permiso de notificaciones del navegador (silencioso si ya se decidió antes)
export async function pedirPermisoNotificaciones() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const resultado = await Notification.requestPermission();
  return resultado === 'granted';
}

export function notificarAperturaSiCorresponde() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const notif = new Notification('¡Ya abrimos! 🍕', {
      body: 'Tenés un pedido armado esperando. Tocá para confirmarlo.',
      tag: 'donadrianos-apertura',
    });
    notif.onclick = () => { window.focus(); };
  } catch {
    // Algunos navegadores móviles no soportan new Notification() directo
  }
}

// ── Borrador del checkout (persiste el progreso del pedido) ────────────────

const BORRADOR_KEY = 'donadrianos_checkout_borrador';

export function guardarBorradorCheckout(datos) {
  try {
    localStorage.setItem(BORRADOR_KEY, JSON.stringify(datos));
  } catch {
    // Si falla (modo privado, etc.) seguimos sin persistencia, no rompemos nada
  }
}

export function cargarBorradorCheckout() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BORRADOR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function limpiarBorradorCheckout() {
  try { localStorage.removeItem(BORRADOR_KEY); } catch {}
}

// ── Validar si una hora elegida cae dentro del horario de atención de hoy ───

export function horaValidaHoy(horaStr, horarios, franjas) {
  if (!horaStr || !horarios?.length) return true; // sin datos, no bloqueamos
  const ahora = new Date();
  const dia = ahora.getDay();
  const [h, m] = horaStr.split(':').map(Number);
  const minutos = h * 60 + m;

  const horarioDia = horarios.find(hh => hh.dia_semana === dia && hh.activo);
  if (!horarioDia) return false;

  const franjasDia = franjas.filter(f => f.horario_id === horarioDia.id);
  if (!franjasDia.length) return false;

  return franjasDia.some(f => {
    const [aH, aM] = f.hora_apertura.split(':').map(Number);
    const [cH, cM] = f.hora_cierre.split(':').map(Number);
    return minutos >= aH * 60 + aM && minutos <= cH * 60 + cM;
  });
}

// ── Preferencias del cliente que se recuerdan entre compras ────────────────
// (a diferencia del "borrador" que se borra al confirmar, esto persiste
// siempre, para no pedirle los mismos datos en cada pedido nuevo)

const PREFERENCIAS_KEY = 'donadrianos_preferencias';

export function guardarPreferenciasCliente(datos) {
  try {
    localStorage.setItem(PREFERENCIAS_KEY, JSON.stringify(datos));
  } catch {}
}

export function cargarPreferenciasCliente() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFERENCIAS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}