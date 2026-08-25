/**
 * COMUNIDAD · CAPA DE DATOS
 * ─────────────────────────
 * Única puerta de la app a `/social`. Ninguna pantalla llama a `api` por su
 * cuenta: si mañana cambia una ruta o la forma de una respuesta, se toca aquí.
 *
 * ── Lo que NO hace este archivo ─────────────────────────────────────────────
 * No decide qué se puede ver. Eso lo decide el servidor y solo el servidor: la
 * app pinta lo que le llega y respeta las banderas que vienen con ello
 * (`canViewContent`, `canWrite`, `isRequest`). Si alguna pantalla intentara
 * adivinar un permiso por su cuenta, la de al lado acabaría adivinando otra
 * cosa — y una de las dos estaría equivocada.
 *
 * ── Las direcciones de las fotos caducan ────────────────────────────────────
 * Todo lo que vive en el bucket llega firmado y con una hora de validez. No se
 * guardan en disco ni se cachean entre sesiones: al volver a abrir la app hay
 * que pedirlas otra vez. Es el precio de que un enlace filtrado deje de servir
 * solo.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from '@/services/api'

// ── Formas que devuelve el servidor ──────────────────────────────────────────

/** Lo único que se sabe de otra persona: seis campos, ni uno más. */
export interface Profile {
  id: string
  username: string | null
  fullName: string | null
  avatar: string | null
  bio: string | null
  isPrivate: boolean
  /**
   * Portada elegida, ya firmada. Llega solo en las dos pantallas de perfil:
   * en listas de caras y en autores de comentarios viene `null`, porque ahí no
   * se pinta y firmarla sería gasto por cada fila.
   */
  coverImage?: string | null
}

export type Relation = 'self' | 'following' | 'requested' | 'none'

export interface ProfileStats {
  followers: number
  following: number
  posts: number
}

export interface MyProfile extends Profile {
  stats: ProfileStats
}

export interface OtherProfile extends Profile {
  relation: Relation
  /** Si es `false`, la app enseña el candado en vez de la rejilla. */
  canViewContent: boolean
  /** Nulo cuando la cuenta está cerrada: sus números también son privados. */
  stats: ProfileStats | null
}

export interface SearchResult extends Profile {
  relation: Relation
}

export interface FollowRequest extends Profile {
  requestedAt: string
}

export type MediaKind = 'image' | 'video'

export interface PostMedia {
  url: string | null
  type: MediaKind
  width: number | null
  height: number | null
  durationMs: number | null
}

export interface Post {
  id: string
  author: Profile | null
  content: string | null
  kind: string
  visibility: 'public' | 'followers'
  media: PostMedia[]
  likes: number
  comments: number
  likedByMe: boolean
  /** Está en mi lista de guardados. Nadie más lo sabe. */
  savedByMe: boolean
  isMine: boolean
  expiresAt: string | null
  createdAt: string
}

export interface StoryGroup {
  author: Profile
  isMine: boolean
  stories: Post[]
}

export interface Comment {
  id: string
  content: string
  createdAt: string
  author: Profile | null
  isMine: boolean
}

export type ConversationStatus = 'pending' | 'accepted' | 'blocked'

export interface MessagePreview {
  id: string
  mine: boolean
  body: string | null
  mediaType: MediaKind | null
  createdAt: string
}

export interface Conversation {
  id: string
  other: Profile | null
  status: ConversationStatus
  /** Espera MI respuesta: va a la bandeja de solicitudes. */
  isRequest: boolean
  /** La abrí yo y aún no me han aceptado. */
  iRequested: boolean
  unread: number
  lastMessage: MessagePreview | null
  lastMessageAt: string | null
  canWrite: boolean
  /** Solo al abrir un chat concreto: por qué no se puede escribir. */
  writeBlockedReason?: string | null
}

