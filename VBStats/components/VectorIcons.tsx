/**
 * Iconos vectoriales personalizados para VBStats
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../styles';

interface IconProps {
  size?: number;
  color?: string;
}

// Icono de menú hamburguesa (3 rayitas)
export const MenuIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.menuLine, { backgroundColor: color, width: size * 0.75 }]} />
    <View style={[styles.menuLine, { backgroundColor: color, width: size * 0.75, marginVertical: size * 0.15 }]} />
    <View style={[styles.menuLine, { backgroundColor: color, width: size * 0.75 }]} />
  </View>
);

// Icono de equipo (personas)
export const TeamIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Persona central */}
    <View style={[styles.personHead, { 
      width: size * 0.3, 
      height: size * 0.3, 
      borderRadius: size * 0.15,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.05,
    }]} />
    <View style={[styles.personBody, { 
      width: size * 0.45, 
      height: size * 0.35, 
      borderTopLeftRadius: size * 0.2,
      borderTopRightRadius: size * 0.2,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.38,
    }]} />
    {/* Persona izquierda */}
    <View style={[styles.personHead, { 
      width: size * 0.22, 
      height: size * 0.22, 
      borderRadius: size * 0.11,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.18,
      left: size * 0.02,
      opacity: 0.7,
    }]} />
    <View style={[styles.personBody, { 
      width: size * 0.32, 
      height: size * 0.28, 
      borderTopLeftRadius: size * 0.15,
      borderTopRightRadius: size * 0.15,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.42,
      left: 0,
      opacity: 0.7,
    }]} />
    {/* Persona derecha */}
    <View style={[styles.personHead, { 
      width: size * 0.22, 
      height: size * 0.22, 
      borderRadius: size * 0.11,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.18,
      right: size * 0.02,
      opacity: 0.7,
    }]} />
    <View style={[styles.personBody, { 
      width: size * 0.32, 
      height: size * 0.28, 
      borderTopLeftRadius: size * 0.15,
      borderTopRightRadius: size * 0.15,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.42,
      right: 0,
      opacity: 0.7,
    }]} />
  </View>
);

// Icono de play (comenzar partido)
export const PlayIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.playCircle, { 
      width: size, 
      height: size, 
      borderRadius: size / 2,
      borderColor: color,
    }]}>
      <View style={{
        width: 0,
        height: 0,
        marginLeft: size * 0.1,
        borderLeftWidth: size * 0.35,
        borderTopWidth: size * 0.22,
        borderBottomWidth: size * 0.22,
        borderLeftColor: color,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
      }} />
    </View>
  </View>
);

// Icono de estadísticas (barras)
export const StatsIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: size * 0.1 }]}>
    <View style={[styles.statsBar, { backgroundColor: color, width: size * 0.18, height: size * 0.4 }]} />
    <View style={[styles.statsBar, { backgroundColor: color, width: size * 0.18, height: size * 0.7 }]} />
    <View style={[styles.statsBar, { backgroundColor: color, width: size * 0.18, height: size * 0.55 }]} />
    <View style={[styles.statsBar, { backgroundColor: color, width: size * 0.18, height: size * 0.85 }]} />
  </View>
);

// Icono de usuario/perfil
export const UserIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={[styles.personHead, { 
      width: size * 0.4, 
      height: size * 0.4, 
      borderRadius: size * 0.2,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.05,
    }]} />
    <View style={[styles.personBody, { 
      width: size * 0.7, 
      height: size * 0.4, 
      borderTopLeftRadius: size * 0.35,
      borderTopRightRadius: size * 0.35,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.5,
    }]} />
  </View>
);

// Icono de cerrar sesión (puerta con flecha)
export const LogoutIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Puerta */}
    <View style={{
      width: size * 0.5,
      height: size * 0.8,
      borderWidth: 2,
      borderColor: color,
      borderRadius: 2,
      position: 'absolute',
      left: 0,
    }} />
    {/* Flecha */}
    <View style={{
      width: size * 0.35,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      right: size * 0.05,
      top: size * 0.45,
    }} />
    <View style={{
      width: 0,
      height: 0,
      position: 'absolute',
      right: 0,
      top: size * 0.32,
      borderLeftWidth: size * 0.18,
      borderTopWidth: size * 0.13,
      borderBottomWidth: size * 0.13,
      borderLeftColor: color,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    }} />
  </View>
);

