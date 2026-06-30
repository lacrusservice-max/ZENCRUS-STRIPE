import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type MediaType = 'image' | 'video'
export type PostType = 'post' | 'story'

export interface SocialMedia {
  uri: string
  type: MediaType
}

export interface SocialComment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  createdAt: string
}

export interface SocialPost {
  id: string
  userId: string
  userName: string
  userHandle: string
  userAvatar?: string
  userLevel: number
  type: PostType
  content: string
  media?: SocialMedia[]
  tags: string[]
  likes: string[]
  comments: SocialComment[]
  createdAt: string
  expiresAt?: string // for stories: +24h
  streak?: number
  healthScore?: number
  achievement?: string
}

export interface FriendRequest {
  id: string
  fromUserId: string
  fromUserName: string
  fromUserHandle: string
  fromUserAvatar?: string
  sentAt: string
}

export interface UserProfile {
  id: string
  name: string
  handle: string
  avatar?: string
  level: number
  xp: number
  streak: number
  healthScore: number
  followersCount: number
  followingCount: number
  postsCount: number
  isFollowing: boolean
}

const DEMO_POSTS: SocialPost[] = [
  {
    id: 'p1',
    userId: 'u1',
    userName: 'María González',
    userHandle: '@mariag',
    userLevel: 5,
    type: 'post',
    content: '¡30 días consecutivos completados! No fue fácil pero aquí estoy. El Coach ZENCRUS me ayudó a ajustar mi dieta esta semana y los resultados son increíbles 💪',
    tags: ['#racha30dias', '#nutricion', '#zencrus'],
    likes: ['u2', 'u3', 'u4'],
    comments: [
      { id: 'c1', userId: 'u2', userName: 'Carlos M.', content: '¡Brutal! Yo voy en el día 18 🔥', createdAt: new Date(Date.now() - 3600000).toISOString() }
    ],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    streak: 30,
    healthScore: 87,
  },
  {
    id: 'p2',
    userId: 'u2',
    userName: 'Carlos Mendoza',
    userHandle: '@carlosfit',
    userLevel: 7,
    type: 'story',
    content: 'Desayuno generado por ZENCRUS IA: Avena con proteína, frutas y mantequilla de almendra. 480 kcal, 35g proteína 🥣',
    tags: ['#breakfast', '#macros'],
    likes: ['u1', 'u3'],
    comments: [],
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    expiresAt: new Date(Date.now() + 79200000).toISOString(),
  },
  {
    id: 'p3',
    userId: 'u3',
    userName: 'Ana Ruiz',
    userHandle: '@anafit',
    userLevel: 3,
    type: 'post',
    content: 'PR en sentadilla hoy: 80kg x 5 reps 🏋️‍♀️ La rutina que me generó ZENCRUS está dando resultados increíbles. Hace 2 meses ni levantaba 40kg.',
    tags: ['#PR', '#powerlifting', '#progreso'],
    likes: ['u1', 'u2', 'u4', 'u5'],
    comments: [],
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    achievement: 'Nuevo récord personal',
  },
]

const DEMO_STORIES: SocialPost[] = DEMO_POSTS.filter(p => p.type === 'story')

interface SocialState {
  posts: SocialPost[]
  stories: SocialPost[]
  friends: string[]
  friendRequests: FriendRequest[]
  myProfile: UserProfile | null
  viewedStories: string[]
  load: () => Promise<void>
  addPost: (post: Omit<SocialPost, 'id' | 'likes' | 'comments' | 'createdAt'>) => void
  addStory: (story: Omit<SocialPost, 'id' | 'likes' | 'comments' | 'createdAt' | 'expiresAt'>) => void
  likePost: (postId: string, userId: string) => void
  unlikePost: (postId: string, userId: string) => void
  addComment: (postId: string, comment: Omit<SocialComment, 'id' | 'createdAt'>) => void
  deletePost: (postId: string) => void
  followUser: (userId: string) => void
  unfollowUser: (userId: string) => void
  sendFriendRequest: (req: Omit<FriendRequest, 'id' | 'sentAt'>) => void
  acceptFriendRequest: (reqId: string) => void
  declineFriendRequest: (reqId: string) => void
  markStoryViewed: (storyId: string) => void
  pruneExpiredStories: () => void
  getActiveStories: () => SocialPost[]
  getFeed: () => SocialPost[]
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      posts: DEMO_POSTS.filter(p => p.type === 'post'),
      stories: DEMO_STORIES,
      friends: ['u1', 'u2', 'u3'],
      friendRequests: [],
      myProfile: null,
      viewedStories: [],

