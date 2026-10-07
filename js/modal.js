// ============================================================
// agregar.js: añadir prospectos (admin y vendedor)
// Admin  -> id_vendedor = null (sin asignar)
// Vendedor -> id_vendedor = su propio id_usuario
// ============================================================

// Abre el modal limpio y carga estados y diplomados
async function abrirNuevoProspecto() {
  el('formProspecto').reset();
  el('prosId').value = '';
  el('modalProspectoTitle').textContent = 'Añadir Prospecto';

  // fecha de hoy por defecto (hora de La Paz)
  el('prosFecha').value = new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });

  // estados desde la base
  const { data: estados } = await listar('estado', {}, 'nombre');
  el('prosEstado').innerHTML =
    `<option value="">Sin calificar</option>` +
    (estados ?? []).map(e => `<option value="${e.id_estado}">${esc(e.nombre)}</option>`).join('');

  // diplomados abiertos, gestión más reciente primero
  const { data: dips } = await listar('diplomado', { estado_diplomado: 'abierto' });
  const lista = (dips ?? []).sort((a, b) =>
    valorGestion(b.gestion) - valorGestion(a.gestion) ||
    a.nombre_diplomado.localeCompare(b.nombre_diplomado, 'es'));

  el('prosDiplomadosContainer').innerHTML = lista.length
    ? lista.map(d => `
        <div class="form-check">
          <input class="form-check-input pros-dip" type="checkbox"
                 value="${d.id_diplomado}" id="dip_${d.id_diplomado}">
          <label class="form-check-label" for="dip_${d.id_diplomado}">
            ${esc(d.nombre_diplomado)} (${esc(d.gestion)})
          </label>
        </div>`).join('')
    : '<span class="text-muted">No hay diplomados abiertos</span>';

    
  bootstrap.Modal.getOrCreateInstance(el('modalProspecto')).show();


  
}

// Guardar
el('formProspecto').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (el('prosId').value) return;   // si trae id es edición, no se maneja aquí

  const btn = el('btnGuardarProspecto');
  btn.disabled = true;

  try {
    const usuario = await getUsuario();
    if (!usuario) { location.href = 'index.html'; return; }

    const telefono = el('prosTelefono').value.replace(/\D/g, '');
    const nombres = el('prosNombre').value.trim();

    // evitar duplicados por teléfono (entre los prospectos que este usuario ve)
    if (PROSPECTOS_DATA.some(p => (p.telefono ?? '').toString().replace(/\D/g, '') === telefono)) {
      alert('Ya existe un prospecto con ese teléfono');
      return;
    }

    // fecha elegida + hora actual
    const [y, m, d] = el('prosFecha').value.split('-').map(Number);
    const ahora = new Date();
    const creado = new Date(y, m - 1, d, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds());

    const nuevo = {
      nombres,
      telefono,
      created_at: creado.toISOString()
    };
    // vendedor: queda a su nombre | admin: sin asignar
    if (usuario.tipo !== 'admin') nuevo.id_vendedor = usuario.id_usuario;

    const { data, error } = await crear('prospecto', nuevo);
    if (error || !data?.length) {
      console.error('Error al crear prospecto:', error?.message);
      alert('No se pudo guardar el prospecto');
      return;
    }
    const idProspecto = data[0].id_prospecto;

    // estado (opcional)
    const idEstado = el('prosEstado').value;
    // diplomados marcados
    const idsDip = [...document.querySelectorAll('.pros-dip:checked')].map(c => c.value);

    let fallo = null;

    if (idEstado) {
      const r = await crear('prospecto_estado', { id_prospecto: idProspecto, id_estado: idEstado });
      if (r.error) fallo = r.error;
    }
    if (!fallo && idsDip.length) {
      const r = await crear('prospecto_diplomado',
        idsDip.map(id => ({ id_prospecto: idProspecto, id_diplomado: id })));
      if (r.error) fallo = r.error;
    }

    // si falló una relación, se deshace el prospecto para no dejarlo incompleto
    if (fallo) {
      console.error('Error al guardar relaciones:', fallo.message);
      await eliminar('prospecto', 'id_prospecto', idProspecto);
      alert('No se pudo guardar el estado o los diplomados. No se creó el prospecto.');
      return;
    }

    bootstrap.Modal.getInstance(el('modalProspecto'))?.hide();
    await mostrarProspectos();   // recarga la tabla conservando los filtros
    if (typeof mostrarMensaje === 'function') mostrarMensaje('Prospecto guardado');

  } finally {
    btn.disabled = false;
  }
});



// ============================================================
// editar.js: editar prospectos
// ============================================================

let EDIT_ORIG = { estados: [], diplomados: [] };  // selección original

// Helper: borra filas de una tabla relación para un prospecto
// y una lista de valores de la otra columna.
// (cambia "supabase" por el nombre real de tu cliente)
async function eliminarRelacion(tabla, idProspecto, columna, valores) {
  if (!valores.length) return { error: null };
  return await db.from(tabla).delete()
    .eq('id_prospecto', idProspecto)
    .in(columna, valores);
}

// Helper: actualizar (si ya lo tienes, no lo repitas)
async function actualizar(tabla, columna, valor, cambios) {
  return await db.from(tabla).update(cambios).eq(columna, valor).select();
}

