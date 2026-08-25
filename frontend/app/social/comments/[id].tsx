/**
 * COMUNIDAD · COMENTARIOS (desvío)
 * ────────────────────────────────
 * Los comentarios ya no tienen pantalla propia: viven dentro de la publicación,
 * en `app/social/post/[id].tsx`.
 *
 * ── Por qué queda este fichero ──────────────────────────────────────────────
 * Esta dirección salió en avisos push ya enviados y puede estar guardada en
 * teléfonos que todavía no se han actualizado. Borrarla dejaría esos avisos
 * llevando a una pantalla que no existe. El desvío cuesta cuatro líneas y
 * cubre eso; se puede borrar cuando ya no queden avisos viejos circulando.
 *
 * `replace` y no `push`: si no, volver atrás desde la publicación caería aquí
 * otra vez y rebotaría en bucle.
 */

import { Redirect, useLocalSearchParams } from 'expo-router'

export default function ComentariosDesvio() {
  const { id } = useLocalSearchParams<{ id: string }>()
  if (!id) return <Redirect href="/social" />
  return <Redirect href={`/social/post/${id}`} />
}
