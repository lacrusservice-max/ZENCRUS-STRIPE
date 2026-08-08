import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Switch, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMedicalIdStore, EmergencyContact } from '@/store/medicalIdStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+', 'No sé']

export default function MedicalIdScreen() {
  const { data, update } = useMedicalIdStore()
  const [contactName, setContactName] = useState('')
  const [contactRel, setContactRel] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const addContact = () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      Alert.alert('Faltan datos', 'Nombre y teléfono son obligatorios.')
      return
    }
    const contact: EmergencyContact = { name: contactName.trim(), relationship: contactRel.trim() || 'Contacto', phone: contactPhone.trim() }
    update({ contacts: [...data.contacts, contact] })
    setContactName(''); setContactRel(''); setContactPhone('')
  }

  const removeContact = (idx: number) => {
    update({ contacts: data.contacts.filter((_, i) => i !== idx) })
  }

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="Zencrus · Salud"
        title="ID médica"
        subtitle="Datos críticos para una emergencia"
        icon="medical"
        color={Colors.accent.red}
      />

      <ScrollView contentContainerStyle={{ padding: Spacing[5], paddingBottom: Spacing[16] }}>
        <View style={s.notice}>
          <Ionicons name="medical-outline" size={18} color={Colors.accent.red} />
          <Text style={s.noticeTxt}>
            Esta información se guarda solo en tu dispositivo, para que la tengas a la mano si alguien necesita ayudarte en una emergencia. ZENCRUS no es un dispositivo médico ni sustituye atención profesional.
          </Text>
        </View>

        <Text style={s.sectionTitle}>Tipo de sangre</Text>
        <View style={s.bloodGrid}>
          {BLOOD_TYPES.map(bt => (
            <TouchableOpacity key={bt} style={[s.bloodChip, data.bloodType === bt && s.bloodChipOn]} onPress={() => update({ bloodType: bt })}>
              <Text style={[s.bloodChipTxt, data.bloodType === bt && s.bloodChipTxtOn]}>{bt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field label="Alergias" value={data.allergies} onChangeText={v => update({ allergies: v })} placeholder="Ej. Penicilina, mariscos, polen" />
        <Field label="Condiciones médicas" value={data.conditions} onChangeText={v => update({ conditions: v })} placeholder="Ej. Asma, diabetes tipo 1" />
        <Field label="Medicamentos actuales" value={data.medications} onChangeText={v => update({ medications: v })} placeholder="Ej. Insulina, inhalador de rescate" />
        <Field label="Notas adicionales" value={data.notes} onChangeText={v => update({ notes: v })} placeholder="Cualquier otra cosa que un paramédico debería saber" multiline />

        <View style={s.donorRow}>
          <Text style={s.donorLabel}>Donador de órganos</Text>
          <Switch value={data.organDonor} onValueChange={v => update({ organDonor: v })} trackColor={{ true: Colors.primary[500], false: 'rgba(255,255,255,0.18)' }} thumbColor="#fff" />
        </View>

        <Text style={[s.sectionTitle, { marginTop: Spacing[6] }]}>Contactos de emergencia</Text>
        {data.contacts.map((c, i) => (
          <View key={i} style={s.contactRow}>
            <View style={s.contactIcon}><Ionicons name="call" size={15} color={Colors.primary[400]} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactName}>{c.name} <Text style={s.contactRel}>· {c.relationship}</Text></Text>
              <Text style={s.contactPhone}>{c.phone}</Text>
            </View>
            <TouchableOpacity onPress={() => removeContact(i)}><Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.3)" /></TouchableOpacity>
          </View>
        ))}

        <View style={s.addContactCard}>
          <TextInput style={s.input} value={contactName} onChangeText={setContactName} placeholder="Nombre" placeholderTextColor="rgba(255,255,255,0.3)" />
          <View style={{ flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[3] }}>
            <TextInput style={[s.input, { flex: 1 }]} value={contactRel} onChangeText={setContactRel} placeholder="Relación (mamá, pareja...)" placeholderTextColor="rgba(255,255,255,0.3)" />
            <TextInput style={[s.input, { flex: 1 }]} value={contactPhone} onChangeText={setContactPhone} placeholder="Teléfono" keyboardType="phone-pad" placeholderTextColor="rgba(255,255,255,0.3)" />
          </View>
          <TouchableOpacity style={s.addBtn} onPress={addContact}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addBtnTxt}>Agregar contacto</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  )
}

function Field({ label, value, onChangeText, placeholder, multiline }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: Spacing[4] }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        multiline={multiline}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },

  notice: { flexDirection: 'row', gap: Spacing[3], backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.22)', borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[6] },
  noticeTxt: { flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },

  sectionTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff', marginBottom: Spacing[3] },
  bloodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginBottom: Spacing[5] },
  bloodChip: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder },
  bloodChipOn: { backgroundColor: 'rgba(255,59,48,0.15)', borderColor: 'rgba(255,59,48,0.4)' },
  bloodChipTxt: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  bloodChipTxtOn: { color: Colors.accent.red },

  fieldLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.md, padding: Spacing[3], fontSize: Typography.fontSize.sm, color: '#fff' },

  donorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing[3] },
  donorLabel: { fontSize: Typography.fontSize.sm, color: '#fff', fontWeight: '600' },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Glass.cardBorder },
  contactIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Glass.purpleTint, alignItems: 'center', justifyContent: 'center' },
  contactName: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  contactRel: { color: 'rgba(255,255,255,0.4)', fontWeight: '400' },
  contactPhone: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  addContactCard: { backgroundColor: Glass.card, borderWidth: 1, borderColor: Glass.cardBorder, borderRadius: BorderRadius.lg, padding: Spacing[4], marginTop: Spacing[3] },
  addBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, paddingVertical: Spacing[3], marginTop: Spacing[3] },
  addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: Typography.fontSize.sm },
})
