-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Acciones pendientes de confirmación · §10 de la especificación
-- ═══════════════════════════════════════════════════════════════════════════
--
-- QUÉ RESUELVE
-- ────────────
-- El §10 marca cuatro herramientas como «Confirma»: cambiar el objetivo,
-- ajustar los targets nutricionales, regenerar el plan y modificar un día de
-- rutina. Hasta hoy las tres primeras escribían en cuanto el modelo las pedía
-- y contestaban «objetivos ajustados» en el mismo turno.
--
-- Eso es un cambio en los datos de salud de alguien decidido por una frase
-- suelta en un chat. «Bájame a 1.500» dicho de pasada valía tanto como dicho
-- en serio, y el usuario se enteraba después — si es que miraba.
--
-- Aquí ZENA deja de escribir. Deja PROPUESTO lo que quiere hacer, la app lo
-- pinta con el antes y el después, y quien escribe es el dedo del usuario
-- sobre un botón.
--
--
-- POR QUÉ UNA TABLA Y NO MEMORIA DEL PROCESO
-- ──────────────────────────────────────────
-- Entre que ZENA propone y el usuario confirma pasa un rato, y en ese rato el
-- servidor puede reiniciarse, desplegarse o repartir la petición a otra
-- instancia. Una acción pendiente guardada en memoria se pierde en cualquiera
-- de los tres casos, y lo que ve el usuario es un botón que ya no hace nada.
--
-- Guardada aquí, además, se puede auditar: qué propuso ZENA, qué se confirmó,
-- qué se canceló y qué se dejó caducar. El §17 mide precisamente eso —
-- «confirmaciones canceladas > 15%» significa que ZENA está entendiendo mal
-- lo que le piden— y una métrica que no se guarda no se puede mirar.
--
--
-- LOS DOS PLAZOS, Y POR QUÉ SON DISTINTOS
-- ───────────────────────────────────────
-- 15 minutos para confirmar: la propuesta se calculó con el estado de ese
-- momento. Si el usuario pesa otra cosa media hora después, el «2.100 → 1.850»
-- de la tarjeta ya no describe la realidad y confirmarlo aplicaría una cuenta
-- vieja. Caduca antes de poder mentir.
--
-- 24 horas para deshacer: aquí el cambio YA está aplicado y el riesgo se
-- invierte. Lo que se protege no es la exactitud del número sino el
-- arrepentimiento, que llega cuando el usuario abre la app al día siguiente y
-- ve sus calorías distintas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- acciones_pendientes · una propuesta de escritura esperando un sí
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.acciones_pendientes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,

  -- El nombre de la herramienta del §10 tal cual lo pidió el modelo. No hay
  -- CHECK con la lista: el catálogo crece y una restricción aquí obligaría a
  -- migrar la base cada vez que se añade una herramienta que confirma.
  herramienta   text not null,

  -- Los argumentos con los que se ejecutará si se confirma. Se guardan tal
  -- cual llegaron para poder reproducir exactamente lo que se propuso.
  argumentos    jsonb not null default '{}'::jsonb,

  -- ── El antes y el después ────────────────────────────────────────────────
  -- El §10 pide «una tarjeta con el antes y el después — "2.100 → 1.850 kcal",
  -- no solo el valor nuevo». Enseñar únicamente el valor nuevo obliga al
  -- usuario a recordar el viejo para saber si el cambio le parece bien, y
  -- nadie se acuerda de sus gramos de grasa.
  --
  -- Van desglosados por campo, no como texto: la app los pinta en dos columnas
  -- y necesita cada par por separado.
  cambios       jsonb not null default '[]'::jsonb,

  -- El estado completo previo, para escribirlo en `plan_versions` al ejecutar.
  -- Es lo que se restaura al deshacer, y por eso se guarda entero y no como
  -- diff: un diff obliga a reconstruir desde el principio.
  snapshot      jsonb not null default '{}'::jsonb,

  -- Una línea en castellano para el encabezado de la tarjeta. Se escribe al
  -- proponer y no se recalcula: es lo que el usuario leyó cuando dijo que sí.
  resumen       text not null,

  estado        text not null default 'pendiente'
                check (estado in ('pendiente','confirmada','cancelada','expirada')),

  -- 15 minutos desde que se propone. Se comprueba al leer y al ejecutar, sin
  -- proceso de limpieza: un cron que caduque filas es una pieza más que
  -- mantener para algo que se resuelve con una comparación de fechas.
  expira_at     timestamptz not null,

  -- Trazabilidad hasta el mensaje que la originó, como en `plan_versions` y
  -- por el mismo motivo: sin clave ajena, para que borrar una conversación no
  -- se lleve por delante el historial de lo que se cambió en ella.
  session_id    uuid,
  message_id    uuid,

  -- La versión que se creó al ejecutar. Es el ancla del deshacer: sin ella
  -- habría que adivinar cuál de las versiones del usuario corresponde a esta
  -- acción, y con dos cambios seguidos adivinar es de verdad.
  version_id    uuid,

  -- Cuándo se confirmó, canceló o caducó. `deshecha_at` se llena aparte
  -- porque deshacer no es un estado nuevo: la acción SÍ se confirmó y eso
  -- ocurrió: lo que hay después es otro cambio encima, no un borrón.
  resuelta_at   timestamptz,
  deshecha_at   timestamptz,

  created_at    timestamptz not null default now()
);

-- Lo que pide la app al abrir el chat: las que siguen vivas, de la más nueva
-- a la más vieja.
create index if not exists acciones_pendientes_vivas_idx
  on public.acciones_pendientes (user_id, estado, created_at desc);

-- Para volver a pintar la tarjeta al recargar el hilo: qué se propuso en cada
-- mensaje de ZENA.
create index if not exists acciones_pendientes_mensaje_idx
  on public.acciones_pendientes (message_id)
  where message_id is not null;


-- ───────────────────────────────────────────────────────────────────────────
-- RLS · cerrado, como en la 010, la 011 y la 012
-- ───────────────────────────────────────────────────────────────────────────
-- El proyecto no usa Supabase Auth: `auth.uid()` sería siempre NULL y una
-- política escrita con ella no autorizaría a nadie. Se activa RLS sin política
-- permisiva; el único camino es el backend con service_role.
alter table public.acciones_pendientes enable row level security;
