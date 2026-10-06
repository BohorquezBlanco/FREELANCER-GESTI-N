// ============================================================
// login.js  →  Lógica de la página de login (index.html)
// Requiere: supabase.js, sesion.js
// ============================================================

// Si ya hay sesión iniciada, redirigir directamente
getUsuario().then(usuario => {
  if (usuario && destino(usuario.tipo)) {
    location.href = destino(usuario.tipo);
  }
});


$('forms-Autentication').onsubmit = async e => {
  e.preventDefault();

  const msg = $('msg');
  msg.className = '';
  msg.textContent = 'Ingresando...';

  const email = $('email').value.trim();
  const password = $('password').value;

  // Intentar login
  const { error } = await iniciarSesion(email, password);

  if (error) {
    msg.className = 'err';
    msg.textContent = 'Correo o contraseña incorrectos.';
    return;
  }

  // Obtener datos del usuario
  const usuario = await getUsuario();

  // Login correcto en Supabase, pero usuario mal configurado
  if (!usuario || !destino(usuario.tipo)) {
    await db.auth.signOut();
    sessionStorage.removeItem('usuarioActual');

    msg.className = 'err';
    msg.textContent = !usuario
      ? 'Tu cuenta no está vinculada a un usuario del sistema. Revisa auth_id.'
      : `El tipo "${usuario.tipo_raw}" no es válido. Debe ser admin o vendedor.`;
    return;
  }

  // Todo bien → redirigir
  location.href = destino(usuario.tipo);
};