export interface DirectMessage {
  id: string
  mine: boolean
  body: string | null
  media: { url: string | null; type: MediaKind } | null
  readAt: string | null
  createdAt: string
  /** Solo en la respuesta de enviar: en qué quedó la conversación. */
  conversationStatus?: ConversationStatus
}

export type NotificationType =
  | 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accepted' | 'mention'

export interface SocialNotification {
  id: string
  type: NotificationType
  isRead: boolean
  createdAt: string
  actor: Profile | null
  post: { id: string; preview: { url: string | null; type: MediaKind } | null } | null
  comment: { id: string; content: string | null } | null
}

export interface Badges {
  notifications: number
  followRequests: number
  messages: number
  messageRequests: number
  total: number
}

// ── Utilidad ─────────────────────────────────────────────────────────────────

/** El servidor envuelve todo en `{ success, data }`. Aquí se desenvuelve. */
const unwrap = <T>(res: { data?: { data?: T } }): T => (res.data?.data as T)

/**
 * El mensaje que el servidor quiso dar, o uno decente si no dijo nada.
 *
 * Importa porque casi todos los errores de esta sección son explicables —«esta
 * persona no acepta tus mensajes», «espera a que acepte tu solicitud»— y
 * taparlos con «algo salió mal» convierte una regla clara en un misterio.
 */
export function errorText(e: any, fallback = 'No pudimos completar la acción'): string {
  if (e?.isOffline) return 'Sin conexión a internet'
  if (e?.isCircuitOpen) return 'El servidor no responde. Inténtalo en un momento.'
  return e?.response?.data?.message ?? fallback
}

// ── Mi perfil ────────────────────────────────────────────────────────────────

export const getMyProfile = async (): Promise<MyProfile> =>
  unwrap(await apiGet('/social/me'))

export interface ProfilePatch {
  username?: string
  fullName?: string
  bio?: string
  /** Clave del bucket, dirección de internet, o `null` para quitarla. */
  avatar?: string | null
  /** Igual que el avatar, pero de la carpeta `cover/`. */
  coverImage?: string | null
  isPrivate?: boolean
}

export const updateMyProfile = async (patch: ProfilePatch): Promise<Profile> =>
  unwrap(await apiPatch('/social/me', patch))

// ── Gente ────────────────────────────────────────────────────────────────────

export const searchUsers = async (q: string, limit = 20): Promise<SearchResult[]> =>
  unwrap(await apiGet('/social/search', { params: { q, limit } })) ?? []

export const getProfile = async (id: string): Promise<OtherProfile> =>
  unwrap(await apiGet(`/social/users/${id}`))

export const getUserPosts = async (id: string): Promise<Post[]> =>
  unwrap(await apiGet(`/social/users/${id}/posts`)) ?? []

export const getFollowers = async (id: string): Promise<Profile[]> =>
  unwrap(await apiGet(`/social/users/${id}/followers`)) ?? []

export const getFollowing = async (id: string): Promise<Profile[]> =>
  unwrap(await apiGet(`/social/users/${id}/following`)) ?? []

/** Devuelve la relación resultante: `following` si es pública, `requested` si no. */
export const follow = async (id: string): Promise<Relation> =>
  (unwrap<{ relation: Relation }>(await apiPost(`/social/users/${id}/follow`))).relation

/** Sirve también para retirar una solicitud que aún no han respondido. */
export const unfollow = async (id: string): Promise<void> => {
  await apiDelete(`/social/users/${id}/follow`)
}

// ── Solicitudes de seguimiento ───────────────────────────────────────────────

export const getFollowRequests = async (): Promise<FollowRequest[]> =>
  unwrap(await apiGet('/social/requests')) ?? []

export const acceptFollowRequest = async (id: string): Promise<void> => {
  await apiPost(`/social/requests/${id}/accept`)
}

export const rejectFollowRequest = async (id: string): Promise<void> => {
  await apiPost(`/social/requests/${id}/reject`)
}

// ── Muros e historias ────────────────────────────────────────────────────────

export type FeedScope = 'foryou' | 'friends'

