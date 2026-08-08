import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import {
  fetchFeed, createPost, deletePost, likePost, unlikePost,
  fetchComments, addComment, CommunityPost, CommunityComment, FeedScope,
} from '@/services/communityService'

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'ahora'
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

const initials = (name?: string | null) => (name?.trim()?.[0] ?? 'Z').toUpperCase()

// ── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  return (
    <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[av.txt, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  )
}
const av = StyleSheet.create({
  wrap: { backgroundColor: Colors.primary[600], alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: `${Colors.primary[400]}55` },
  txt: { color: '#fff', fontWeight: '800' },
})

// ── Post Card ───────────────────────────────────────────────────────────────
function PostCard({ post, onLike, onComment, onDelete, isMine }: {
  post: CommunityPost
  onLike: (p: CommunityPost) => void
  onComment: (p: CommunityPost) => void
  onDelete: (p: CommunityPost) => void
  isMine: boolean
}) {
  const name = post.author?.full_name ?? 'Usuario ZENCRUS'
  const streak = post.metadata?.streak
  const achievement = post.metadata?.achievement

  return (
    <View style={pc.card}>
      <View style={pc.head}>
        <Avatar name={name} />
        <View style={{ flex: 1 }}>
          <Text style={pc.name}>{name}</Text>
          <Text style={pc.time}>{timeAgo(post.created_at)}</Text>
        </View>
        {isMine && (
          <TouchableOpacity onPress={() => onDelete(post)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {!!post.content && <Text style={pc.content}>{post.content}</Text>}

      {(streak || achievement) && (
        <View style={pc.badges}>
          {streak ? (
            <View style={pc.badge}><Ionicons name="flame" size={13} color={Colors.accent.orange} /><Text style={pc.badgeTxt}>Racha de {streak} días</Text></View>
          ) : null}
          {achievement ? (
            <View style={pc.badge}><Ionicons name="trophy" size={13} color={Colors.accent.yellow} /><Text style={[pc.badgeTxt, { color: Colors.accent.yellow }]}>{achievement}</Text></View>
          ) : null}
        </View>
      )}

      <View style={pc.actions}>
        <TouchableOpacity style={pc.action} onPress={() => onLike(post)} activeOpacity={0.7}>
          <Ionicons name={post.liked ? 'heart' : 'heart-outline'} size={20} color={post.liked ? Colors.accent.red : 'rgba(255,255,255,0.6)'} />
          <Text style={[pc.actionTxt, post.liked && { color: Colors.accent.red }]}>{post.likes_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pc.action} onPress={() => onComment(post)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={19} color="rgba(255,255,255,0.6)" />
          <Text style={pc.actionTxt}>{post.comments_count}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Screen ──────────────────────────────────────────────────────────────────
export default function SocialScreen() {
  const { user } = useAuthStore()
  const [scope, setScope] = useState<FeedScope>('all')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  const [commentsFor, setCommentsFor] = useState<CommunityPost | null>(null)

  const load = useCallback(async (s: FeedScope) => {
    try {
      const data = await fetchFeed(s)
      setPosts(data)
    } catch {
      // feed vacío ante error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { setLoading(true); load(scope) }, [scope, load])

  const onRefresh = () => { setRefreshing(true); load(scope) }

  const handleLike = async (p: CommunityPost) => {
    const liked = !p.liked
    setPosts(prev => prev.map(x => x.id === p.id ? { ...x, liked, likes_count: x.likes_count + (liked ? 1 : -1) } : x))
    try { liked ? await likePost(p.id) : await unlikePost(p.id) }
    catch { setPosts(prev => prev.map(x => x.id === p.id ? { ...x, liked: !liked, likes_count: x.likes_count + (liked ? -1 : 1) } : x)) }
  }

  const handlePost = async () => {
    const content = draft.trim()
    if (!content || posting) return
    setPosting(true)
    try {
      const created = await createPost({ content, kind: 'post' })
      setPosts(prev => [created, ...prev])
      setDraft('')
      setComposerOpen(false)
    } catch {
      Alert.alert('Error', 'No se pudo publicar. Intenta de nuevo.')
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = (p: CommunityPost) => {
    Alert.alert('Eliminar publicación', '¿Seguro que quieres eliminarla?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        setPosts(prev => prev.filter(x => x.id !== p.id))
        try { await deletePost(p.id) } catch { load(scope) }
      } },
    ])
  }

  return (
    <Screen tint={Colors.accent.green}>
      <ScreenHeader
        eyebrow="Zencrus · Comunidad"
        title="Comunidad"
        subtitle="Comparte tu progreso y motiva a otros"
        icon="people"
        color={Colors.accent.green}
        right={
          <TouchableOpacity style={s.newBtn} onPress={() => setComposerOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        }
      />

      {/* Scope tabs */}
      <View style={s.tabs}>
        {(['all', 'following'] as FeedScope[]).map(sc => (
          <TouchableOpacity key={sc} style={[s.tab, scope === sc && s.tabOn]} onPress={() => setScope(sc)}>
            <Text style={[s.tabTxt, scope === sc && s.tabTxtOn]}>{sc === 'all' ? 'Explorar' : 'Siguiendo'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.primary[400]} size="large" /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: Spacing[4], paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[400]} />}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              isMine={item.user_id === user?.id}
              onLike={handleLike}
              onComment={setCommentsFor}
              onDelete={handleDelete}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.25)" />
              <Text style={s.emptyTitle}>{scope === 'following' ? 'Aún no sigues a nadie' : 'Sé el primero en publicar'}</Text>
              <Text style={s.emptyBody}>{scope === 'following' ? 'Sigue cuentas para ver su progreso aquí.' : 'Comparte tu progreso y motiva a la comunidad ZENCRUS.'}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setComposerOpen(true)}>
                <Text style={s.emptyBtnTxt}>Crear publicación</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Composer */}
      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView style={cm.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={cm.sheet}>
            <View style={cm.head}>
              <TouchableOpacity onPress={() => setComposerOpen(false)}><Text style={cm.cancel}>Cancelar</Text></TouchableOpacity>
              <Text style={cm.title}>Nueva publicación</Text>
              <TouchableOpacity onPress={handlePost} disabled={!draft.trim() || posting}>
                {posting ? <ActivityIndicator color={Colors.primary[400]} /> : <Text style={[cm.post, (!draft.trim()) && { opacity: 0.4 }]}>Publicar</Text>}
              </TouchableOpacity>
            </View>
            <View style={cm.body}>
              <Avatar name={user?.full_name ?? user?.email} size={38} />
              <TextInput
                style={cm.input}
                placeholder="¿Qué quieres compartir con la comunidad?"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={draft}
                onChangeText={setDraft}
                multiline
                autoFocus
                maxLength={2000}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments */}
      {commentsFor && (
        <CommentsModal post={commentsFor} onClose={() => setCommentsFor(null)} onAdded={() => {
          setPosts(prev => prev.map(x => x.id === commentsFor.id ? { ...x, comments_count: x.comments_count + 1 } : x))
        }} me={user} />
      )}
    </Screen>
  )
}

// ── Comments Modal ──────────────────────────────────────────────────────────
function CommentsModal({ post, onClose, onAdded, me }: {
  post: CommunityPost; onClose: () => void; onAdded: () => void; me: any
}) {
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchComments(post.id).then(setComments).catch(() => {}).finally(() => setLoading(false))
  }, [post.id])

  const send = async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const c = await addComment(post.id, content)
      setComments(prev => [...prev, c])
      setDraft('')
      onAdded()
    } catch {
      Alert.alert('Error', 'No se pudo comentar.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={cm.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[cm.sheet, { maxHeight: '80%' }]}>
          <View style={cm.head}>
            <View style={{ width: 60 }} />
            <Text style={cm.title}>Comentarios</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: Spacing[8] }}><ActivityIndicator color={Colors.primary[400]} /></View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={c => c.id}
              style={{ maxHeight: 380 }}
              contentContainerStyle={{ padding: Spacing[4], gap: Spacing[4] }}
              renderItem={({ item }) => (
                <View style={cx.row}>
                  <Avatar name={item.author?.full_name} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={cx.name}>{item.author?.full_name ?? 'Usuario'} <Text style={cx.time}>· {timeAgo(item.created_at)}</Text></Text>
                    <Text style={cx.content}>{item.content}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={cx.emptyTxt}>Sé el primero en comentar.</Text>}
            />
          )}

          <View style={cx.inputRow}>
            <TextInput
              style={cx.input}
              placeholder="Escribe un comentario…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={draft}
              onChangeText={setDraft}
              maxLength={1000}
            />
            <TouchableOpacity onPress={send} disabled={!draft.trim() || sending} style={cx.sendBtn}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color={draft.trim() ? '#fff' : 'rgba(255,255,255,0.4)'} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3] },
  headerTitle: { fontFamily: Typography.fontFamily.display, fontSize: Typography.fontSize['2xl'] + 4, letterSpacing: 0.2, color: '#fff' },
  newBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primary[500], alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: Spacing[2], paddingHorizontal: Spacing[5], paddingBottom: Spacing[3] },
  tab: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder },
  tabOn: { backgroundColor: Glass.purpleTint, borderColor: Glass.purpleBorder },
  tabTxt: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.55)', fontWeight: '700' },
  tabTxtOn: { color: Colors.primary[400] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: Spacing[16], paddingHorizontal: Spacing[6], gap: Spacing[3] },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: '#fff', marginTop: Spacing[2] },
  emptyBody: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: Spacing[3], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.full, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  emptyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: Typography.fontSize.sm },
})

