import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

async function obtenerDueñoDesdeToken(token) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) return null;

  const { data: solicitante } = await supabaseAdmin
    .from('empleados')
    .select('rol, activo')
    .eq('user_id', userData.user.id)
    .single();

  if (solicitante?.rol !== 'dueño' || !solicitante.activo) return null;
  return userData.user;
}

export async function PATCH(request, { params }) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const dueño = await obtenerDueñoDesdeToken(token);
    if (!dueño) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = params;
    const { nombre, email, password } = await request.json();

    const { data: empleado, error: empleadoError } = await supabaseAdmin
      .from('empleados')
      .select('user_id')
      .eq('id', id)
      .single();

    if (empleadoError || !empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Si vino email o contraseña nuevos, actualizamos el usuario de autenticación
    if (email || password) {
      const cambiosAuth = {};
      if (email) cambiosAuth.email = email;
      if (password) {
        if (password.length < 6) {
          return NextResponse.json(
            { error: 'La contraseña debe tener al menos 6 caracteres' },
            { status: 400 }
          );
        }
        cambiosAuth.password = password;
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        empleado.user_id,
        cambiosAuth
      );
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    // Actualizamos nombre y/o email en la tabla empleados
    const cambiosTabla = {};
    if (nombre) cambiosTabla.nombre = nombre;
    if (email) cambiosTabla.email = email;

    if (Object.keys(cambiosTabla).length > 0) {
      const { error: tablaError } = await supabaseAdmin
        .from('empleados')
        .update(cambiosTabla)
        .eq('id', id);
      if (tablaError) {
        return NextResponse.json({ error: tablaError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Error inesperado del servidor' }, { status: 500 });
  }
}