/**
 * SIEMBRA DE LOS PROGRAMAS DE ZENCRUS
 * ───────────────────────────────────
 * Mete en `workout_programs` los cuatro programas de arranque, con `user_id` a
 * null (públicos). Se puede volver a ejecutar tantas veces como haga falta: no
 * duplica, actualiza.
 *
 *     cd backend && npx ts-node --transpile-only scripts/sembrar-programas.ts
 *
 * ── Comprueba los slugs ANTES de escribir nada ──────────────────────────────
 * Un slug que no esté en el catálogo se guardaría sin protestar, y el fallo no
 * aparecería hasta que alguien entrenara ese día: la serie se registra, pero el
 * ejercicio no cuenta en el mapa del cuerpo y sale sin imagen. Es el mismo
 * fallo silencioso contra el que avisa `musculoDe`. Aquí se aborta antes.
 *
 * ── Por qué es un script y no un SQL más ────────────────────────────────────
 * La migración 009 es DDL y solo se puede aplicar desde el panel de Supabase.
 * Esto son DATOS, y los datos sí entran por la API con la clave de servicio. Un
 * `010_seed.sql` obligaría a volver al navegador cada vez que se retoque un
 * programa.
 */

import 'dotenv/config'
import { supabase } from '../src/config/supabase'
import { PROGRAMAS } from '../src/data/programasArranque'
import catalogo from '../src/data/exercises.json'

const SLUGS = new Set((catalogo.ejercicios as { slug: string }[]).map(e => e.slug))

function comprobarSlugs(): string[] {
  const malos: string[] = []
  for (const p of PROGRAMAS) {
    for (const d of p.plan.dias) {
      for (const e of d.ejercicios) {
        if (e.slug && !SLUGS.has(e.slug)) malos.push(`${p.name} · ${d.nombre} · ${e.slug}`)
      }
    }
  }
  return malos
}

async function main() {
  const malos = comprobarSlugs()
  if (malos.length > 0) {
    console.error('ABORTA · slugs que no están en el catálogo:')
    for (const m of malos) console.error(`  ✗ ${m}`)
    process.exit(1)
  }

  const total = PROGRAMAS.reduce(
    (a, p) => a + p.plan.dias.reduce((b, d) => b + d.ejercicios.length, 0), 0,
  )
  console.log(`${PROGRAMAS.length} programas · ${total} ejercicios · todos los slugs existen\n`)

  for (const p of PROGRAMAS) {
    const fila = {
      user_id: null,
      name: p.name,
      description: p.description,
      weeks: p.weeks,
      days_per_week: p.daysPerWeek,
      goal: p.goal,
      level: p.level,
      mode: p.mode,
      deload_every: p.deloadEvery,
      plan: p.plan,
      is_published: true,
    }

    // Se busca por NOMBRE entre los públicos: es lo que los identifica de cara
    // a quien los usa, y evita duplicarlos al re-sembrar. Los ids se generan
    // solos y no se pueden escribir aquí sin arriesgarse a pisar el de alguien.
    const { data: existente } = await supabase
      .from('workout_programs')
      .select('id')
      .is('user_id', null)
      .eq('name', p.name)
      .maybeSingle()

    if (existente) {
      const { error } = await supabase
        .from('workout_programs')
        .update(fila)
        .eq('id', existente.id)
      if (error) { console.error(`  ✗ ${p.name}: ${error.message}`); process.exit(1) }
      console.log(`  ↻ ${p.name}  (actualizado)`)
    } else {
      const { error } = await supabase.from('workout_programs').insert(fila)
      if (error) { console.error(`  ✗ ${p.name}: ${error.message}`); process.exit(1) }
      console.log(`  + ${p.name}  (${p.weeks} sem · ${p.daysPerWeek} días · ${p.level})`)
    }
  }

  const { count } = await supabase
    .from('workout_programs')
    .select('*', { count: 'exact', head: true })
    .is('user_id', null)

  console.log(`\nEn el catálogo: ${count} programas de ZENCRUS.`)
}

main().catch(e => { console.error('FALLÓ:', e.message); process.exit(1) })
