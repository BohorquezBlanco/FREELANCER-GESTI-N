// ============================================================
// copiar.js: copia teléfonos o la tabla visible (respeta filtros)
// ============================================================

// Copia al portapapeles (con respaldo si el navegador no da permiso)
async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// Mensajito flotante (se crea solo, no necesita HTML)
function mostrarMensaje(texto, tipo = 'success') {
  const color = tipo === 'success' ? '#198754' : '#dc3545';
  const icono = tipo === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';

  const aviso = document.createElement('div');
  aviso.innerHTML = `<i class="bi ${icono} me-2"></i>${texto}`;
  aviso.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: ${color}; color: #fff; padding: 10px 18px;
    border-radius: 10px; font-size: .9rem; font-weight: 500;
    box-shadow: 0 4px 14px rgba(0,0,0,.25);
    opacity: 0; transform: translateY(10px);
    transition: opacity .25s, transform .25s;`;

  document.body.appendChild(aviso);
  requestAnimationFrame(() => {
    aviso.style.opacity = '1';
    aviso.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    aviso.style.opacity = '0';
    aviso.style.transform = 'translateY(10px)';
    setTimeout(() => aviso.remove(), 300);
  }, 2000);
}

// ---------- TELÉFONOS: uno por línea, solo números ----------
document.getElementById('btnCopiarTelefonos').addEventListener('click', async () => {
  const filas = document.querySelectorAll('#tabla-prospectos tr');
  const telefonos = [...filas]
    .map(tr => tr.cells[2]?.innerText.replace(/\D/g, ''))   // columna 3 = teléfono
    .filter(Boolean);

  const unicos = [...new Set(telefonos)];                    // sin repetidos
  if (!unicos.length) { mostrarMensaje('No hay teléfonos para copiar', 'error'); return; }

  await copiarTexto(unicos.join('\n'));
  mostrarMensaje(`Teléfonos copiados (${unicos.length})`);
});

// ---------- TABLA: separada por tabuladores (pega directo en Excel) ----------
document.getElementById('btnCopiarTabla').addEventListener('click', async () => {
  const limpiar = (t) => t.replace(/\s+/g, ' ').trim();

  const encabezados = document.querySelector('#tabla-prospectos')
    ?.closest('table')
    ?.querySelectorAll('thead th');

  const cols = [0, 1, 2, 3, 4, 5];          // todas menos "Acciones"
  const lineas = [];

  if (encabezados?.length) {
    lineas.push(cols.map(i => limpiar(encabezados[i]?.innerText ?? '')).join('\t'));
  }

  document.querySelectorAll('#tabla-prospectos tr').forEach(tr => {
    if (tr.cells.length < 6) return;        // salta la fila "Sin resultados"
    lineas.push(cols.map(i => limpiar(tr.cells[i].innerText)).join('\t'));
  });

  if (lineas.length <= 1) { mostrarMensaje('No hay datos para copiar', 'error'); return; }

  await copiarTexto(lineas.join('\n'));
  mostrarMensaje('Tabla copiada');
});