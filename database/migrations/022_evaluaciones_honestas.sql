-- ═══════════════════════════════════════════════════════════════════════════
-- EVALUACIONES DE SÍNTOMAS · el esquema deja de obligar a inventar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `health_assessments` se diseñó con `likelihood text NOT NULL check in
-- ('baja','moderada','alta')`. Al ir a construir los cuestionarios, la
-- literatura dijo que esa escala no existe:
--
--   · TODOS los instrumentos validados e implementables son BINARIOS.
--     Pedersen para SOP corta en >=2 sobre 4. SAMANTA-Q para sangrado
--     abundante corta en >=3 sobre 10. El PPST de endometriosis dispara con
--     un solo síntoma. Ninguno produce tres niveles, así que «moderada»
--     habría que fabricarla.
--
--   · No había forma de guardar «no se puede evaluar». Con anticoncepción
--     hormonal, el SOP no se puede ni afirmar ni descartar —la píldora
--     regulariza el ciclo, mejora el acné y el hirsutismo, y falsea la
--     analítica—; la guía internacional de 2023 llama a eso «en riesgo, ni
--     diagnosticada ni descartada». El esquema obligaba a escribir 'baja',
--     que es justo lo contrario.
--
--   · No había dónde caerse ante una bandera roja a mitad del cuestionario.
--     O no se escribía fila —y el caso más urgente era el único sin rastro—
--     o había que inventar un `likelihood` para poder insertar.
--
-- La tabla está vacía y ningún código la lee todavía, así que esto no migra
-- datos: corrige el contrato antes del primer uso.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Fuera la escala que no existe ──────────────────────────────────────────
alter table public.health_assessments drop column if exists likelihood;

alter table public.health_assessments
  -- Cómo terminó. Sin valor por defecto a propósito: quien escribe la fila
  -- tiene que decir si el cuestionario se completó, porque «completo» es la
  -- única puerta a poder decir que no se encontraron señales.
  add column if not exists estado text not null
    check (estado in ('completo', 'parcial', 'no_evaluable', 'bandera_roja')),

  -- Por qué no se pudo evaluar, en palabras. «Llevas anticoncepción hormonal»
  -- no es un fallo del cuestionario: es el resultado.
  add column if not exists no_evaluable_motivo text,

  -- Qué instrumento corrió y qué dio. Binario, que es lo que dan de verdad.
  -- El nombre lleva año para que una fila de hace dos años se pueda releer:
  -- 'pedersen_2007', 'samanta_q_2020', 'ppst_2020'.
  add column if not exists instrumento text,
  add column if not exists instrumento_positivo boolean,

  -- Lo que se le enseña a ella NO es un grado, es un plazo. Un grado se lee
  -- como un diagnóstico («SOP · alta»); un plazo se lee como lo que es.
  add column if not exists siguiente_paso text not null
    check (siguiente_paso in ('urgente', 'consulta', 'sin_senales')),

  -- Las banderas rojas que salieron, con su hora. Se guardan aunque el
  -- cuestionario se corte: es el caso más urgente y era el único que no
  -- dejaba rastro.
  add column if not exists red_flags jsonb not null default '[]'::jsonb,

  -- Dos versiones distintas de la precarga sobre el mismo cuestionario
  -- producen respuestas distintas. Sin esto no habría forma de saber cuál
  -- generó la fila.
  add column if not exists preload_version text;


-- ── Las tres guardas que impiden fabricar un resultado ─────────────────────
--
-- Van en la base y no solo en el servidor porque son el contrato: un endpoint
-- nuevo escrito dentro de un año no puede saltárselas sin que la base lo pare.

-- Si no se puede evaluar, hay que decir por qué, y no hay resultado.
alter table public.health_assessments
  drop constraint if exists ha_no_evaluable_dice_por_que;
alter table public.health_assessments
  add constraint ha_no_evaluable_dice_por_que check (
    estado <> 'no_evaluable'
    or (no_evaluable_motivo is not null and instrumento_positivo is null)
  );

-- Una salida por bandera roja no produce resultado de instrumento: el
-- cuestionario se cortó, así que no corrió entero.
alter table public.health_assessments
  drop constraint if exists ha_bandera_roja_no_da_resultado;
alter table public.health_assessments
  add constraint ha_bandera_roja_no_da_resultado check (
    estado <> 'bandera_roja' or instrumento_positivo is null
  );

-- LA GUARDA IMPORTANTE. «No encontramos señales» es el resultado que hace
-- daño cuando se equivoca: es el que cierra el bucle, el que hace que deje de
-- registrar y de preguntar. Solo se puede escribir si un instrumento de
-- verdad corrió ENTERO y dio negativo. Nunca porque se abandonara a mitad,
-- ni porque no fuera evaluable.
alter table public.health_assessments
  drop constraint if exists ha_sin_senales_exige_instrumento;
alter table public.health_assessments
  add constraint ha_sin_senales_exige_instrumento check (
    siguiente_paso <> 'sin_senales'
    or (estado = 'completo' and instrumento is not null and instrumento_positivo = false)
  );


comment on column public.health_assessments.answers is
  'Una entrada por ítem, y cada una es un OBJETO, no un escalar: '
  '{valor, fuente, origen, n, ventana}. `fuente` es usuaria | '
  'precargado_aceptado | precargado_corregido. Sin esto, un «no» precargado '
  'que ella pasó sin leer es indistinguible de uno que tecleó, ni para ella '
  'ni para el médico. Es la misma disciplina que el PDF clínico, que ya '
  'distingue el inicio de ciclo declarado del deducido.';

comment on column public.health_assessments.siguiente_paso is
  'Un PLAZO, nunca un grado. urgente = hoy o esta semana; consulta = '
  'coméntalo en tu próxima cita; sin_senales = el instrumento corrió entero '
  'y dio negativo, que NO es lo mismo que descartar.';
