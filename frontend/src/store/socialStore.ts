/**
 * COMUNIDAD · ESTADO
 * ──────────────────
 * Lo que la sección Social tiene en memoria mientras la app está abierta.
 *
 * ── Por qué esto NO se guarda en disco ──────────────────────────────────────
 * La versión anterior guardaba muros, publicaciones y comentarios en
 * AsyncStorage. No se puede: AsyncStorage no está cifrado, y ahí acababan las
 * publicaciones de cuentas privadas, listas de quién sigue a quién y trozos de
 * conversaciones ajenas. Quien tuviera acceso al almacenamiento del teléfono lo
 * leía entero, y seguía leyéndolo meses después de que esa persona hubiera
 * cerrado su cuenta.
 *
 * Además las direcciones de las fotos caducan en una hora: un muro rescatado
 * del disco al día siguiente sería una pantalla de imágenes rotas.
 *
 * Así que esto vive en memoria y se muere con la app. Lo único que sobrevive es
 * la sesión, que está en SecureStore desde siempre.
 *
 * ── Qué decide este archivo ─────────────────────────────────────────────────
 * Nada de permisos. El servidor manda: la app guarda lo que llega y respeta las
 * banderas que vienen con ello. Aquí solo se ordena, se cachea en memoria y se
 * hacen los retoques optimistas —el corazón que se pinta antes de que el
 * servidor conteste—, que se deshacen si la petición falla.
 */

import { create } from 'zustand'
import * as S from '@/services/socialService'

interface FeedState {
  posts: S.Post[]
  nextBefore: string | null
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string | null
  /** Cuándo se cargó por última vez, para no repetir petición al volver. */
  fetchedAt: number
}

const emptyFeed = (): FeedState => ({
  posts: [], nextBefore: null,
  loading: false, refreshing: false, loadingMore: false,
  error: null, fetchedAt: 0,
})

interface SocialState {
  me: S.MyProfile | null
  badges: S.Badges
  feeds: Record<S.FeedScope, FeedState>
  stories: S.StoryGroup[]
  storiesLoading: boolean
  /** Historias ya vistas en esta sesión: apaga el anillo sin ir al servidor. */
  seenStories: Set<string>

  loadMe: () => Promise<void>
  patchMe: (p: S.ProfilePatch) => Promise<S.Profile>
  loadBadges: () => Promise<void>
  /** Resta a mano un contador tras leer algo, sin esperar al servidor. */
  clearBadge: (k: keyof Omit<S.Badges, 'total'>, n?: number) => void

  loadFeed: (scope: S.FeedScope, mode?: 'first' | 'refresh' | 'more') => Promise<void>
  loadStories: () => Promise<void>
  markStorySeen: (groupAuthorId: string) => void

  toggleLike: (post: S.Post) => Promise<void>
  removePost: (id: string) => Promise<void>
  /** Mete una publicación recién creada en lo alto de los muros donde toca. */
  prependPost: (post: S.Post) => void
  /** Reemplaza una publicación en todos los muros donde esté. */
  patchPost: (id: string, patch: Partial<S.Post>) => void
  /**
   * Suma o resta comentarios.
   *
   * Suma en vez de fijar un total a propósito: quien comenta no conoce el
   * número real —solo ve la página que cargó— y fijarlo desde ahí pisaría los
   * comentarios de otros que llegaron mientras tanto.
   */
  bumpComments: (id: string, delta: number) => void

  reset: () => void
}

/** Aplica un cambio a la misma publicación en los dos muros. */
function enTodos(
  feeds: Record<S.FeedScope, FeedState>,
  id: string,
  fn: (p: S.Post) => S.Post,
): Record<S.FeedScope, FeedState> {
  const out = {} as Record<S.FeedScope, FeedState>
  for (const k of Object.keys(feeds) as S.FeedScope[]) {
    out[k] = { ...feeds[k], posts: feeds[k].posts.map(p => (p.id === id ? fn(p) : p)) }
  }
  return out
}