// Icono de cerrar (X)
export const CloseIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.8,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      transform: [{ rotate: '45deg' }],
    }} />
    <View style={{
      width: size * 0.8,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      transform: [{ rotate: '-45deg' }],
    }} />
  </View>
);

// Icono de agregar (+)
export const AddIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.7,
      height: 3,
      backgroundColor: color,
      position: 'absolute',
      borderRadius: 1.5,
    }} />
    <View style={{
      width: 3,
      height: size * 0.7,
      backgroundColor: color,
      position: 'absolute',
      borderRadius: 1.5,
    }} />
  </View>
);

// Icono de flecha derecha (>)
export const ChevronRightIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.35,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      transform: [{ rotate: '45deg' }],
      top: size * 0.28,
    }} />
    <View style={{
      width: size * 0.35,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      transform: [{ rotate: '-45deg' }],
      top: size * 0.52,
    }} />
  </View>
);

// Icono de voleibol
export const VolleyballIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {/* Líneas del balón */}
      <View style={{
        width: size * 0.9,
        height: 1.5,
        backgroundColor: color,
        position: 'absolute',
      }} />
      <View style={{
        width: 1.5,
        height: size * 0.9,
        backgroundColor: color,
        position: 'absolute',
      }} />
      <View style={{
        width: size * 0.65,
        height: 1.5,
        backgroundColor: color,
        position: 'absolute',
        transform: [{ rotate: '45deg' }],
      }} />
      <View style={{
        width: size * 0.65,
        height: 1.5,
        backgroundColor: color,
        position: 'absolute',
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  </View>
);

// Icono de inicio / home
export const HomeIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size, justifyContent: 'center' }]}>
    <View style={{
      width: size * 0.75,
      height: size * 0.55,
      backgroundColor: 'transparent',
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderRightWidth: 2,
      borderColor: color,
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2,
      position: 'absolute',
      bottom: size * 0.08,
    }} />
    <View style={{
      width: 0,
      height: 0,
      borderLeftWidth: size * 0.38,
      borderRightWidth: size * 0.38,
      borderBottomWidth: size * 0.28,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: color,
      position: 'absolute',
      top: 0,
    }} />
  </View>
);

// Icono de configuración (engranaje)
export const SettingsIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.5,
      height: size * 0.5,
      borderRadius: size * 0.25,
      borderWidth: 2,
      borderColor: color,
      position: 'absolute',
    }} />
    {/* Dientes del engranaje */}
    {[0, 45, 90, 135].map((angle, index) => (
      <View key={index} style={{
        width: 3,
        height: size * 0.25,
        backgroundColor: color,
        position: 'absolute',
        transform: [{ rotate: `${angle}deg` }, { translateY: -size * 0.35 }],
      }} />
    ))}
  </View>
);

// Icono de editar (lápiz)
export const EditIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.6,
      height: size * 0.15,
      backgroundColor: color,
      position: 'absolute',
      transform: [{ rotate: '-45deg' }],
      borderRadius: 2,
    }} />
    <View style={{
      width: 0,
      height: 0,
      position: 'absolute',
      bottom: size * 0.12,
      left: size * 0.12,
      borderLeftWidth: size * 0.08,
      borderRightWidth: size * 0.08,
      borderTopWidth: size * 0.15,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: color,
      transform: [{ rotate: '-45deg' }],
    }} />
  </View>
);

// Icono de eliminar (papelera)
export const DeleteIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Tapa */}
    <View style={{
      width: size * 0.7,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.15,
    }} />
    <View style={{
      width: size * 0.25,
      height: 2,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.08,
    }} />
    {/* Cuerpo */}
    <View style={{
      width: size * 0.55,
      height: size * 0.55,
      borderWidth: 2,
      borderColor: color,
      borderTopWidth: 0,
      position: 'absolute',
      bottom: size * 0.1,
      borderBottomLeftRadius: 3,
      borderBottomRightRadius: 3,
    }} />
  </View>
);

