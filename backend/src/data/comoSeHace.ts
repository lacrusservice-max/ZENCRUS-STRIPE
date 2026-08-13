/**
 * CÓMO SE HACE CADA EJERCICIO
 * ───────────────────────────
 * La explicación que acompaña a los 206: cómo colocarse, cómo mover, hasta
 * dónde llegar y qué error evitar.
 *
 * ── Se COMPONE, no se escribe una por una ───────────────────────────────────
 * Doscientas seis descripciones a mano envejecen mal: en cuanto entren vídeos
 * nuevos, los que falten se quedarán sin explicación y nadie se dará cuenta.
 * Aquí se compone a partir de lo que el catálogo YA sabe de cada ficha —su
 * patrón de movimiento, su músculo y su material—, que es exactamente de lo que
 * depende la técnica. Un ejercicio nuevo trae su explicación el día que entra.
 *
 * ── Por qué el patrón y no el nombre ────────────────────────────────────────
 * Un press de banca, uno inclinado y unos fondos son el mismo gesto —empuje
 * horizontal— con distinta inclinación y distinto material. Lo que cambia entre
 * ellos es la colocación, no el movimiento. Así que el movimiento y el rango
 * salen del patrón, y la colocación se ajusta con el material.
 *
 * ── Las cuatro frases, y por qué esas ───────────────────────────────────────
 *   · COLÓCATE — la mitad de las lesiones y de los estancamientos vienen de
 *     empezar mal, y es lo único que se puede corregir antes de cargar.
 *   · MUEVE — qué hace el cuerpo, en una frase.
 *   · HASTA DÓNDE — el rango. Es lo que más se acorta cuando pesa, y acortarlo
 *     es entrenar menos creyendo que se entrena igual.
 *   · OJO CON — el error que de verdad comete la gente en ese gesto, no una
 *     lista de advertencias genéricas.
 *
 * ── En español y sin jerga ──────────────────────────────────────────────────
 * Nada de «retracción escapular», «core», «hip hinge» ni «ROM». Quien empieza
 * no sabe qué es y se sale de la pantalla. Se dice «junta los omóplatos»,
 * «aprieta el abdomen», «bisagra de cadera» solo si se explica al lado.
 */

export interface ComoSeHace {
  colocate: string
  mueve: string
  hastaDonde: string
  ojoCon: string
}

/** Lo que cambia según con qué se hace el ejercicio. */
const PREPARACION: Record<string, string> = {
  barbell: 'Agarra la barra un poco más abierto que los hombros y apriétala fuerte con las dos manos.',
  dumbbell: 'Coge una mancuerna en cada mano con las muñecas firmes, ni dobladas hacia dentro ni hacia fuera.',
  kettlebell: 'Sujeta la pesa rusa por el asa y deja que el peso cuelgue pegado al antebrazo, no colgando de los dedos.',
  cable: 'Colócate de forma que el cable quede tenso ya desde el principio, sin holgura.',
  machine: 'Ajusta el asiento antes de cargar: la articulación que se mueve tiene que quedar a la altura del eje de la máquina.',
  band: 'Pisa o fija la banda y sepárate hasta que ya esté algo tensa antes de empezar.',
  bodyweight: 'Colócate con los pies firmes y reparte el peso por toda la planta, no solo en la punta.',
  plate: 'Sujeta el disco con las dos manos, pegado al cuerpo.',
  landmine: 'Agarra el extremo libre de la barra con las dos manos y mantenlo pegado al pecho.',
}

/**
 * La técnica por PATRÓN de movimiento.
 *
 * Es lo que de verdad decide cómo se hace un ejercicio: todos los empujes
 * horizontales se hacen igual aunque cambie el banco o el material.
 */