export const useSocialStore = create<SocialState>((set, get) => ({
  me: null,
  badges: { notifications: 0, followRequests: 0, messages: 0, messageRequests: 0, total: 0 },
  feeds: { foryou: emptyFeed(), friends: emptyFeed() },
  stories: [],
  storiesLoading: false,
  seenStories: new Set(),

  // ── Yo ─────────────────────────────────────────────────────────────────────

  loadMe: async () => {
    try {
      set({ me: await S.getMyProfile() })
    } catch {
      // Silencio a propósito: el perfil se reintenta al entrar en Social, y un
      // aviso aquí saldría encima de cualquier pantalla de la app.
    }
  },

  patchMe: async (p) => {
    const perfil = await S.updateMyProfile(p)
    set(s => ({ me: s.me ? { ...s.me, ...perfil } : null }))
    return perfil
  },

  loadBadges: async () => {
    try {
      set({ badges: await S.getBadges() })
    } catch { /* los contadores no merecen molestar a nadie */ }
  },

  clearBadge: (k, n) => set(s => {
    const resta = n ?? s.badges[k]
    const valor = Math.max(0, s.badges[k] - resta)
    return {
      badges: { ...s.badges, [k]: valor, total: Math.max(0, s.badges.total - (s.badges[k] - valor)) },
    }
  }),

  // ── Muros ──────────────────────────────────────────────────────────────────

  loadFeed: async (scope, mode = 'first') => {
    const actual = get().feeds[scope]
    // Dos peticiones a la vez del mismo muro dejarían la lista con repetidos.
    if (actual.loading || actual.refreshing || actual.loadingMore) return
    if (mode === 'more' && !actual.nextBefore) return

    set(s => ({
      feeds: {
        ...s.feeds,
        [scope]: {
          ...actual,
          error: null,
          loading: mode === 'first' && !actual.posts.length,
          refreshing: mode === 'refresh',
          loadingMore: mode === 'more',
        },
      },
    }))

    try {
      const pagina = await S.getFeed(scope, mode === 'more' ? actual.nextBefore : null)
      set(s => {
        const previo = s.feeds[scope]
        const posts = mode === 'more' ? [...previo.posts, ...pagina.posts] : pagina.posts
        return {
          feeds: {
            ...s.feeds,
            [scope]: {
              posts, nextBefore: pagina.nextBefore,
              loading: false, refreshing: false, loadingMore: false,
              error: null, fetchedAt: Date.now(),
            },
          },
        }
      })
    } catch (e) {
      set(s => ({
        feeds: {
          ...s.feeds,
          [scope]: {
            ...s.feeds[scope],
            loading: false, refreshing: false, loadingMore: false,
            error: S.errorText(e, 'No pudimos cargar el muro'),
          },
        },
      }))
    }
  },

  loadStories: async () => {
    if (get().storiesLoading) return
    set({ storiesLoading: true })
    try {
      set({ stories: await S.getStories(), storiesLoading: false })
    } catch {
      set({ storiesLoading: false })
    }
  },

  markStorySeen: (groupAuthorId) => set(s => {
    const vistas = new Set(s.seenStories)
    vistas.add(groupAuthorId)
    return { seenStories: vistas }
  }),

  // ── Publicaciones ──────────────────────────────────────────────────────────

  toggleLike: async (post) => {
    const daba = post.likedByMe
    // Se pinta antes de preguntar: un corazón que tarda medio segundo en
    // encenderse se siente roto aunque funcione.
    set(s => ({
      feeds: enTodos(s.feeds, post.id, p => ({
        ...p, likedByMe: !daba, likes: p.likes + (daba ? -1 : 1),
      })),
    }))

    try {
      daba ? await S.unlikePost(post.id) : await S.likePost(post.id)
    } catch {
      // Y se deshace si el servidor dice que no.
      set(s => ({
        feeds: enTodos(s.feeds, post.id, p => ({
          ...p, likedByMe: daba, likes: p.likes + (daba ? 1 : -1),
        })),
      }))
    }
  },

  removePost: async (id) => {
    await S.deletePost(id)
    set(s => {
      const feeds = {} as Record<S.FeedScope, FeedState>
      for (const k of Object.keys(s.feeds) as S.FeedScope[]) {
        feeds[k] = { ...s.feeds[k], posts: s.feeds[k].posts.filter(p => p.id !== id) }
      }
      return {
        feeds,
        me: s.me ? { ...s.me, stats: { ...s.me.stats, posts: Math.max(0, s.me.stats.posts - 1) } } : null,
      }
    })
  },

  prependPost: (post) => set(s => {
    const feeds = { ...s.feeds }
    // En «Amigos» entra siempre: es mía y yo me sigo. En «Para ti» solo si es
    // pública — si no, la vería en un muro donde nadie más la va a ver.
    feeds.friends = { ...feeds.friends, posts: [post, ...feeds.friends.posts] }
    if (post.visibility === 'public' && !s.me?.isPrivate) {
      feeds.foryou = { ...feeds.foryou, posts: [post, ...feeds.foryou.posts] }
    }
    return {
      feeds,
      me: s.me ? { ...s.me, stats: { ...s.me.stats, posts: s.me.stats.posts + 1 } } : null,
    }
  }),

  patchPost: (id, patch) => set(s => ({
    feeds: enTodos(s.feeds, id, p => ({ ...p, ...patch })),
  })),

  bumpComments: (id, delta) => set(s => ({
    feeds: enTodos(s.feeds, id, p => ({ ...p, comments: Math.max(0, p.comments + delta) })),
  })),

  // ── Cierre de sesión ───────────────────────────────────────────────────────

  /**
   * Vacía todo. Lo llama el cierre de sesión: sin esto, la siguiente persona
   * que entrara en el mismo teléfono vería por un instante el muro de la
   * anterior mientras carga el suyo.
   */
  reset: () => set({
    me: null,
    badges: { notifications: 0, followRequests: 0, messages: 0, messageRequests: 0, total: 0 },
    feeds: { foryou: emptyFeed(), friends: emptyFeed() },
    stories: [],
    storiesLoading: false,
    seenStories: new Set(),
  }),
}))
