declare module '../../../ai-integration/deepseek-client' {
  export function sendMessage(messages: Array<{ role: string; content: string }>, systemPrompt?: string): Promise<string>
  export function analyzeNutrition(data: unknown): Promise<unknown>
  export function generateMealPlan(data: unknown): Promise<unknown>
  export function generateWorkoutPlan(data: unknown): Promise<unknown>
}
