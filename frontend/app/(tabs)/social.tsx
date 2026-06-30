import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, FlatList, StyleSheet,
  TouchableOpacity, TextInput, Modal, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  RefreshControl, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSocialStore, SocialPost, SocialComment } from '@/store/socialStore'
import { useStreakStore } from '@/store/streakStore'
import { useHealthStore } from '@/store/healthStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { GlassCard, SectionLabel } from '@/components/ui/Glass'

const { width: SW } = Dimensions.get('window')
const MY_USER_ID    = 'me'
const MY_USER_NAME  = 'Tú'
const MY_USER_HANDLE = '@zencrus_user'

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60)    return 'ahora'
  if (d < 3600)  return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

function levelColor(level: number): string {
  if (level >= 8) return Colors.accent.yellow
  if (level >= 6) return Colors.accent.orange
  if (level >= 4) return Colors.primary[400]
  return 'rgba(255,255,255,0.35)'
}

// ── Pick image helper ─────────────────────────────────────────────────────────

async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    quality: 0.85,
  })
  if (result.canceled) return null
  return result.assets[0].uri
}

// ── Story Bubble ──────────────────────────────────────────────────────────────

function StoryBubble({ story, onPress, viewed }: { story: SocialPost; onPress: () => void; viewed: boolean }) {
  const imgUri = story.media?.[0]?.uri ?? story.userAvatar

  return (
    <TouchableOpacity style={sb.wrap} onPress={onPress} activeOpacity={0.82}>
      <View style={[sb.ring, viewed && sb.ringViewed]}>
        {imgUri ? (
          <Image source={{ uri: imgUri }} style={sb.avatarImg} />
        ) : (
          <View style={sb.avatarFill}>
            <Text style={sb.emoji}>{story.streak ? '🔥' : story.achievement ? '🏆' : '✨'}</Text>
          </View>
        )}
      </View>
      <Text style={sb.name} numberOfLines={1}>{story.userName.split(' ')[0]}</Text>
    </TouchableOpacity>
  )
}

const sb = StyleSheet.create({
  wrap: { alignItems: 'center', marginRight: Spacing[4], width: 68 },
  ring: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2.5, borderColor: Colors.primary[500],
    padding: 2.5, marginBottom: 5,
    shadowColor: Colors.primary[500],
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  ringViewed: { borderColor: 'rgba(255,255,255,0.18)' },
  avatarImg:  { flex: 1, borderRadius: 29, backgroundColor: Glass.elevated },
  avatarFill: { flex: 1, borderRadius: 29, backgroundColor: Glass.elevated, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  name: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontWeight: '600' },
})

// ── Story Viewer ───────────────────────────────────────────────────────────────

function StoryViewer({ stories, initialIndex, onClose }: { stories: SocialPost[]; initialIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIndex)
  const { markStoryViewed } = useSocialStore()
  const story = stories[idx]

  useEffect(() => { if (story) markStoryViewed(story.id) }, [idx])
  if (!story) return null

  const timeLeft = story.expiresAt
    ? Math.max(0, Math.round((new Date(story.expiresAt).getTime() - Date.now()) / 3600000))
    : null

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={sv.bg}>
        {/* Background image if present */}
        {story.media?.[0]?.uri && (
          <Image source={{ uri: story.media[0].uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        )}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />

        {/* Progress bars */}
        <View style={sv.progress}>
          {stories.map((_, i) => (
            <View key={i} style={[sv.bar, i <= idx && sv.barFilled]} />
          ))}
        </View>

        {/* Close */}
        <TouchableOpacity style={sv.close} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={sv.content}>
          <View style={sv.header}>
            <View style={sv.avatarCircle}>
              <Text style={{ fontSize: 20 }}>⚡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sv.name}>{story.userName}</Text>
              <Text style={sv.meta}>{story.userHandle} · {timeLeft != null ? `${timeLeft}h restantes` : timeAgo(story.createdAt)}</Text>
            </View>
          </View>
          <View style={sv.card}>
            {story.streak && (
              <View style={sv.badge}>
                <Text style={sv.badgeTxt}>🔥 {story.streak} días de racha</Text>
              </View>
            )}
            {story.achievement && (
              <View style={[sv.badge, { backgroundColor: Colors.accent.yellow + '25' }]}>
                <Text style={[sv.badgeTxt, { color: Colors.accent.yellow }]}>🏆 {story.achievement}</Text>
              </View>
            )}
            <Text style={sv.txt}>{story.content}</Text>
            {story.healthScore != null && (
              <Text style={sv.score}>Health Score: {story.healthScore} ⭐</Text>
            )}
          </View>
        </View>

        {/* Tap areas */}
        <View style={sv.nav}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setIdx(i => Math.max(0, i - 1))} />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => {
            if (idx < stories.length - 1) setIdx(i => i + 1)
            else onClose()
          }} />
        </View>
      </View>
    </Modal>
  )
}

