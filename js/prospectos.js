async function mostrarProspectos() {
  const usuario = await getUsuario();

  if (!usuario) {
    location.href = 'index.html';
    return;
  }

  // Admin ve todo; vendedor solo lo suyo
  const filtros = usuario.tipo === 'admin'
    ? {}
    : { id_vendedor: usuario.id_usuario };

  // más reciente primero (requiere el 4.º parámetro en listar, ver nota abajo)
  const { data, error } = await listar("v_prospectos_plano", filtros, "created_at", false);

  if (error) {
    console.error("Error al cargar:", error.message);
    return;
  }

  // ---------- AGRUPAR: 1 prospecto con sus diplomados y estados ----------
  const mapa = new Map();

  for (const fila of data) {
    if (!mapa.has(fila.id_prospecto)) {
      mapa.set(fila.id_prospecto, { ...fila, diplomados: [], estados: [] });
    }
    const p = mapa.get(fila.id_prospecto);

    if (fila.id_diplomado && !p.diplomados.some(d => d.id_diplomado === fila.id_diplomado)) {
      p.diplomados.push({
        id_diplomado: fila.id_diplomado,
        nombre_diplomado: fila.nombre_diplomado,
        gestion: fila.gestion,
        matriculado: fila.matriculado
      });
    }

    if (fila.id_estado && !p.estados.some(e => e.id_estado === fila.id_estado)) {
      p.estados.push({
        id_estado: fila.id_estado,
        nombre: fila.nombre_estado
      });
    }
  }

  const prospectos = [...mapa.values()];

  // ---------- RENDER ----------
  const cuerpo = document.getElementById("tabla-prospectos");
  let filas = "";

  prospectos.forEach((p, i) => {

    // ciclo interno: diplomados
    let diplomadosHTML = "";
    p.diplomados.forEach(d => {
      const mat = d.matriculado === true;

      const estilo = mat
        ? 'background:rgba(25,135,84,.15);color:#198754;border:1px solid rgba(25,135,84,.5);'
        : 'background:rgba(220,53,69,.12);color:#dc3545;border:1px solid rgba(220,53,69,.5);';

      const texto = mat ? 'Matriculado' : 'No matriculado';
      const icono = mat ? 'bi-check-circle-fill' : 'bi-x-circle-fill';

      diplomadosHTML += `
        <div class="mb-2">
          <div class="small fw-medium mb-1" style="white-space:normal;word-break:break-word;">
            ${d.nombre_diplomado} (${d.gestion})
          </div>
          <button type="button"
                  class="btn btn-sm d-inline-flex align-items-center gap-1 rounded-pill px-2 py-0"
                  style="${estilo} font-size:.75rem;"
                  title="Clic para cambiar"
                  onclick="toggleMatricula('${p.id_prospecto}', '${d.id_diplomado}', ${mat})">
            <i class="bi ${icono}"></i> ${texto}
          </button>
        </div>`;
    });
    if (!diplomadosHTML) diplomadosHTML = '<span class="text-muted">Sin diplomados</span>';

    // ciclo interno: estados
    let estadosHTML = "";
    p.estados.forEach(e => {
      estadosHTML += `
        <span class="badge ${getBadgeClass(e.nombre)} me-1">
          ${e.nombre}
        </span>`;
    });
    if (!estadosHTML) estadosHTML = '<span class="text-muted">Sin calificar</span>';

    filas += `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(p.created_at).toLocaleString("es-BO")}</td>
        <td>
          <a href="https://wa.me/${p.telefono}" target="_blank"
             class="text-white text-decoration-none fw-medium d-inline-flex align-items-center gap-1 bg-success bg-opacity-10 px-2 py-1 rounded-pill">
            <i class="bi bi-whatsapp"></i> ${p.telefono}
          </a>
        </td>
        <td class="fw-medium text-dark">${p.nombres}</td>
        <td style="min-width: 260px;">${diplomadosHTML}</td>
        <td>${estadosHTML}</td>
        <td class="text-end pe-4">
          <button class="btn btn-sm btn-light text-success me-1"
                  onclick="openProspectoModal('${p.id_prospecto}')" title="Editar">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-light text-danger"
                  onclick="confirmDelete('prospecto', '${p.id_prospecto}')" title="Eliminar">
            <i class="bi bi-trash-fill"></i>
          </button>
        </td>
      </tr>
    `;
  });

  cuerpo.innerHTML = filas || `<tr><td colspan="7" class="text-center text-muted">Sin prospectos</td></tr>`;
}

async function toggleMatricula(idProspecto, idDiplomado, estaMatriculado) {
  const nuevo = !estaMatriculado;

  const { error } = await db
    .from("prospecto_diplomado")
    .update({
      matriculado: nuevo,
      fecha_matricula: nuevo ? new Date().toISOString() : null
    })
    .eq("id_prospecto", idProspecto)
    .eq("id_diplomado", idDiplomado);

  if (error) {
    console.error("Error al actualizar matrícula:", error.message);
    alert("No se pudo actualizar la matrícula");
    return;
  }

  mostrarProspectos();
}

mostrarProspectos();



//matricular
async function toggleMatricula(idProspecto, idDiplomado, estaMatriculado) {
  const nuevo = !estaMatriculado;

  const { error } = await db
    .from("prospecto_diplomado")
    .update({
      matriculado: nuevo,
    })
    .eq("id_prospecto", idProspecto)
    .eq("id_diplomado", idDiplomado);

  if (error) {
    console.error("Error al actualizar matrícula:", error.message);
    alert("No se pudo actualizar la matrícula");
    return;
  }

  mostrarProspectos();
}

