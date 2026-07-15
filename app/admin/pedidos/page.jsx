'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useEmpleado } from '../../../contexts/EmpleadoContext';

const ESTADOS = [
  { id: 'todos',          label: 'Todos',          color: '#a69c8d' },
  { id: 'nuevo',          label: 'Nuevos',         color: '#c1440e' },
  { id: 'en_preparacion', label: 'Preparando',     color: '#b07d2a' },
  { id: 'listo',          label: 'Listos',         color: '#6b9c6b' },
  { id: 'entregado',      label: 'Entregados',     color: '#4a4a4a' },
];

const COLUMNAS_KANBAN = [
  { id: 'nuevo',          label: 'Nuevos',     color: '#c1440e', emoji: '🔔' },
  { id: 'en_preparacion', label: 'Preparando', color: '#b07d2a', emoji: '🍕' },
  { id: 'listo',          label: 'Listos',     color: '#6b9c6b', emoji: '✅' },
  { id: 'entregado',      label: 'Entregados', color: '#3a3a3a', emoji: '📦' },
];

const SIGUIENTE = {
  nuevo:          { estado: 'en_preparacion', label: 'Tomar pedido' },
  en_preparacion: { estado: 'listo',          label: 'Marcar listo' },
  listo:          { estado: 'entregado',      label: 'Marcar entregado' },
};

