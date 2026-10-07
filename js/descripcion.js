// ============================================================
// descripcion-editable.js
// Label (con "...") -> doble clic -> textarea -> clic afuera -> UPDATE -> label
// Requiere: db (Supabase), PROSPECTOS_DATA (de prospectos.js)
// ============================================================

// HTML del label: recorta a 2 líneas con "..." y muestra el texto completo al pasar el mouse
function descripcionLabelHTML(texto) {
  const t = (texto ?? '').toString().trim();
  const tooltip = t || 'Doble clic para escribir una descripción';
  const contenido = t
    ? esc(t)
    : '<span class="text-muted fst-italic">Sin descripción</span>';

  return `<div class="desc-label small"
               title="${esc(tooltip)}"
               style="white-space:pre-wrap;word-break:break-word;cursor:pointer;
                      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${contenido}
          </div>`;
}

(function () {
  const cuerpo = document.getElementById('tabla-prospectos');
  if (!cuerpo) return;

  // ---------- DOBLE CLIC: label -> textarea ----------
  cuerpo.addEventListener('dblclick', (e) => {
    const td = e.target.closest('.celda-desc');
    if (!td || td.querySelector('textarea')) return;   // ya está en edición

    const id = td.dataset.id;
    const p = PROSPECTOS_DATA.find(x => String(x.id_prospecto) === String(id));
    const original = (p?.descripcion_seguimiento ?? '').toString();

    const ta = document.createElement('textarea');
    ta.className = 'form-control form-control-sm';
    ta.rows = 3;
    ta.value = original;
    ta.placeholder = 'Escribe la descripción...';
    ta.style.minWidth = '220px';

    // auto-ajusta el alto mientras se escribe
    const ajustar = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', ajustar);

    td.innerHTML = '';
    td.appendChild(ta);
    ajustar();
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    let terminado = false;   // evita guardar dos veces (blur + re-render)

    const volverALabel = (texto) => {
      td.innerHTML = descripcionLabelHTML(texto);
    };

    const guardar = async () => {
      if (terminado) return;
      terminado = true;

      const nuevo = ta.value.trim();

      // sin cambios: solo vuelve al label, sin consultar a la base
      if (nuevo === original.trim()) { volverALabel(original); return; }

      ta.disabled = true;

      const { error } = await db
        .from('prospecto')
        .update({ descripcion_seguimiento: nuevo || null })
        .eq('id_prospecto', id);

      if (error) {
        console.error('Error al guardar descripción:', error.message);
        alert('No se pudo guardar la descripción');
        volverALabel(original);
        return;
      }

      // actualiza en memoria para que los filtros/re-render no la pierdan
      if (p) p.descripcion_seguimiento = nuevo || null;
      volverALabel(nuevo);
    };

    // clic afuera -> guarda
    ta.addEventListener('blur', guardar);

    // Esc -> cancela sin guardar
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        terminado = true;
        volverALabel(original);
      }
    });
  });
})();