// ---------- ABRIR ----------
async function abrirEditarProspecto(id) {
  const p = PROSPECTOS_DATA.find(x => String(x.id_prospecto) === String(id));
  if (!p) { alert('No se encontró el prospecto'); return; }

  el('formEditarProspecto').reset();
  el('editId').value = id;

  // datos básicos
  el('editNombre').value   = p.nombres ?? '';
  el('editTelefono').value = p.telefono ?? '';
  el('editFecha').value    = new Date(p.created_at)
    .toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });

  // catálogos + lo que el prospecto tiene ahora (en paralelo)
  const [rEst, rPE, rDip, rPD] = await Promise.all([
    listar('estado', {}, 'nombre'),
    listar('prospecto_estado', { id_prospecto: id }),
    listar('diplomado', {}),
    listar('prospecto_diplomado', { id_prospecto: id })
  ]);

  const estSel = (rPE.data ?? []).map(x => String(x.id_estado));
  const dipSel = (rPD.data ?? []).map(x => String(x.id_diplomado));
  EDIT_ORIG = { estados: estSel, diplomados: dipSel };

  // estados: checks, marcados los que ya tiene
  const estados = rEst.data ?? [];
  el('editEstadosContainer').innerHTML = estados.length
    ? estados.map(e => `
        <div class="form-check">
          <input class="form-check-input edit-est" type="checkbox"
                 value="${e.id_estado}" id="editEst_${e.id_estado}"
                 ${estSel.includes(String(e.id_estado)) ? 'checked' : ''}>
          <label class="form-check-label" for="editEst_${e.id_estado}">${esc(e.nombre)}</label>
        </div>`).join('')
    : '<span class="text-muted">No hay estados creados</span>';

  // diplomados: los abiertos + los que ya tiene (aunque estén cerrados)
  const lista = (rDip.data ?? [])
    .filter(d => d.estado_diplomado === 'abierto' || dipSel.includes(String(d.id_diplomado)))
    .sort((a, b) =>
      valorGestion(b.gestion) - valorGestion(a.gestion) ||
      a.nombre_diplomado.localeCompare(b.nombre_diplomado, 'es'));

  el('editDiplomadosContainer').innerHTML = lista.length
    ? lista.map(d => `
        <div class="form-check">
          <input class="form-check-input edit-dip" type="checkbox"
                 value="${d.id_diplomado}" id="editDip_${d.id_diplomado}"
                 ${dipSel.includes(String(d.id_diplomado)) ? 'checked' : ''}>
          <label class="form-check-label" for="editDip_${d.id_diplomado}">
            ${esc(d.nombre_diplomado)} (${esc(d.gestion)})
          </label>
        </div>`).join('')
    : '<span class="text-muted">No hay diplomados</span>';

  bootstrap.Modal.getOrCreateInstance(el('modalEditarProspecto')).show();
}

// ---------- GUARDAR ----------
el('formEditarProspecto').addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const btn = el('btnGuardarEdicion');
  btn.disabled = true;

  try {
    const id       = el('editId').value;
    const telefono = el('editTelefono').value.replace(/\D/g, '');
    const nombres  = el('editNombre').value.trim();
    const fecha    = el('editFecha').value;

    // duplicado por teléfono (excluyendo al propio prospecto)
    const duplicado = PROSPECTOS_DATA.some(p =>
      String(p.id_prospecto) !== String(id) &&
      (p.telefono ?? '').toString().replace(/\D/g, '') === telefono);
    if (duplicado) { alert('Ya existe otro prospecto con ese teléfono'); return; }

    // 1) datos básicos
    const cambios = { nombres, telefono };

    // created_at solo se toca si cambió el DÍA (así se conserva la hora original)
    const p = PROSPECTOS_DATA.find(x => String(x.id_prospecto) === String(id));
    const fechaOriginal = new Date(p.created_at)
      .toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
    if (fecha !== fechaOriginal) {
      const [y, m, d] = fecha.split('-').map(Number);
      const ahora = new Date();
      cambios.created_at = new Date(y, m - 1, d,
        ahora.getHours(), ahora.getMinutes(), ahora.getSeconds()).toISOString();
    }

    const up = await actualizar('prospecto', 'id_prospecto', id, cambios);
    if (up.error) {
      console.error(up.error.message);
      alert('No se pudo actualizar el prospecto');
      return;
    }

    // 2) relaciones: comparar original vs. nuevo
    const nuevosE = [...document.querySelectorAll('.edit-est:checked')].map(c => c.value);
    const nuevosD = [...document.querySelectorAll('.edit-dip:checked')].map(c => c.value);

    const quitarE  = EDIT_ORIG.estados.filter(x => !nuevosE.includes(x));
    const agregarE = nuevosE.filter(x => !EDIT_ORIG.estados.includes(x));
    const quitarD  = EDIT_ORIG.diplomados.filter(x => !nuevosD.includes(x));
    const agregarD = nuevosD.filter(x => !EDIT_ORIG.diplomados.includes(x));

    const errores = [];

    let r = await eliminarRelacion('prospecto_estado', id, 'id_estado', quitarE);
    if (r.error) errores.push(r.error);
    r = await eliminarRelacion('prospecto_diplomado', id, 'id_diplomado', quitarD);
    if (r.error) errores.push(r.error);

    if (agregarE.length) {
      r = await crear('prospecto_estado',
        agregarE.map(e => ({ id_prospecto: id, id_estado: e })));
      if (r.error) errores.push(r.error);
    }
    if (agregarD.length) {
      r = await crear('prospecto_diplomado',
        agregarD.map(d => ({ id_prospecto: id, id_diplomado: d })));
      if (r.error) errores.push(r.error);
    }

    if (errores.length) {
      console.error('Errores en relaciones:', errores.map(e => e.message));
      alert('Se guardaron los datos, pero falló algún estado o diplomado. Revísalos.');
    }

    bootstrap.Modal.getInstance(el('modalEditarProspecto'))?.hide();
    await mostrarProspectos();
    if (typeof mostrarMensaje === 'function') mostrarMensaje('Prospecto actualizado');

  } finally {
    btn.disabled = false;
  }
});