// ============================================================
// crud.js  →  Operaciones CRUD genéricas sobre cualquier tabla
// Requiere: supabase.js (usa la variable "db")
// Todas devuelven { data, error }
// ============================================================

// CREATE → crear("producto", { nombre: "Lápiz", precio: 2 })
async function crear(tabla, datos) {
  return await db.from(tabla).insert(datos).select();
}

// READ (lista) → listar("producto", { activo: true }, "nombre")
async function listar(tabla, filtros = {}, ordenarPor = null) {
  let consulta = db.from(tabla).select('*');

  for (const [columna, valor] of Object.entries(filtros)) {
    consulta = consulta.eq(columna, valor);
  }
  if (ordenarPor) consulta = consulta.order(ordenarPor);

  return await consulta;
}

// READ (uno) → obtener("producto", "id_producto", 5)
async function obtener(tabla, columnaId, id) {
  return await db.from(tabla).select('*').eq(columnaId, id).maybeSingle();
}

// UPDATE → actualizar("producto", "id_producto", 5, { precio: 3 })
async function actualizar(tabla, columnaId, id, cambios) {
  return await db.from(tabla).update(cambios).eq(columnaId, id).select();
}

// DELETE → eliminar("producto", "id_producto", 5)
async function eliminar(tabla, columnaId, id) {
  return await db.from(tabla).delete().eq(columnaId, id);
}