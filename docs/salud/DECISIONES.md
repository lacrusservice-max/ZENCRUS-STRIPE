# DECISIONES · Módulo de Salud (ciclo)
### ZENCRUS · LACRUSS INNOVATION TECHNOLOGY

Registro de toda decisión tomada ante una ambigüedad del prompt maestro, con su
justificación. El prompt ordena elegir la opción más robusta, documentarla y seguir.

Formato: `D-nn · Fase · Decisión · Por qué · Qué se descartó`

---

## D-01 · Fase 2 · RLS sin política de `auth.uid()`

**Decisión.** Las tablas del módulo llevan `ENABLE ROW LEVEL SECURITY` **sin política
permisiva**, siguiendo el patrón ya establecido en `012_seguimiento_usuario.sql` y
`016_salud.sql`. El aislamiento por usuario se garantiza en el backend Express, que
filtra por el `user_id` del token en cada consulta.

**Por qué.** El prompt exige `USING (auth.uid() = user_id)`, pero este proyecto **no usa
Supabase Auth**: `auth.uid()` es siempre `NULL`, así que esa política no autorizaría a
nadie y dejaría el módulo inservible. Está documentado en la propia migración 012. El
frontend no tiene cliente de Supabase; todo pasa por el backend con `service_role`.

**Qué se descartó.** Migrar el proyecto a Supabase Auth: sería refactorizar autenticación
global, prohibido explícitamente por el alcance del prompt.

**Deuda que genera.** El QA de la Fase 14 debe incluir una prueba real de aislamiento
contra la **API**, no contra la base: un usuario autenticado intentando leer datos de
otro por cada endpoint del módulo. Sin esa prueba, este modelo no está verificado.

---

## D-02 · Fase 2 · Renumerar la colisión de migraciones `016`

**Decisión.** Antes de aplicar nada, renumerar. `016_salud.sql` pasa a `017_salud.sql`
y se revisa el orden de los otros dos archivos `016` existentes.

**Por qué.** Hay **tres** archivos con prefijo `016` (`016_salud.sql`,
`016_PARA_PEGAR.sql`, `016_social_guardar_bloquear_denunciar.sql`). Con la numeración
duplicada el orden de aplicación es indeterminado y una de las tres se puede perder o
aplicarse fuera de secuencia.

**Qué se descartó.** Aplicarlas tal cual y confiar en el orden alfabético: es
exactamente el tipo de suposición que rompe una base de datos en producción.

---

## D-03 · Fase 1 · Tipografía: adaptar el sistema de cuatro roles

**Decisión.** Se conservan los **cuatro roles** del prompt (Marca / Editorial /
Interfaz / Instrumento), pero mapeados así:

| Rol | Prompt | ZENCRUS |
|---|---|---|
| Marca | Michroma | **Rajdhani 700** (ya cargada) |
| Interfaz | Inter | **Inter** (ya cargada) ✅ |
| Editorial | Fraunces | **Fraunces** — se añade |
| Instrumento | JetBrains Mono | **JetBrains Mono** — se añade |

**Por qué.** La app ya carga Rajdhani + Inter vía `expo-font` y todo el sistema visual
existente descansa en ellas. Sustituir la fuente de marca rompería la coherencia con
Nutrición, Entrena y Social, y el alcance prohíbe tocar esos módulos. Rajdhani cumple
la misma función que Michroma —geométrica, tecnológica, ilegible en párrafo, perfecta
en etiqueta corta en mayúsculas— y es **la voz de marca real de este producto**.

Las dos que sí faltan (Editorial e Instrumento) se añaden porque cumplen funciones que
ninguna fuente actual cubre: voz humana en los insights, y cifras tabulares que no
tiemblan al actualizarse.

**Qué se descartó.** Cargar Michroma además de Rajdhani: dos fuentes display
compitiendo, +peso de bundle, y ninguna ganancia.

**Coste medido.** Fraunces variable (subset latino) + JetBrains Mono 400/500.
Se declara el delta de bundle en la Fase 14.

---

## D-04 · Fase 1 · Instalar Skia (bloqueante)

**Decisión.** Instalar `@shopify/react-native-skia` como dependencia del módulo.

**Por qué.** La Cinta (§5), el campo de fase (§1.6) y todas las gráficas (§6.4) lo
exigen explícitamente, y el prompt prohíbe librerías de charts genéricas. Sin Skia no
hay elemento firma y la Fase 5 no se puede entregar.