export interface FeedPage {
  posts: Post[]
  /** Cursor de la siguiente página. `null` cuando no queda nada detrás. */
  nextBefore: string | null
}

/**
 * El muro.
 *
 * Con `circulo: 'femenino'` pide el espacio cerrado en vez del muro normal.
 * Quién puede verlo NO lo decide este parámetro: el servidor lo comprueba
 * contra el perfil y a quien no pertenece le devuelve el muro vacío —no un
 * error—, porque un 403 confirmaría que el espacio existe y quién está dentro.
 */
export const getFeed = async (
  scope: FeedScope,
  before?: string | null,
  circulo?: 'femenino',
): Promise<FeedPage> =>
  unwrap(await apiGet('/social/feed', {
    params: { scope, before: before ?? undefined, limit: 20, circulo },
  }))
    ?? { posts: [], nextBefore: null }

export const getStories = async (): Promise<StoryGroup[]> =>
  unwrap(await apiGet('/social/stories')) ?? []

// ── Publicaciones ────────────────────────────────────────────────────────────

export interface NewPostMedia {
  key: string
  contentType: string
  width?: number
  height?: number
  durationMs?: number
}

export interface NewPost {
  content?: string
  kind?: 'post' | 'story'
  visibility?: 'public' | 'followers'
  media?: NewPostMedia[]
}

export const createPost = async (input: NewPost): Promise<Post> =>
  unwrap(await apiPost('/social/posts', input))

export const getPost = async (id: string): Promise<Post> =>
  unwrap(await apiGet(`/social/posts/${id}`))

export const deletePost = async (id: string): Promise<void> => {
  await apiDelete(`/social/posts/${id}`)
}

export const likePost = async (id: string): Promise<void> => {
  await apiPost(`/social/posts/${id}/like`)
}

export const unlikePost = async (id: string): Promise<void> => {
  await apiDelete(`/social/posts/${id}/like`)
}

export const getComments = async (postId: string): Promise<Comment[]> =>
  unwrap(await apiGet(`/social/posts/${postId}/comments`)) ?? []

export const addComment = async (postId: string, content: string): Promise<Comment> =>
  unwrap(await apiPost(`/social/posts/${postId}/comments`, { content }))

export const deleteComment = async (id: string): Promise<void> => {
  await apiDelete(`/social/comments/${id}`)
}

// ── Guardados ────────────────────────────────────────────────────────────────

export const savePost = async (id: string): Promise<void> => {
  await apiPost(`/social/posts/${id}/save`)
}

export const unsavePost = async (id: string): Promise<void> => {
  await apiDelete(`/social/posts/${id}/save`)
}

/**
 * Mis guardados, del más reciente al más antiguo POR CUÁNDO LO GUARDÉ.
 *
 * El servidor vuelve a comprobar los permisos al leer, así que esta lista puede
 * devolver menos publicaciones de las que hay guardadas: lo de una cuenta que
 * se cerró desde entonces deja de salir. No es un fallo de paginación.
 */
export const getSaved = async (before?: string | null): Promise<FeedPage> =>
  unwrap(await apiGet('/social/saved', {
    params: { before: before ?? undefined, limit: 30 },
  })) ?? { posts: [], nextBefore: null }

// ── Bloqueos ─────────────────────────────────────────────────────────────────

/**
 * Bloquear a alguien.
 *
 * Deshace el seguimiento en los dos sentidos y borra los avisos que se tenían
 * el uno del otro. A partir de ahí, cada uno deja de existir para el otro: ni
 * perfil, ni contenido, ni mensajes, ni búsqueda.
 *
 * A la otra persona NO se le dice nada, así que la app tampoco debe insinuarlo
 * en ningún texto.
 */
export const blockUser = async (id: string): Promise<void> => {
  await apiPost(`/social/users/${id}/block`)
}

export const unblockUser = async (id: string): Promise<void> => {
  await apiDelete(`/social/users/${id}/block`)
}

