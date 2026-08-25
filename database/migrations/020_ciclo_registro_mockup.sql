-- ───────────────────────────────────────────────────────────────────────────
-- 020 · Los cuatro tipos de registro que pedía el mockup
-- ───────────────────────────────────────────────────────────────────────────
--
-- El registro diario del mockup captura cuatro cosas que los catorce tipos de
-- la 018 no cubrían: los antojos, el apetito, cómo se sintió entrenando y las
-- notas libres del día.
--
-- ── Por qué hace falta una migración y no basta con zod ────────────────────
-- Porque `cycle_logs.kind` es un ENUM de Postgres, no texto. Un `kind` nuevo
-- validado solo en el cliente y en el servidor llegaría hasta el INSERT y
-- moriría ahí con un error de tipo — y como el lote «descarta lo inválido y
-- sigue», el registro se perdería EN SILENCIO. Es el peor de los fallos
-- posibles en un historial: la app dice «guardado» y no hay nada.
--
-- ── El color del sangrado NO está aquí, a propósito ────────────────────────
-- «Rojo brillante / rojo oscuro / café» y «sangrado fuera del periodo» entran
-- dentro del `value` jsonb de `sangrado`, que ya existe. Ampliar un JSONB no
-- necesita DDL; solo los esquemas de zod de los dos lados.
--
-- ── ADD VALUE no se puede deshacer ─────────────────────────────────────────
-- PostgreSQL no permite quitar un valor de un ENUM. Si algún día sobra, se
-- deja de escribir y punto; el valor se queda ahí sin molestar. Por eso los
-- cuatro nombres van pensados para durar y no llevan prefijos de versión.
-- ───────────────────────────────────────────────────────────────────────────

-- `IF NOT EXISTS` para que volver a aplicar la migración no reviente: en este
-- proyecto las migraciones se han corrido más de una vez a mano.
alter type public.cycle_log_kind add value if not exists 'antojos';
alter type public.cycle_log_kind add value if not exists 'apetito';
alter type public.cycle_log_kind add value if not exists 'entrenamiento';
alter type public.cycle_log_kind add value if not exists 'notas';

-- ───────────────────────────────────────────────────────────────────────────
-- Nota para quien venga detrás
-- ───────────────────────────────────────────────────────────────────────────
--
-- La forma de cada `value` vive en DOS ficheros que tienen que cambiar a la
-- vez, y no hay nada en la base que lo obligue:
--
--   frontend/src/features/salud/trackers.ts
--   backend/src/utils/ciclo.ts
--
-- Si solo cambia el del cliente, el servidor rechaza el registro y la cola se
-- lo come. Si solo cambia el del servidor, la app ni lo manda.
--
--   antojos:       { tags: ['dulce' | 'salado' | ... ] }
--   apetito:       { level: 1..5 }
--   entrenamiento: { estado: 'no_entrene' | 'con_energia' | ... }
--   notas:         { texto: string }
-- ───────────────────────────────────────────────────────────────────────────