// Icono de recepción (persona juntando antebrazos)
export const ReceptionIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Cabeza */}
    <View style={{
      width: size * 0.22,
      height: size * 0.22,
      borderRadius: size * 0.11,
      backgroundColor: color,
      position: 'absolute',
      top: 0,
    }} />
    {/* Cuerpo */}
    <View style={{
      width: size * 0.3,
      height: size * 0.28,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.24,
      borderTopLeftRadius: size * 0.1,
      borderTopRightRadius: size * 0.1,
    }} />
    {/* Brazo izquierdo */}
    <View style={{
      width: size * 0.35,
      height: 3,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.45,
      left: size * 0.05,
      transform: [{ rotate: '35deg' }],
      borderRadius: 1.5,
    }} />
    {/* Brazo derecho */}
    <View style={{
      width: size * 0.35,
      height: 3,
      backgroundColor: color,
      position: 'absolute',
      top: size * 0.45,
      right: size * 0.05,
      transform: [{ rotate: '-35deg' }],
      borderRadius: 1.5,
    }} />
    {/* Antebrazos juntos (rectángulo horizontal) */}
    <View style={{
      width: size * 0.5,
      height: size * 0.12,
      backgroundColor: color,
      position: 'absolute',
      bottom: size * 0.15,
      borderRadius: size * 0.06,
    }} />
  </View>
);

// Icono de ataque (mano simple)
export const AttackIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Palma */}
    <View style={{
      width: size * 0.35,
      height: size * 0.55,
      backgroundColor: color,
      borderTopLeftRadius: size * 0.12,
      borderTopRightRadius: size * 0.12,
      borderBottomLeftRadius: size * 0.08,
      borderBottomRightRadius: size * 0.12,
      position: 'absolute',
      left: size * 0.32,
      bottom: size * 0.08,
    }} />
    {/* Dedos */}
    {[0, 1, 2, 3].map((i) => (
      <View
        key={i}
        style={{
          width: size * 0.08,
          height: size * 0.32,
          backgroundColor: color,
          borderTopLeftRadius: size * 0.04,
          borderTopRightRadius: size * 0.04,
          position: 'absolute',
          top: size * 0.08,
          left: size * (0.24 + i * 0.09),
        }}
      />
    ))}
    {/* Pulgar */}
    <View style={{
      width: size * 0.16,
      height: size * 0.22,
      backgroundColor: color,
      borderRadius: size * 0.08,
      position: 'absolute',
      bottom: size * 0.14,
      left: size * 0.18,
      transform: [{ rotate: '-35deg' }],
    }} />
  </View>
);

// Icono de bloqueo (dos manos juntas levantadas)
export const BlockIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Mano izquierda */}
    <View style={{
      width: size * 0.38,
      height: size * 0.55,
      backgroundColor: color,
      position: 'absolute',
      left: size * 0.02,
      top: size * 0.08,
      borderTopLeftRadius: size * 0.15,
      borderTopRightRadius: size * 0.15,
      borderBottomLeftRadius: size * 0.08,
      borderBottomRightRadius: size * 0.08,
    }} />
    {/* Mano derecha */}
    <View style={{
      width: size * 0.38,
      height: size * 0.55,
      backgroundColor: color,
      position: 'absolute',
      right: size * 0.02,
      top: size * 0.08,
      borderTopLeftRadius: size * 0.15,
      borderTopRightRadius: size * 0.15,
      borderBottomLeftRadius: size * 0.08,
      borderBottomRightRadius: size * 0.08,
    }} />
    {/* Muñecas */}
    <View style={{
      width: size * 0.15,
      height: size * 0.22,
      backgroundColor: color,
      position: 'absolute',
      left: size * 0.13,
      bottom: size * 0.08,
      borderRadius: size * 0.04,
    }} />
    <View style={{
      width: size * 0.15,
      height: size * 0.22,
      backgroundColor: color,
      position: 'absolute',
      right: size * 0.13,
      bottom: size * 0.08,
      borderRadius: size * 0.04,
    }} />
  </View>
);

// Icono de saque (pelota de voleibol)
export const ServeIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.85,
      height: size * 0.85,
      borderRadius: size * 0.425,
      borderWidth: 2,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {/* Líneas del balón de voleibol */}
      <View style={{
        width: size * 0.75,
        height: 2,
        backgroundColor: color,
        position: 'absolute',
      }} />
      <View style={{
        width: 2,
        height: size * 0.75,
        backgroundColor: color,
        position: 'absolute',
      }} />
      <View style={{
        width: size * 0.55,
        height: 2,
        backgroundColor: color,
        position: 'absolute',
        transform: [{ rotate: '45deg' }],
      }} />
      <View style={{
        width: size * 0.55,
        height: 2,
        backgroundColor: color,
        position: 'absolute',
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  </View>
);

// Icono de defensa (escudo simple)
export const DefenseIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.75,
      height: size * 0.85,
      borderWidth: 2,
      borderColor: color,
      backgroundColor: 'transparent',
      borderTopLeftRadius: size * 0.375,
      borderTopRightRadius: size * 0.375,
      borderBottomLeftRadius: size * 0.15,
      borderBottomRightRadius: size * 0.15,
    }} />
  </View>
);

