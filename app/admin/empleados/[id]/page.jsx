'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { useEmpleado } from '../../../../contexts/EmpleadoContext';

const SECCIONES = [
  { id: 'pedidos',       label: 'Pedidos' },
  { id: 'catalogo',      label: 'Catálogo' },
  { id: 'configuracion', label: 'Configuración' },
];

function calcularPermiso(actual, accion) {
  const ver    = Boolean(actual?.ver);
  const editar = Boolean(actual?.editar);
  if (accion === 'ver') return { ver: !ver, editar: !ver ? editar : false };
  const nuevoEditar = !editar;
  return { ver: nuevoEditar ? true : ver, editar: nuevoEditar };
}

export default function EditarEmpleadoPage() {
  const { id } = useParams();
  const router  = useRouter();
  const { empleado: yo } = useEmpleado();

  const [emp, setEmp]             = useState(null);
  const [nombre, setNombre]       = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [permisos, setPermisos]   = useState({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje]     = useState(null);
  const [confirmElim, setConfirmElim] = useState(false);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    const { data } = await supabase.from('empleados').select('*').eq('id', id).single();
    if (data) {
      setEmp(data);
      setNombre(data.nombre);
      setEmail(data.email || '');
      setPermisos(data.permisos || {});
    }
  }

  function setMsg(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 3000);
  }

  function togglePermiso(seccionId, accion) {
    setPermisos(prev => ({ ...prev, [seccionId]: calcularPermiso(prev[seccionId], accion) }));
  }

  async function guardarDatos(e) {
    e.preventDefault();
    setGuardando(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const body = {};
    if (nombre !== emp.nombre) body.nombre = nombre;
    if (email !== (emp.email || '')) body.email = email;
    if (password) body.password = password;

    if (Object.keys(body).length > 0) {
      const res = await fetch(`/api/empleados/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setGuardando(false); setMsg('error', data.error); return; }
    }

    setGuardando(false);
    setPassword('');
    cargar();
    setMsg('ok', 'Datos guardados.');
  }

  async function guardarPermisos() {
    setGuardando(true);
    await supabase.from('empleados').update({ permisos }).eq('id', id);
    setGuardando(false);
    setMsg('ok', 'Permisos actualizados.');
  }

  async function eliminarEmpleado() {
    // Borra la fila de empleados (el usuario de Auth queda deshabilitado sin acceso)
    await supabase.from('empleados').delete().eq('id', id);
    router.push('/admin/empleados');
  }

  if (yo.rol !== 'dueño') return <div className="sin-acceso">Solo el dueño puede editar empleados.</div>;
  if (!emp) return <div className="cargando">Cargando…</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin/empleados">← Empleados</a>
      <header>
        <span className="eyebrow">Empleados</span>
        <h1>{emp.nombre}</h1>
        {!emp.activo && <span className="badge-inactivo">Inactivo</span>}
      </header>

      {/* Datos personales */}
      <section className="tarjeta">
        <h2>Datos de acceso</h2>
        <form className="form" onSubmit={guardarDatos}>
          <label className="campo">
            <span>Nombre</span>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required />
          </label>
          <label className="campo">
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="campo">
            <span>Nueva contraseña (dejá vacío para no cambiar)</span>
            <input type="password" value={password} minLength={6} placeholder="••••••" onChange={e => setPassword(e.target.value)} />
          </label>
          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar datos'}
          </button>
          {mensaje && <p className={`aviso aviso-${mensaje.tipo}`}>{mensaje.texto}</p>}
        </form>
      </section>

      {/* Permisos */}
      {emp.rol !== 'dueño' && (
        <section className="tarjeta">
          <h2>Permisos</h2>
          <div className="permisos-lista">
            {SECCIONES.map(s => (
              <div key={s.id} className="permiso-fila">
                <span className="permiso-nombre">{s.label}</span>
                <label className="check">
                  <input type="checkbox" checked={Boolean(permisos[s.id]?.ver)} onChange={() => togglePermiso(s.id, 'ver')} />
                  Ver
                </label>
                <label className="check">
                  <input type="checkbox" checked={Boolean(permisos[s.id]?.editar)} onChange={() => togglePermiso(s.id, 'editar')} />
                  Editar
                </label>
              </div>
            ))}
          </div>
          <button className="btn-guardar-permisos" onClick={guardarPermisos} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar permisos'}
          </button>
        </section>
      )}

      {/* Zona de peligro */}
      {emp.rol !== 'dueño' && (
        <section className="tarjeta tarjeta-danger">
          <h2>Zona de peligro</h2>
          <p className="danger-desc">Eliminar este empleado borra su acceso al sistema permanentemente.</p>
          {confirmElim ? (
            <div className="confirm-elim">
              <span>¿Estás seguro? Esta acción no se puede deshacer.</span>
              <div className="confirm-btns">
                <button className="btn-elim-si" onClick={eliminarEmpleado}>Sí, eliminar</button>
                <button className="btn-cancelar" onClick={() => setConfirmElim(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button className="btn-elim" onClick={() => setConfirmElim(true)}>Eliminar empleado</button>
          )}
        </section>
      )}

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 520px; margin: 0 auto 24px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 24px; margin: 0 0 6px; }
        .badge-inactivo { font-size: 11px; color: #b0a898; background: rgba(107,113,86,0.15); border-radius: 20px; padding: 2px 8px; }
        .tarjeta { max-width: 520px; margin: 0 auto 16px; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 24px; }
        .tarjeta h2 { font-family: 'Fraunces', serif; font-size: 17px; margin: 0 0 16px; }
        .tarjeta-danger { border-color: rgba(156,58,58,0.4); }
        .form { display: flex; flex-direction: column; gap: 14px; }
        .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #9a8f82; }
        .campo input { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; }
        .campo input:focus-visible { border-color: #c1320a; box-shadow: 0 0 0 3px rgba(193,50,10,0.2); }
        button[type='submit'] { background: #c1440e; color: #1a1510; border: none; border-radius: 8px; padding: 12px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; }
        button[type='submit']:disabled { opacity: 0.5; cursor: default; }
        .aviso { font-size: 13px; padding: 10px 12px; border-radius: 8px; margin: 0; }
        .aviso-ok { background: rgba(107,113,86,0.15); border: 1px solid rgba(107,113,86,0.5); color: #c7cdb8; }
        .aviso-error { background: rgba(226,87,76,0.12); border: 1px solid rgba(226,87,76,0.4); color: #e2574c; }
        .permisos-lista { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
        .permiso-fila { display: flex; align-items: center; gap: 16px; background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 14px; }
        .permiso-nombre { flex: 1; font-size: 14px; }
        .check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #9a8f82; cursor: pointer; }
        .check input { accent-color: #c1320a; }
        .btn-guardar-permisos { background: #8a9070; border: none; color: #1a1510; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-family: inherit; cursor: pointer; }
        .btn-guardar-permisos:disabled { opacity: 0.5; cursor: default; }
        .danger-desc { font-size: 13px; color: #9a8f82; margin: 0 0 14px; line-height: 1.5; }
        .confirm-elim { display: flex; flex-direction: column; gap: 12px; font-size: 13px; color: #e2574c; }
        .confirm-btns { display: flex; gap: 8px; }
        .btn-elim { background: transparent; border: 1px solid #9c3a3a; color: #e2574c; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-family: inherit; cursor: pointer; }
        .btn-elim-si { background: #9c3a3a; border: none; color: #1a1510; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-family: inherit; cursor: pointer; }
        .btn-cancelar { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-family: inherit; cursor: pointer; }
        .cargando, .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}