import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Identificar quién está haciendo el pedido
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Confirmar que quien pide esto es el dueño (no cualquier empleado logueado)
    const { data: solicitante, error: solicitanteError } = await supabaseAdmin
      .from('empleados')
      .select('rol, activo')
      .eq('user_id', userData.user.id)
      .single();

    if (solicitanteError || solicitante?.rol !== 'dueño' || !solicitante.activo) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { email, password, nombre, permisos } = await request.json();

    if (!email || !password || !nombre) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Crear el usuario de autenticación (ya confirmado, no manda mail de verificación)
    const { data: nuevoUsuario, error: crearUsuarioError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (crearUsuarioError) {
      return NextResponse.json({ error: crearUsuarioError.message }, { status: 400 });
    }

    // Crear su fila en "empleados" con los permisos que definió el dueño
    const { error: insertError } = await supabaseAdmin.from('empleados').insert({
      user_id: nuevoUsuario.user.id,
      nombre,
      email,
      rol: 'empleado',
      permisos: permisos ?? {},
      activo: true,
    });

    if (insertError) {
      // Si falla el insert, deshacemos la creación del usuario para no dejar cuentas huérfanas
      await supabaseAdmin.auth.admin.deleteUser(nuevoUsuario.user.id);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Error inesperado del servidor' }, { status: 500 });
  }
}