**Qué implica.** Requiere recompilar el development build (ya existe uno del 21/08, con
`expo-dev-client`). Es una dependencia nativa, así que se instala **antes** de la Fase 1
y se verifica en el simulador antes de codear la Cinta.

**Riesgo aceptado.** Skia añade peso al bundle. Se mide antes y después (§14.4).

---

## D-05 · Fase 7 · Paywall sobre Stripe, no RevenueCat

**Decisión.** La separación gratis/premium se implementa contra el
`paymentsService.ts` existente (Stripe), no contra RevenueCat.

**Por qué.** El proyecto no tiene RevenueCat; tiene Stripe con
`stripePublishableKey` ya en `app.config.ts`. Añadir RevenueCat tocaría suscripciones,
prohibido por el alcance.

**Lo que no cambia.** Las reglas éticas de §7.3 se respetan íntegras: nunca se muestra
que existe información sobre la salud del usuario para luego bloquearla.

---

## D-06 · Fase 6 · La correlación nace en «reuniendo datos»

**Decisión.** La Fase 6 se construye completa, pero su estado inicial para todos los
usuarios actuales será «reuniendo datos — faltan N ciclos».

**Por qué.** El prompt prohíbe mostrar una correlación con menos de 3 ciclos, y hoy el
historial de ciclo vive **solo en AsyncStorage** (`menstrualStore`), sin servidor. No
existe ningún usuario con 3 ciclos verificables. Fingir correlaciones con datos
insuficientes sería exactamente lo que el propio prompt prohíbe.

**Qué se hace en consecuencia.** La migración del historial local al servidor es
requisito de la Fase 2, no de la 6: sin ella, la Fase 6 nunca sale de su estado vacío.

---

## D-07 · Fase 6 · HRV y FC en reposo quedan como entrada manual

**Decisión.** Las correlaciones de HRV y FC en reposo se implementan, pero alimentadas
por registro manual hasta que exista integración con wearable (Fase 14).

**Por qué.** No hay ninguna fuente automática de HRV en el proyecto y no hay integración
con Apple Health / Health Connect. `healthTrackerStore` guarda pulsaciones solo si el
usuario las teclea.

**Qué se descartó.** Estimar HRV desde otra métrica: sería inventar un dato fisiológico,
prohibido por §4.3 y por la disciplina que ya sigue este repositorio (ver el pulso de 65
que se corrigió en `scoreRecuperacion.ts`).

---

## D-08 · Fase 1 · El cian de marca se reserva para la fase ovulatoria

**Decisión.** Se adopta el sistema cromático de fases del prompt **tal cual**, con una
salvedad: el acento ovulatorio usa el cian `#00F5FF` del prompt, que **no es** el rojo
`#FF1F3D` de la marca ZENCRUS actual.

**Por qué.** El prompt lo justifica bien —reservar el pico de color para el pico
fisiológico— y prohíbe explícitamente el rosa, que es el cliché de la categoría. Pero
hay que dejar constancia de que ZENCRUS es hoy una app **roja**: el módulo de Salud será
el único con otra temperatura.

**Marcado para revisión con Sergio.** Es una decisión de identidad de marca, no técnica.
Se ejecuta como pide el prompt, pero se señala aquí porque el módulo se verá distinto al
resto de la app.

---

## D-09 · Fase 3 · El registro se guarda primero en local

**Decisión.** Guardado optimista en AsyncStorage/SQLite y cola de sincronización detrás,
reusando el patrón ya probado de `trackingSync.ts`.

**Por qué.** El prompt exige <100 ms de respuesta y funcionamiento 100% offline. El
proyecto ya tiene una cola offline con reintentos que funciona para hábitos y
mediciones; no se inventa una capa nueva (regla de CERO REPETICIÓN).

---

## D-10 · Fase 0 · Alcance: Running ya no forma parte de Salud

**Decisión.** El módulo de Salud **no** incluye running, pasos ni carreras.

**Por qué.** El 21/08 Running se mudó a Entrena (`app/workout/running.tsx`) con su
propio selector de sección. El prompt maestro de Running es un documento aparte
(`PROMPT-RUNNING.md`). Mantenerlos separados evita que dos documentos reclamen las
mismas pantallas.

---

## Pendientes de decisión (requieren datos que aún no tengo)

- **P-01 · Fase 2.** Auditar qué SDKs de terceros se inicializan en `app/_layout.tsx`
  y si alguno captura payloads en rutas `/salud/*`. Stripe está en el bundle; hay que
  verificar su alcance. Es el punto de mayor riesgo legal del módulo.
