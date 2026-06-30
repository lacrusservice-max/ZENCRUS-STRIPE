import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme'
import api from '../../services/api'

interface DietPlan {
  id: string
  name: string
  totalCalories: number
  macros: { protein: number; carbs: number; fat: number }
  days: any[]
  isActive: boolean
}

export default function NutritionDashboard(): JSX.Element {
  const { user } = useAuth()
  const [plan, setPlan] = useState<DietPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [caloriesConsumed, setCaloriesConsumed] = useState(0)

  const fetchActivePlan = useCallback(async () => {
    try {
      const { data } = await api.get('/diet/active')
      setPlan(data.data)
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        console.error('Error cargando plan:', error)
      }
      setPlan(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchActivePlan()
  }, [fetchActivePlan])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchActivePlan()
  }, [fetchActivePlan])

  const handleGeneratePlan = useCallback(async () => {
    setGenerating(true)
    try {
      const { data } = await api.post('/diet/generate', { durationDays: 7 })
      setPlan(data.data)
    } catch {
      // Toast de error
    } finally {
      setGenerating(false)
    }
  }, [])

  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })
  const todayDayName = new Date().toLocaleDateString('es-MX', { weekday: 'long' })
  const capitalizedDay = todayDayName.charAt(0).toUpperCase() + todayDayName.slice(1)

  const todayPlan = plan?.days?.find(d => d.day === capitalizedDay) || plan?.days?.[0]
  const calorieProgress = plan ? Math.min(caloriesConsumed / plan.totalCalories, 1) : 0

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
        <Text style={styles.loadingText}>Cargando tu plan...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary[500]} />}
    >
      {/* Saludo */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>Buenos días, {user?.email?.split('@')[0]} 👋</Text>
        <Text style={styles.dateText}>{today}</Text>
      </View>

      {!plan ? (
        /* Estado vacío */
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🥗</Text>
          <Text style={styles.emptyTitle}>Sin plan de dieta aún</Text>
          <Text style={styles.emptySubtitle}>
            Genera tu primer plan personalizado con IA basado en tu perfil y objetivos.
          </Text>
          <Button
            label="✨ Generar mi plan con IA"
            onPress={handleGeneratePlan}
            loading={generating}
            size="lg"
            style={styles.generateButton}
          />
          <Text style={styles.emptyHint}>
            💡 Completa tu perfil primero para obtener mejores resultados
          </Text>
        </View>
      ) : (
        <>
          {/* Resumen calórico */}
          <View style={styles.calorieCard}>
            <View style={styles.calorieHeader}>
              <Text style={styles.calorieTitle}>Calorías hoy</Text>
              <TouchableOpacity onPress={() => router.push('/nutrition/log')}>
                <Text style={styles.logLink}>Registrar comida</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calorieNumbers}>
              <Text style={styles.caloriesConsumed}>{caloriesConsumed}</Text>
              <Text style={styles.caloriesSeparator}> / </Text>
              <Text style={styles.caloriesTotal}>{plan.totalCalories} kcal</Text>
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${calorieProgress * 100}%` }]} />
            </View>

            <Text style={styles.caloriesRemaining}>
              {plan.totalCalories - caloriesConsumed} kcal restantes
            </Text>

            {/* Macros */}
            <View style={styles.macrosRow}>
              {[
                { label: 'Proteínas', value: plan.macros.protein, unit: 'g', color: Colors.secondary[500] },
                { label: 'Carbos', value: plan.macros.carbs, unit: 'g', color: Colors.accent.orange },
                { label: 'Grasas', value: plan.macros.fat, unit: 'g', color: Colors.accent.pink },
              ].map(macro => (
                <View key={macro.label} style={styles.macroItem}>
                  <View style={[styles.macroBar, { backgroundColor: macro.color + '20' }]}>
                    <View style={[styles.macroBarFill, { backgroundColor: macro.color, height: '60%' }]} />
                  </View>
                  <Text style={[styles.macroValue, { color: macro.color }]}>{macro.value}{macro.unit}</Text>
                  <Text style={styles.macroLabel}>{macro.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Comidas del día */}
          {todayPlan ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Comidas de hoy — {todayPlan.day}</Text>

              {todayPlan.meals?.map((meal: any, index: number) => (
                <TouchableOpacity
                  key={index}
                  style={styles.mealCard}
                  onPress={() => router.push({ pathname: '/nutrition/meal', params: { mealIndex: index } })}
                >
                  <View style={styles.mealLeft}>
                    <Text style={styles.mealEmoji}>
                      {['☀️', '🌿', '🍽️', '🌙', '🍎'][index] || '🥗'}
                    </Text>
                    <View>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <Text style={styles.mealTime}>{meal.time}</Text>
                    </View>
                  </View>
                  <View style={styles.mealRight}>
                    <Text style={styles.mealCalories}>{meal.totalCalories} kcal</Text>
                    <Text style={styles.mealItems}>{meal.items?.length || 0} alimentos</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Botones de acción */}
          <View style={styles.actions}>
            <Button
              label="🔄 Regenerar plan"
              onPress={handleGeneratePlan}
              loading={generating}
              variant="outline"
              style={styles.actionButton}
            />
            <Button
              label="📋 Ver historial"
              onPress={() => router.push('/nutrition/history')}
              variant="ghost"
              style={styles.actionButton}
            />
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: Spacing[5], paddingBottom: 100 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.neutral[500], fontSize: Typography.fontSize.sm },

  greeting: { marginBottom: Spacing[6] },
  greetingText: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.bold, color: Colors.neutral[900] },
  dateText: { fontSize: Typography.fontSize.sm, color: Colors.neutral[500], marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: Spacing[10] },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing[4] },
  emptyTitle: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.neutral[900], textAlign: 'center' },
  emptySubtitle: { fontSize: Typography.fontSize.base, color: Colors.neutral[500], textAlign: 'center', marginTop: 8, lineHeight: 22, paddingHorizontal: Spacing[4] },
  generateButton: { width: '100%', marginTop: Spacing[6] },
  emptyHint: { fontSize: Typography.fontSize.sm, color: Colors.neutral[400], textAlign: 'center', marginTop: Spacing[3] },

  calorieCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    marginBottom: Spacing[5],
    ...Shadows.base,
  },
  calorieHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[4] },
  calorieTitle: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.semiBold, color: Colors.neutral[900] },
  logLink: { color: Colors.primary[500], fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.medium },
  calorieNumbers: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  caloriesConsumed: { fontSize: Typography.fontSize['4xl'], fontFamily: Typography.fontFamily.bold, color: Colors.primary[500] },
  caloriesSeparator: { fontSize: Typography.fontSize.xl, color: Colors.neutral[400] },
  caloriesTotal: { fontSize: Typography.fontSize.lg, color: Colors.neutral[500], fontFamily: Typography.fontFamily.medium },
  progressBar: { height: 8, backgroundColor: Colors.neutral[100], borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: Colors.primary[500], borderRadius: 4 },
  caloriesRemaining: { fontSize: Typography.fontSize.sm, color: Colors.neutral[500], marginBottom: Spacing[4] },
  macrosRow: { flexDirection: 'row', justifyContent: 'space-around' },
  macroItem: { alignItems: 'center', gap: 4 },
  macroBar: { width: 40, height: 40, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  macroBarFill: { width: '100%', borderRadius: 8 },
  macroValue: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.bold },
  macroLabel: { fontSize: Typography.fontSize.xs, color: Colors.neutral[500] },

  section: { marginBottom: Spacing[5] },
  sectionTitle: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.neutral[900], marginBottom: Spacing[3] },

  mealCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    marginBottom: Spacing[2],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.sm,
  },
  mealLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealEmoji: { fontSize: 28 },
  mealName: { fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.semiBold, color: Colors.neutral[900] },
  mealTime: { fontSize: Typography.fontSize.xs, color: Colors.neutral[500], marginTop: 2 },
  mealRight: { alignItems: 'flex-end' },
  mealCalories: { fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.bold, color: Colors.primary[500] },
  mealItems: { fontSize: Typography.fontSize.xs, color: Colors.neutral[400] },

  actions: { gap: 8 },
  actionButton: { width: '100%' },
})