// Icono de colocación (dos manos con balón entre ellas)
export const SetIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Balón en el centro */}
    <View style={{
      width: size * 0.32,
      height: size * 0.32,
      borderRadius: size * 0.16,
      borderWidth: 2,
      borderColor: color,
      position: 'absolute',
      top: size * 0.1,
    }} />
    {/* Mano izquierda */}
    <View style={{
      width: size * 0.25,
      height: size * 0.35,
      backgroundColor: color,
      position: 'absolute',
      left: size * 0.02,
      top: size * 0.38,
      borderRadius: size * 0.08,
      transform: [{ rotate: '15deg' }],
    }} />
    {/* Mano derecha */}
    <View style={{
      width: size * 0.25,
      height: size * 0.35,
      backgroundColor: color,
      position: 'absolute',
      right: size * 0.02,
      top: size * 0.38,
      borderRadius: size * 0.08,
      transform: [{ rotate: '-15deg' }],
    }} />
    {/* Muñeca izquierda */}
    <View style={{
      width: size * 0.12,
      height: size * 0.18,
      backgroundColor: color,
      position: 'absolute',
      left: size * 0.1,
      bottom: size * 0.02,
      borderRadius: size * 0.03,
    }} />
    {/* Muñeca derecha */}
    <View style={{
      width: size * 0.12,
      height: size * 0.18,
      backgroundColor: color,
      position: 'absolute',
      right: size * 0.1,
      bottom: size * 0.02,
      borderRadius: size * 0.03,
    }} />
  </View>
);

// Icono de advertencia (triángulo con exclamación)
export const WarningIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: 0,
      height: 0,
      borderLeftWidth: size * 0.4,
      borderRightWidth: size * 0.4,
      borderBottomWidth: size * 0.7,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: color,
      position: 'absolute',
      top: size * 0.1,
    }} />
    <View style={{
      width: 2,
      height: size * 0.28,
      backgroundColor: Colors.surface,
      position: 'absolute',
      top: size * 0.28,
    }} />
    <View style={{
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: Colors.surface,
      position: 'absolute',
      bottom: size * 0.22,
    }} />
  </View>
);

// Icono de doble plus (++)
export const DoublePlusIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
    {/* Primer + */}
    <View style={{ position: 'absolute', left: size * 0.15 }}>
      <View style={{ width: size * 0.32, height: 3, backgroundColor: color, borderRadius: 1.5, position: 'absolute' }} />
      <View style={{ width: 3, height: size * 0.32, backgroundColor: color, borderRadius: 1.5, position: 'absolute', left: (size * 0.32 - 3) / 2 }} />
    </View>
    {/* Segundo + */}
    <View style={{ position: 'absolute', right: size * 0.15 }}>
      <View style={{ width: size * 0.32, height: 3, backgroundColor: color, borderRadius: 1.5, position: 'absolute' }} />
      <View style={{ width: 3, height: size * 0.32, backgroundColor: color, borderRadius: 1.5, position: 'absolute', left: (size * 0.32 - 3) / 2 }} />
    </View>
  </View>
);

// Icono de plus (+)
export const PlusIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{ width: size * 0.6, height: 2.5, backgroundColor: color, position: 'absolute', borderRadius: 1.25 }} />
    <View style={{ width: 2.5, height: size * 0.6, backgroundColor: color, position: 'absolute', borderRadius: 1.25 }} />
  </View>
);

// Icono de minus (-)
export const MinusIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{ width: size * 0.6, height: 2.5, backgroundColor: color, borderRadius: 1.25 }} />
  </View>
);

