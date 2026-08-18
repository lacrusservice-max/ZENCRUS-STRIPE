-- ═══════════════════════════════════════════════════════════════════════════
-- ZENCRUS · Detección de trastorno de conducta alimentaria · §12
-- ═══════════════════════════════════════════════════════════════════════════
--
-- QUÉ ES ESTO Y QUÉ NO ES
-- ───────────────────────
-- El §12 lo dice con todas las letras: «esto no es vigilancia, es cuidado
-- silencioso». Lo que se guarda aquí no sirve para señalar a nadie ni para
-- restringirle nada de golpe. Sirve para que ZENA baje la voz.
--
-- El nivel 1 —el que hace el 80% del trabajo— es invisible: fuerza el estilo
-- «Serena», deja de proponer déficits y quita el peso objetivo de en medio.
-- El usuario no ve un aviso. Ve una coach que dejó de empujar.
--
--
-- POR QUÉ HACEN FALTA DOS SEÑALES Y NO UNA
-- ────────────────────────────────────────
-- El umbral del §12 son dos señales en 14 días (7 en modo menor). No es
-- prudencia de más: un falso positivo aquí le cambia el tono a alguien que
-- estaba bien, le esconde su peso objetivo y le deja de proponer lo que vino a
-- buscar. «Ninguna señal dispara sola» está escrito en la especificación y es
-- la regla que impide que un día raro se lea como un trastorno.
--
--
-- LAS QUE SE GUARDAN Y LAS QUE SE CALCULAN
-- ────────────────────────────────────────
-- De las seis señales del §12, tres se pueden deducir de lo que ya hay en la
-- base y NO se guardan aquí: pesarse varias veces al día sale de
-- `body_metrics`, borrar comidas repetidamente sale de `meal_logs.deleted_at`,
-- e ingesta muy baja sostenida sale de sumar los días. Guardarlas sería tener
-- dos verdades sobre el mismo hecho, y cuando discrepan gana la que está mal.
--
-- Las otras tres ocurren dentro de una conversación y se pierden si nadie las
-- apunta en el momento: pedir bajar calorías estando ya en la TMB, insistir en
-- un peso fuera de rango después de que se le dijo que no, y el lenguaje de
-- culpa sobre la comida. Esas son las que viven en esta tabla.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- senales_tca · lo que pasó en una conversación y no se puede deducir después
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.senales_tca (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,

  -- La lista es cerrada a propósito. Una señal nueva es una decisión clínica,
  -- no un `insert` con otra cadena: que la base lo rechace obliga a pasar por
  -- aquí y por quien revise el §12.
  senal         text not null
                check (senal in (
                  'calorias_bajo_tmb',
                  'insiste_peso_fuera_rango',
                  'lenguaje_de_culpa'
                )),

  -- Qué se pidió exactamente. Es lo que permite revisar después si la señal
  -- estuvo bien puesta — y una detección que no se puede auditar no se puede
  -- corregir.
  contexto      jsonb not null default '{}'::jsonb,

  detectada_at  timestamptz not null default now()
);

-- La ventana de 14 días, que es la única consulta que se hace.
create index if not exists senales_tca_ventana_idx
  on public.senales_tca (user_id, detectada_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- tca_estado · una fila por usuario: qué se le ha dicho y cuándo
-- ───────────────────────────────────────────────────────────────────────────
-- El nivel 1 y el 3 se pueden recalcular en cada mensaje sin coste. El nivel 2
-- no: es el único que el usuario OYE, y el §12 lo condiciona a «si persiste».
-- Sin memoria de que ya se dijo, se lo repetiría en cada mensaje mientras las
-- señales siguieran dentro de la ventana — que es exactamente el «detectamos
-- un comportamiento preocupante en tu cuenta» que la especificación prohíbe.
create table if not exists public.tca_estado (
  user_id           uuid primary key references public.users(id) on delete cascade,

  -- Cuándo ZENA lo mencionó en voz alta por última vez.
  nivel2_avisado_at timestamptz,

  -- Cuándo se levantó la última alerta interna para el panel (§16).
  nivel3_alertado_at timestamptz,

  actualizado_at    timestamptz not null default now()
);


-- ───────────────────────────────────────────────────────────────────────────
-- RLS · cerrado, como en la 010, la 011, la 012 y la 013
-- ───────────────────────────────────────────────────────────────────────────
-- El proyecto no usa Supabase Auth: `auth.uid()` sería siempre NULL y una
-- política escrita con ella no autorizaría a nadie. Se activa RLS sin política
-- permisiva; el único camino es el backend con service_role.
--
-- Aquí importa más que en ninguna otra tabla: esto es estado de salud mental
-- inferido, la categoría más sensible de todo el §15.
alter table public.senales_tca enable row level security;
alter table public.tca_estado  enable row level security;
