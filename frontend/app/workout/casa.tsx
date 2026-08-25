/**
 * ENTRENA · EN CASA
 * ═════════════════
 * La portada de quien entrena en el salón.
 *
 * ── Lo que había antes, y por qué se tiró ───────────────────────────────────
 * «En casa» era una pantalla propia y mucho más pobre: elegir minutos, elegir
 * zona y a correr. El gimnasio, en cambio, tenía el plan de varias semanas, la
 * semana en vertical, el anillo, las marcas, las rutinas y el material.
 *
 * O sea que quien entrena en casa se quedaba sin todo eso por vivir donde vive.
 * Y no había ninguna razón para ello: el modelo de sesiones, los programas y
 * los récords nunca han distinguido el lugar — `mode` es una columna más.
 *
 * Ahora las dos son `PortadaEntreno` y lo único que cambia es el lugar, que
 * viene fijado desde aquí y se arrastra a todo lo que cuelga: la biblioteca
 * entra filtrada por los que se hacen sin material, el historial por lo hecho
 * en casa, y el entrenamiento rápido se genera solo con lo que cabe en un
 * salón. No hay nada que marcar en ningún sitio.
 */

import { PortadaEntreno } from '@/components/workout/PortadaEntreno'

export default function EnCasa() {
  return <PortadaEntreno modo="home" />
}