- **P-02 · Transversal.** Confirmar si New Architecture está activa; no está declarada
  en `app.config.ts`.
- **P-03 · Fase 12.** La comunidad ya existe en ZENCRUS (`community_schema.sql`,
  sección Social). Hay que decidir si la comunidad de Salud es una categoría dentro de
  la existente o un espacio separado con moderación propia. Reusar exige revisar la
  moderación actual contra los requisitos de §12.2.

---

## D-11 · Fase 8 · El coach es ZENA, no un coach nuevo

**Decisión.** No se construye un «Coach de Salud» separado. Se **extiende ZENA** con
contexto de ciclo: fase actual, registros de los últimos 14 días, correlaciones activas
y modo de vida se inyectan en el contexto que ya recibe.

**Por qué.** ZENA ya existe, ya tiene su tono, su pantalla, su historial y su control de
costos. Un segundo asistente sería otra voz, otro coste y otra superficie que mantener —
y viola la regla de CERO REPETICIÓN.

**Qué se mantiene íntegro.** Los guardarraíles médicos de §8.2 se añaden al system prompt
de ZENA y el filtro de salida en cliente se implementa igual. Un ZENA que hable de ciclo
sin esos límites es más peligroso que uno que no hable del tema.

**Alcance.** Tocar el system prompt de ZENA es tocar `backend/src/services/aiSystemPrompt.ts`,
fuera del módulo de Salud. Se hace **aditivo**: un bloque de contexto que solo se inyecta
cuando el usuario tiene el ciclo activo. Sin ese bloque, ZENA se comporta exactamente
como hoy.

---

## D-12 · Fase 12 · La comunidad es Social, no una comunidad nueva

**Decisión.** No se construye una comunidad propia. Se conecta con la sección **Social**
existente para que se puedan compartir resultados del ciclo.

**Por qué.** Social ya tiene `posts`, `post_likes`, `post_comments`, `follows`,
moderación y reportes. Duplicarla sería mantener dos sistemas de moderación, que es el
peor error posible en contenido de salud.

**Qué se añade.** Un `kind` nuevo en `posts` para contenido de ciclo, y la visibilidad
restringida de D-13. La moderación existente se audita contra §12.2 antes de abrir el
canal: si no cubre desinformación de salud ni promoción de trastornos alimentarios,
se amplía el clasificador.

---

## D-13 · Transversal · Segregación por género — función fantasma ★

**Decisión.** El ciclo menstrual **no existe** para las cuentas que no lo han activado.
No es «oculto» ni «deshabilitado»: es inexistente.

**Implementación en tres capas, todas obligatorias:**

```
CAPA 1 · INTERFAZ
  → La entrada al módulo no se renderiza. No hay pestaña, no hay tarjeta,
    no hay ajuste, no hay mención en ninguna pantalla.
  → La ruta /salud/ciclo/* no se registra en el router para esas cuentas.
    Escribir la URL a mano devuelve «no existe», no «no autorizado».

CAPA 2 · DATOS
  → El backend filtra por la preferencia del perfil ANTES de consultar.
    Un GET a los endpoints de ciclo desde una cuenta sin la función
    responde 404, nunca 403.
  → 404 y no 403 a propósito: un 403 confirma que el recurso existe.

CAPA 3 · SOCIAL
  → Los posts de tipo ciclo solo se sirven a cuentas con la función activa.
    El filtro va en la consulta del feed, no en el cliente.
  → No aparecen en búsqueda, ni en perfiles, ni en notificaciones, ni en
    hilos de comentarios para quien no tiene acceso.
  → Un post compartido por enlace directo devuelve 404.
```

**Cómo se activa.** Por **elección explícita en el registro**, como pediste: «¿quieres
seguir tu ciclo?». No se deduce del campo `gender` a solas.

**Por qué se decide así y no por `gender === 'female'`.** Tres razones concretas:

1. El perfil admite `'male' | 'female' | 'other'`. Filtrar por `'female'` deja fuera a
   `'other'`, que hoy no tendría acceso a algo que puede necesitar.
2. Hay mujeres que no quieren la función (menopausia, histerectomía, simplemente no les
   interesa). Imponerla por el campo de género es peor producto.
3. El campo de género en onboarding se pide **para el cálculo metabólico**
   («Selecciona tu género biológico para el cálculo»). Reusarlo como llave de acceso a
   una función distinta acopla dos cosas que deben poder cambiar por separado.

