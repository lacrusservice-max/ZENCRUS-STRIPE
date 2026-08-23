/**
 * COMUNIDAD · GUARDADOS, BLOQUEOS Y DENUNCIAS
 * ───────────────────────────────────────────
 * Las tres cosas que hacen falta cuando la sección deja de usarla solo gente
 * que ya se conoce.
 *
 * Como el resto de la sección, aquí NO se razona ni una regla de privacidad:
 * todo pasa por `services/socialAccess`. Este archivo consulta, escribe y
 * devuelve.
 *
 * ── Guardar es privado ──────────────────────────────────────────────────────
 * Nadie sabe que guardaste su publicación: no genera aviso, no suma a ningún
 * contador público y no sale en ninguna respuesta ajena. Es una lista para uno
 * mismo, no un gesto social.
 *
 * ── Bloquear no se anuncia ──────────────────────────────────────────────────
 * A quien bloqueas le pasa lo mismo que si la cuenta no existiera: no encuentra
 * el perfil, no ve el contenido y no puede escribir. Nunca se le dice que ha
 * sido bloqueado — eso convertiría el bloqueo en un mensaje, y quien bloquea
 * casi siempre quiere lo contrario: desaparecer.
 *
 * ── Denunciar no borra nada ─────────────────────────────────────────────────
 * Solo deja constancia para que alguien lo revise. Si una denuncia escondiera
 * contenido por sí sola, tres cuentas nuevas bastarían para silenciar a
 * cualquiera. Lo que sí hace es OFRECER bloquear a la vez, que es la parte que
 * la persona sí controla y la que le quita el problema de delante ahora mismo.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'
import {
  PUBLIC_FIELDS, toPublicProfile, accessTo, signAvatars,
} from '../services/socialAccess'
import { hydrate, POST_COLS } from './socialContentController'

const uid = (req: Request) => req.user?.userId ?? req.user?.id
const noAuth = (res: Response) => {
  res.status(401).json({ success: false, message: 'No autenticado' } satisfies ApiResponse)
}
const fail = (res: Response, code: number, message: string) => {
  res.status(code).json({ success: false, message } satisfies ApiResponse)
}

// ── Esquemas ─────────────────────────────────────────────────────────────────

export const reportSchema = z.object({
  body: z.object({
    targetType: z.enum(['post', 'user', 'comment', 'message']),
    targetId: z.string().uuid('Eso que denuncias no existe'),
    reason: z.enum([
      'spam', 'acoso', 'desnudos', 'violencia',
      'autolesion', 'suplantacion', 'desinformacion', 'otro',
    ]),
    detail: z.string().max(1000).optional(),
  }),
})

// ═══ GUARDADOS ═══════════════════════════════════════════════════════════════

/**
 * POST /social/posts/:id/save
 *
 * Solo se puede guardar lo que se puede ver. Sin esa comprobación, guardar
 * sería una forma de quedarse con una publicación de una cuenta privada: al
 * cerrarte el acceso después, seguiría en tu lista.
 *
 * Y por eso la lista se vuelve a filtrar al leerla, no solo al guardar.
 */
