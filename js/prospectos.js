// ============================================================
// prospectos.js  (Supabase solo trae datos; todo lo demás es JS)
// Requiere cargar antes: descripcion-editable.js
// ============================================================
let PROSPECTOS_DATA = [];
let ES_ADMIN = false;
let USUARIOS = [];

const el = (id) => document.getElementById(id);

// sin acentos ni mayúsculas
const normalizar = (t) => (t ?? '').toString()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim();

// evita que un texto con < > " rompa el HTML
const esc = (t) => (t ?? '').toString()
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const nombreUsuario = (u) =>
  `${u?.nombres ?? ''} ${u?.apellidos ?? ''}`.trim() || 'Sin nombre';

// gestión actual y próxima (semestre 1 = ene-jun), hora de La Paz
function gestionesVigentes() {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
  const sem = hoy.getMonth() < 6 ? 1 : 2;
  const anio = hoy.getFullYear();
  return sem === 1 ? [`1/${anio}`, `2/${anio}`] : [`2/${anio}`, `1/${anio + 1}`];
}

// "2/2026" -> 20262, para ordenar
const valorGestion = (g) => {
  const [s, a] = (g ?? '0/0').split('/');
  return Number(a) * 10 + Number(s);
};

// ---------- CARGA Y AGRUPADO ----------
async function mostrarProspectos() {
  const usuario = await getUsuario();
  if (!usuario) { location.href = 'index.html'; return; }

  ES_ADMIN = usuario.tipo === 'admin';

  // Admin ve todo; vendedor solo lo suyo
  const filtros = ES_ADMIN ? {} : { id_vendedor: usuario.id_usuario };

  // el admin necesita la lista de usuarios para mostrar/asignar vendedores
  if (ES_ADMIN) {
    const { data: us, error: errUs } = await listar("usuario");
    if (errUs) console.error("Error al cargar usuarios:", errUs.message);
    USUARIOS = us ?? [];
  }

  // v_prospectos_todos ya viene ordenado por nombres y apellidos
  const { data, error } = await listar("v_prospectos_todos", filtros);
  if (error) { console.error("Error al cargar:", error.message); return; }

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
        estado_diplomado: fila.estado_diplomado,
        matriculado: fila.matriculado
      });
    }

    if (fila.id_estado && !p.estados.some(e => e.id_estado === fila.id_estado)) {
      p.estados.push({ id_estado: fila.id_estado, nombre: fila.nombre_estado });
    }
  }

  PROSPECTOS_DATA = [...mapa.values()];

  poblarGestiones();
  poblarEstados();
  poblarVendedores();
  poblarDiplomados();
  aplicarFiltros();
}

// ---------- LLENAR SELECTS ----------
function poblarGestiones() {
  const sel = el('filterGestión');
  const actual = sel.value;

  const gestiones = [...new Set(PROSPECTOS_DATA.flatMap(p => p.diplomados.map(d => d.gestion)))]
    .sort((a, b) => valorGestion(b) - valorGestion(a));

  sel.innerHTML =
    `<option value="">Vigente y próxima</option>
     <option value="todas">Todas las gestiones</option>` +
    gestiones.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');

  sel.value = [...sel.options].some(o => o.value === actual) ? actual : '';
}