const POR_PATRON: Record<string, ComoSeHace> = {
  'push-horizontal': {
    colocate: 'Junta los omóplatos y mantenlos juntos todo el rato, como si quisieras sujetar un lápiz entre ellos. Los pies bien apoyados en el suelo.',
    mueve: 'Empuja el peso hacia delante separándolo del pecho, y vuelve controlando la bajada. Los codos van hacia dentro, formando una flecha con el cuerpo, no abiertos en cruz.',
    hastaDonde: 'Baja hasta que el peso roce el pecho o los codos queden algo por debajo de los hombros. Arriba, estira sin bloquear del todo.',
    ojoCon: 'Rebotar el peso en el pecho. Quita el trabajo justo a la parte donde estabas ganando fuerza.',
  },
  'push-vertical': {
    colocate: 'De pie o sentado con la espalda recta, aprieta el abdomen y las nalgas para que la zona baja no se arquee.',
    mueve: 'Empuja el peso hacia arriba por encima de la cabeza, apartando la cara ligeramente hacia atrás al pasar. Termina con el peso justo encima de los hombros, no por delante.',
    hastaDonde: 'Baja hasta que las manos queden a la altura de la barbilla y sube hasta estirar los brazos sin bloquear los codos.',
    ojoCon: 'Arquear la espalda baja para llegar arriba. Si te pasa, el peso es demasiado.',
  },
  'pull-horizontal': {
    colocate: 'Inclínate desde la cadera con la espalda recta, el pecho abierto y las rodillas algo flexionadas.',
    mueve: 'Tira llevando los codos hacia atrás, pegados al cuerpo, y termina juntando los omóplatos. Suelta despacio hasta estirar los brazos del todo.',
    hastaDonde: 'Tira hasta que las manos lleguen a la altura del ombligo o el costado. Al soltar, estira hasta notar tirón en la espalda, sin encoger los hombros.',
    ojoCon: 'Tirar con los brazos y no con la espalda. Piensa en llevar los codos atrás, no en doblarlos.',
  },
  'pull-vertical': {
    colocate: 'Agarra por encima de la cabeza con las manos algo más abiertas que los hombros. Baja los hombros antes de empezar: aléjalos de las orejas.',
    mueve: 'Tira hacia abajo llevando los codos hacia las costillas y sacando pecho. Sube controlando, sin dejarte caer.',
    hastaDonde: 'Baja hasta que la barbilla pase la barra o la barra llegue al pecho. Arriba, estira los brazos del todo pero sin quedar colgando de los hombros.',
    ojoCon: 'Balancearte para llegar. Si necesitas impulso, usa la máquina asistida o una goma.',
  },
  squat: {
    colocate: 'Pies a la anchura de los hombros, con las puntas ligeramente hacia fuera. Reparte el peso entre el talón y la base de los dedos.',
    mueve: 'Baja doblando cadera y rodillas a la vez, como si te sentaras en una silla que está algo atrás. Sube empujando el suelo con los pies.',
    hastaDonde: 'Baja al menos hasta que los muslos queden paralelos al suelo, y más si puedes sin que la espalda se redondee. Sube hasta estirar sin echar la cadera hacia delante.',
    ojoCon: 'Que las rodillas se metan hacia dentro al subir. Piensa en separarlas en la dirección de las puntas de los pies.',
  },
  hinge: {
    colocate: 'Pies a la anchura de la cadera y rodillas ligeramente dobladas, casi rectas. Aprieta el abdomen.',
    mueve: 'Lleva la cadera hacia atrás manteniendo la espalda recta, como si cerraras una puerta con el trasero. El peso baja pegado a las piernas. Sube apretando las nalgas.',
    hastaDonde: 'Baja hasta notar tirón detrás de los muslos, normalmente a media espinilla. Para en cuanto la espalda empiece a redondearse: ese es tu límite de hoy.',
    ojoCon: 'Convertirlo en una sentadilla. Aquí la cadera va atrás, no abajo.',
  },
  core: {
    colocate: 'Aprieta el abdomen como si fueras a recibir un golpe suave y mete un poco la pelvis para que la espalda baja no se arquee.',
    mueve: 'Mueve despacio y controlando. En esta zona la velocidad no aporta nada: lo que trabaja es la tensión mantenida.',
    hastaDonde: 'Llega hasta donde puedas mantener la espalda pegada al suelo o la cadera quieta. En cuanto se despega o se cae, has llegado al límite.',
    ojoCon: 'Tirar del cuello con las manos. Las manos solo acompañan la cabeza, no empujan.',
  },
  carry: {
    colocate: 'Coge el peso con la espalda recta y ponte de pie con el pecho alto y los hombros hacia atrás.',
    mueve: 'Camina a paso normal, sin prisa, manteniendo el tronco firme y sin inclinarte hacia ningún lado.',
    hastaDonde: 'Anda la distancia o el tiempo marcados. Para en cuanto empieces a torcerte o a perder el agarre.',
    ojoCon: 'Encoger los hombros hacia las orejas. Déjalos abajo y sujeta con la espalda.',
  },
  stretch: {
    colocate: 'Colócate sin forzar y respira despacio: el estiramiento empieza cuando dejas de apretar.',
    mueve: 'Entra en la postura poco a poco hasta notar tirón, no dolor. Mantén sin rebotar.',
    hastaDonde: 'Aguanta entre veinte y cuarenta segundos y suelta despacio. Si tiembla o duele, has ido demasiado lejos.',
    ojoCon: 'Aguantar la respiración. Suelta el aire despacio y notarás que llegas más lejos sola.',
  },
}