/**
 * A quién he bloqueado yo.
 *
 * Es el ÚNICO sitio desde el que se puede desbloquear: al perfil de alguien
 * bloqueado no se llega, porque para la app esa cuenta no existe.
 */
export const getBlocked = async (): Promise<Profile[]> =>
  unwrap(await apiGet('/social/blocked')) ?? []

// ── Denuncias ────────────────────────────────────────────────────────────────

export type ReportTarget = 'post' | 'user' | 'comment' | 'message'

export type ReportReason =
  | 'spam' | 'acoso' | 'desnudos' | 'violencia'
  | 'autolesion' | 'suplantacion' | 'desinformacion' | 'otro'

/** Lo que se le enseña a la persona, en su orden. */
export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'acoso',          label: 'Acoso o insultos' },
  { key: 'spam',           label: 'Spam o estafa' },
  { key: 'desnudos',       label: 'Desnudos o contenido sexual' },
  { key: 'violencia',      label: 'Violencia' },
  { key: 'autolesion',     label: 'Autolesión o trastornos alimentarios' },
  { key: 'suplantacion',   label: 'Se hace pasar por otra persona' },
  { key: 'desinformacion', label: 'Información falsa sobre salud' },
  { key: 'otro',           label: 'Otra cosa' },
]

/**
 * Denuncia algo para que lo revise una persona.
 *
 * No esconde ni borra nada por sí sola: una denuncia que ocultara contenido
 * sería un botón para silenciar a cualquiera con unas cuantas cuentas. Lo que
 * quita el problema de delante es bloquear, y por eso las dos cosas se ofrecen
 * juntas.
 *
 * `alreadyReported` viene a `true` si ya la habías denunciado antes: se dice
 * tal cual en vez de fingir que se ha enviado otra.
 */
export const reportContent = async (
  targetType: ReportTarget,
  targetId: string,
  reason: ReportReason,
  detail?: string,
): Promise<{ reported: boolean; alreadyReported: boolean }> =>
  unwrap(await apiPost('/social/reports', { targetType, targetId, reason, detail }))

// ── Mensajes ─────────────────────────────────────────────────────────────────

export interface Inbox {
  chats: Conversation[]
  requests: Conversation[]
  unread: { chats: number; requests: number }
}

export const getInbox = async (): Promise<Inbox> =>
  unwrap(await apiGet('/social/conversations'))
    ?? { chats: [], requests: [], unread: { chats: 0, requests: 0 } }

/** Abre —o recupera— la conversación con alguien. Es idempotente. */
export const openConversation = async (userId: string): Promise<Conversation> =>
  unwrap(await apiPost('/social/conversations', { userId }))

export const getConversation = async (id: string): Promise<Conversation> =>
  unwrap(await apiGet(`/social/conversations/${id}`))

export interface MessagePage {
  messages: DirectMessage[]
  nextBefore: string | null
}

/** Del más reciente al más antiguo, que es como los pinta una lista invertida. */
export const getMessages = async (id: string, before?: string | null): Promise<MessagePage> =>
  unwrap(await apiGet(`/social/conversations/${id}/messages`, {
    params: { before: before ?? undefined, limit: 40 },
  })) ?? { messages: [], nextBefore: null }

export const sendMessage = async (
  id: string,
  input: { body?: string; media?: { key: string; contentType: string } },
): Promise<DirectMessage> =>
  unwrap(await apiPost(`/social/conversations/${id}/messages`, input))

export const markConversationRead = async (id: string): Promise<number> =>
  (unwrap<{ read: number }>(await apiPost(`/social/conversations/${id}/read`))).read

export const acceptConversation = async (id: string): Promise<void> => {
  await apiPost(`/social/conversations/${id}/accept`)
}

export const rejectConversation = async (id: string): Promise<void> => {
  await apiPost(`/social/conversations/${id}/reject`)
}

export const blockConversation = async (id: string): Promise<void> => {
  await apiPost(`/social/conversations/${id}/block`)
}