function poblarEstados() {
  const sel = el('filterEstado');
  const actual = sel.value;

  const estados = [...new Set(PROSPECTOS_DATA.flatMap(p => p.estados.map(e => e.nombre)))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  sel.innerHTML = `<option value="">Todos los Estados</option>` +
    estados.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');

  sel.value = estados.includes(actual) ? actual : '';
}

// filtro por vendedor: se crea solo si el usuario es admin
function poblarVendedores() {
  if (!ES_ADMIN) return;

  let sel = el('filterVendedor');

  if (!sel) {
    const fila = el('filterEstado').closest('.row');
    const col = document.createElement('div');
    col.className = 'col-md-2';
    col.innerHTML = `<select id="filterVendedor" class="form-select focus-ring-success"></select>`;
    fila.appendChild(col);

    sel = el('filterVendedor');
    sel.addEventListener('change', aplicarFiltros);
  }

  const actual = sel.value;

  // solo vendedores activos (sin admins)
  const vendedores = USUARIOS
    .filter(u => u.estado === 'activo' && u.tipo !== 'admin')
    .sort((a, b) => nombreUsuario(a).localeCompare(nombreUsuario(b), 'es'));

  sel.innerHTML =
    `<option value="">Todos los vendedores</option>
     <option value="sin_asignar">Sin asignar</option>` +
    vendedores.map(u => `<option value="${u.id_usuario}">${esc(nombreUsuario(u))}</option>`).join('');

  sel.value = [...sel.options].some(o => o.value === actual) ? actual : '';
}

// ¿el diplomado cumple Gestión y Activo/Inactivo?
function diplomadoCumple(d) {
  const g = el('filterGestión').value;
  const act = el('filterActivo').value;

  const gestiones = g === 'todas' ? null : g === '' ? gestionesVigentes() : [g];
  if (gestiones && !gestiones.includes(d.gestion)) return false;
  if (act !== 'todos' && d.estado_diplomado !== act) return false;
  return true;
}

// el ÚNICO select que depende de los otros filtros (Gestión y Activo/Inactivo)
function poblarDiplomados() {
  const sel = el('filterDiplomado');
  const actual = sel.value;

  const unicos = new Map();
  PROSPECTOS_DATA.forEach(p => p.diplomados.forEach(d => {
    if (diplomadoCumple(d)) unicos.set(String(d.id_diplomado), d);
  }));

  const lista = [...unicos.values()].sort((a, b) =>
    valorGestion(b.gestion) - valorGestion(a.gestion) ||
    a.nombre_diplomado.localeCompare(b.nombre_diplomado, 'es'));

  sel.innerHTML = `<option value="">Todos los Diplomados</option>` +
    lista.map(d => `<option value="${d.id_diplomado}">${esc(d.nombre_diplomado)} (${esc(d.gestion)})</option>`).join('');

  // si el diplomado elegido ya no está disponible, vuelve a "Todos"
  sel.value = unicos.has(actual) ? actual : '';
}

// ---------- FILTRAR (en la tabla, sin consultar a la base) ----------
function aplicarFiltros() {
  const q = normalizar(el('filterPhone').value);
  const qTel = q.replace(/\D/g, '');
  const idDip = el('filterDiplomado').value;
  const estado = el('filterEstado').value;
  const gestion = el('filterGestión').value;
  const act = el('filterActivo').value;
  const mat = el('filterMatricula').value;          // "", "si" o "no"
  const vend = el('filterVendedor')?.value ?? '';   // "", "sin_asignar" o id (solo admin)

  // prospectos sin diplomados: solo si no se filtra por diplomado, matrícula ni inactivos
  const mostrarSinDiplomado =
    !idDip && !mat && act !== 'cerrado' && (gestion === '' || gestion === 'todas');

  const resultado = [];

  for (const p of PROSPECTOS_DATA) {
    let visibles;

    if (p.diplomados.length === 0) {
      if (!mostrarSinDiplomado) continue;
      visibles = [];
    } else {
      visibles = p.diplomados.filter(d =>
        diplomadoCumple(d) &&
        (!idDip || String(d.id_diplomado) === idDip) &&
        (!mat || (mat === 'si' ? d.matriculado === true : d.matriculado !== true)));
      if (visibles.length === 0) continue;
    }

    if (estado && !p.estados.some(e => e.nombre === estado)) continue;

    if (vend === 'sin_asignar' && p.id_vendedor) continue;
    if (vend && vend !== 'sin_asignar' && String(p.id_vendedor) !== vend) continue;

    // buscador: prospecto, teléfono, diplomado o descripción
    if (q) {
      const nombre = normalizar(`${p.nombres} ${p.apellidos ?? ''}`);
      const tel = (p.telefono ?? '').toString().replace(/\D/g, '');
      const dips = normalizar(visibles.map(d => `${d.nombre_diplomado} ${d.gestion}`).join(' '));
      const desc = normalizar(p.descripcion_seguimiento);

      const coincide = nombre.includes(q) || dips.includes(q) || desc.includes(q) || (qTel && tel.includes(qTel));
      if (!coincide) continue;
    }

    resultado.push({ ...p, diplomados: visibles });
  }

  renderTabla(resultado);
}

// ---------- RENDER ----------
function renderTabla(prospectos) {
  const cuerpo = el("tabla-prospectos");
  // solo usuarios activos y que no sean admin
  const activos = USUARIOS.filter(u => u.estado === 'activo' && u.tipo !== 'admin');
  let filas = "";

  // encabezado "Vendedor" (solo admin), antes de "Acciones"
  const thead = cuerpo.closest('table')?.querySelector('thead tr');
  if (thead && ES_ADMIN && !thead.querySelector('#th-vendedor')) {
    const th = document.createElement('th');
    th.id = 'th-vendedor';
    th.textContent = 'Vendedor';
    thead.insertBefore(th, thead.lastElementChild);
  }

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
            ${esc(d.nombre_diplomado)} (${esc(d.gestion)})
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
      estadosHTML += `<span class="badge ${getBadgeClass(e.nombre)} me-1">${esc(e.nombre)}</span>`;
    });
    if (!estadosHTML) estadosHTML = '<span class="text-muted">Sin calificar</span>';

    // celda del vendedor (solo admin)
    let vendedorTD = "";
    if (ES_ADMIN) {
      let contenido;
      if (p.id_vendedor) {
        const v = USUARIOS.find(u => String(u.id_usuario) === String(p.id_vendedor));
        contenido = `<span class="fw-medium">${v ? esc(nombreUsuario(v)) : 'Usuario no encontrado'}</span>`;
      } else {
        contenido = `
          <select class="form-select form-select-sm text-danger border-danger-subtle"
                  style="min-width:150px;"
                  onchange="asignarVendedor('${p.id_prospecto}', this.value)">
            <option value="">Asignar vendedor</option>
            ${activos.map(u => `<option value="${u.id_usuario}">${esc(nombreUsuario(u))}</option>`).join('')}
          </select>`;
      }
      vendedorTD = `<td>${contenido}</td>`;
    }

    filas += `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(p.created_at).toLocaleString("es-BO")}</td>
        <td>
          <div class="d-inline-flex align-items-center gap-1">
            <a href="https://wa.me/${esc(p.telefono)}" target="_blank"
              class="text-white text-decoration-none fw-medium d-inline-flex align-items-center gap-1 bg-success bg-opacity-10 px-2 py-1 rounded-pill">
              <i class="bi bi-whatsapp"></i> ${esc(p.telefono)}
            </a>
            <button type="button" class="btn btn-sm btn-light text-secondary px-2 py-1"
                    title="Copiar número"
                    onclick="copiarTelefono(this, '${esc(p.telefono)}')">
              <i class="bi bi-clipboard"></i>
            </button>
          </div>
        </td>
        <td class="fw-medium text-dark">${esc(p.nombres)}</td>
        <td style="min-width: 260px;">${diplomadosHTML}</td>
        <td>${estadosHTML}</td>
        <td class="celda-desc" data-id="${p.id_prospecto}" style="min-width:220px;max-width:300px;">
          ${descripcionLabelHTML(p.descripcion_seguimiento)}
        </td>
        ${vendedorTD}
        <td class="text-end pe-4">
          <button class="btn btn-sm btn-light text-success me-1"
        onclick="abrirEditarProspecto('${p.id_prospecto}')" title="Editar">
            <i class="bi bi-pencil-fill"></i>
          </button>
        </td>
      </tr>`;
  });

      //    <button class="btn btn-sm btn-light text-danger"
      //           onclick="confirmDelete('prospecto', '${p.id_prospecto}')" title="Eliminar">
      //       <i class="bi bi-trash-fill"></i>
      //    </button>

  const cols = ES_ADMIN ? 9 : 8;
  cuerpo.innerHTML = filas ||
    `<tr><td colspan="${cols}" class="text-center text-muted">Sin resultados</td></tr>`;
}

