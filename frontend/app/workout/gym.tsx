/**
 * ENTRENA · GIMNASIO
 * ══════════════════
 * La portada de quien entrena en un gimnasio.
 *
 * Todo el cuerpo de esta pantalla vive en `PortadaEntreno`, compartido con
 * «En casa». No es que se parezcan: es LA MISMA pantalla, servida con el lugar
 * ya decidido. Tenerla dos veces escrita garantizaba que una de las dos se
 * quedara atrás en cuanto se tocara algo, y de hecho ya había pasado: casa se
 * quedó sin plan, sin semana, sin anillo y sin récords.
 *
 * Lo que aporta este fichero es una sola cosa: el lugar.
 */

import { PortadaEntreno } from '@/components/workout/PortadaEntreno'

export default function Gimnasio() {
  return <PortadaEntreno modo="gym" />
}