**Resultado.** Una preferencia propia, `health_profile.cycle_enabled`, que se propone en
el registro a quien declara género femenino u otro, y que es revocable en cualquier
momento sin perder datos. Un hombre nunca la ve porque nunca se le ofrece — que es
exactamente el comportamiento pedido.

**Prueba de aceptación.** Una cuenta sin la función activa no puede, por ningún camino
—UI, deep link, API directa, feed de Social, búsqueda, notificación—, saber que el
módulo de ciclo existe. Se verifica en el QA de la Fase 14 con una cuenta real.

---

## D-14 · Fase 1 · El rosa entra, y contradice al prompt maestro

**Decisión.** La sección de ciclo usa **rosa**, por instrucción directa del 21/08.

**El conflicto, dicho con todas las letras.** El prompt maestro de este mismo módulo
prohíbe el rosa en su lista de anti-patrones:

> «✗ Rosa. Ningún rosa. Ni pastel, ni fucsia, ni "millennial pink". Es el cliché número
> uno de la categoría y comunica condescendencia.»

La instrucción posterior del cliente gana sobre el documento. Queda registrado que la
prohibición era explícita y que se levanta a propósito, no por descuido.

**Cómo se ejecuta para que no caiga en el cliché que el prompt temía.** El riesgo real
del rosa en esta categoría no es el tono: es el **tratamiento**. Rosa pastel + serif
redondeada + ilustración de flores es condescendiente. Rosa saturado y profundo sobre
negro, con tipografía de instrumento y cifras tabulares, no lo es — es la diferencia
entre una app de bienestar y un equipo de medición.

```
FASE MENSTRUAL     → Rosa profundo   · #B3184C
FASE FOLICULAR     → Rosa ascendente · #E0326E
FASE OVULATORIA    → Rosa pico       · #FF4D8F  (máxima luminosidad del mes)
FASE LÚTEA         → Rosa descenso   · #C4436B
```

Se conserva del prompt todo lo que hacía funcionar el sistema: la interfaz cambia de
temperatura según la fase, la luminancia sube hacia la ovulación, el movimiento se
reduce en menstrual, y la transición entre fases es continua día a día. Solo cambia el
eje cromático: en vez de recorrer granate → jade → cian → ámbar, recorre la escala del
rosa.

**Lo que sigue prohibido, sin excepción.** Flores, pétalos, gotas estilizadas,
mariposas, lunas de caricatura, ilustraciones de mujeres genéricas y cualquier gradiente
rosa→morado. El color cambia; la disciplina no.

**Efecto secundario.** Decae D-08: el cian ya no es el acento del pico. Se anota que
ZENCRUS sigue siendo roja y que este módulo será el único rosa.

---

## D-15 · Fase 11 · Los modos de vida quedan condicionados a D-13

**Decisión.** Los siete modos de vida solo existen dentro del módulo de ciclo, y por
tanto solo para cuentas con la función activa.

**Por qué.** Son estados del ciclo (buscando embarazo, embarazo, posparto,
perimenopausia, anticoncepción continua, amenorrea). Fuera del módulo no significan nada.

---

## P-01 · RESUELTO · Auditoría de SDKs de terceros

**Resultado: ZENCRUS no tiene ningún SDK que capture datos.** Verificado el 21/08.

Búsqueda en `package.json` de los sospechosos habituales —Sentry, Amplitude,
PostHog, Mixpanel, Segment, Firebase, AppsFlyer, Branch, Datadog, Bugsnag,
LogRocket— y de inicializaciones globales en `app/_layout.tsx`:

```
Analytics ....................... ninguno
Attribution ..................... ninguno
Crash reporting ................. ninguno
Ads ............................. ninguno
Único initialize() global ....... useAuthStore.initialize  (código propio)
```

El único SDK de terceros del proyecto es **`@stripe/stripe-react-native`**, que
actúa en el flujo de pago y no captura eventos de navegación ni payloads de
pantalla.

**Por qué importa tanto.** El requisito §2.2 del prompt nace del caso
*Frasco v. Flo Health*: un SDK de terceros dentro de un módulo de datos de salud
costó 59,5 M USD. Ese riesgo **no aplica a ZENCRUS hoy**, y la razón es que el
proyecto nunca metió analítica de terceros.

**Lo que hay que sostener.** Esto no es una casilla cerrada para siempre: es un
estado que se puede perder el día que alguien añada analítica «solo para ver
retención». Cuando eso ocurra, el módulo de ciclo debe quedar excluido de forma
explícita —un envoltorio que descarte cualquier evento originado en rutas
`/salud/*`— y no confiarlo a la configuración del SDK.