const pc = StyleSheet.create({
  card: { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginBottom: Spacing[3] },
  name: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  time: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  content: { fontSize: Typography.fontSize.base, color: 'rgba(255,255,255,0.9)', lineHeight: 22, marginBottom: Spacing[3] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginBottom: Spacing[3] },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Glass.elevated, borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: 5 },
  badgeTxt: { fontSize: Typography.fontSize.xs, color: Colors.accent.orange, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing[5], borderTopWidth: 1, borderTopColor: Glass.cardBorder, paddingTop: Spacing[3] },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionTxt: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
})

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Glass.cardBorder, paddingBottom: Spacing[8] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing[4], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  cancel: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  title: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
  post: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '800' },
  body: { flexDirection: 'row', gap: Spacing[3], padding: Spacing[4] },
  input: { flex: 1, fontSize: Typography.fontSize.base, color: '#fff', minHeight: 100, textAlignVertical: 'top' },
})

const cx = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start' },
  name: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  time: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.4)', fontWeight: '400' },
  content: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.85)', lineHeight: 19, marginTop: 2 },
  emptyTxt: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingVertical: Spacing[6] },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[4], borderTopWidth: 1, borderTopColor: Glass.cardBorder },
  input: { flex: 1, backgroundColor: Glass.card, borderRadius: BorderRadius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], color: '#fff', fontSize: Typography.fontSize.sm },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary[500], alignItems: 'center', justifyContent: 'center' },
})
