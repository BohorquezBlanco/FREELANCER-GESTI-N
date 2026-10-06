// ============================================================
// sesion.js  →  Manejo de sesión y tipo de usuario
// Requiere: supabase.js (usa la variable "db")
// ============================================================

// Atajo: $('email') en lugar de document.getElementById('email')
const $ = id => document.getElementById(id);


// ------------------------------------------------------------
// Normalizar el tipo de usuario ("Administrador" → "admin")
// ------------------------------------------------------------
function normTipo(tipo) {
  tipo = String(tipo ?? '').trim().toLowerCase();

  if (tipo.startsWith('admin')) return 'admin';
  if (tipo.startsWith('vend'))  return 'vendedor';

  return null;
}


// ------------------------------------------------------------
// Decidir a qué página redirigir según el tipo
// ------------------------------------------------------------
function destino(tipo) {
  const t = normTipo(tipo);
  return (t === 'admin' || t === 'vendedor') ? 'usuario.html' : null;
}


// ------------------------------------------------------------
// Obtener el usuario actual (sessionStorage → Supabase)
// ------------------------------------------------------------
async function getUsuario() {
  // Primero: ¿hay sesión real?
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    localStorage.removeItem('usuarioActual');
    return null;
  }

  // Luego: caché, solo si es del mismo usuario
  const guardado = localStorage.getItem('usuarioActual');
  if (guardado) {
    try {
      const u = JSON.parse(guardado);
      if (u.auth_id === session.user.id) return u;
    } catch (e) {
      localStorage.removeItem('usuarioActual');
    }
  }

  // Consultar tabla usuario (agrego auth_id para poder comparar)
  const { data, error } = await db
    .from('usuario')
    .select('id_usuario, auth_id, nombres, apellidos, tipo')
    .eq('auth_id', session.user.id)
    .maybeSingle();

  if (error || !data) return null;

  data.tipo_raw = data.tipo;
  data.tipo = normTipo(data.tipo);
  localStorage.setItem('usuarioActual', JSON.stringify(data));
  return data;
}
// ------------------------------------------------------------
// Iniciar sesión (devuelve { error })
// ------------------------------------------------------------
async function iniciarSesion(email, password) {
  return await db.auth.signInWithPassword({ email, password });
}


// ------------------------------------------------------------
// Cerrar sesión y volver al login
// ------------------------------------------------------------
async function cerrarSesion(paginaLogin = 'index.html') {
  await db.auth.signOut();
  sessionStorage.removeItem('usuarioActual');
  location.href = paginaLogin;
}


// ------------------------------------------------------------
// Proteger páginas: úsalo al inicio de usuario.html, etc.
//   const u = await requerirSesion();            // cualquiera válido
//   const u = await requerirSesion(['admin']);   // solo admin
// ------------------------------------------------------------
async function requerirSesion(tiposPermitidos = ['admin', 'vendedor'], paginaLogin = 'index.html') {
  const usuario = await getUsuario();

  if (!usuario || !tiposPermitidos.includes(usuario.tipo)) {
    location.href = paginaLogin;
    return null;
  }
  return usuario;
}