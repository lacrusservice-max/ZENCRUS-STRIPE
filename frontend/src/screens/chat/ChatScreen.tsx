import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme'
import api from '../../services/api'
import { detectMedicalEmergency } from '../../../ai-integration/validators'

interface Message {
  id: string
  senderType: 'user' | 'ai' | 'nutritionist'
  content: string
  createdAt: Date
}

const QUICK_SUGGESTIONS = [
  '¿Qué puedo comer antes de entrenar?',
  '¿Cuánta proteína necesito al día?',
  '¿Cómo mejorar mi sueño?',
  '¿Qué snacks saludables recomiendas?',
]

export default function ChatScreen({ sessionId }: { sessionId?: string }): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null)
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    if (!currentSessionId) {
      initSession()
    } else {
      loadSession()
    }
  }, [])

  const initSession = useCallback(async () => {
    try {
      const { data } = await api.post('/chat/sessions', { title: 'Nueva conversación' })
      setCurrentSessionId(data.data.session.id)
      setMessages(data.data.messages || [])
    } catch {
      setMessages([{
        id: 'init',
        senderType: 'ai',
        content: '⚕️ **Aviso:** Soy un asistente de IA. No sustituyo a un profesional de la salud.\n\n¡Hola! Soy ZENCRUS 🌿 ¿En qué puedo ayudarte?',
        createdAt: new Date(),
      }])
    }
  }, [])

  const loadSession = useCallback(async () => {
    if (!currentSessionId) return
    try {
      const { data } = await api.get(`/chat/sessions/${currentSessionId}`)
      setMessages(data.data.messages || [])
    } catch {
      // Sesión no encontrada — crear nueva
      initSession()
    }
  }, [currentSessionId, initSession])

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text || inputText).trim()
    if (!messageText || sending) return

    setInputText('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Detectar emergencias médicas
    if (typeof detectMedicalEmergency === 'function' && detectMedicalEmergency(messageText)) {
      const emergencyMsg: Message = {
        id: Date.now().toString(),
        senderType: 'ai',
        content: '🚨 **Atención médica urgente**\n\nLo que describes puede ser una emergencia. Por favor:\n\n• **Llama al 911** inmediatamente\n• **Cruz Roja:** 800-911-2000\n\nNo soy un médico y no puedo ayudarte en emergencias. Tu seguridad es lo más importante.',
        createdAt: new Date(),
      }

      const userMsg: Message = { id: 'u-' + Date.now(), senderType: 'user', content: messageText, createdAt: new Date() }
      setMessages(prev => [...prev, userMsg, emergencyMsg])
      return
    }

    const userMessage: Message = {
      id: 'temp-' + Date.now(),
      senderType: 'user',
      content: messageText,
      createdAt: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setSending(true)

    try {
      const { data } = await api.post(`/chat/sessions/${currentSessionId}/messages`, {
        content: messageText,
      })

      setMessages(prev => [
        ...prev.filter(m => m.id !== userMessage.id),
        data.data.userMessage,
        data.data.aiMessage,
      ])
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.id !== userMessage.id),
        {
          id: 'error-' + Date.now(),
          senderType: 'ai',
          content: 'Lo siento, tuve un problema al responder. ¿Puedes intentarlo de nuevo?',
          createdAt: new Date(),
        },
      ])
    } finally {
      setSending(false)
    }
  }, [inputText, sending, currentSessionId])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages])

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser = item.senderType === 'user'

    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAI]}>
        {!isUser ? (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>🌿</Text>
          </View>
        ) : null}

        <View style={[styles.messageBubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          {!isUser ? (
            <Text style={styles.senderName}>ZENCRUS</Text>
          ) : null}
          <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAI]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isUser ? styles.messageTimeUser : styles.messageTimeAI]}>
            {new Date(item.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    )
  }, [])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={88}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={sending ? (
          <View style={styles.typingIndicator}>
            <Text style={styles.avatar}>🌿</Text>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={Colors.primary[500]} />
              <Text style={styles.typingText}>ZENCRUS está escribiendo...</Text>
            </View>
          </View>
        ) : null}
      />

      {/* Sugerencias rápidas */}
      {messages.length <= 1 ? (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>Preguntas frecuentes:</Text>
          <View style={styles.suggestionsGrid}>
            {QUICK_SUGGESTIONS.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => sendMessage(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Pregunta sobre nutrición o fitness..."
          placeholderTextColor={Colors.neutral[400]}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={() => sendMessage()}
          disabled={!inputText.trim() || sending}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  messagesList: { padding: Spacing[4], paddingBottom: Spacing[2] },

  messageRow: { flexDirection: 'row', marginBottom: Spacing[3], maxWidth: '85%' },
  messageRowUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  messageRowAI: { alignSelf: 'flex-start' },

  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  avatar: { fontSize: 16 },

  messageBubble: {
    borderRadius: BorderRadius.lg,
    padding: Spacing[3],
    maxWidth: '100%',
    ...Shadows.sm,
  },
  bubbleUser: {
    backgroundColor: Colors.primary[500],
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: Colors.light.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
  },

  senderName: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.primary[600],
    marginBottom: 4,
  },
  messageText: { fontSize: Typography.fontSize.sm, lineHeight: 20 },
  messageTextUser: { color: '#fff' },
  messageTextAI: { color: Colors.neutral[800] },
  messageTime: { fontSize: 10, marginTop: 4 },
  messageTimeUser: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  messageTimeAI: { color: Colors.neutral[400] },

  typingIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing[2], gap: 8 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing[3],
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.neutral[100],
  },
  typingText: { fontSize: Typography.fontSize.sm, color: Colors.neutral[500] },

  suggestions: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[2] },
  suggestionsTitle: { fontSize: Typography.fontSize.xs, color: Colors.neutral[400], marginBottom: 8 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    backgroundColor: Colors.primary[50],
    borderRadius: BorderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  suggestionText: { fontSize: Typography.fontSize.xs, color: Colors.primary[600], fontFamily: Typography.fontFamily.medium },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing[3],
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[100],
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[4],
    paddingVertical: Platform.OS === 'ios' ? Spacing[3] : Spacing[2],
    fontSize: Typography.fontSize.sm,
    color: Colors.neutral[900],
    maxHeight: 120,
    backgroundColor: Colors.light.background,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: Colors.neutral[200] },
  sendIcon: { color: '#fff', fontSize: 16 },
})