// ---------- MATRÍCULA ----------
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

  // se actualiza en memoria: no recarga, la fila no se mueve y los filtros se conservan
  const p = PROSPECTOS_DATA.find(x => String(x.id_prospecto) === String(idProspecto));
  const d = p?.diplomados.find(x => String(x.id_diplomado) === String(idDiplomado));
  if (d) d.matriculado = nuevo;

  aplicarFiltros();
}

// ---------- ASIGNAR VENDEDOR (solo admin) ----------
async function asignarVendedor(idProspecto, idVendedor) {
  if (!idVendedor) return;

  const { error } = await db
    .from("prospecto")
    .update({ id_vendedor: idVendedor })
    .eq("id_prospecto", idProspecto);

  if (error) {
    console.error("Error al asignar vendedor:", error.message);
    alert("No se pudo asignar el vendedor");
    aplicarFiltros();   // devuelve el select a "Asignar vendedor"
    return;
  }

  const p = PROSPECTOS_DATA.find(x => String(x.id_prospecto) === String(idProspecto));
  if (p) p.id_vendedor = idVendedor;

  aplicarFiltros();
}

// ---------- EVENTOS ----------
el('filterPhone').addEventListener('input', aplicarFiltros);
el('filterEstado').addEventListener('change', aplicarFiltros);
el('filterDiplomado').addEventListener('change', aplicarFiltros);
el('filterMatricula').addEventListener('change', aplicarFiltros);

// estos dos cambian las opciones de filterDiplomado
el('filterGestión').addEventListener('change', () => { poblarDiplomados(); aplicarFiltros(); });
el('filterActivo').addEventListener('change',  () => { poblarDiplomados(); aplicarFiltros(); });

mostrarProspectos();



// ---------- COPIAR TELÉFONO ----------
async function copiarTelefono(btn, telefono) {
  try {
    await navigator.clipboard.writeText(telefono);
  } catch {
    // respaldo para navegadores/contextos sin clipboard API
    const ta = document.createElement('textarea');
    ta.value = telefono;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  // feedback: el icono cambia a un check por 1.5 segundos
  const icono = btn.querySelector('i');
  icono.className = 'bi bi-check2 text-success';
  btn.title = 'Copiado';
  setTimeout(() => {
    icono.className = 'bi bi-clipboard';
    btn.title = 'Copiar número';
  }, 1500);
}