---

## D-16 · Fase 4 · La predicción usa un intervalo de PREDICCIÓN, no de confianza

Son cosas distintas y la diferencia se ve en pantalla. Un intervalo de confianza
responde «dónde está la media de sus ciclos»; uno de predicción responde «dónde
va a caer el próximo», que es la pregunta real y da una banda más ancha.

```
banda = media ± t(0,90; n-1) · s · √(1 + 1/n)
```

El `√(1 + 1/n)` es lo que separa a los dos. El t de Student —en vez del 1,282 de
la normal— es lo que ensancha la banda cuando hay pocos ciclos: con tres ciclos
sale ancha porque con tres ciclos no se sabe, y taparlo con una normal sería
volver a mentir con otra cara.

**Suelo de 1 día y techo de 7.** Cero días sería la fecha exacta que este módulo
evita; por encima de siete la banda deja de informar y la pantalla debe decir que
no puede predecir en vez de pintar dos semanas de incertidumbre.

## D-17 · Fase 4 · Las fases se calculan sobre SU ciclo, no sobre el día 14

El error más extendido de la categoría: fijar la ovulación en el día 14 porque es
lo que toca en un ciclo de 28. En uno de 34 días la ovulación cae cerca del 20, y
una app que insista en el 14 enseña la ventana fértil casi una semana antes.

Lo estable de un ciclo es la fase lútea —unos 14 días—, así que la ovulación se
cuenta **hacia atrás desde la regla prevista** y no hacia delante desde la
anterior. Se acota a un mínimo de ocho días de folicular para que en ciclos muy
cortos la ovulación no caiga dentro del sangrado.

## D-18 · Fase 4 · Los periodos se deducen del sangrado, no se declaran

La alternativa es un botón de «hoy me bajó». Parece más simple y es peor: son dos
registros del mismo hecho, se puede marcar uno y olvidar el otro, y entonces el
historial deja de coincidir con lo que ella misma apuntó.

El sangrado es la única fuente; declarar el inicio a mano existe como
**corrección** y gana siempre sobre la deducción.

Tres guardas contra el periodo fantasma:
- el **manchado (nivel 1) no abre periodo** — es común a mitad de ciclo y
  fabricaría un ciclo de quince días que no ocurrió;
- ningún periodo nuevo antes del **día 15** — no existe un ciclo más corto, así
  que ese sangrado es intermenstrual y se informa como tal;
- la separación se cuenta **de día con sangrado a día con sangrado**, nunca
  contando días sin registro: la ausencia de registro no es ausencia de sangrado,
  y confundirlas parte periodos cada vez que alguien se salta un día.

## D-19 · Fase 10 · La correlación cruzada exige tres guardas, no una

Es el diferenciador del módulo y también lo más fácil de hacer mal: con cuatro
observaciones se «demuestra» cualquier cosa, y una frase así cambia cómo alguien
se ve a sí mismo.

1. **Mínimo por fase**, no en total: 6 observaciones.
2. **Al menos 2 ciclos distintos.** Si todo viene del mismo, lo medido es ese mes.
3. **El intervalo debe excluir el cero.** Si lo cruza, la respuesta es «no se ve
   efecto», y se dice.

**Lo que no sale también se enseña**, marcado como tal. Enseñar solo lo que salió
significativo es el sesgo de publicación aplicado al cuerpo de una persona.

**Los días sin dato no son ceros.** Un día sin entrenar no es «volumen 0»: no
aparece. Meterlo como cero hundiría la media de la fase que caiga en semana de
descarga y la app «descubriría» un efecto que solo es el calendario de entreno.

## D-20 · Transversal · El vocabulario de fases sale del tema

`Phase` y `PHASE_ORDER` vivían en `theme/salud/tokens.ts`, así que cualquier
archivo que necesitara saber el orden de las fases arrastraba el sistema visual
entero —y con él `react-native-reanimated`, que en pruebas sin nativos revienta
al importarse. El motor de correlación no debe saber de animaciones para calcular
una media.

Ahora viven en `features/salud/ciclo/fases.ts` y el tema los reexporta: **el tema
conoce el dominio, el dominio no conoce el tema.** Nada de lo que ya importaba
`Phase` desde el tema se rompió.

## D-21 · Transversal · La puerta del módulo está en el layout, no en cada pantalla

Los dos cerrojos —existencia (D-13) y privacidad biométrica— viven en
`app/salud/ciclo/_layout.tsx`. Copiados en cada pantalla, la séptima que se añada
nacería abierta y un enlace profundo a `/salud/ciclo/historial` entraría directo.

