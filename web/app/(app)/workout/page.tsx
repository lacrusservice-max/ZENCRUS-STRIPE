"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Dumbbell, Play, CheckCircle, Clock, Zap, Plus, Check, Flame, Footprints, Wind } from "lucide-react";

const ROUTINE_ACCENT: Record<string, { icon: typeof Dumbbell; color: string; glow: string }> = {
  upper: { icon: Dumbbell, color: "#60a5fa", glow: "rgba(37,99,235,0.28)" },
  lower: { icon: Footprints, color: "#f08a4b", glow: "rgba(240,138,75,0.28)" },
  cardio: { icon: Wind, color: "#3fae6b", glow: "rgba(63,174,107,0.28)" },
};

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  muscle: string;
  completed: boolean;
}

interface Routine {
  id: string;
  name: string;
  emoji: string;
  duration: number;
  exercises: Exercise[];
}

const SAMPLE_ROUTINES: Routine[] = [
  {
    id: "upper",
    name: "Tren Superior",
    emoji: "💪",
    duration: 50,
    exercises: [
      { id: "1", name: "Press de banca", sets: 4, reps: "8-10", muscle: "Pecho", completed: false },
      { id: "2", name: "Dominadas", sets: 3, reps: "6-8", muscle: "Espalda", completed: false },
      { id: "3", name: "Press militar", sets: 3, reps: "10-12", muscle: "Hombros", completed: false },
      { id: "4", name: "Curl de bíceps", sets: 3, reps: "12-15", muscle: "Bíceps", completed: false },
      { id: "5", name: "Extensiones tríceps", sets: 3, reps: "12-15", muscle: "Tríceps", completed: false },
    ],
  },
  {
    id: "lower",
    name: "Tren Inferior",
    emoji: "🦵",
    duration: 55,
    exercises: [
      { id: "6", name: "Sentadilla libre", sets: 4, reps: "8-10", muscle: "Cuádriceps", completed: false },
      { id: "7", name: "Peso muerto", sets: 4, reps: "6-8", muscle: "Isquiotibiales", completed: false },
      { id: "8", name: "Prensa de piernas", sets: 3, reps: "12-15", muscle: "Cuádriceps", completed: false },
      { id: "9", name: "Elevación de talones", sets: 4, reps: "20", muscle: "Gemelos", completed: false },
    ],
  },
  {
    id: "cardio",
    name: "Cardio + Core",
    emoji: "🏃",
    duration: 35,
    exercises: [
      { id: "10", name: "Carrera 20min", sets: 1, reps: "20min", muscle: "Cardio", completed: false },
      { id: "11", name: "Plancha", sets: 3, reps: "60s", muscle: "Core", completed: false },
      { id: "12", name: "Abdominales", sets: 3, reps: "20", muscle: "Core", completed: false },
      { id: "13", name: "Mountain climbers", sets: 3, reps: "30", muscle: "Core", completed: false },
    ],
  },
];

