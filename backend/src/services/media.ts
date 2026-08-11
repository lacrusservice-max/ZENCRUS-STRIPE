/**
 * MEDIOS · ALMACENAMIENTO
 * ───────────────────────
 * Única puerta a los archivos de la comunidad. Ningún controlador habla con el
 * proveedor directamente: si mañana hay que cambiar Cloudflare R2 por otra
 * cosa, se toca este archivo y nada más.
 *
 * ── Por qué R2 y no Supabase Storage ────────────────────────────────────────
 * El coste de una app de medios no está en guardar, está en servir. Supabase
 * cobra el tráfico de salida (5 GB al mes en el plan gratis, 250 GB en el de
 * pago); R2 no lo cobra en absoluto. Con vídeos de 30 s a ~3 MB, un puñado de
 * usuarios activos agota el tráfico gratis de Supabase en días.
 *
 * El argumento habitual a favor de Supabase Storage —que se integra con sus
 * políticas de acceso— aquí no aplica: la autenticación de esta app es propia,
 * así que el permiso hay que comprobarlo en el backend de todas formas.
 *
 * ── Cómo viaja un archivo ───────────────────────────────────────────────────
 * El teléfono sube DIRECTO a R2 con una URL firmada de escritura. Los bytes no
 * pasan por Express: proxear vídeos de varios megas por el servidor sería lento
 * y caro, y no aporta seguridad porque la URL ya va firmada y caduca.
 *
 * Al terminar, la app llama a `confirmUpload`, que comprueba contra R2 el
 * tamaño y el tipo reales. Esa comprobación es la que vale: una URL firmada de
 * escritura no puede limitar cuántos bytes se suben, así que el límite se
 * verifica después y lo que se pase se borra.
 *
 * ── Lectura ─────────────────────────────────────────────────────────────────
 * El bucket es privado. Nada se sirve por URL fija: cada lectura va con una URL
 * firmada que caduca en una hora, y solo se emite después de que
 * `socialAccess` haya dicho que esa persona puede ver ese contenido. Verificado
 * contra el bucket real: sin firma, R2 responde 400.
 */

import {
  S3Client, PutObjectCommand, GetObjectCommand,
  DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import { env } from '../config/env'
import { logger } from '../config/logger'

// ── Reglas ───────────────────────────────────────────────────────────────────

/** Lo que se acepta subir. Cualquier otra cosa se rechaza antes de firmar. */
const ALLOWED = {
  'image/jpeg': { ext: 'jpg', kind: 'image' as const, maxBytes: 8 * 1024 * 1024 },
  'image/png':  { ext: 'png', kind: 'image' as const, maxBytes: 8 * 1024 * 1024 },
  'image/webp': { ext: 'webp', kind: 'image' as const, maxBytes: 8 * 1024 * 1024 },
  // 30 s comprimidos en el teléfono rondan los 3–5 MB. El tope de 30 MB deja
  // margen para vídeo peor comprimido sin abrir la puerta a subir películas.
  'video/mp4':       { ext: 'mp4', kind: 'video' as const, maxBytes: 30 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', kind: 'video' as const, maxBytes: 30 * 1024 * 1024 },
}
export type MediaKind = 'image' | 'video'
export type AllowedType = keyof typeof ALLOWED

/** Duración máxima de un vídeo. La comprueba la app antes de subir. */
export const MAX_VIDEO_SECONDS = 30

/** Vigencia de una URL de lectura. Corta: un enlace filtrado caduca solo. */
const READ_TTL = 60 * 60
/** Vigencia de una URL de escritura. Lo justo para subir y no más. */
const WRITE_TTL = 10 * 60

// ── Cliente ──────────────────────────────────────────────────────────────────

const configured = Boolean(
  env.R2_ACCOUNT_ID && env.R2_BUCKET && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY,
)

const s3 = configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null

/** true si el almacenamiento está configurado. Sin esto, subir devuelve 503. */
export const mediaReady = () => configured

function client(): S3Client {
  if (!s3) throw new Error('R2 no está configurado')
  return s3
}

// ── Claves ───────────────────────────────────────────────────────────────────

/**
 * Ruta de un archivo dentro del bucket.
 *
 * Lleva identificador aleatorio y no el del alimento, la publicación ni nada
 * adivinable. El bucket ya es privado, pero una clave que no se puede deducir
 * es una capa más: aunque alguien conociera el esquema, no puede construir la
 * ruta de la foto de otra persona.
 */
export function newKey(userId: string, contentType: AllowedType, scope: 'post' | 'story' | 'avatar' | 'dm'): string {
  const spec = ALLOWED[contentType]
  return `${scope}/${userId}/${randomUUID()}.${spec.ext}`
}

export function kindOf(contentType: string): MediaKind | null {
  return (ALLOWED as Record<string, { kind: MediaKind }>)[contentType]?.kind ?? null
}

export function isAllowedType(t: string): t is AllowedType {
  return t in ALLOWED
}

/**
 * El tipo de un archivo deducido de su extensión.
 *
 * Lo necesita el avatar: a diferencia de una publicación, la app solo manda la
 * clave, y `confirmUpload` necesita saber qué esperaba encontrar. La extensión
 * la puso `newKey` a partir del tipo firmado, así que es de fiar — y aun así, lo
 * que decide es la comprobación contra R2, no esta cadena.
 */
export function typeFromKey(key: string): AllowedType | null {
  const ext = key.split('.').pop()?.toLowerCase()
  if (!ext) return null
  for (const [tipo, spec] of Object.entries(ALLOWED)) {
    if (spec.ext === ext) return tipo as AllowedType
  }
  return null
}

/**
 * Distingue un archivo del bucket de una dirección de internet.
 *
 * `profile_picture` guardaba direcciones externas antes de que existiera el
 * bucket, y sigue habiendo cuentas con una. Lo que no empieza por http es una
 * clave nuestra y hay que firmarla; lo que empieza por http se devuelve tal cual.
 */
export function isStoredKey(value: string | null | undefined): value is string {
  return !!value && !/^https?:\/\//i.test(value)
}

// ── Subida ───────────────────────────────────────────────────────────────────

export interface UploadTicket {
  key: string
  uploadUrl: string
  expiresIn: number
  maxBytes: number
}

/**
 * Permiso temporal para que el teléfono suba un archivo directamente.
 *
 * `ContentType` va dentro de la firma: si la app sube algo con otro tipo, R2
 * rechaza la petición. No impide mentir sobre el contenido real —para eso está
 * `confirmUpload`— pero cierra el caso fácil.
 */
export async function createUploadTicket(
  userId: string,
  contentType: AllowedType,
  scope: 'post' | 'story' | 'avatar' | 'dm',
): Promise<UploadTicket> {
  const key = newKey(userId, contentType, scope)
  const uploadUrl = await getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: WRITE_TTL },
  )
  return { key, uploadUrl, expiresIn: WRITE_TTL, maxBytes: ALLOWED[contentType].maxBytes }
}

