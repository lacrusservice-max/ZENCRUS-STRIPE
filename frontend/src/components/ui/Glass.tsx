import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { Colors, Glass, BorderRadius, Spacing, Typography } from '@/constants/theme'

// ── Glass Card ────────────────────────────────────────────────────────────────

interface GlassCardProps {
  children: React.ReactNode
  style?: ViewStyle
  elevated?: boolean
  accent?: string
  noPad?: boolean
  onPress?: () => void
}

export function GlassCard({ children, style, elevated, accent, noPad, onPress }: GlassCardProps) {
  const s = [
    g.card,
    elevated && g.elevated,
    accent ? { borderColor: accent + '28', shadowColor: accent, shadowOpacity: 0.2 } : undefined,
    !noPad && g.padded,
    style,
  ]

  if (onPress) {
    return (
      <TouchableOpacity style={s} onPress={onPress} activeOpacity={0.82}>
        <View style={g.highlight} pointerEvents="none" />
        {children}
      </TouchableOpacity>
    )
  }

  return (
    <View style={s}>
      <View style={g.highlight} pointerEvents="none" />
      {children}
    </View>
  )
}

// ── Glass Section Label ────────────────────────────────────────────────────────

interface SectionLabelProps {
  children: string
  style?: TextStyle
  action?: string
  onAction?: () => void
}

export function SectionLabel({ children, style, action, onAction }: SectionLabelProps) {
  return (
    <View style={g.sectionRow}>
      <Text style={[g.sectionLabel, style]}>{children.toUpperCase()}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={g.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Glass Badge ────────────────────────────────────────────────────────────────

interface GlassBadgeProps {
  children: string
  color?: string
  size?: 'sm' | 'md'
}

export function GlassBadge({ children, color = Colors.primary[500], size = 'sm' }: GlassBadgeProps) {
  return (
    <View style={[
      g.badge,
      size === 'md' && g.badgeMd,
      { backgroundColor: color + '18', borderColor: color + '35' },
    ]}>
      <Text style={[g.badgeText, { color }, size === 'md' && g.badgeTextMd]}>
        {children}
      </Text>
    </View>
  )
}

// ── Glass Progress Bar ─────────────────────────────────────────────────────────

interface GlassProgressProps {
  pct: number
  color?: string
  height?: number
  style?: ViewStyle
}

export function GlassProgress({ pct, color = Colors.primary[500], height = 4, style }: GlassProgressProps) {
  return (
    <View style={[g.progressBg, { height }, style]}>
      <View style={[g.progressFill, {
        width: `${Math.min(Math.max(pct * 100, 0), 100)}%` as any,
        backgroundColor: color,
        height,
      }]} />
    </View>
  )
}

// ── Glass Separator ────────────────────────────────────────────────────────────

export function GlassSep() {
  return <View style={g.sep} />
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const g = StyleSheet.create({
  card: {
    backgroundColor: Glass.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Glass.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  elevated: {
    backgroundColor: Glass.elevated,
    shadowColor: Colors.primary[500],
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
  padded: {
    padding: Spacing[4],
  },
  highlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: Glass.cardHighlight,
  },
  // Section
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 1.5,
  },
  sectionAction: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary[400],
    fontWeight: '700',
  },
  // Badge
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  badgeMd: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  badgeTextMd: {
    fontSize: 11,
  },
  // Progress
  progressBg: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 4,
  },
  // Separator
  sep: {
    height: 1,
    backgroundColor: Glass.cardBorder,
    marginVertical: Spacing[3],
  },
})