**Fuga encontrada y cerrada el 21/08:** `app/(tabs)/profile.tsx` y `app/progress.tsx`
enlazaban la pantalla vieja de ciclo **sin comprobar el acceso**. La función
fantasma no lo era: cualquier cuenta veía la puerta. Ambas pasan ahora por
`tieneCiclo(user)` y apuntan a `/salud/ciclo`.

---

## D-22 · Servidor · `/api/cycle` va aparte y no bajo `/tracking`

Porque tiene su propio cerrojo: para una cuenta sin el módulo, **toda** la rama
responde 404 —el mismo cuerpo que una ruta que nunca se escribió—. Colgarlo de
`/tracking` obligaría a meter ese cerrojo dentro de un router cuyas otras veinte
rutas no lo necesitan.

**Y el 404 no es un detalle de cortesía.** Un 403 dice «esto existe y no es para
ti», lo que convierte la API en un oráculo: cualquiera con un token puede
preguntar y deducir del código de respuesta si una persona lleva registro de
ciclo. Para la decisión de producto de D-13 —invisible, no bloqueada— un 403 la
delata igual de bien que enseñar el botón.

El 401 por falta de token va **antes** del cerrojo, y eso es correcto: quien no
ha iniciado sesión no está preguntando por nadie en concreto.

## D-23 · Servidor · `cycle_periods` es una vista materializada

No es una segunda fuente de verdad. El servidor la recalcula desde `cycle_logs`
**en la misma petición** en que cambia el sangrado, así que no puede quedarse
vieja. Guardar en su lugar lo que dedujo el móvil haría que dos versiones
distintas de la app escribieran periodos distintos sobre los mismos datos, y el
historial dependería de quién sincronizó el último.

Consecuencia: la deducción existe en los dos lados
(`frontend/src/features/salud/ciclo/periodos.ts` y `backend/src/utils/ciclo.ts`)
y **si cambia, cambia en ambos a la vez**. Un umbral distinto entre cliente y
servidor produce el peor fallo posible aquí: la app enseña un ciclo y la base
guarda otro.

El recálculo hace **upsert + borrado del sobrante**, nunca «borrar todo e
insertar»: el borrado total abre una ventana sin periodos y, si el insert falla
ahí, se queda así. Con este orden, un fallo del upsert no cambia nada y un fallo
del borrado deja filas de más, recuperables en el siguiente recálculo.

## D-24 · Servidor · Los esquemas de los 14 trackers se validan en los dos lados

Un esquema que solo valida en el cliente no valida nada: cualquiera con el token
puede escribir directo contra la API.

Dos consecuencias concretas:
- **`photoLocalUri` se descarta en el servidor**, no en el móvil. Si la limpieza
  viviera solo en el cliente, bastaría una versión vieja de la app para empezar a
  guardar rutas de fotos de tests de embarazo en la base.
- **El lote descarta lo inválido y sigue**, en vez de rechazarse entero. Si un
  registro escrito por una versión anterior dejara de pasar el esquema, un lote
  todo-o-nada se atascaría reintentándolo para siempre y con él todo lo que
  hubiera detrás.

## D-25 · Cliente · La fusión respeta lo que aún no se ha subido

El servidor es la verdad **salvo en lo que todavía no ha visto**. Al traer datos,
lo remoto pisa lo local excepto en los `(día, tracker)` que siguen en la cola:
esos conservan el valor de aquí.

Sin esa excepción, registrar algo sin cobertura y que la app refresque antes de
subirlo lo haría desaparecer delante de quien acaba de escribirlo.

Y el borrado total va **primero al servidor**. Al revés, un fallo de red dejaría
lo local vacío y el servidor lleno: la siguiente sincronización lo devolvería
todo y parecería que la app resucita el historial que acaban de pedirle borrar.

## D-26 · Cliente · La predicción se calcula en el móvil y solo se SUBE el resultado

El motor no se mueve al servidor por dos razones. La predicción tiene que existir
sin red —se abre la app en el metro y el número tiene que estar—, y tener el
mismo motor en dos lenguajes es la receta para que se desincronicen: el día que
uno redondee distinto, la pantalla dirá una fecha y el informe otra.

Lo que sube es el resultado, con su banda y su confianza, para que ZENA y el
informe clínico lo lean sin recalcular. Como mucho una vez al día y solo si
cambió: `cycle_predictions` es un histórico, y una fila por render lo convertiría
en basura.
