import api from './api'

export interface PostAuthor {
  id: string
  full_name: string | null
  username: string | null
  profile_picture: string | null
}

export interface CommunityPost {
  id: string
  user_id: string
  content: string | null
  image_url: string | null
  kind: string
  metadata: Record<string, any>
  likes_count: number
  comments_count: number
  created_at: string
  author: PostAuthor | null
  liked: boolean
}

export interface CommunityComment {
  id: string
  post_id: string
  content: string
  created_at: string
  author: PostAuthor | null
}

export type FeedScope = 'all' | 'following'

export async function fetchFeed(scope: FeedScope = 'all', before?: string): Promise<CommunityPost[]> {
  const { data } = await api.get('/community/feed', { params: { scope, before, limit: 20 } })
  return data?.data ?? []
}

export async function createPost(input: { content?: string; imageUrl?: string; kind?: string; metadata?: Record<string, any> }): Promise<CommunityPost> {
  const { data } = await api.post('/community/posts', input)
  return data?.data
}

export async function deletePost(id: string): Promise<void> {
  await api.delete(`/community/posts/${id}`)
}

export async function likePost(id: string): Promise<void> {
  await api.post(`/community/posts/${id}/like`)
}

export async function unlikePost(id: string): Promise<void> {
  await api.delete(`/community/posts/${id}/like`)
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data } = await api.get(`/community/posts/${postId}/comments`)
  return data?.data ?? []
}

export async function addComment(postId: string, content: string): Promise<CommunityComment> {
  const { data } = await api.post(`/community/posts/${postId}/comments`, { content })
  return data?.data
}

export async function followUser(userId: string): Promise<void> {
  await api.post(`/community/users/${userId}/follow`)
}

export async function unfollowUser(userId: string): Promise<void> {
  await api.delete(`/community/users/${userId}/follow`)
}