/**
 * La técnica de los AISLAMIENTOS, por músculo.
 *
 * `isolation` son 45 ejercicios y no tienen nada en común: un curl de bíceps,
 * una elevación lateral y un gemelo se hacen de forma distinta. Aquí el músculo
 * es lo que decide, no el patrón.
 */
const AISLAMIENTO_POR_MUSCULO: Record<string, ComoSeHace> = {
  biceps: {
    colocate: 'Pega los codos al costado y déjalos ahí: son una bisagra, no se mueven de sitio.',
    mueve: 'Sube el peso doblando solo el codo, sin balancear el cuerpo. Baja despacio hasta estirar el brazo del todo.',
    hastaDonde: 'Sube hasta que el antebrazo pase de la vertical y baja hasta estirar por completo. La bajada es donde más se gana.',
    ojoCon: 'Ayudarte con la espalda para subir. Si necesitas impulso, baja el peso.',
  },
  triceps: {
    colocate: 'Codos pegados al cuerpo y quietos, apuntando al suelo o hacia arriba según el ejercicio.',
    mueve: 'Estira el codo del todo empujando el peso, y vuelve doblando despacio sin dejar que el codo se abra.',
    hastaDonde: 'Estira hasta notar el tríceps apretado al final y vuelve hasta que el antebrazo toque casi el bíceps.',
    ojoCon: 'Que los codos se separen o suban. En cuanto se mueven, el trabajo se va al hombro.',
  },
  shoulders: {
    colocate: 'De pie con el abdomen apretado. Baja los hombros: sepáralos de las orejas antes de empezar.',
    mueve: 'Sube el peso con los brazos casi rectos, guiando con el codo, no con la mano. Baja controlando.',
    hastaDonde: 'Sube hasta que los brazos queden a la altura del hombro, no más. Por encima el trabajo se va al trapecio.',
    ojoCon: 'Coger impulso con las piernas. Con poco peso y sin balanceo trabaja mucho más.',
  },
  chest: {
    colocate: 'Junta los omóplatos y saca pecho. Los codos algo doblados y fijos así todo el recorrido.',
    mueve: 'Junta las manos por delante del pecho describiendo un arco, como si abrazaras un árbol. Abre despacio.',
    hastaDonde: 'Abre hasta notar estiramiento en el pecho, sin que los hombros se vayan hacia delante. Cierra hasta juntar.',
    ojoCon: 'Doblar los codos para poder con más peso. Eso lo convierte en un press.',
  },
  back: {
    colocate: 'Espalda recta y hombros bajos. Sujeta el tronco firme para que solo se muevan los brazos.',
    mueve: 'Lleva el peso hacia el cuerpo pensando en juntar los omóplatos, y suelta hasta estirar del todo.',
    hastaDonde: 'Tira hasta juntar la espalda y suelta hasta notar tirón, sin encoger los hombros.',
    ojoCon: 'Redondear la espalda al soltar el peso. Mantenla recta todo el recorrido.',
  },
  quads: {
    colocate: 'Siéntate con la espalda apoyada y la rodilla alineada con el eje de la máquina.',
    mueve: 'Estira la rodilla subiendo el peso y baja despacio sin dejar que la pila toque abajo.',
    hastaDonde: 'Sube hasta estirar casi del todo y baja hasta que la rodilla pase de los noventa grados.',
    ojoCon: 'Dar tirones al final para llegar. Baja el peso y sube limpio.',
  },
  hamstrings: {
    colocate: 'Coloca la almohadilla justo encima del talón, no sobre el gemelo.',
    mueve: 'Dobla la rodilla llevando el talón hacia el trasero y vuelve despacio.',
    hastaDonde: 'Dobla hasta donde llegues sin que la cadera se despegue, y vuelve casi hasta estirar.',
    ojoCon: 'Levantar la cadera para ayudarte. Si se despega, hay demasiado peso.',
  },
  glutes: {
    colocate: 'Aprieta el abdomen y mete un poco la pelvis para que el trabajo no se vaya a la espalda baja.',
    mueve: 'Empuja con la cadera apretando fuerte las nalgas arriba, y baja controlando.',
    hastaDonde: 'Sube hasta que el cuerpo quede recto de rodillas a hombros, sin pasarte arqueando la espalda.',
    ojoCon: 'Arquear la zona lumbar arriba en vez de apretar el glúteo. Debe notarse en la nalga, no en la espalda.',
  },
  calves: {
    colocate: 'Apoya la base de los dedos en el escalón y deja el talón al aire.',
    mueve: 'Sube todo lo que puedas de puntillas y baja despacio dejando caer el talón por debajo del escalón.',
    hastaDonde: 'Arriba, hasta el tope. Abajo, hasta notar el estiramiento del gemelo. El recorrido completo es lo que hace que crezca.',
    ojoCon: 'Rebotar. Aguanta un segundo arriba y otro abajo.',
  },
  forearms: {
    colocate: 'Apoya los antebrazos y deja que solo la muñeca quede libre.',
    mueve: 'Sube y baja el peso doblando únicamente la muñeca, despacio.',
    hastaDonde: 'Recorrido completo: hasta arriba y hasta que el peso casi se abra en la mano.',
    ojoCon: 'Mover el codo. Si se mueve, el antebrazo deja de trabajar.',
  },
  core: {
    colocate: 'Aprieta el abdomen y mantén la zona baja de la espalda pegada al suelo o firme.',
    mueve: 'Mueve despacio, sin impulso. Aquí lo que trabaja es aguantar, no ir rápido.',
    hastaDonde: 'Hasta donde puedas sin que la espalda se despegue ni la cadera se caiga.',
    ojoCon: 'Aguantar la respiración. Respira aunque estés apretando.',
  },
  fullbody: {
    colocate: 'Pies firmes, abdomen apretado y espalda recta antes de mover nada.',
    mueve: 'Encadena el movimiento de piernas, cadera y brazos sin pausas, controlando el peso.',
    hastaDonde: 'Recorrido completo en cada repetición. Si tienes que acortarlo, baja el peso.',
    ojoCon: 'Perder la postura al cansarte. Es mejor parar la serie que hacer dos repeticiones torcidas.',
  },
}

