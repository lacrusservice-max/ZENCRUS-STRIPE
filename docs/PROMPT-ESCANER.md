# Encargo: que el escáner de códigos de barras acierte en México

> Este documento ES el encargo. Léelo entero antes de tocar un fichero.
> Datos medidos contra la API real el **22-ago-2026**. Si algún número no te
> cuadra con lo que ves, **para y dilo** — no sigas suponiendo.

---

## 1. El problema, en una frase

El escáner funciona, pero solo sabe preguntar **hacia fuera**: cada lectura sale
a Open Food Facts, no guarda nada de lo que aprende, y cuando el producto no
está —que en México es casi una de cada dos veces— contesta 404 y ahí se acaba.

## 2. Lo que YA está hecho — no lo reconstruyas

| Pieza | Dónde | Estado |
|---|---|---|
| Cliente de Open Food Facts | `backend/src/services/openFoodFacts.ts` (236 líneas) | ✅ completo y bien hecho |
| Ruta | `backend/src/routes/food.routes.ts` → `GET /foods/barcode/:code` | ✅ enrutada y protegida (401 sin token) |
| Handler | `backend/src/controllers/foodController.ts` → `barcode()` | ✅ funciona |
| Alta de alimentos externos en el catálogo | `backend/src/services/altaAlimento.ts` (181 líneas) | ✅ hecho **para FatSecret** |
| Pantalla del escáner | `frontend/src/components/nutrition/console/panels/ScanPanel.tsx` | ✅ |

`openFoodFacts.ts` ya resuelve lo difícil y **no hay que tocarlo**: normaliza
UPC-A ↔ EAN-13 (el lector de iOS devuelve siempre 13 dígitos y OFF guarda unos
productos de una forma y otros de otra), rechaza fichas sin energía en vez de
devolver ceros, descarta las que traen más de 900 kcal/100 g —el error típico de
meter el valor por ración en la casilla de los 100 g—, y convierte kJ a kcal.

**La API no necesita clave, ni cuenta, ni pago.** Comprobado en vivo:
`3017620422003` → Nutella, 539 kcal, 6.3 prot, 57.5 carb, 30.9 grasa.

## 3. La cobertura real — el dato que manda

Medido contra la API el 22-ago-2026:

| | Productos |
|---|---|
| Open Food Facts, mundial | 4.706.037 |
| Vendidos en México | **17.468** |
| México **con ficha nutricional completa** | **13.423 (77%)** |

**Traducción:** el escáner va a fallar mucho en México. 13.423 productos no son
ni de lejos lo que hay en un Walmart. Marcas locales, productos regionales y
cualquier cosa que no sea Bimbo, Lala, Coca-Cola o Sabritas va a dar 404.

**Eso no se arregla cambiando de proveedor: no hay otro.** USDA es genérico y
estadounidense; FatSecret no da el scope `barcode` en la edición gratuita (ya
está documentado en `foodController.ts`); Nutritionix, Edamam y Barcode Lookup
son de pago. Open Food Facts es la única fuente gratuita que existe.

Se arregla **construyendo tu propia base encima**, que es de lo que va esto.

## 4. Los cinco huecos

1. **No se busca en la base propia antes de salir a la red.** No existe ninguna
   consulta a `foods` por `code`. Cada escaneo, incluido el del mismo yogur cada
   mañana, sale a internet.
2. **Lo que devuelve OFF no se guarda nunca.** FatSecret sí tiene
   `darDeAltaAlimento()`; Open Food Facts no. Se usa y se tira.
3. **No hay salida cuando OFF no lo tiene.** 404 y el usuario se queda mirando
   la cámara. Es el caso más frecuente en México.
4. **Nadie ha precargado el catálogo mexicano.** Los 13.423 productos útiles
   están ahí para cogerlos.
5. **La caché es un `Map` en memoria** (500 entradas, 24 h). Muere en cada
   despliegue de Railway y no se comparte entre instancias.

---

## 5. El trabajo

### Fase 1 — Mirar en casa antes de salir a la calle

En `foodController.ts`, la cadena de `barcode()` debe quedar así:

