'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useEmpleado } from '../../../contexts/EmpleadoContext';

export default function EmpleadosPage() {
  const { empleado } = useEmpleado();
  const [empleados, setEmpleados] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    const { data } = await supabase
      .from('empleados').select('*').order('created_at', { ascending: true });
    if (data) setEmpleados(data);
  }

  async function toggleActivo(emp) {
    setEmpleados(prev => prev.map(e => e.id === emp.id ? { ...e, activo: !e.activo } : e));
    await supabase.from('empleados').update({ activo: !emp.activo }).eq('id', emp.id);
  }

  if (empleado.rol !== 'dueño') return <div className="sin-acceso">Solo el dueño puede ver esta sección.</div>;

  return (
    <div className="pagina">
      <a className="volver" href="/admin">← Volver al panel</a>

      <header>
        <div>
          <span className="eyebrow">Panel interno</span>
          <h1>Empleados</h1>
        </div>
        <a className="btn-nuevo" href="/admin/empleados/nuevo">+ Nuevo empleado</a>
      </header>

      <div className="lista">
        {empleados === null && <p className="cargando">Cargando…</p>}
        {empleados?.length === 0 && <p className="cargando">No hay empleados todavía.</p>}

        {empleados?.map(emp => (
          <div key={emp.id} className={`fila ${!emp.activo ? 'inactiva' : ''}`}>
            <div className="fila-info">
              <span className="fila-nombre">{emp.nombre}</span>
              <span className="fila-email">{emp.email || '—'}</span>
              {emp.rol === 'dueño' && <span className="badge-dueño">Dueño</span>}
              {!emp.activo && <span className="badge-inactivo">Inactivo</span>}
            </div>
            <div className="fila-acciones">
              {emp.rol !== 'dueño' && (
                <>
                  <a className="btn-accion" href={`/admin/empleados/${emp.id}`}>Editar</a>
                  <button className="btn-accion" onClick={() => toggleActivo(emp)}>
                    {emp.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .pagina { min-height: 100vh; background: #f7f5f2; color: #1a1510; font-family: 'Work Sans', system-ui, sans-serif; padding: 32px 24px 64px; }
        .volver { display: inline-block; color: #9a8f82; text-decoration: none; font-size: 13px; margin-bottom: 20px; }
        .volver:hover { color: #1a1510; }
        header { max-width: 640px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .eyebrow { display: block; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a8f82; margin-bottom: 6px; }
        h1 { font-family: 'Fraunces', serif; font-weight: 600; font-size: 24px; margin: 0; }
        .btn-nuevo { background: #c1440e; color: #1a1510; text-decoration: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 600; white-space: nowrap; }
        .lista { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
        .fila { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #ede8e0; border-radius: 12px; padding: 14px 18px; flex-wrap: wrap; }
        .fila.inactiva { opacity: 0.5; }
        .fila-info { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .fila-nombre { font-size: 15px; font-weight: 600; }
        .fila-email { font-size: 13px; color: #9a8f82; }
        .badge-dueño { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; background: rgba(193,50,10,0.15); color: #e2734a; border-radius: 20px; padding: 2px 8px; width: fit-content; }
        .badge-inactivo { font-size: 11px; color: #b0a898; background: rgba(107,113,86,0.15); border-radius: 20px; padding: 2px 8px; width: fit-content; }
        .fila-acciones { display: flex; gap: 6px; flex-wrap: wrap; }
        .btn-accion { background: transparent; border: 1px solid #ede8e0; color: #9a8f82; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; font-family: inherit; text-decoration: none; white-space: nowrap; }
        .btn-accion:hover { border-color: #9a8f82; color: #1a1510; }
        .cargando { color: #9a8f82; font-size: 14px; }
        .sin-acceso { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f7f5f2; color: #9a8f82; font-family: 'Work Sans', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}