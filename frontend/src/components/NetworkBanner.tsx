import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Colors, Typography, Spacing } from '@/constants/theme'

export function NetworkBanner() {
  const { isConnected, wasOffline, isWeak } = useNetworkStatus()
  const translateY = useRef(new Animated.Value(-60)).current
  const opacity = useRef(new Animated.Value(0)).current

  const offline = !isConnected
  const visible = offline || wasOffline || isWeak

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: visible ? 0 : -60,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()

    // Si reconectó, ocultar banner luego de 2 segundos
    if (wasOffline) {
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -60, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start()
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [visible, wasOffline])

  const bgColor = offline
    ? Colors.accent.red
    : wasOffline
    ? Colors.accent.green
    : '#FF9F0A'

  const message = offline
    ? '📡 Sin conexión — los cambios se guardarán localmente'
    : wasOffline
    ? '✅ Conexión restaurada'
    : '⚠️ Conexión lenta — puede haber demoras'

  return (
    <Animated.View style={[s.wrap, { backgroundColor: bgColor, transform: [{ translateY }], opacity }]}>
      <Text style={s.txt}>{message}</Text>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  txt: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
})