```
1. foods WHERE code = <código>        ← NUEVO, y va primero
2. FatSecret (hoy nunca contesta)
3. Open Food Facts
4. 404
```

Usa `variantesDe()` de `openFoodFacts.ts` también para la consulta local: si el
producto se guardó como UPC-A de 12 dígitos y el lector manda 13, no lo
encontrarías. Esa función ya está escrita y exportada — reutilízala, no la
copies.

Comprueba que `foods.code` tenga índice. Si no lo tiene, créalo.

**Criterio de terminado:** escanear dos veces el mismo código; la segunda no
genera tráfico a Open Food Facts (mírate el log).

### Fase 2 — Que cada escaneo alimente la base

Extender `altaAlimento.ts` para que acepte también un `ProductoOFF`, igual que
hoy acepta un `FatSecretFood`. **No escribas un servicio nuevo**: ahí ya está
resuelta la parte difícil —normalización del nombre y comprobación de duplicado
antes de insertar—, y duplicarlo significa dos sitios donde arreglar el mismo
fallo.

Al guardar, rellena bien las columnas que ya existen en el esquema:

| Columna | Valor |
|---|---|
| `code` | el código de barras |
| `source_id` | una fuente nueva `openfoodfacts` en `food_sources` |
| `attribution` | `Open Food Facts` |
| `license` | `ODbL` |
| `official` / `verified` | **`false`** |
| `country` | `MX` cuando venga de la sincronización mexicana |

Los ids de nutriente son los que ya usa el fichero: energía 1, proteína 2,
hidratos 3, grasa 4, fibra 7.

**El distintivo de verificado se reserva a las tablas oficiales (SMAE, INCMNSZ,
USDA).** Open Food Facts es un catálogo colaborativo sin curar: es utilísimo y
no es lo mismo. Que el usuario pueda distinguirlo.

### Fase 3 — Precargar el catálogo mexicano

**Usa la API paginada, no el volcado.** El CSV completo pesa 1.2 GB comprimido y
el JSONL 11.9 GB; no hacen falta para 17k productos.

```
https://world.openfoodfacts.org/api/v2/search
  ?countries_tags=mexico
  &fields=code,product_name,product_name_es,brands,nutriments,serving_quantity,serving_size,image_front_small_url
  &page_size=100
  &page=N
```

- `page_size` **está topado a 100** aunque pidas 1000. Son **175 páginas**.
- El límite es de **10 peticiones por minuto en búsquedas** (100/min en consultas
  por código). 175 páginas ≈ **18 minutos**. Perfecto para un cron semanal.
- **Filtra por `countries_tags=mexico`, NO por el prefijo `750`.** El prefijo
  solo coge lo fabricado en México y dejaría fuera el ketchup de Heinz o la Coca
  importada, que es justo lo que la gente escanea.
- Reutiliza `aProducto()` de `openFoodFacts.ts` para descartar las fichas malas.
  Las mismas reglas que en vivo, o acabarás con basura precargada.
- Inserta por lotes con `upsert` sobre `code`. Reejecutable sin duplicar.

**Su API se cae.** Durante estas mediciones devolvió **503** varias veces. El
script necesita reintentos con espera creciente y tiene que poder **retomar por
donde iba**: guarda la última página completada. Un fallo en la página 140 no
puede obligar a empezar de cero.

**Criterio de terminado:** `SELECT count(*) FROM foods WHERE country='MX' AND
source='openfoodfacts'` da del orden de 13.000. Si da mucho menos, la
sincronización se cortó — **dilo, no lo redondees**.

### Fase 4 — La salida cuando no está (lo importante)

Es la fase que de verdad cambia el producto. Cuando las tres fuentes fallan:

```
"No tenemos este producto todavía.
 ¿Nos ayudas? Hazle una foto a la tabla nutricional."
   → la IA lee la etiqueta y extrae los macros
   → se muestran al usuario PARA QUE LOS CONFIRME
   → se guarda en foods con ese código de barras
   → el siguiente que lo escanee lo encuentra al instante
```

Reglas:

