import api from './api'

export interface ChatMessage {
  id: string
  session_id: string
  sender_type: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChatSession {
  id: string
  user_id: string
  created_at: string
  messages: ChatMessage[]
}

const chatService = {
  getOrCreateSession: async (): Promise<ChatSession> => {
    const { data } = await api.post('/chat/session')
    return data.data
  },

  getHistory: async (sessionId: string): Promise<ChatMessage[]> => {
    const { data } = await api.get(`/chat/sessions/${sessionId}/messages`)
    return data.data ?? []
  },

  sendMessage: async (sessionId: string, content: string): Promise<ChatMessage> => {
    const { data } = await api.post(`/chat/sessions/${sessionId}/messages`, { content })
    return data.data
  },

  getSessions: async (): Promise<ChatSession[]> => {
    const { data } = await api.get('/chat/sessions')
    return data.data ?? []
  },
}

export default chatService
