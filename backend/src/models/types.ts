// ── Enums ──────────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'admin' | 'nutritionist'
export type Gender = 'male' | 'female' | 'other'
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'
export type SubscriptionTier = 'free' | 'monthly' | 'annual_individual' | 'annual_duo' | 'annual_familiar'
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending'
export type PaymentProvider = 'stripe' | 'mercadopago' | 'none'
export type PlanGeneratedBy = 'ai' | 'nutritionist' | 'user'
export type WorkoutGoal = 'strength' | 'hypertrophy' | 'endurance' | 'functional'
export type MessageSenderType = 'user' | 'ai' | 'nutritionist'
export type ChatStatus = 'active' | 'resolved' | 'archived'
export type NotificationType = 'reminder' | 'alert' | 'promotion' | 'system'
export type UserGoal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'performance'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

// ── User Models ───────────────────────────────────────────────────────────────

export interface UserGoals {
  primary: UserGoal
  targetWeight?: number
  targetDate?: string
}

export interface HealthConditions {
  diabetes?: boolean
  hypertension?: boolean
  allergies?: string[]
  injuries?: string[]
  otherConditions?: string[]
}

export interface DietaryPreferences {
  vegetarian?: boolean
  vegan?: boolean
  glutenFree?: boolean
  lactoseFree?: boolean
  halal?: boolean
  kosher?: boolean
  otherRestrictions?: string[]
}

export interface User {
  id: string
  email: string
  passwordHash: string
  fullName: string
  birthDate?: string
  gender?: Gender
  phone?: string
  role: UserRole
  profilePicture?: string
  fitnessLevel?: FitnessLevel
  activityLevel?: ActivityLevel
  goals?: UserGoals
  healthConditions?: HealthConditions
  dietaryPreferences?: DietaryPreferences
  weight?: number
  height?: number
  subscriptionTier: SubscriptionTier
  subscriptionExpiresAt?: Date
  emailVerified: boolean
  emailVerificationCode?: string
  emailVerificationExpires?: Date
  twoFactorEnabled: boolean
  twoFactorSecret?: string
  deviceFingerprint?: string
  fcmToken?: string
  failedLoginAttempts: number
  lockedUntil?: Date
  refreshTokenFamily?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastLogin?: Date
}

export type UserPublic = Omit<
  User,
  | 'passwordHash'
  | 'emailVerificationCode'
  | 'emailVerificationExpires'
  | 'twoFactorSecret'
  | 'deviceFingerprint'
  | 'refreshTokenFamily'
  | 'failedLoginAttempts'
  | 'lockedUntil'
>

// ── Diet Plan Models ──────────────────────────────────────────────────────────

export interface Macros {
  protein: number
  carbs: number
  fat: number
}

export interface MealItem {
  name: string
  quantity: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface Meal {
  name: string
  time: string
  items: MealItem[]
  totalCalories: number
}

export interface DayPlan {
  day: string
  meals: Meal[]
  totalCalories: number
  macros: Macros
  notes?: string
}

export interface DietPlan {
  id: string
  userId: string
  name: string
  description?: string
  totalCalories: number
  macros: Macros
  days: DayPlan[]
  generatedBy: PlanGeneratedBy
  validatedBy?: string
  startDate: string
  endDate?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// ── Workout Models ────────────────────────────────────────────────────────────

export interface ExerciseSet {
  sets: number
  reps: string
  rest: number
  notes?: string
}

export interface WorkoutExercise {
  exerciseId: string
  name: string
  muscleGroup: string
  sets: ExerciseSet[]
  videoUrl?: string
}

export interface WorkoutDay {
  day: number
  name: string
  focus: string
  exercises: WorkoutExercise[]
  warmUp: string[]
  coolDown: string[]
  estimatedDuration: number
}

export interface WorkoutRoutine {
  id: string
  userId: string
  name: string
  description?: string
  level: FitnessLevel
  goal: WorkoutGoal
  daysPerWeek: number
  days: WorkoutDay[]
  generatedBy: PlanGeneratedBy
  validatedBy?: string
  startDate: string
  endDate?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// ── Exercise Models ───────────────────────────────────────────────────────────

export interface InstructionStep {
  step: number
  description: string
}

export interface Exercise {
  id: string
  name: string
  description: string
  muscleGroup: string
  equipment: string[]
  difficulty: FitnessLevel
  videoUrl?: string
  imageUrl?: string
  instructions: InstructionStep[]
  safetyTips?: string
  createdBy: string
  isVerified: boolean
  createdAt: Date
  updatedAt: Date
}

// ── Chat Models ───────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string
  userId: string
  title: string
  status: ChatStatus
  createdAt: Date
  updatedAt: Date
}

export interface Attachment {
  type: 'image' | 'file'
  url: string
  name: string
}

export interface Message {
  id: string
  sessionId: string
  senderType: MessageSenderType
  content: string
  attachments?: Attachment[]
  createdAt: Date
}

// ── Subscription Models ───────────────────────────────────────────────────────

export interface Subscription {
  id: string
  userId: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  paymentProvider: PaymentProvider
  paymentId?: string
  startDate: Date
  endDate: Date
  autoRenew: boolean
  createdAt: Date
  updatedAt: Date
}

// ── Notification Models ───────────────────────────────────────────────────────

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  isRead: boolean
  scheduledFor?: Date
  sentAt?: Date
  createdAt: Date
}

// ── API Response Models ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