// Icono de X (error)
export const XIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.65,
      height: 2.5,
      backgroundColor: color,
      position: 'absolute',
      transform: [{ rotate: '45deg' }],
      borderRadius: 1.25,
    }} />
    <View style={{
      width: size * 0.65,
      height: 2.5,
      backgroundColor: color,
      position: 'absolute',
      transform: [{ rotate: '-45deg' }],
      borderRadius: 1.25,
    }} />
  </View>
);

// Icono de tick/check (✓)
export const TickIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.25,
      height: 2.5,
      backgroundColor: color,
      position: 'absolute',
      left: size * 0.2,
      top: size * 0.55,
      transform: [{ rotate: '45deg' }],
      borderRadius: 1.25,
    }} />
    <View style={{
      width: size * 0.5,
      height: 2.5,
      backgroundColor: color,
      position: 'absolute',
      left: size * 0.3,
      top: size * 0.45,
      transform: [{ rotate: '-45deg' }],
      borderRadius: 1.25,
    }} />
  </View>
);

// Icono de diana/target (punto directo)
export const TargetIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.8,
      height: size * 0.8,
      borderRadius: size * 0.4,
      borderWidth: 2.5,
      borderColor: color,
    }}>
      <View style={{
        width: size * 0.5,
        height: size * 0.5,
        borderRadius: size * 0.25,
        borderWidth: 2.5,
        borderColor: color,
        position: 'absolute',
        top: size * 0.115,
        left: size * 0.115,
      }}>
        <View style={{
          width: size * 0.2,
          height: size * 0.2,
          borderRadius: size * 0.1,
          backgroundColor: color,
          position: 'absolute',
          top: size * 0.115,
          left: size * 0.115,
        }} />
      </View>
    </View>
  </View>
);

// Icono de ubicación/lugar (pin de mapa)
export const LocationIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    <View style={{
      width: size * 0.5,
      height: size * 0.65,
      borderRadius: size * 0.25,
      borderTopLeftRadius: size * 0.25,
      borderTopRightRadius: size * 0.25,
      borderBottomLeftRadius: size * 0.6,
      borderBottomRightRadius: size * 0.6,
      borderWidth: 2.5,
      borderColor: color,
      position: 'absolute',
      top: size * 0.05,
    }}>
      <View style={{
        width: size * 0.2,
        height: size * 0.2,
        borderRadius: size * 0.1,
        backgroundColor: color,
        position: 'absolute',
        top: size * 0.08,
        left: size * 0.08,
      }} />
    </View>
  </View>
);

// Icono de avión (visitante)
export const PlaneIcon = ({ size = 24, color = Colors.text }: IconProps) => (
  <View style={[styles.iconContainer, { width: size, height: size }]}>
    {/* Fuselaje */}
    <View style={{
      width: size * 0.7,
      height: size * 0.15,
      backgroundColor: color,
      borderRadius: size * 0.075,
      position: 'absolute',
      top: size * 0.425,
      left: size * 0.15,
    }} />
    {/* Alas */}
    <View style={{
      width: size * 0.85,
      height: size * 0.1,
      backgroundColor: color,
      borderRadius: size * 0.05,
      position: 'absolute',
      top: size * 0.45,
      left: size * 0.075,
    }} />
    {/* Cola */}
    <View style={{
      width: size * 0.15,
      height: size * 0.3,
      backgroundColor: color,
      borderTopLeftRadius: size * 0.075,
      borderTopRightRadius: size * 0.075,
      position: 'absolute',
      top: size * 0.2,
      left: size * 0.75,
    }} />
  </View>
);

const styles = StyleSheet.create({
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLine: {
    height: 2,
    borderRadius: 1,
  },
  personHead: {},
  personBody: {},
  playCircle: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsBar: {
    borderRadius: 2,
  },
});

export default {
  MenuIcon,
  TeamIcon,
  PlayIcon,
  StatsIcon,
  UserIcon,
  LogoutIcon,
  HomeIcon,
  CloseIcon,
  AddIcon,
  ChevronRightIcon,
  VolleyballIcon,
  SettingsIcon,
  EditIcon,
  DeleteIcon,
  ReceptionIcon,
  AttackIcon,
  BlockIcon,
  ServeIcon,
  DefenseIcon,
  SetIcon,
  WarningIcon,
  DoublePlusIcon,
  PlusIcon,
  MinusIcon,
  XIcon,
  TickIcon,
  TargetIcon,
  LocationIcon,
  PlaneIcon,
};