      load: async () => {},

      addPost: (postData) => {
        const post: SocialPost = {
          ...postData,
          id: `p_${Date.now()}`,
          likes: [],
          comments: [],
          createdAt: new Date().toISOString(),
        }
        set(s => ({ posts: [post, ...s.posts] }))
      },

      addStory: (storyData) => {
        const story: SocialPost = {
          ...storyData,
          id: `s_${Date.now()}`,
          type: 'story',
          likes: [],
          comments: [],
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        }
        set(s => ({ stories: [story, ...s.stories] }))
      },

      likePost: (postId, userId) => {
        set(s => ({
          posts: s.posts.map(p =>
            p.id === postId && !p.likes.includes(userId)
              ? { ...p, likes: [...p.likes, userId] }
              : p
          ),
        }))
      },

      unlikePost: (postId, userId) => {
        set(s => ({
          posts: s.posts.map(p =>
            p.id === postId
              ? { ...p, likes: p.likes.filter(id => id !== userId) }
              : p
          ),
        }))
      },

      addComment: (postId, commentData) => {
        const comment: SocialComment = {
          ...commentData,
          id: `c_${Date.now()}`,
          createdAt: new Date().toISOString(),
        }
        set(s => ({
          posts: s.posts.map(p =>
            p.id === postId ? { ...p, comments: [...p.comments, comment] } : p
          ),
        }))
      },

      deletePost: (postId) => {
        set(s => ({ posts: s.posts.filter(p => p.id !== postId) }))
      },

      followUser: (userId) => {
        set(s => ({
          friends: s.friends.includes(userId) ? s.friends : [...s.friends, userId],
        }))
      },

      unfollowUser: (userId) => {
        set(s => ({ friends: s.friends.filter(id => id !== userId) }))
      },

      sendFriendRequest: (req) => {
        const request: FriendRequest = {
          ...req,
          id: `fr_${Date.now()}`,
          sentAt: new Date().toISOString(),
        }
        set(s => ({ friendRequests: [...s.friendRequests, request] }))
      },

      acceptFriendRequest: (reqId) => {
        const req = get().friendRequests.find(r => r.id === reqId)
        if (!req) return
        set(s => ({
          friends: [...s.friends, req.fromUserId],
          friendRequests: s.friendRequests.filter(r => r.id !== reqId),
        }))
      },

      declineFriendRequest: (reqId) => {
        set(s => ({ friendRequests: s.friendRequests.filter(r => r.id !== reqId) }))
      },

      markStoryViewed: (storyId) => {
        set(s => ({
          viewedStories: s.viewedStories.includes(storyId)
            ? s.viewedStories
            : [...s.viewedStories, storyId],
        }))
      },

      pruneExpiredStories: () => {
        const now = new Date().toISOString()
        set(s => ({
          stories: s.stories.filter(st => !st.expiresAt || st.expiresAt > now),
        }))
      },

      getActiveStories: () => {
        const now = new Date().toISOString()
        return get().stories.filter(st => !st.expiresAt || st.expiresAt > now)
      },

      getFeed: () => {
        const { posts } = get()
        return [...posts].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      },
    }),
    { name: 'zencrus-social', storage: createJSONStorage(() => AsyncStorage) }
  )
)
