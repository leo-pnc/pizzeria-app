'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { useEmpleado } from '../../../../contexts/EmpleadoContext';

const SECCIONES = [
  { id: 'pedidos',       label: 'Pedidos' },
  { id: 'catalogo',      label: 'Catálogo' },
  { id: 'configuracion', label: 'Configuración' },
];

function permisosVacios() {
  return SECCIONES.reduce((acc, s) => { acc[s.id] = { ver: false, editar: false }; return acc; }, {});
}

function calcularPermiso(actual, accion) {
  const ver    = Boolean(actual?.ver);
  const editar = Boolean(actual?.editar);
  if (accion === 'ver') return { ver: !ver, editar: !ver ? editar : false };
  const nuevoEditar = !editar;
  return { ver: nuevoEditar ? true : ver, editar: nuevoEditar };
}

export default function NuevoEmpleadoPage() {
  const { empleado } = useEmpleado();
  const router = useRouter();

  const [form, setForm]               = useState({ nombre: '', email: '', password: '', permisos: permisosVacios() });
  const [mostrarPass, setMostrarPass] = useState(false);
  const [enviando, setEnviando]       = useState(false);
  const [error, setError]             = useState('');

  if (empleado.rol !== 'dueño') return <div className="sin-acceso">Solo el dueño puede crear empleados.</div>;

  function togglePermiso(seccionId, accion) {
    setForm(prev => ({
      ...prev,
      permisos: { ...prev.permisos, [seccionId]: calcularPermiso(prev.permisos[seccionId], accion) },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Completá todos los campos obligatorios.'); return;
    }
    setError('');
    setEnviando(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch('/api/empleados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setEnviando(false);

    if (!res.ok) { setError(data.error || 'No se pudo crear el empleado.'); return; }
    router.push('/admin/empleados');
  }

  return (
    <div className="pagina">
      <a className="volver" href="/admin/empleados">← Empleados</a>
      <header><span className="eyebrow">Empleados</span><h1>Nuevo empleado</h1></header>

      <form className="tarjeta" onSubmit={handleSubmit}>
        <label className="campo">
          <span>Nombre *</span>
          <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required />
        </label>
        <label className="campo">
          <span>Email *</span>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
        </label>
        <label className="campo">
          <span>Contraseña *</span>
          <div className="campo-pass">
            <input
              type={mostrarPass ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              minLength={6} required
            />
            <button type="button" className="btn-ojo" onClick={() => setMostrarPass(v => !v)}>
              {mostrarPass ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        <div className="permisos-bloque">
          <span className="permisos-titulo">Permisos</span>
          {SECCIONES.map(s => (
            <div key={s.id} className="permiso-fila">
              <span className="permiso-nombre">{s.label}</span>
              <label className="check">
                <input type="checkbox" checked={form.permisos[s.id].ver} onChange={() => togglePermiso(s.id, 'ver')} />
                Ver
              </label>
              <label className="check">
                <input type="checkbox" checked={form.permisos[s.id].editar} onChange={() => togglePermiso(s.id, 'editar')} />
                Editar
              </label>
            </div>
          ))}
        </div>

        {error && <p className="aviso aviso-error">{error}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear empleado'}
        </button>
      </form>

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 520px; margin: 0 auto 24px; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 24px; margin: 0; }
        .tarjeta { max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #ede8e0; border-radius: 14px; padding: 28px; display: flex; flex-direction: column; gap: 16px; }
        .campo { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #9a8f82; }
        .campo input { background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 12px; font-size: 15px; color: #1a1510; font-family: inherit; outline: none; width: 100%; }
        .campo input:focus-visible { border-color: #c1320a; box-shadow: 0 0 0 3px rgba(193,50,10,0.2); }
        .campo-pass { display: flex; gap: 8px; }
        .campo-pass input { flex: 1; }
        .btn-ojo { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 8px; padding: 10px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; font-family: inherit; }
        .btn-ojo:hover { border-color: #c1320a; color: #1a1510; }
        .permisos-bloque { display: flex; flex-direction: column; gap: 8px; }
        .permisos-titulo { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #9a8f82; }
        .permiso-fila { display: flex; align-items: center; gap: 16px; background: #f7f5f2; border: 1px solid #ede8e0; border-radius: 8px; padding: 10px 14px; }
        .permiso-nombre { flex: 1; font-size: 14px; }
        .check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #9a8f82; cursor: pointer; }
        .check input { accent-color: #c1320a; }
        button[type='submit'] { background: #c1440e; color: #1a1510; border: none; border-radius: 8px; padding: 13px; font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; margin-top: 4px; }
        button[type='submit']:disabled { opacity: 0.5; cursor: default; }
        .aviso { font-size: 13px; padding: 10px 12px; border-radius: 8px; margin: 0; }
        .aviso-error { background: rgba(226,87,76,0.12); border: 1px solid rgba(226,87,76,0.4); color: #e2574c; }
        .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}