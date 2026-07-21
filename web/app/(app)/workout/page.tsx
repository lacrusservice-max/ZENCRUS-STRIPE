"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Dumbbell, Play, CheckCircle, Clock, Zap, Plus } from "lucide-react";

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
                  {ex.completed ? <span style={{ fontSize: 14, color: "#fff" }}>✓</span> : <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{i + 1}</span>}
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
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 20px 120px", animation: "fadeIn 0.5s ease" }}>
      {/* Header */}
      <div style={{ paddingTop: 24, paddingBottom: 20 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: "#2563EB", letterSpacing: 3.5, marginBottom: 4 }}>ZENCRUS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Dumbbell size={24} color="#f4f4f5" />
          <div style={{ fontSize: 24, fontWeight: 800, color: "#f4f4f5" }}>Entrenamiento</div>
        </div>
      </div>

      {/* Quick start */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-label">Inicio rápido</div>
        <div className="glass-card" style={{ padding: 20, background: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(37,99,235,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={24} color="#60a5fa" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f4f4f5" }}>Rutina recomendada por IA</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Basada en tu objetivo y nivel</div>
            </div>
          </div>
          <button onClick={() => startWorkout(SAMPLE_ROUTINES[0])} className="btn-primary" style={{ width: "100%" }}>
            <Play size={16} fill="#fff" /> Comenzar ahora
          </button>
        </div>
      </div>

      {/* Routines */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-label">Mis rutinas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SAMPLE_ROUTINES.map(routine => (
            <div key={routine.id} className="glass-card" style={{ padding: 0 }}>
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {routine.emoji}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f4f4f5" }}>{routine.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      <Clock size={10} style={{ display: "inline", marginRight: 4 }} />{routine.duration} min · {routine.exercises.length} ejercicios
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => startWorkout(routine)}
                  style={{ width: 36, height: 36, borderRadius: "50%", background: "#2563EB", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Play size={14} fill="#fff" color="#fff" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-secondary" style={{ width: "100%" }} onClick={() => toast("Creación de rutinas próximamente")}>
        <Plus size={16} /> Crear rutina personalizada
      </button>
    </div>
  );
}
