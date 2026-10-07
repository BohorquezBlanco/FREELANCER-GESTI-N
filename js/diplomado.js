// ============================================================
// diplomados.js: mostrar, añadir y editar diplomados
// ============================================================
let DIPLOMADOS_DATA = [];

// ---------- CARGAR Y MOSTRAR ----------
async function mostrarDiplomados() {
  const { data, error } = await listar('diplomado', {});
  if (error) { console.error('Error al cargar diplomados:', error.message); return; }

  // gestión más reciente primero, luego por nombre
  DIPLOMADOS_DATA = (data ?? []).sort((a, b) =>
    valorGestion(b.gestion) - valorGestion(a.gestion) ||
    a.nombre_diplomado.localeCompare(b.nombre_diplomado, 'es'));

  renderDiplomados();
}

function renderDiplomados() {
  const cuerpo = el('tableBodyDiplomados');

  cuerpo.innerHTML = DIPLOMADOS_DATA.map((d, i) => {
    const abierto = d.estado_diplomado === 'abierto';
    return `
      <tr>
        <td class="ps-4">${i + 1}</td>
        <td class="fw-medium text-dark">${esc(d.nombre_diplomado)}</td>
        <td>${esc(d.gestion)}</td>
        <td>
          <span class="badge ${abierto ? 'bg-success' : 'bg-secondary'}">
            ${abierto ? 'Abierto' : 'Cerrado'}
          </span>
        </td>
        <td class="text-end pe-4">
          <button class="btn btn-sm btn-light text-success me-1"
                  onclick="openDiplomadoModal('${d.id_diplomado}')" title="Editar">
            <i class="bi bi-pencil-fill"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  el('diplomadosEmptyState').classList.toggle('d-none', DIPLOMADOS_DATA.length > 0);
}

// ---------- ABRIR MODAL (añadir o editar) ----------
function openDiplomadoModal(id = null) {
  const isEdit = id !== null && id !== '';

  el('formDiplomado').reset();
  el('dipId').value = isEdit ? id : '';
  el('modalDiplomadoTitle').textContent = isEdit ? 'Editar Diplomado' : 'Añadir Diplomado';

  // sugerencias de gestión: vigente y próxima
  el('dipGestionesList').innerHTML =
    gestionesVigentes().map(g => `<option value="${g}">`).join('');

  if (isEdit) {
    const d = DIPLOMADOS_DATA.find(x => String(x.id_diplomado) === String(id));
    if (!d) { alert('No se encontró el diplomado'); return; }

    el('dipNombre').value  = d.nombre_diplomado;
    el('dipGestion').value = d.gestion;
    el('dipEstado').value  = d.estado_diplomado;
  } else {
    el('dipGestion').value = gestionesVigentes()[0];
    el('dipEstado').value  = 'abierto';
  }

  bootstrap.Modal.getOrCreateInstance(el('modalDiplomado')).show();
}

// ---------- GUARDAR (el id oculto decide: crear o actualizar) ----------
el('formDiplomado').addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const btn = el('btnGuardarDiplomado');
  btn.disabled = true;

  try {
    const id      = el('dipId').value;            // '' = añadir
    const nombre  = el('dipNombre').value.trim();
    const gestion = el('dipGestion').value.trim();
    const estado  = el('dipEstado').value;

    // evitar duplicados: mismo nombre y gestión (excluyendo el propio al editar)
    const duplicado = DIPLOMADOS_DATA.some(d =>
      String(d.id_diplomado) !== String(id) &&
      normalizar(d.nombre_diplomado) === normalizar(nombre) &&
      d.gestion === gestion);
    if (duplicado) { alert('Ya existe ese diplomado en esa gestión'); return; }

    const datos = { nombre_diplomado: nombre, gestion, estado_diplomado: estado };

    if (id) {
      // ---------- EDITAR ----------
      const { error } = await db.from('diplomado').update(datos).eq('id_diplomado', id);
      if (error) {
        console.error('Error al actualizar diplomado:', error.message);
        alert('No se pudo actualizar el diplomado');
        return;
      }
    } else {
      // ---------- AÑADIR ----------
      const { error } = await crear('diplomado', datos);
      if (error) {
        console.error('Error al crear diplomado:', error.message);
        alert('No se pudo guardar el diplomado');
        return;
      }
    }

    bootstrap.Modal.getInstance(el('modalDiplomado'))?.hide();
    await mostrarDiplomados();
    if (typeof mostrarMensaje === 'function')
      mostrarMensaje(id ? 'Diplomado actualizado' : 'Diplomado guardado');

  } finally {
    btn.disabled = false;
  }
});

mostrarDiplomados();