export const deleteMessage = async (id: string): Promise<void> => {
  await apiDelete(`/social/messages/${id}`)
}

// ── Notificaciones ───────────────────────────────────────────────────────────

export interface NotificationPage {
  items: SocialNotification[]
  nextBefore: string | null
}

export const getNotifications = async (before?: string | null): Promise<NotificationPage> =>
  unwrap(await apiGet('/social/notifications', {
    params: { before: before ?? undefined, limit: 30 },
  })) ?? { items: [], nextBefore: null }

export const markAllNotificationsRead = async (): Promise<number> =>
  (unwrap<{ read: number }>(await apiPost('/social/notifications/read'))).read

export const markNotificationRead = async (id: string): Promise<void> => {
  await apiPost(`/social/notifications/${id}/read`)
}

export const deleteNotification = async (id: string): Promise<void> => {
  await apiDelete(`/social/notifications/${id}`)
}

export const getBadges = async (): Promise<Badges> =>
  unwrap(await apiGet('/social/badges'))
    ?? { notifications: 0, followRequests: 0, messages: 0, messageRequests: 0, total: 0 }

// ── Subida de archivos ───────────────────────────────────────────────────────

export type UploadScope = 'post' | 'story' | 'avatar' | 'cover' | 'dm'

export interface UploadTicket {
  key: string
  uploadUrl: string
  expiresIn: number
  maxBytes: number
  maxVideoSeconds: number
}

const TIPOS: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime',
}

/**
 * El tipo del archivo a partir de su nombre.
 *
 * El selector de fotos de iOS devuelve rutas como `…/IMG_0004.HEIC` o sin
 * extensión reconocible; por eso hay un valor por defecto y por eso el servidor
 * vuelve a comprobar contra el almacén lo que se subió DE VERDAD. Esta función
 * elige la firma, no decide la seguridad.
 */
export function guessType(uri: string, fallback = 'image/jpeg'): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  return TIPOS[ext] ?? fallback
}

export const requestUploadTicket = async (
  contentType: string,
  scope: UploadScope,
): Promise<UploadTicket> =>
  unwrap(await apiPost('/social/media/ticket', { contentType, scope }))

/**
 * Sube un archivo del teléfono al bucket y devuelve su clave.
 *
 * Tres pasos y ninguno se puede saltar: se pide permiso al servidor, los bytes
 * viajan DIRECTOS al almacén —no pasan por nuestro servidor, que sería lento y
 * caro con vídeo—, y la clave resultante se manda al crear la publicación o el
 * mensaje. El servidor comprueba entonces el tamaño y el tipo reales, y borra
 * lo que incumpla: la URL firmada de escritura no puede limitar los bytes.
 *
 * `onProgress` es opcional y solo distingue entre «pidiendo permiso»,
 * «subiendo» y «hecho»: sin XMLHttpRequest no hay porcentaje real, y fingir uno
 * que avanza solo es peor que no enseñar ninguno.
 */
export async function uploadMedia(
  uri: string,
  scope: UploadScope,
  onProgress?: (fase: 'permiso' | 'subiendo' | 'hecho') => void,
): Promise<{ key: string; contentType: string }> {
  const contentType = guessType(uri)

  onProgress?.('permiso')
  const ticket = await requestUploadTicket(contentType, scope)

  onProgress?.('subiendo')
  const archivo = await fetch(uri)
  const bytes = await archivo.blob()

  if (bytes.size > ticket.maxBytes) {
    throw new Error(
      `El archivo pesa ${(bytes.size / 1048576).toFixed(1)} MB y el máximo son ${ticket.maxBytes / 1048576} MB`,
    )
  }

  const subida = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    body: bytes,
    headers: { 'Content-Type': contentType },
  })
  if (!subida.ok) throw new Error('No pudimos subir el archivo')

  onProgress?.('hecho')
  return { key: ticket.key, contentType }
}