export default function WorkoutPage() {
  const router = useRouter();
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutActive, setWorkoutActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);

  const startWorkout = (routine: Routine) => {
    setSelectedRoutine(routine);
    setExercises(routine.exercises.map(e => ({ ...e, completed: false })));
    setWorkoutActive(true);
    setElapsed(0);
    const ref = setInterval(() => setElapsed(s => s + 1), 1000);
    setTimerRef(ref);
  };

  const finishWorkout = () => {
    if (timerRef) clearInterval(timerRef);
    setWorkoutActive(false);
    toast.success("¡Entrenamiento completado! +25 XP");
    setSelectedRoutine(null);
    setExercises([]);
  };

  const toggleExercise = (id: string) => {
    setExercises(prev => prev.map(e => e.id === id ? { ...e, completed: !e.completed } : e));
  };

  const completed = exercises.filter(e => e.completed).length;
  const pct = exercises.length > 0 ? completed / exercises.length : 0;
  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (workoutActive && selectedRoutine) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.4s ease" }}>
        {/* Active workout header */}
        <div style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#30D158", letterSpacing: 3, marginBottom: 4 }}>EN CURSO</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f4f4f5" }}>{selectedRoutine.emoji} {selectedRoutine.name}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#f4f4f5", fontVariantNumeric: "tabular-nums" }}>{formatTime(elapsed)}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Tiempo</div>
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct * 100}%`, background: "#30D158", transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>{completed}/{exercises.length} ejercicios</div>
        </div>

        {/* Exercises */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {exercises.map((ex, i) => (
            <div key={ex.id} className="glass-card" style={{ padding: 0 }}>
              <button
                onClick={() => toggleExercise(ex.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: 16, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: ex.completed ? "#30D158" : "rgba(255,255,255,0.07)", border: ex.completed ? "none" : "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                  {ex.completed ? <Check size={15} color="#fff" strokeWidth={3} /> : <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{i + 1}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ex.completed ? "rgba(255,255,255,0.4)" : "#f4f4f5", textDecoration: ex.completed ? "line-through" : "none" }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{ex.sets} series × {ex.reps} · {ex.muscle}</div>
                </div>
              </button>
            </div>
          ))}
        </div>

        <button onClick={finishWorkout} className="btn-primary" style={{ width: "100%", fontSize: 16 }}>
          <CheckCircle size={18} /> Finalizar entrenamiento
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>
      {/* Header */}
      <div style={{ paddingTop: 32, paddingBottom: 28 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#60a5fa", letterSpacing: 4, marginBottom: 6 }}>ZENCRUS · ENTRENAMIENTO</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, rgba(37,99,235,0.35), rgba(0,194,192,0.2))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Dumbbell size={22} color="#93c5fd" />
          </div>
          <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 40, color: "#f4f4f5", letterSpacing: -0.5 }}>Entrenamiento</div>
        </div>
      </div>

      <div className="wk-grid">
        {/* Main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Quick start — accent hero */}
          <div>
            <div className="section-label">Inicio rápido</div>
            <div className="glass-card-accent">
              <div style={{ padding: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, rgba(37,99,235,0.4), rgba(0,194,192,0.25))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 8px 24px rgba(37,99,235,0.35)" }}>
                    <Zap size={26} color="#93c5fd" />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#f4f4f5" }}>Rutina recomendada por IA</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Basada en tu objetivo y nivel actual</div>
                  </div>
                </div>
                <button onClick={() => startWorkout(SAMPLE_ROUTINES[0])} className="btn-primary" style={{ width: "100%", fontSize: 16, padding: "16px 24px" }}>
                  <Play size={18} fill="#fff" /> Comenzar ahora
                </button>
              </div>
            </div>
          </div>

          {/* Routines */}
          <div>
            <div className="section-label">Mis rutinas</div>
            <div className="wk-routines">
              {SAMPLE_ROUTINES.map(routine => {
                const accent = ROUTINE_ACCENT[routine.id] ?? ROUTINE_ACCENT.upper;
                const Icon = accent.icon;
                return (
                  <div key={routine.id} className="glass-card" style={{ padding: 0 }}>
                    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: accent.glow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={22} color={accent.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>{routine.name}</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={11} />{routine.duration} min · {routine.exercises.length} ejercicios
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => startWorkout(routine)}
                        className="btn-secondary"
                        style={{ width: "100%", background: accent.glow, borderColor: "transparent", color: accent.color, fontWeight: 700 }}
                      >
                        <Play size={14} fill={accent.color} color={accent.color} /> Comenzar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button className="btn-secondary" style={{ width: "100%" }} onClick={() => toast("Creación de rutinas próximamente")}>
            <Plus size={16} /> Crear rutina personalizada
          </button>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="section-label">Esta semana</div>
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Flame size={18} color="#f08a4b" />
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f4f4f5" }}>Racha de entrenamiento</div>
            </div>
            <div style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 700, fontSize: 34, color: "#f4f4f5" }}>3 <span style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", fontFamily: "inherit" }}>sesiones</span></div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Meta semanal: 4 sesiones</div>
            <div className="progress-bar" style={{ marginTop: 14 }}>
              <div className="progress-fill" style={{ width: "75%", background: "linear-gradient(90deg, #2563EB, #00C2C0)" }} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .wk-grid { display: flex; flex-direction: column; gap: 24px; }
        .wk-routines { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 900px) {
          .wk-grid { flex-direction: row; align-items: flex-start; }
          .wk-grid > div:first-child { flex: 1 1 0; min-width: 0; }
          .wk-grid > div:last-child { flex: 0 0 320px; position: sticky; top: 24px; }
          .wk-routines { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
}