/** Cuando no hay ni patrón ni músculo conocidos. Honesto y útil. */
const GENERICA: ComoSeHace = {
  colocate: 'Colócate con la espalda recta, el abdomen apretado y los pies firmes.',
  mueve: 'Haz el movimiento controlando las dos fases, sin coger impulso.',
  hastaDonde: 'Recorrido completo en cada repetición: si tienes que acortarlo, es que pesa demasiado.',
  ojoCon: 'Ir deprisa. La técnica se pierde con la velocidad antes que con el peso.',
}

/**
 * Cómo se hace este ejercicio.
 *
 * El orden de decisión no es casual: primero el patrón, porque es lo que manda
 * en la técnica; y solo cuando el patrón no dice nada útil —`isolation`, o
 * ninguno— se recurre al músculo.
 */
export function comoSeHace(e: {
  pattern?: string | null
  muscle?: string | null
  equipment?: string
}): ComoSeHace {
  const base =
    (e.pattern && e.pattern !== 'isolation' ? POR_PATRON[e.pattern] : undefined)
    ?? (e.muscle ? AISLAMIENTO_POR_MUSCULO[e.muscle] : undefined)
    ?? GENERICA

  const prep = e.equipment ? PREPARACION[e.equipment] : undefined

  // La preparación del material va DELANTE de la del patrón: primero se coge el
  // peso y después se coloca el cuerpo, que es el orden en que ocurre.
  return prep ? { ...base, colocate: `${prep} ${base.colocate}` } : base
}