function tiempo(fechaStr) {
  const s = Math.floor((Date.now() - new Date(fechaStr)) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
}

function urgencia(fechaStr, estado) {
  if (estado === 'entregado') return 'ok';
  const m = (Date.now() - new Date(fechaStr)) / 60000;
  if (m > 45) return 'critico';
  if (m > 20) return 'alerta';
  return 'ok';
}

function horaCorta(fechaStr) {
  return new Date(fechaStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function colorEstado(estado) {
  return COLUMNAS_KANBAN.find(c => c.id === estado)?.color || '#a69c8d';
}

// ─── Tarjeta compacta (móvil) ────────────────────────────────────────────────
function TarjetaMobile({ pedido, onClick }) {
  const urg = urgencia(pedido.created_at, pedido.estado);
  const num = pedido.id.slice(-4).toUpperCase();
  const col = colorEstado(pedido.estado);

  return (
    <button className={`card ${pedido.esNuevo ? 'card-nueva' : ''}`} onClick={onClick}>
      <span className="card-bar" style={{ background: col }} />
      <div className="card-body">
        <div className="card-row">
          <span className="card-num">#{num}</span>
          <span className={`card-timer urg-${urg}`}>{tiempo(pedido.created_at)}</span>
        </div>
        <div className="card-row card-row-b">
          <span className="card-tipo">
            {pedido.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Retiro'}
          </span>
          <span className="card-hora">{horaCorta(pedido.created_at)}</span>
        </div>
        <span className="card-estado" style={{ color: col }}>
          {COLUMNAS_KANBAN.find(c => c.id === pedido.estado)?.label}
        </span>
      </div>
    </button>
  );
}

// ─── Tarjeta Kanban (desktop) ─────────────────────────────────────────────────
function TarjetaKanban({ pedido, onAvanzar, puedeEditar }) {
  const [abierto, setAbierto] = useState(false);
  const urg = urgencia(pedido.created_at, pedido.estado);
  const num = pedido.id.slice(-4).toUpperCase();
  const sig = SIGUIENTE[pedido.estado];

  return (
    <div
      className={`kcard urg-${urg} ${pedido.esNuevo ? 'kcard-nueva' : ''} ${abierto ? 'kcard-abierta' : ''}`}
      onClick={() => setAbierto(v => !v)}
    >
      <div className="kcard-top">
        <div>
          <span className="kcard-num">#{num}</span>
          <span className={`ktipo tipo-${pedido.tipo_entrega}`}>
            {pedido.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Retiro'}
          </span>
        </div>
        <div className="kcard-meta">
          <span className="kcard-hora">{horaCorta(pedido.created_at)}</span>
          <span className={`kcard-timer urg-${urg}`}>{tiempo(pedido.created_at)}</span>
        </div>
      </div>

      {abierto && (
        <div className="kcard-detalle" onClick={e => e.stopPropagation()}>
          <div className="det-sep" />
          {pedido.cliente_nombre && <p className="det-row"><span className="det-lbl">Cliente</span>{pedido.cliente_nombre}</p>}
          {pedido.items?.length > 0 && (
            <div className="det-items">
              {pedido.items.map(it => (
                <div key={it.id} className="det-item">
                  <span className="det-cant">{it.cantidad}×</span>
                  <span>{it.nombre_snapshot}</span>
                </div>
              ))}
            </div>
          )}
          <p className="det-row det-total"><span className="det-lbl">Total</span>${pedido.total}</p>
          <p className="det-row"><span className="det-lbl">Pago</span>{pedido.metodo_pago}</p>
          {pedido.tipo_entrega === 'delivery' && pedido.direccion && (
            <p className="det-row"><span className="det-lbl">Dirección</span>{pedido.direccion} {pedido.piso_depto}</p>
          )}
          {pedido.latitud && (
            <a className="det-maps" href={`https://maps.google.com/?q=${pedido.latitud},${pedido.longitud}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
              📍 Ver en Maps
            </a>
          )}
          {puedeEditar && sig && (
            <button
              className="kcard-btn-avanzar"
              style={{ background: colorEstado(sig.estado) }}
              onClick={() => onAvanzar(pedido)}
            >
              → {sig.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drawer de detalle (móvil) ────────────────────────────────────────────────
function Drawer({ pedido, onClose, onAvanzar, puedeEditar }) {
  const sig = SIGUIENTE[pedido?.estado];
  const col = colorEstado(pedido?.estado);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!pedido) return null;
  const num = pedido.id.slice(-4).toUpperCase();

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-handle" />

        <div className="drawer-header">
          <div>
            <span className="drawer-num">#{num}</span>
            <span className={`drawer-tipo tipo-${pedido.tipo_entrega}`}>
              {pedido.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Retiro'}
            </span>
          </div>
          <div className="drawer-header-r">
            <span className="drawer-hora">{horaCorta(pedido.created_at)}</span>
            <button className="drawer-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="drawer-estado-row">
          <span className="drawer-estado-dot" style={{ background: col }} />
          <span className="drawer-estado-label" style={{ color: col }}>
            {COLUMNAS_KANBAN.find(c => c.id === pedido.estado)?.label}
          </span>
          <span className={`drawer-timer urg-${urgencia(pedido.created_at, pedido.estado)}`}>
            {tiempo(pedido.created_at)}
          </span>
        </div>

        <div className="drawer-scroll">
          {pedido.cliente_nombre && (
            <div className="drawer-bloque">
              <span className="drawer-lbl">Cliente</span>
              <span className="drawer-val">{pedido.cliente_nombre}</span>
            </div>
          )}

          {pedido.items?.length > 0 && (
            <div className="drawer-bloque">
              <span className="drawer-lbl">Pedido</span>
              <div className="drawer-items">
                {pedido.items.map(it => (
                  <div key={it.id} className="drawer-item">
                    <span className="drawer-item-cant">{it.cantidad}×</span>
                    <div>
                      <span className="drawer-item-nombre">{it.nombre_snapshot}</span>
                      {it.detalle_seleccion && (
                        <span className="drawer-item-sel">
                          {(typeof it.detalle_seleccion === 'string'
                            ? JSON.parse(it.detalle_seleccion)
                            : it.detalle_seleccion
                          ).map(s => `${s.cantidad} ${s.nombre}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="drawer-bloque drawer-totales">
            {pedido.costo_delivery > 0 && (
              <div className="drawer-total-row">
                <span>Envío</span><span>${pedido.costo_delivery}</span>
              </div>
            )}
            <div className="drawer-total-row drawer-total-grande">
              <span>Total</span><span>${pedido.total}</span>
            </div>
            <div className="drawer-total-row">
              <span>Método de pago</span><span>{pedido.metodo_pago}</span>
            </div>
          </div>

          {pedido.tipo_entrega === 'delivery' && (
            <div className="drawer-bloque">
              <span className="drawer-lbl">Dirección de entrega</span>
              {pedido.direccion && <span className="drawer-val">{pedido.direccion} {pedido.piso_depto}</span>}
              {pedido.indicaciones && <span className="drawer-subval">{pedido.indicaciones}</span>}
              {pedido.latitud && (
                <a
                  className="drawer-maps"
                  href={`https://maps.google.com/?q=${pedido.latitud},${pedido.longitud}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📍 Abrir en Google Maps
                </a>
              )}
            </div>
          )}
        </div>

        {puedeEditar && sig && (
          <div className="drawer-footer">
            <button
              className="drawer-btn-avanzar"
              style={{ background: colorEstado(sig.estado) }}
              onClick={() => { onAvanzar(pedido); onClose(); }}
            >
              → {sig.label}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PedidosPage() {
  const { puede, empleado } = useEmpleado();
  const puedeVer    = empleado.rol === 'dueño' || puede('pedidos', 'ver');
  const puedeEditar = empleado.rol === 'dueño' || puede('pedidos', 'editar');

  const [pedidos, setPedidos]       = useState([]);
  const [filtro, setFiltro]         = useState('todos');
  const [drawerPedido, setDrawer]   = useState(null);
  const [tick, setTick]             = useState(0);
  const [confirmLimpiar, setConfirmLimpiar] = useState(false);
  const prevIds                     = useRef(new Set());

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!puedeVer) return;
    cargar();

    const canal = supabase
      .channel('pedidos-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, payload => {
        if (payload.eventType === 'INSERT') {
          const nuevo = payload.new;
          if (!prevIds.current.has(nuevo.id)) {
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            if (Notification.permission === 'granted') {
              new Notification('🔔 Nuevo pedido', {
                body: `#${nuevo.id.slice(-4).toUpperCase()} · ${nuevo.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Retiro'}`,
              });
            }
            prevIds.current.add(nuevo.id);
          }
          setPedidos(prev => [{ ...nuevo, items: [], esNuevo: true }, ...prev]);
          cargarItems(nuevo.id);
        }
        if (payload.eventType === 'UPDATE') {
          setPedidos(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new, esNuevo: false } : p));
        }
        if (payload.eventType === 'DELETE') {
          setPedidos(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, [puedeVer]);

  async function cargar() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const { data: peds } = await supabase
      .from('pedidos').select('*')
      .gte('created_at', hoy.toISOString())
      .order('created_at', { ascending: false });

    const { data: items } = await supabase
      .from('pedido_items').select('*')
      .in('pedido_id', (peds || []).map(p => p.id));

    const result = (peds || []).map(p => ({ ...p, items: (items || []).filter(i => i.pedido_id === p.id), esNuevo: false }));
    prevIds.current = new Set(result.map(p => p.id));
    setPedidos(result);
  }

  async function cargarItems(pedidoId) {
    const { data } = await supabase.from('pedido_items').select('*').eq('pedido_id', pedidoId);
    setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, items: data || [] } : p));
  }

  async function avanzar(pedido) {
    const sig = SIGUIENTE[pedido.estado];
    if (!sig || !puedeEditar) return;
    await supabase.from('pedidos').update({ estado: sig.estado, atendido_por: empleado.id }).eq('id', pedido.id);
  }

  async function limpiarEntregados() {
    setPedidos(prev => prev.filter(p => p.estado !== 'entregado'));
    setConfirmLimpiar(false);
  }

  const pedidosFiltrados = filtro === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtro);
  const activos = pedidos.filter(p => p.estado !== 'entregado').length;
  const nuevos  = pedidos.filter(p => p.estado === 'nuevo').length;

  if (!puedeVer) return <div className="sin-acceso">No tenés permiso para ver pedidos.</div>;

  return (
    <div className="pagina">
      {/* ── TOP BAR ── */}
      <header className="topbar">
        <div className="topbar-l">
          <a className="volver" href="/admin">←</a>
          <h1>Pedidos</h1>
          {nuevos > 0 && <span className="badge-nuevos">{nuevos} nuevo{nuevos > 1 ? 's' : ''}</span>}
        </div>
        <div className="topbar-r">
          <span className="badge-activos">{activos} activo{activos !== 1 ? 's' : ''}</span>
          {puedeEditar && (
            confirmLimpiar ? (
              <div className="confirm-inline">
                <span>¿Limpiar?</span>
                <button className="btn-si" onClick={limpiarEntregados}>Sí</button>
                <button className="btn-no" onClick={() => setConfirmLimpiar(false)}>No</button>
              </div>
            ) : (
              <button className="btn-limpiar" onClick={() => setConfirmLimpiar(true)}>Limpiar</button>
            )
          )}
        </div>
      </header>

      {/* ── VISTA MÓVIL ── */}
      <div className="vista-mobile">
        {/* Tabs de filtro */}
        <div className="tabs-wrap">
          <div className="tabs">
            {ESTADOS.map(e => {
              const count = e.id === 'todos' ? pedidos.length : pedidos.filter(p => p.estado === e.id).length;
              return (
                <button
                  key={e.id}
                  className={`tab ${filtro === e.id ? 'tab-activo' : ''}`}
                  style={filtro === e.id ? { borderColor: e.color, color: e.color } : {}}
                  onClick={() => setFiltro(e.id)}
                >
                  {e.label}
                  {count > 0 && <span className="tab-count" style={filtro === e.id ? { background: e.color } : {}}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista */}
        <div className="lista-mobile">
          {pedidosFiltrados.length === 0 && (
            <div className="lista-vacia">
              <span>Sin pedidos</span>
              {filtro !== 'todos' && <button className="btn-ver-todos" onClick={() => setFiltro('todos')}>Ver todos</button>}
            </div>
          )}
          {pedidosFiltrados.map(p => (
            <TarjetaMobile key={p.id} pedido={p} onClick={() => setDrawer(p)} />
          ))}
        </div>
      </div>

      {/* ── VISTA DESKTOP (Kanban) ── */}
      <div className="vista-desktop">
        <div className="kanban">
          {COLUMNAS_KANBAN.map(col => {
            const lista = pedidos.filter(p => p.estado === col.id);
            return (
              <div key={col.id} className="col">
                <div className="col-header" style={{ borderTopColor: col.color }}>
                  <span>{col.emoji}</span>
                  <span className="col-label">{col.label}</span>
                  {lista.length > 0 && <span className="col-count" style={{ background: col.color }}>{lista.length}</span>}
                </div>
                <div className="col-body">
                  {lista.length === 0 && <div className="col-vacia">–</div>}
                  {lista.map(p => (
                    <TarjetaKanban key={p.id} pedido={p} onAvanzar={avanzar} puedeEditar={puedeEditar} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── DRAWER ── */}
      {drawerPedido && (
        <Drawer
          pedido={pedidos.find(p => p.id === drawerPedido.id) || drawerPedido}
          onClose={() => setDrawer(null)}
          onAvanzar={avanzar}
          puedeEditar={puedeEditar}
        />
      )}

      <style jsx global>{`
        /* ── GENERAL ── */
        .pagina { min-height: 100vh; background: #f7f5f2; color: #f2e9de; font-family: 'Work Sans', system-ui, sans-serif; display: flex; flex-direction: column; }

        /* ── TOPBAR ── */
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #2e2820; position: sticky; top: 0; z-index: 20; background: #f7f5f2; }
        .topbar-l { display: flex; align-items: center; gap: 12px; }
        .topbar-r { display: flex; align-items: center; gap: 8px; }
        .volver { color: #9a8f82; text-decoration: none; font-size: 18px; line-height: 1; padding: 4px; }
        h1 { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; margin: 0; color: #1a1510; }
        .badge-nuevos { background: #c1440e; color: #f2e9de; font-size: 11px; font-weight: 700; border-radius: 20px; padding: 3px 10px; animation: pulso 2s infinite; }
        @keyframes pulso { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .badge-activos { background: #f0ebe3; border: 1px solid #e4ddd3; color: #9a8f82; font-size: 12px; border-radius: 20px; padding: 4px 10px; }
        .btn-limpiar { background: transparent; border: 1px solid #e4ddd3; color: #9a8f82; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: inherit; }
        .confirm-inline { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #e2574c; }
        .btn-si { background: #9c3a3a; border: none; color: #f2e9de; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }
        .btn-no { background: transparent; border: 1px solid #3a3128; color: #a69c8d; border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: inherit; }

        /* ── VISIBILIDAD ── */
        .vista-mobile  { display: flex; flex-direction: column; flex: 1; }
        .vista-desktop { display: none; }
        @media (min-width: 860px) {
          .vista-mobile  { display: none; }
          .vista-desktop { display: block; flex: 1; }
        }

        /* ── TABS ── */
        .tabs-wrap { overflow-x: auto; border-bottom: 1px solid #ede8e0; -webkit-overflow-scrolling: touch; background: #fff; }
        .tabs-wrap::-webkit-scrollbar { display: none; }
        .tabs { display: flex; padding: 0 16px; gap: 0; white-space: nowrap; }
        .tab { background: transparent; border: none; border-bottom: 2px solid transparent; color: #9a8f82; padding: 12px 14px; font-size: 13px; font-family: inherit; cursor: pointer; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; gap: 6px; }
        .tab-activo { color: #f2e9de; }
        .tab-count { font-size: 11px; font-weight: 700; background: #ede8e0; color: #9a8f82; border-radius: 20px; padding: 1px 7px; }

        /* ── LISTA MÓVIL ── */
        .lista-mobile { display: flex; flex-direction: column; gap: 1px; background: #ede8e0; flex: 1; }
        .lista-vacia { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px; color: #9a8f82; font-size: 14px; }
        .btn-ver-todos { background: transparent; border: 1px solid #3a3128; color: #a69c8d; border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; font-family: inherit; }

        /* ── TARJETA MÓVIL ── */
        .card { display: flex; align-items: stretch; background: #fff; border: none; width: 100%; text-align: left; cursor: pointer; padding: 0; font-family: inherit; transition: background 0.1s; }
        .card:active { background: #26201a; }
        .card-nueva { animation: flash 1s ease; }
        @keyframes flash { 0%{background:#2a1a0e} 100%{background:#1e1a15} }
        .card-bar { width: 3px; flex-shrink: 0; }
        .card-body { flex: 1; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
        .card-row { display: flex; align-items: center; justify-content: space-between; }
        .card-row-b { margin-top: 2px; }
        .card-num { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; color: #1a1510; letter-spacing: 0.04em; }
        .card-timer { font-size: 12px; font-weight: 600; }
        .card-tipo { font-size: 13px; color: #9a8f82; }
        .card-hora { font-size: 12px; color: #b0a898; }
        .card-estado { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 4px; }
        .urg-ok      { color: #6b7156; }
        .urg-alerta  { color: #b07d2a; }
        .urg-critico { color: #c1440e; }

        /* ── DRAWER ── */
        .drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 40; backdrop-filter: blur(2px); }
        .drawer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #ede8e0; border-radius: 16px 16px 0 0; z-index: 50; display: flex; flex-direction: column; max-height: 88vh; animation: slideUp 0.25s ease; }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .drawer-handle { width: 36px; height: 4px; background: #e4ddd3; border-radius: 2px; margin: 12px auto 0; flex-shrink: 0; }
        .drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 12px; flex-shrink: 0; }
        .drawer-num { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 600; display: block; color: #1a1510; }
        .drawer-tipo { font-size: 13px; color: #9a8f82; display: block; margin-top: 2px; }
        .drawer-header-r { display: flex; align-items: center; gap: 12px; }
        .drawer-hora { font-size: 14px; color: #b0a898; }
        .drawer-close { background: #f0ebe3; border: 1px solid #e4ddd3; color: #9a8f82; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .drawer-estado-row { display: flex; align-items: center; gap: 8px; padding: 0 20px 14px; border-bottom: 1px solid #ede8e0; flex-shrink: 0; }
        .drawer-estado-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .drawer-estado-label { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; flex: 1; }
        .drawer-timer { font-size: 13px; font-weight: 600; }
        .drawer-scroll { overflow-y: auto; flex: 1; padding: 16px 20px; display: flex; flex-direction: column; gap: 20px; -webkit-overflow-scrolling: touch; }
        .drawer-bloque { display: flex; flex-direction: column; gap: 8px; }
        .drawer-lbl { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #b0a898; }
        .drawer-val { font-size: 15px; color: #1a1510; }
        .drawer-subval { font-size: 13px; color: #9a8f82; }
        .drawer-items { display: flex; flex-direction: column; gap: 8px; }
        .drawer-item { display: flex; gap: 10px; align-items: flex-start; }
        .drawer-item-cant { font-size: 15px; font-weight: 700; color: #c1440e; min-width: 24px; }
        .drawer-item-nombre { font-size: 15px; color: #1a1510; display: block; }
        .drawer-item-sel { font-size: 12px; color: #9a8f82; display: block; margin-top: 2px; }
        .drawer-totales { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 10px; padding: 14px; }
        .drawer-total-row { display: flex; justify-content: space-between; font-size: 14px; color: #9a8f82; padding: 4px 0; }
        .drawer-total-grande { font-size: 18px; font-weight: 700; color: #1a1510; padding: 8px 0; border-top: 1px solid #ede8e0; border-bottom: 1px solid #ede8e0; margin: 4px 0; }
        .drawer-maps { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #9a8f82; border: 1px solid #ede8e0; border-radius: 8px; padding: 8px 12px; text-decoration: none; }
        .drawer-footer { padding: 12px 20px; padding-bottom: max(12px, env(safe-area-inset-bottom)); border-top: 1px solid #ede8e0; flex-shrink: 0; }
        .drawer-btn-avanzar { width: 100%; border: none; border-radius: 10px; padding: 15px; font-size: 16px; font-weight: 700; color: #f2e9de; font-family: inherit; cursor: pointer; letter-spacing: 0.02em; }

        /* ── KANBAN DESKTOP ── */
        .kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 20px; height: calc(100vh - 57px); overflow: hidden; }
        .col { display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
        .col-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fff; border: 1px solid #ede8e0; border-top: 3px solid; border-radius: 10px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .col-label { font-size: 13px; font-weight: 600; flex: 1; color: #1a1510; }
        .col-count { font-size: 11px; font-weight: 700; color: #f2e9de; border-radius: 20px; padding: 2px 8px; }
        .col-body { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; padding-right: 2px; }
        .col-body::-webkit-scrollbar { width: 3px; }
        .col-body::-webkit-scrollbar-thumb { background: #3a3128; border-radius: 2px; }
        .col-vacia { text-align: center; color: #ccc5bb; font-size: 20px; padding: 24px 0; }

        /* Tarjeta kanban */
        .kcard { background: #fff; border: 1px solid #ede8e0; border-radius: 10px; padding: 12px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .kcard:hover { border-color: #c1320a; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .kcard-abierta { border-color: #c1440e; }
        .kcard-nueva { animation: kflash 0.8s ease; }
        @keyframes kflash { 0%{box-shadow:0 0 0 3px rgba(193,68,14,0.5)} 100%{box-shadow:none} }
        .urg-alerta  { border-left: 3px solid #b07d2a; }
        .urg-critico { border-left: 3px solid #c1440e; }
        .kcard-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .kcard-num { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; display: block; color: #1a1510; }
        .ktipo { font-size: 11px; color: #9a8f82; display: block; margin-top: 2px; }
        .kcard-meta { text-align: right; }
        .kcard-hora { font-size: 12px; color: #b0a898; display: block; }
        .kcard-timer { font-size: 11px; font-weight: 600; display: block; }
        .kcard-detalle { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .det-sep { height: 1px; background: #ede8e0; }
        .det-row { display: flex; gap: 8px; font-size: 12px; margin: 0; }
        .det-lbl { color: #b0a898; min-width: 60px; font-size: 11px; }
        .det-total { font-weight: 700; font-size: 14px; color: #1a1510; }
        .det-items { display: flex; flex-direction: column; gap: 3px; }
        .det-item { display: flex; gap: 6px; font-size: 12px; }
        .det-cant { color: #a69c8d; font-weight: 600; min-width: 18px; }
        .det-maps { font-size: 12px; color: #9a8f82; border: 1px solid #ede8e0; border-radius: 6px; padding: 5px 10px; text-decoration: none; display: inline-block; }
        .kcard-btn-avanzar { width: 100%; border: none; border-radius: 8px; padding: 9px; font-size: 12px; font-weight: 700; color: #f2e9de; font-family: inherit; cursor: pointer; margin-top: 4px; }

        .tipo-delivery { color: #e2734a; }
        .tipo-retiro   { color: #c7cdb8; }

        .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #a69c8d; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}