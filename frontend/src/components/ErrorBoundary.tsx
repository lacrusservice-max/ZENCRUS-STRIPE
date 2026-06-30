import React, { Component, ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: '' }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info.componentStack ?? '' })
    // Aquí se conectaría Sentry en producción:
    // Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } })
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.icon}>⚠️</Text>
          <Text style={s.title}>Algo salió mal</Text>
          <Text style={s.subtitle}>
            Ocurrió un error inesperado. Tu sesión y datos están seguros.
          </Text>

          <TouchableOpacity style={s.primaryBtn} onPress={this.reset}>
            <Text style={s.primaryBtnTxt}>Intentar nuevamente</Text>
          </TouchableOpacity>

          {__DEV__ && this.state.error && (
            <View style={s.debugBox}>
              <Text style={s.debugTitle}>Error (solo en desarrollo):</Text>
              <Text style={s.debugTxt}>{this.state.error.message}</Text>
              {this.state.errorInfo ? (
                <Text style={s.debugTxt} numberOfLines={8}>{this.state.errorInfo}</Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    )
  }
}

// ── HOC para wrappear screens individuales ────────────────────────────────────

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  onReset?: () => void
) {
  return function WrappedWithBoundary(props: P) {
    return (
      <ErrorBoundary onReset={onReset}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[8],
  },
  icon: {
    fontSize: 64,
    marginBottom: Spacing[4],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: '800',
    color: Colors.dark.text,
    marginBottom: Spacing[3],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing[8],
  },
  primaryBtn: {
    backgroundColor: Colors.primary[500],
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[8],
    paddingVertical: Spacing[4],
    marginBottom: Spacing[4],
  },
  primaryBtnTxt: {
    fontSize: Typography.fontSize.base,
    fontWeight: '800',
    color: '#fff',
  },
  debugBox: {
    marginTop: Spacing[8],
    padding: Spacing[4],
    backgroundColor: Colors.accent.red + '15',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent.red + '40',
    width: '100%',
  },
  debugTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.accent.red,
    marginBottom: Spacing[2],
  },
  debugTxt: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
})
