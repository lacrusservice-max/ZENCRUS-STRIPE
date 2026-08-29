-- ═══════════════════════════════════════════════════════════════════════════
-- app_events · qué se usa, qué se abandona, qué sobra
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Para saber qué añadir, qué quitar, qué mejorar y qué personalizar. Guarda la
-- FORMA de la interacción, nunca su contenido: el saneado vive en
-- `nucleo/telemetria/eventos.ts` y corre en la app Y en el servidor, porque un
-- cliente modificado puede mandar lo que quiera y la garantía no puede
-- depender de que el cliente se porte bien.
--
-- ── Dos fechas, y no es purismo ────────────────────────────────────────────
-- `ocurrio_en` es el reloj del teléfono cuando pasó; `recibido_en` es el del
-- servidor cuando llegó. Los eventos se encolan sin red y se envían al
-- reconectar: con una sola fecha, todo lo que alguien hizo en el metro
-- aparecería ocurriendo a la vez al salir, y cualquier embudo o medición de
-- duración saldría mal. La primera es la buena para analizar; la segunda sirve
-- para detectar relojes torcidos y colas que tardaron días en vaciarse.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.app_events (
  id            bigserial primary key,

  -- Nulo a propósito: hay pantallas antes de iniciar sesión, y saber dónde se
  -- cae la gente en el registro es justo de lo más útil que puede haber aquí.
  user_id       uuid references public.users(id) on delete cascade,

  -- Qué pasó. `nombre` es el verbo ('pantalla_vista', 'control_usado',
  -- 'flujo_terminado') y `seccion` el primer eje de análisis.
  nombre        text not null,
  seccion       text not null,

  -- La ruta, ya sin parámetros ni identificadores: la app los quita antes de
  -- encolar y el servidor lo vuelve a hacer. `/salud/ciclo/registrar?fecha=…`
  -- diría qué día registró alguien su periodo.
  pantalla      text,
  control       text,

  -- Contexto sin contenido. En las secciones sensibles solo sobreviven las
  -- claves de la lista blanca del núcleo.
  props         jsonb not null default '{}'::jsonb,

  ocurrio_en    timestamptz not null,
  recibido_en   timestamptz not null default now(),

  -- Agrupa lo que pasó de un tirón sin identificar a nadie: se genera en el
  -- teléfono y se tira al cerrar la app.
  sesion_id     text,

  plataforma    text,
  version_app   text
);

-- La pregunta más frecuente: qué hizo una cuenta, en orden.
create index if not exists app_events_user_fecha
  on public.app_events (user_id, ocurrio_en desc);

-- La otra: cómo se comporta una pantalla o una sección para todo el mundo.
create index if not exists app_events_seccion_fecha
  on public.app_events (seccion, nombre, ocurrio_en desc);

-- Para poder borrar lo viejo sin recorrer la tabla entera. Esta tabla crece
-- más deprisa que ninguna otra de la base, y sin una poda pactada acaba
-- costando más que todo lo demás junto.
create index if not exists app_events_recibido
  on public.app_events (recibido_en);

-- Mismo régimen que el resto del proyecto: RLS activa y sin política
-- permisiva. El aislamiento lo hace el backend con service_role, porque este
-- proyecto no usa Supabase Auth y `auth.uid()` es siempre NULL. Ver D-01.
alter table public.app_events enable row level security;

comment on table public.app_events is
  'Telemetría de producto. Forma de la interacción, nunca contenido. El '
  'saneado está en nucleo/telemetria/eventos.ts y corre en los dos lados. '
  'En las secciones sensibles (salud) solo pasan las claves de la lista '
  'blanca: qué control se usó, en qué paso, cuánto duró — jamás qué se marcó.';