const sv = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#000' },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: Spacing[4], paddingTop: 60, paddingBottom: Spacing[3] },
  bar: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  barFilled: { backgroundColor: '#fff' },
  close: { position: 'absolute', top: 56, right: Spacing[5], zIndex: 10, padding: Spacing[2] },
  content: { flex: 1, padding: Spacing[5], paddingTop: Spacing[4] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginBottom: Spacing[6] },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary[900],
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.primary[500],
  },
  name: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff' },
  meta: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  card: { backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: Spacing[5], borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  badge: {
    backgroundColor: Colors.primary[900] + '80', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[4], paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: Spacing[3],
  },
  badgeTxt: { fontSize: Typography.fontSize.xs, color: Colors.primary[300], fontWeight: '700' },
  txt: { fontSize: Typography.fontSize.base, color: '#fff', lineHeight: 24 },
  score: { fontSize: Typography.fontSize.sm, color: Colors.accent.yellow, marginTop: Spacing[3], fontWeight: '600' },
  nav: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
})

// ── Post Card ──────────────────────────────────────────────────────────────────

function PostCard({ post, onLike, onComment }: { post: SocialPost; onLike: () => void; onComment: () => void }) {
  const liked = post.likes.includes(MY_USER_ID)
  const isMe  = post.userId === MY_USER_ID
  const [showComments, setShowComments] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const { addComment, friends, followUser, unfollowUser } = useSocialStore()
  const isFollowing = friends.includes(post.userId)

  const handleComment = () => {
    if (!commentInput.trim()) return
    addComment(post.id, { userId: MY_USER_ID, userName: MY_USER_NAME, content: commentInput.trim() })
    setCommentInput('')
  }

  return (
    <View style={pc.wrap}>
      {/* Top highlight */}
      <View style={pc.highlight} pointerEvents="none" />

      {/* Header */}
      <View style={pc.header}>
        <View style={pc.avatarCircle}>
          {post.userAvatar
            ? <Image source={{ uri: post.userAvatar }} style={{ flex: 1, borderRadius: 20 }} />
            : <Ionicons name="person" size={18} color={Colors.primary[400]} />
          }
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={pc.name}>{post.userName}</Text>
            <View style={[pc.levelPill, { borderColor: levelColor(post.userLevel) }]}>
              <Text style={[pc.levelTxt, { color: levelColor(post.userLevel) }]}>Nv.{post.userLevel}</Text>
            </View>
          </View>
          <Text style={pc.meta}>{post.userHandle} · {timeAgo(post.createdAt)}</Text>
        </View>
        {!isMe && (
          <TouchableOpacity
            style={[pc.followBtn, isFollowing && pc.followBtnActive]}
            onPress={() => isFollowing ? unfollowUser(post.userId) : followUser(post.userId)}
            activeOpacity={0.78}
          >
            <Text style={[pc.followTxt, isFollowing && pc.followTxtActive]}>
              {isFollowing ? 'Siguiendo' : 'Seguir'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Badges */}
      {post.streak != null && (
        <View style={pc.badge}>
          <Text style={pc.badgeTxt}>🔥 Racha de {post.streak} días</Text>
        </View>
      )}
      {post.achievement && (
        <View style={[pc.badge, { backgroundColor: Colors.accent.yellow + '12', borderColor: Colors.accent.yellow + '35' }]}>
          <Text style={[pc.badgeTxt, { color: Colors.accent.yellow }]}>🏆 {post.achievement}</Text>
        </View>
      )}

      {/* Content */}
      <Text style={pc.content}>{post.content}</Text>

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <View style={pc.mediaWrap}>
          {post.media.map((m, i) => (
            <Image key={i} source={{ uri: m.uri }} style={pc.mediaImg} resizeMode="cover" />
          ))}
        </View>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <View style={pc.tags}>
          {post.tags.map(t => <Text key={t} style={pc.tag}>{t}</Text>)}
        </View>
      )}

      {/* Actions */}
      <View style={pc.actions}>
        <TouchableOpacity style={pc.action} onPress={onLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={19}
            color={liked ? Colors.accent.pink : 'rgba(255,255,255,0.45)'}
          />
          <Text style={[pc.actionTxt, liked && { color: Colors.accent.pink }]}>{post.likes.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pc.action} onPress={() => { setShowComments(v => !v); onComment() }}>
          <Ionicons name="chatbubble-outline" size={17} color="rgba(255,255,255,0.45)" />
          <Text style={pc.actionTxt}>{post.comments.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pc.action}>
          <Ionicons name="arrow-redo-outline" size={18} color="rgba(255,255,255,0.45)" />
          <Text style={pc.actionTxt}>Compartir</Text>
        </TouchableOpacity>
      </View>

      {/* Comments */}
      {showComments && (
        <View style={pc.commentsWrap}>
          {post.comments.map(c => (
            <View key={c.id} style={pc.commentRow}>
              <Text style={pc.commentName}>{c.userName} </Text>
              <Text style={pc.commentTxt}>{c.content}</Text>
            </View>
          ))}
          <View style={pc.commentField}>
            <Ionicons name="person-circle-outline" size={22} color="rgba(255,255,255,0.3)" />
            <TextInput
              style={pc.commentInput}
              value={commentInput}
              onChangeText={setCommentInput}
              placeholder="Añade un comentario..."
              placeholderTextColor="rgba(255,255,255,0.22)"
              onSubmitEditing={handleComment}
              returnKeyType="send"
            />
            {commentInput.trim().length > 0 && (
              <TouchableOpacity onPress={handleComment}>
                <Ionicons name="send" size={18} color={Colors.primary[400]} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  )
}

const pc = StyleSheet.create({
  wrap: {
    backgroundColor: Glass.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Glass.cardBorder,
    padding: Spacing[4],
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: Glass.cardHighlight,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing[3] },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Glass.elevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: `${Colors.primary[500]}55`,
    overflow: 'hidden',
  },
  name: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  meta: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1 },
  levelPill: {
    borderWidth: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  levelTxt: { fontSize: 9, fontWeight: '800' },
  followBtn: {
    borderWidth: 1, borderColor: Colors.primary[500],
    borderRadius: BorderRadius.full,
    paddingHorizontal: 13, paddingVertical: 5,
  },
  followBtnActive: {
    backgroundColor: Glass.elevated,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  followTxt: { fontSize: 11, fontWeight: '700', color: Colors.primary[400] },
  followTxtActive: { color: 'rgba(255,255,255,0.5)' },
  badge: {
    backgroundColor: Glass.purpleTint,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: 7,
    borderWidth: 1, borderColor: Glass.purpleBorder,
  },
  badgeTxt: { fontSize: 11, color: Colors.primary[300], fontWeight: '600' },
  content: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.88)', lineHeight: 21, marginBottom: Spacing[3] },
  mediaWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: Spacing[3] },
  mediaImg: { width: '100%', height: 200, borderRadius: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing[3] },
  tag: { fontSize: 11, color: Colors.primary[400], fontWeight: '600' },
  actions: {
    flexDirection: 'row', gap: Spacing[5], paddingTop: Spacing[3],
    borderTopWidth: 1, borderTopColor: Glass.cardBorder,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 },
  actionTxt: { fontSize: 11, color: 'rgba(255,255,255,0.42)', fontWeight: '600' },
  commentsWrap: {
    marginTop: Spacing[3], paddingTop: Spacing[3],
    borderTopWidth: 1, borderTopColor: Glass.cardBorder,
  },
  commentRow: { flexDirection: 'row', marginBottom: 6, flexWrap: 'wrap' },
  commentName: { fontSize: 11, fontWeight: '700', color: '#fff' },
  commentTxt: { fontSize: 11, color: 'rgba(255,255,255,0.62)' },
  commentField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Glass.elevated, borderRadius: 30,
    paddingHorizontal: Spacing[3], paddingVertical: 8,
    borderWidth: 1, borderColor: Glass.cardBorder, marginTop: Spacing[2],
  },
  commentInput: {
    flex: 1, fontSize: 12, color: '#fff', padding: 0,
  },
})

// ── Create Post Modal ─────────────────────────────────────────────────────────

function CreatePostModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [type, setType]       = useState<'post' | 'story'>('post')
  const [content, setContent] = useState('')
  const [tags, setTags]       = useState('')
  const [mediaUri, setMediaUri] = useState<string | null>(null)
  const [picking, setPicking]   = useState(false)

  const { addPost, addStory } = useSocialStore()
  const { currentStreak }     = useStreakStore()
  const { scoreHistory }      = useHealthStore()
  const healthScore = scoreHistory[0]?.total ?? 0

  const handlePickImage = async () => {
    setPicking(true)
    try {
      const uri = await pickImage()
      if (uri) setMediaUri(uri)
    } finally {
      setPicking(false)
    }
  }

  const handlePublish = () => {
    if (!content.trim()) return
    const tagList = tags.split(/[\s,]+/).filter(t => t.startsWith('#'))
    const base = {
      userId:      MY_USER_ID,
      userName:    MY_USER_NAME,
      userHandle:  MY_USER_HANDLE,
      userLevel:   1,
      type,
      content:     content.trim(),
      tags:        tagList,
      media:       mediaUri ? [{ uri: mediaUri, type: 'image' as const }] : undefined,
      streak:      currentStreak > 0 ? currentStreak : undefined,
      healthScore: healthScore > 0 ? healthScore : undefined,
      isPublic:    true,
    }
    if (type === 'story') addStory(base as any)
    else addPost(base as any)
    setContent('')
    setTags('')
    setMediaUri(null)
    onClose()
  }

  const reset = () => { setContent(''); setTags(''); setMediaUri(null); onClose() }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={reset}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={cm.container}>
          {/* Header */}
          <View style={cm.header}>
            <TouchableOpacity onPress={reset}>
              <Text style={cm.cancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={cm.title}>Compartir</Text>
            <TouchableOpacity
              style={[cm.publishBtn, !content.trim() && { opacity: 0.35 }]}
              onPress={handlePublish}
              disabled={!content.trim()}
            >
              <Text style={cm.publishTxt}>Publicar</Text>
            </TouchableOpacity>
          </View>

          {/* Type tabs */}
          <View style={cm.typeTabs}>
            {(['post', 'story'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[cm.typeTab, type === t && cm.typeTabActive]}
                onPress={() => setType(t)}
              >
                <Ionicons
                  name={t === 'post' ? 'create-outline' : 'time-outline'}
                  size={15}
                  color={type === t ? Colors.primary[400] : 'rgba(255,255,255,0.4)'}
                />
                <Text style={[cm.typeTabTxt, type === t && cm.typeTabTxtActive]}>
                  {t === 'post' ? 'Publicación' : 'Historia (24h)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {/* Compose area */}
            <View style={cm.body}>
              <View style={cm.avatarCircle}>
                <Ionicons name="person" size={20} color={Colors.primary[400]} />
              </View>
              <TextInput
                style={cm.input}
                value={content}
                onChangeText={setContent}
                placeholder="¿Qué quieres compartir hoy?"
                placeholderTextColor="rgba(255,255,255,0.28)"
                multiline
                autoFocus
                maxLength={500}
              />
            </View>

            {/* Selected image preview */}
            {mediaUri && (
              <View style={cm.imgPreviewWrap}>
                <Image source={{ uri: mediaUri }} style={cm.imgPreview} resizeMode="cover" />
                <TouchableOpacity style={cm.removeImg} onPress={() => setMediaUri(null)}>
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Action toolbar */}
            <View style={cm.toolbar}>
              <TouchableOpacity style={cm.toolBtn} onPress={handlePickImage} disabled={picking}>
                {picking
                  ? <ActivityIndicator size="small" color={Colors.primary[400]} />
                  : <Ionicons name="image-outline" size={22} color={Colors.primary[400]} />
                }
                <Text style={cm.toolTxt}>Imagen</Text>
              </TouchableOpacity>
              {currentStreak > 0 && (
                <View style={cm.autoChip}>
                  <Text style={cm.autoChipTxt}>🔥 Racha {currentStreak}d</Text>
                </View>
              )}
            </View>

            {/* Tags */}
            <View style={cm.tagSection}>
              <Text style={cm.tagLabel}>Etiquetas</Text>
              <View style={cm.tagInput}>
                <Ionicons name="pricetag-outline" size={15} color="rgba(255,255,255,0.35)" />
                <TextInput
                  style={{ flex: 1, fontSize: Typography.fontSize.sm, color: '#fff', padding: 0, marginLeft: 8 }}
                  value={tags}
                  onChangeText={setTags}
                  placeholder="#racha #progreso #nutricion"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const cm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[4],
    borderBottomWidth: 1, borderBottomColor: Glass.cardBorder,
  },
  cancel: { fontSize: Typography.fontSize.base, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  title: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff' },
  publishBtn: {
    backgroundColor: Colors.primary[500], borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[5], paddingVertical: 7,
  },
  publishTxt: { color: '#fff', fontWeight: '700', fontSize: Typography.fontSize.sm },
  typeTabs: { flexDirection: 'row', padding: Spacing[4], gap: Spacing[3] },
  typeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing[3], borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Glass.cardBorder,
    backgroundColor: Glass.card,
  },
  typeTabActive: { backgroundColor: Glass.purpleTint, borderColor: Glass.purpleBorder },
  typeTabTxt: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.42)', fontWeight: '600' },
  typeTabTxtActive: { color: Colors.primary[400] },
  body: { flexDirection: 'row', gap: Spacing[3], padding: Spacing[5] },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Glass.elevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: `${Colors.primary[500]}55`,
  },
  input: {
    flex: 1, fontSize: Typography.fontSize.base, color: '#fff',
    lineHeight: 24, minHeight: 120,
  },
  imgPreviewWrap: { marginHorizontal: Spacing[5], borderRadius: 14, overflow: 'hidden', marginBottom: Spacing[3] },
  imgPreview: { width: '100%', height: 200 },
  removeImg: { position: 'absolute', top: 8, right: 8 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingHorizontal: Spacing[5], paddingBottom: Spacing[3],
    borderTopWidth: 1, borderTopColor: Glass.cardBorder, paddingTop: Spacing[3],
  },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolTxt: { fontSize: Typography.fontSize.xs, color: Colors.primary[400], fontWeight: '600' },
  autoChip: {
    backgroundColor: Glass.card, borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Glass.cardBorder,
  },
  autoChipTxt: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  tagSection: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[8] },
  tagLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  tagInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Glass.card, borderRadius: 12,
    borderWidth: 1, borderColor: Glass.cardBorder,
    paddingHorizontal: Spacing[4], paddingVertical: 12,
  },
})

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SocialScreen() {
  const { getFeed, getActiveStories, likePost, unlikePost, pruneExpiredStories, viewedStories } = useSocialStore()
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [storyViewer, setStoryViewer] = useState<{ stories: SocialPost[]; index: number } | null>(null)
  const [tab, setTab] = useState<'feed' | 'discover'>('feed')

  useEffect(() => { pruneExpiredStories() }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    pruneExpiredStories()
    await new Promise(r => setTimeout(r, 700))
    setRefreshing(false)
  }, [])

  const feed    = getFeed()
  const stories = getActiveStories()

  const handleLike = (post: SocialPost) => {
    if (post.likes.includes(MY_USER_ID)) unlikePost(post.id, MY_USER_ID)
    else likePost(post.id, MY_USER_ID)
  }

  return (
    <View style={s.bg}>
      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Comunidad</Text>
            <Text style={s.subtitle}>Conecta, comparte y crece</Text>
          </View>
          <TouchableOpacity style={s.createBtn} onPress={() => setShowCreate(true)} activeOpacity={0.82}>
            <View style={s.createBtnShine} pointerEvents="none" />
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.createTxt}>Compartir</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Stories */}
      <View style={s.storiesWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesRow}>
          {/* My story */}
          <TouchableOpacity style={[sb.wrap, { marginRight: Spacing[4] }]} onPress={() => setShowCreate(true)}>
            <View style={[sb.ring, { borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)' }]}>
              <View style={sb.avatarFill}>
                <Ionicons name="add" size={26} color={Colors.primary[400]} />
              </View>
            </View>
            <Text style={sb.name}>Mi historia</Text>
          </TouchableOpacity>
          {stories.map((story, i) => (
            <StoryBubble
              key={story.id}
              story={story}
              viewed={viewedStories.includes(story.id)}
              onPress={() => setStoryViewer({ stories, index: i })}
            />
          ))}
        </ScrollView>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['feed', 'discover'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Ionicons
              name={t === 'feed' ? 'people-outline' : 'compass-outline'}
              size={15}
              color={tab === t ? Colors.primary[400] : 'rgba(255,255,255,0.38)'}
            />
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'feed' ? 'Siguiendo' : 'Descubrir'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      <FlatList
        data={feed}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <PostCard post={item} onLike={() => handleLike(item)} onComment={() => {}} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[400]} />
        }
        contentContainerStyle={[s.feedContent, feed.length === 0 && { flex: 1 }]}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="people-outline" size={38} color={Colors.primary[400]} />
            </View>
            <Text style={s.emptyTitle}>Sé el primero en compartir</Text>
            <Text style={s.emptySub}>Comparte tu progreso, comidas o logros con la comunidad ZENCRUS.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)} activeOpacity={0.82}>
              <Text style={s.emptyBtnTxt}>Crear publicación</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <CreatePostModal visible={showCreate} onClose={() => setShowCreate(false)} />

      {storyViewer && (
        <StoryViewer
          stories={storyViewer.stories}
          initialIndex={storyViewer.index}
          onClose={() => setStoryViewer(null)}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080808' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[4],
    borderBottomWidth: 1, borderBottomColor: Glass.cardBorder,
  },
  title: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary[500], borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    overflow: 'hidden',
    shadowColor: Colors.primary[500], shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  createBtnShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  createTxt: { color: '#fff', fontWeight: '700', fontSize: Typography.fontSize.xs },
  storiesWrap: { borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  storiesRow: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[4] },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Glass.cardBorder,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing[3] },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary[500] },
  tabTxt: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.38)', fontWeight: '600' },
  tabTxtActive: { color: Colors.primary[400] },
  feedContent: { paddingTop: Spacing[4], paddingBottom: 160 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing[8] },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Glass.purpleTint,
    borderWidth: 1, borderColor: Glass.purpleBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[5],
  },
  emptyTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700', color: '#fff', marginBottom: Spacing[2], textAlign: 'center' },
  emptySub: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.42)', textAlign: 'center', lineHeight: 20, marginBottom: Spacing[6] },
  emptyBtn: {
    backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[6], paddingVertical: Spacing[3],
    shadowColor: Colors.primary[500], shadowOpacity: 0.35, shadowRadius: 12,
  },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: Typography.fontSize.sm },
})
