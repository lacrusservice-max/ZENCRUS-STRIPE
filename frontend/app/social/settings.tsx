/**
 * COMUNIDAD · AJUSTES
 * ───────────────────
 * Todo lo que es de la cuenta y no del perfil: solicitudes, guardados,
 * privacidad y bloqueados.
 *
 * ── Por qué salieron del perfil ─────────────────────────────────────────────
 * Estaban en fila justo debajo de la ficha, entre el avatar y la rejilla. Eso
 * dejaba cuatro cajas grises separando lo único que la gente va a ver ahí —tus
 * publicaciones— de tu cara, y hacía que el perfil pareciera un menú de
 * ajustes con una foto encima. Aquí no estorban, y el perfil vuelve a ser lo
 * que es: ficha y rejilla.
 *
 * ── La rueda de arriba lleva el punto ───────────────────────────────────────
 * Meter las solicitudes de seguimiento aquí dentro las escondería: nadie entra
 * en ajustes a mirar si le han pedido seguirle. Por eso el acceso desde el
 * perfil se enciende cuando hay algo esperando, y el número sigue saliendo en
 * su fila.
 *
 * ── Los subtítulos van cortos a propósito ───────────────────────────────────
 * `Row` los corta a una línea. «Las publicaciones que te apuntaste. Solo tú
 * las ves» se quedaba en «Solo t…», que no dice nada.
 */

import { useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { useAppTheme } from '@/context/ThemeContext'
import { useSocialStore } from '@/store/socialStore'
import { Row } from '@/components/social/Bits'
import { TabBar } from '@/constants/layout'

export default function SocialSettingsScreen() {
  const T = useAppTheme()
  const me = useSocialStore(s => s.me)
  const badges = useSocialStore(s => s.badges)
  const loadBadges = useSocialStore(s => s.loadBadges)

  // Al volver de «Solicitudes» el número tiene que haber bajado.
  useFocusEffect(useCallback(() => { loadBadges() }, []))

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="COMUNIDAD"
        title="Ajustes"
        subtitle="Tu cuenta en la comunidad"
        icon="settings"
      />

      <ScrollView contentContainerStyle={{ paddingBottom: TabBar.scrollInset }} showsVerticalScrollIndicator={false}>
        <Text style={[s.etiqueta, { color: T.ink3 }]}>TU CUENTA</Text>
        <View style={s.grupo}>
          <Row
            icon="create-outline"
            title="Editar perfil"
            sub="Foto, portada, nombre y biografía"
            onPress={() => router.push('/social/edit-profile')}
          />
          <Row
            icon={me?.isPrivate ? 'lock-closed-outline' : 'globe-outline'}
            title="Privacidad"
            sub={me?.isPrivate ? 'Cuenta privada' : 'Cuenta pública'}
            onPress={() => router.push('/social/edit-profile')}
          />
          <Row
            icon="person-add-outline"
            title="Solicitudes de seguimiento"
            sub={badges.followRequests ? 'Hay gente esperando' : 'Nadie esperando'}
            badge={badges.followRequests}
            onPress={() => router.push('/social/requests')}
          />
        </View>

        <Text style={[s.etiqueta, { color: T.ink3 }]}>SOLO TÚ LO VES</Text>
        <View style={s.grupo}>
          <Row
            icon="bookmark-outline"
            title="Guardados"
            sub="Lo que te apuntaste"
            onPress={() => router.push('/social/saved')}
          />
          {/* El ÚNICO sitio desde el que se desbloquea: al perfil de alguien
              bloqueado no se llega, porque para la app no existe. */}
          <Row
            icon="ban-outline"
            title="Cuentas bloqueadas"
            sub="A quién has bloqueado"
            onPress={() => router.push('/social/blocked')}
          />
        </View>

        <Text style={[s.pie, { color: T.ink3 }]}>
          Ni los guardados ni la lista de bloqueados avisan a nadie. Nadie sabe
          que está en ellas.
        </Text>
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  etiqueta: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2,
    marginTop: 22, marginBottom: 11, paddingHorizontal: 20,
  },
  grupo: { paddingHorizontal: 20, gap: 10 },
  pie: { fontSize: 11.5, lineHeight: 17, paddingHorizontal: 24, marginTop: 26, textAlign: 'center' },
})