export interface Confirmed {
  ok: boolean
  bytes?: number
  contentType?: string
  reason?: string
}

/**
 * Comprueba lo que realmente se subió y borra lo que incumpla.
 *
 * Una URL firmada de escritura no puede limitar el tamaño, así que este paso no
 * es una formalidad: es el único punto donde se sabe cuántos bytes llegaron.
 * Sin él, cualquiera con un ticket válido podría subir un archivo de 2 GB.
 */
export async function confirmUpload(key: string, expected: AllowedType): Promise<Confirmed> {
  try {
    const head = await client().send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
    )
    const bytes = head.ContentLength ?? 0
    const type = head.ContentType ?? ''
    const spec = ALLOWED[expected]

    if (type !== expected) {
      await remove(key)
      return { ok: false, reason: `El archivo subido no es ${expected}` }
    }
    if (bytes > spec.maxBytes) {
      await remove(key)
      return {
        ok: false,
        reason: `El archivo pesa ${(bytes / 1048576).toFixed(1)} MB y el máximo son ${spec.maxBytes / 1048576} MB`,
      }
    }
    if (bytes === 0) {
      await remove(key)
      return { ok: false, reason: 'El archivo llegó vacío' }
    }
    return { ok: true, bytes, contentType: type }
  } catch (e) {
    logger.warn(`media · confirmUpload ${key}: ${(e as Error).message}`)
    return { ok: false, reason: 'No encontramos el archivo subido' }
  }
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/**
 * URL temporal de lectura.
 *
 * Quien llame a esto ya tiene que haber comprobado el permiso con
 * `socialAccess`: esta función no sabe de cuentas privadas ni de seguidores, y
 * firmar sin comprobar antes sería abrir la puerta.
 */
export async function readUrl(key: string, ttl = READ_TTL): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
    { expiresIn: ttl },
  )
}

/** Varias a la vez, para no firmar de una en una al montar un muro. */
export async function readUrls(keys: string[], ttl = READ_TTL): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  await Promise.all(
    keys.map(async k => {
      try { out.set(k, await readUrl(k, ttl)) }
      catch (e) { logger.warn(`media · readUrl ${k}: ${(e as Error).message}`) }
    }),
  )
  return out
}

// ── Borrado ──────────────────────────────────────────────────────────────────

export async function remove(key: string): Promise<void> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }))
  } catch (e) {
    logger.warn(`media · remove ${key}: ${(e as Error).message}`)
  }
}

/**
 * Borrado en lote, para limpiar las historias caducadas.
 *
 * R2 acepta mil claves por petición. Si no se limpian, el almacenamiento crece
 * para siempre con archivos que ya nadie puede ver — que es justo lo que hace
 * cara una app de medios.
 */
export async function removeMany(keys: string[]): Promise<number> {
  if (!keys.length) return 0
  let borradas = 0
  for (let i = 0; i < keys.length; i += 1000) {
    const lote = keys.slice(i, i + 1000)
    try {
      await client().send(new DeleteObjectsCommand({
        Bucket: env.R2_BUCKET,
        Delete: { Objects: lote.map(Key => ({ Key })), Quiet: true },
      }))
      borradas += lote.length
    } catch (e) {
      logger.error(`media · removeMany: ${(e as Error).message}`)
    }
  }
  return borradas
}