export async function savePost(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const { data: post } = await supabase.from('posts')
    .select('id, user_id, visibility, expires_at')
    .eq('id', req.params.id).maybeSingle()
  if (!post) return fail(res, 404, 'Esa publicación no existe')

  // Una historia caduca a las 24 horas: guardarla sería guardar un hueco.
  if (post.expires_at) return fail(res, 422, 'Las historias no se pueden guardar')

  if (post.user_id !== me) {
    const acc = await accessTo(me, post.user_id)
    if (!acc.profile || !acc.content) return fail(res, 404, 'Esa publicación no existe')
    if (post.visibility === 'followers' && acc.relation !== 'following') {
      return fail(res, 404, 'Esa publicación no existe')
    }
  }

  // `upsert` y no `insert`: guardar dos veces es guardar una vez, no un error.
  const { error } = await supabase.from('saved_posts')
    .upsert({ user_id: me, post_id: post.id }, { onConflict: 'user_id,post_id' })

  if (error) {
    logger.error(`social · savePost ${me}→${post.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos guardarla')
  }
  res.json({ success: true, data: { saved: true } } satisfies ApiResponse)
}

/** DELETE /social/posts/:id/save */
export async function unsavePost(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const { error } = await supabase.from('saved_posts')
    .delete().eq('user_id', me).eq('post_id', req.params.id)

  if (error) {
    logger.error(`social · unsavePost ${me}→${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos quitarla de guardados')
  }
  res.json({ success: true, data: { saved: false } } satisfies ApiResponse)
}

/**
 * GET /social/saved
 *
 * ── Lo guardado se vuelve a filtrar al leer ─────────────────────────────────
 * Entre guardar y volver a mirar pueden haber pasado tres cosas: que la cuenta
 * se haya cerrado, que te haya dejado de aceptar, o que te haya bloqueado. La
 * fila sigue en la tabla —no hay forma de enterarse en el momento— así que el
 * filtro va aquí. Lo que ya no se puede ver, no sale; y no se borra la fila,
 * por si vuelve a poderse.
 */
export async function listSaved(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const limit = Math.min(Number(req.query.limit ?? 30) || 30, 50)
  const before = typeof req.query.before === 'string' ? req.query.before : null

  let q = supabase.from('saved_posts')
    .select(`created_at, post:posts!inner(${POST_COLS})`)
    .eq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) {
    logger.error(`social · listSaved ${me}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar tus guardados')
  }

  const filas = (data ?? []) as unknown as { created_at: string; post: any }[]
  const posts = filas.map(f => f.post).filter(Boolean)

  // Una comprobación por AUTOR, no por publicación: quien guarda veinte cosas
  // de la misma persona no merece veinte viajes a la base.
  const autores = [...new Set(posts.map(p => p.user_id as string))]
  const permitido = new Map<string, { content: boolean; following: boolean }>()
  await Promise.all(autores.map(async id => {
    if (id === me) {
      permitido.set(id, { content: true, following: true })
      return
    }
    const acc = await accessTo(me, id)
    permitido.set(id, {
      content: acc.profile && acc.content,
      following: acc.relation === 'following' || acc.relation === 'self',
    })
  }))

  const visibles = posts.filter(p => {
    const ok = permitido.get(p.user_id)
    if (!ok?.content) return false
    return p.visibility !== 'followers' || p.user_id === me || ok.following
  })

  // El cursor sale de la fila de GUARDADO, no de la publicación: la lista está
  // ordenada por cuándo se guardó. Y se toma de la última fila traída, no de la
  // última visible, o al filtrar una página entera el cursor no avanzaría y la
  // siguiente petición devolvería lo mismo para siempre.
  const ultima = filas[filas.length - 1]
  res.json({
    success: true,
    data: {
      posts: await hydrate(visibles, me),
      nextBefore: filas.length === limit && ultima ? ultima.created_at : null,
    },
  } satisfies ApiResponse)
}

// ═══ BLOQUEOS ════════════════════════════════════════════════════════════════

/**
 * POST /social/users/:id/block
 *
 * Bloquear rompe el seguimiento en LOS DOS SENTIDOS, además de crear la fila.
 *
 * Podría dejarse el seguimiento intacto y filtrarlo al leer —de hecho
 * `visibleAuthorIds` ya lo filtra—, pero entonces los contadores de seguidores
 * de las dos personas seguirían contándose mutuamente. Y el número de
 * seguidores es justo lo que alguien mira para saber si sigue ahí: verlo
 * intacto después de bloquear se lee como que el bloqueo no funcionó.
 *
 * Al desbloquear NO se devuelve el seguimiento: quien quiera volver a seguir,
 * que lo pida. Restaurarlo solo sería correcto si supiéramos que las dos
 * personas lo quieren, y no lo sabemos.
 */
export async function blockUser(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const otro = req.params.id
  if (otro === me) return fail(res, 422, 'No puedes bloquearte a ti mismo')

  const { data: existe } = await supabase.from('users')
    .select('id').eq('id', otro).maybeSingle()
  if (!existe) return fail(res, 404, 'Esa cuenta no existe')

  const { error } = await supabase.from('blocks')
    .upsert({ blocker_id: me, blocked_id: otro }, { onConflict: 'blocker_id,blocked_id' })

  if (error) {
    logger.error(`social · blockUser ${me}→${otro}: ${error.message}`)
    return fail(res, 500, 'No pudimos bloquear a esta persona')
  }

  // Los dos sentidos del seguimiento, de una vez.
  const { error: fe } = await supabase.from('follows').delete()
    .or(`and(follower_id.eq.${me},following_id.eq.${otro}),and(follower_id.eq.${otro},following_id.eq.${me})`)
  if (fe) logger.error(`social · blockUser follows ${me}↔${otro}: ${fe.message}`)

  // Y los avisos que se tenían el uno del otro: dejarlos ahí mantiene a la
  // persona bloqueada en la pantalla de avisos, que es de donde se quería sacar.
  const { error: ne } = await supabase.from('social_notifications').delete()
    .or(`and(user_id.eq.${me},actor_id.eq.${otro}),and(user_id.eq.${otro},actor_id.eq.${me})`)
  if (ne) logger.error(`social · blockUser avisos ${me}↔${otro}: ${ne.message}`)

  res.json({ success: true, data: { blocked: true } } satisfies ApiResponse)
}

/**
 * DELETE /social/users/:id/block
 *
 * Solo lo deshace quien lo puso: el `eq('blocker_id', me)` es lo que impide que
 * la persona bloqueada se desbloquee a sí misma.
 */
export async function unblockUser(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const { error } = await supabase.from('blocks')
    .delete().eq('blocker_id', me).eq('blocked_id', req.params.id)

  if (error) {
    logger.error(`social · unblockUser ${me}→${req.params.id}: ${error.message}`)
    return fail(res, 500, 'No pudimos desbloquear a esta persona')
  }
  res.json({ success: true, data: { blocked: false } } satisfies ApiResponse)
}

/**
 * GET /social/blocked
 *
 * Solo los que bloqueé YO. Quien me bloqueó a mí no sale: enseñarlo sería
 * decirle a la gente quién la ha bloqueado, que es justo lo que no se cuenta.
 */
export async function listBlocked(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const { data, error } = await supabase.from('blocks')
    .select(`created_at, quien:users!blocks_blocked_id_fkey(${PUBLIC_FIELDS})`)
    .eq('blocker_id', me)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error(`social · listBlocked ${me}: ${error.message}`)
    return fail(res, 500, 'No pudimos cargar tu lista de bloqueados')
  }

  const perfiles = (data ?? [])
    .map((r: any) => r.quien)
    .filter(Boolean)
    .map(toPublicProfile)

  res.json({ success: true, data: await signAvatars(perfiles) } satisfies ApiResponse)
}

// ═══ DENUNCIAS ═══════════════════════════════════════════════════════════════

/**
 * POST /social/reports
 *
 * ── No se comprueba que se pueda VER lo denunciado ──────────────────────────
 * Solo que exista. Alguien puede recibir por otro camino —una captura, un
 * enlace compartido— algo que no ve dentro de la app, y eso no lo hace menos
 * denunciable. Lo que sí se comprueba es que exista, para que la cola de
 * revisión no se llene de identificadores inventados.
 *
 * Denunciarse a uno mismo lo corta la base (`reports_no_self`), y repetir la
 * misma denuncia lo corta el índice único: las dos son 422, no 500.
 */
export async function createReport(req: Request, res: Response): Promise<void> {
  const me = uid(req)
  if (!me) return noAuth(res)

  const b = req.body as z.infer<typeof reportSchema>['body']

  const TABLA: Record<typeof b.targetType, string> = {
    post: 'posts',
    user: 'users',
    comment: 'post_comments',
    message: 'direct_messages',
  }
  const { data: existe } = await supabase
    .from(TABLA[b.targetType]).select('id').eq('id', b.targetId).maybeSingle()
  if (!existe) return fail(res, 404, 'Eso que denuncias ya no existe')

  if (b.targetType === 'user' && b.targetId === me) {
    return fail(res, 422, 'No puedes denunciarte a ti mismo')
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: me,
    target_type: b.targetType,
    target_id: b.targetId,
    reason: b.reason,
    detail: b.detail?.trim() || null,
  })

  if (error) {
    // 23505 es el índice único: ya la había denunciado. No es un fallo, y
    // decirle «ya nos lo contaste» es más honesto que fingir que se ha guardado
    // otra vez.
    if (error.code === '23505') {
      return res.json({
        success: true,
        data: { reported: true, alreadyReported: true },
      } satisfies ApiResponse) as never
    }
    logger.error(`social · createReport ${me}→${b.targetType}:${b.targetId}: ${error.message}`)
    return fail(res, 500, 'No pudimos enviar la denuncia')
  }

  res.status(201).json({
    success: true,
    data: { reported: true, alreadyReported: false },
  } satisfies ApiResponse)
}
