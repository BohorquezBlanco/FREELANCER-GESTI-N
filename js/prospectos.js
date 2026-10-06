async function mostrarProspectos() {
  const usuario = await getUsuario();   // ← tu función de sesion.js

  if (!usuario) {
    location.href = 'index.html';       // sin sesión → al login
    return;
  }

  // Admin ve todo; vendedor solo lo suyo
  const filtros = usuario.tipo === 'admin'
    ? {}
    : { id_vendedor: usuario.id_usuario };

  const { data, error } = await listar("prospecto", filtros, "nombres");

  if (error) {
    console.error("Error al cargar:", error.message);
    return;
  }

  const cuerpo = document.getElementById("tabla-prospectos");
  let filas = "";

  data.forEach((p, i) => {
    filas += `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(p.created_at).toLocaleString("es-BO")}</td>
        <td>${p.telefono}</td>
        <td>${p.nombres}</td>
      </tr>
    `;
  });

  cuerpo.innerHTML = filas;
}

mostrarProspectos();