- **El usuario confirma siempre antes de guardar.** Una lectura de OCR mal hecha
  que entra directa a la base contamina el catálogo de todos. Enseña lo que
  entendió y deja corregirlo.
- **Esa foto NO cuenta contra su cuota de IA.** Cobrarle una foto a quien te está
  regalando un producto nuevo para tu base es cobrarle por trabajar para ti.
- Márcala con una fuente propia (`usuario`) y `verified: false`.
- Guarda quién lo dio de alta. El día que haya que limpiar, querrás saberlo.

**Aquí está el foso.** Cada usuario que rellena un hueco lo rellena para todos.
En seis meses tienes la mejor base de productos mexicanos que existe y es tuya —
el mismo efecto red que el SMAE, pero creciendo solo. Es exactamente el
razonamiento que ya está escrito en la cabecera de `altaAlimento.ts`.

### Fase 5 — Devolver (opcional, cuando lo demás esté)

Open Food Facts acepta altas por API. Devolver los productos mexicanos que
recojas mejora la fuente de la que bebes y es lo correcto con datos ODbL.
**No lo hagas sin preguntarle a Sergio**: publica datos con su nombre detrás.

---

## 6. Reglas que no se negocian

- **Nada de ceros inventados.** Es el fallo que más veces ha salido en este
  proyecto. Si un producto no declara energía, **no la deduzcas de los macros con
  la regla 4-4-9**. `openFoodFacts.ts` ya lo dice en un comentario y hace lo
  correcto: devolver «no está», que es la verdad útil. Un número creíble metido a
  mano corrompe todo lo que se calcule encima.
- **Identifícate.** El `User-Agent` es `ZENCRUS/1.0 (https://zencrus.com)`. Es lo
  que pide su política de uso y ya está puesto. No lo quites ni lo cambies.
- **Respeta los límites**: 100 peticiones/minuto por código, 10/minuto en
  búsquedas.
- **La licencia es ODbL.** Por eso cada fila lleva su `source_id`, `attribution`
  y `license`: los datos de OFF tienen que poder separarse siempre del SMAE y del
  INCMNSZ. No mezcles fuentes en una misma fila.
- **Un 404 no es una avería.** Es la respuesta correcta a un código que no
  existe, y con la fase 4 deja de ser un callejón sin salida.

## 7. Qué NO hacer

- ❌ No busques otra API de códigos de barras. No hay ninguna gratuita más
  (sección 3). No pierdas la sesión en ello.
- ❌ No uses la **búsqueda por texto** de Open Food Facts. Se retiró del proyecto
  a propósito: es un catálogo sin curar y al pedirle «pollo» devuelve marcas
  regionales antes que una pechuga. Un código de barras es una clave exacta y por
  eso sí vale. La cabecera de `openFoodFacts.ts` lo explica entero.
- ❌ No toques la normalización UPC/EAN de `variantesDe()`. Está bien y es sutil.
- ❌ No pongas `verified: true` a nada que venga de Open Food Facts.
- ❌ No te bajes el volcado de 1.2 GB si la API paginada te sirve.
- ❌ No amplíes la caché en memoria como solución. Con la fase 1 sobra: la base
  ES la caché, y sobrevive a los despliegues.

## 8. Cómo se escribe el código aquí

Mira `openFoodFacts.ts` y `altaAlimento.ts` antes de escribir nada. La convención
es una cabecera larga en español que explica **por qué** está hecho así y qué se
intentó antes que no funcionó — no qué hace el código. Nombres en español
(`buscarPorCodigo`, `variantesDe`, `darDeAltaAlimento`). Respétalo.

## 9. Entorno

- Backend en **`localhost:5001`** en local; en producción, Railway
  (`perfect-integrity`, servicio `web`, desde `main`).
- El endpoint pide token: `GET /api/foods/barcode/:code` devuelve 401 sin él.
- Para aplicar SQL en Supabase, el token está en el llavero y la API rechaza a
  Python: **usar `curl`**. No hace falta molestar a Sergio.
- Metro lo levanta pm2. **Avisa antes de reiniciarlo**: desloguea la app.
