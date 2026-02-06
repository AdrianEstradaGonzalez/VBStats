/**
 * Pantalla de Guía de Uso y Comparación de Roles
 * Incluye tabs para navegación entre Guía y Roles
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Dimensions,
  Modal,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../styles';
import { MenuIcon, ReceptionIcon, AttackIcon, BlockIcon, ServeIcon, DefenseIcon, SetIcon } from '../components/VectorIcons';

// Safe area paddings para Android
const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 24;
const ANDROID_NAV_BAR_HEIGHT = 48;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GuideScreenProps {
  onBack?: () => void;
  onOpenMenu?: () => void;
  onSelectPlan?: () => void;
  /** Si se pasa, muestra inicialmente este tab */
  initialTab?: TabType;
  /** Si true, muestra solo el tab de Planes (roles) y oculta la Guía */
  onlyRoles?: boolean;
}

type TabType = 'guide' | 'roles';

interface GuideSection {
  id: string;
  icon: string;
  title: string;
  description: string;
  steps?: string[];
}

interface RoleFeature {
  feature: string;
  free: boolean | string;
  basic: boolean | string;
  pro: boolean | string;
}

// Colores de las categorías de estadísticas
const STAT_COLORS = {
  reception: '#3b82f6',
  attack: '#f59e0b',
  block: '#10b981',
  serve: '#8b5cf6',
  defense: '#ef4444',
  set: '#06b6d4',
};

type InfoModalType = 'basicConfig' | 'proConfig' | null;

export default function GuideScreen({ onBack, onOpenMenu, onSelectPlan, initialTab, onlyRoles }: GuideScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? (onlyRoles ? 'roles' : 'guide'));
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);

  // Secciones de la guía
  const guideSections: GuideSection[] = [
    {
      id: 'teams',
      icon: 'account-group',
      title: 'Gestión de Equipos',
      description: 'Crea y administra tus equipos de voleibol con todos sus jugadores.',
      steps: [
        'Ve a "Mis Equipos" desde el menú lateral',
        'Pulsa el botón "+" para crear un nuevo equipo',
        'Añade jugadores con su nombre, número de dorsal y posición',
        'Guarda el equipo para gestionar sus estadísticas',
      ],
    },
    {
      id: 'match',
      icon: 'volleyball',
      title: 'Comenzar un Partido',
      description: 'Inicia un partido y registra estadísticas en tiempo real.',
      steps: [
        'Pulsa "Comenzar Partido" en el menú',
        'Selecciona tu equipo',
        'Configura el partido (sets, nombre rival)',
        'Selecciona los jugadores titulares',
        'Pulsa "Iniciar" para iniciar el registro del primer set',
        'Selecciona el set actual para consultar las estadísticas recogidas hasta el momento',
        'Pulsa "Finalizar" para terminar el set o partido',
      ],
    },
    {
      id: 'stats',
      icon: 'chart-line',
      title: 'Registrar Estadísticas',
      description: 'Captura cada acción durante el partido de forma rápida e intuitiva.',
      steps: [
        'Durante el partido, verás el campo con los jugadores titulares',
        'Selecciona la acción realizada (saque, ataque, bloqueo, recepción, defensa, colocación) para el jugador correspondiente',
        'Selecciona el icono representativo de la acción (punto directo, doble positivo, positivo, neutro, error)',
        'La estadística se registra automáticamente',
      ],
    },
    {
      id: 'config',
      icon: 'cog',
      title: 'Configuración de Estadísticas',
      description: 'Personaliza qué estadísticas quieres registrar según tus necesidades.',
      steps: [
        'Ve a "Configuración" desde el menú',
        'Se pueden configurar todas las acciones que incluye tu plan (activar o desactivar las acciones), realizando una configuración completamente personalizada',
        'Se pueden establecer configuraciones predeterminadas básica o avanzada (plan PRO)',
      ],
    },
    {
      id: 'view',
      icon: 'eye',
      title: 'Consultar Estadísticas',
      description: 'Visualiza las estadísticas de tus partidos con diferentes filtros.',
      steps: [
        'Ve a "Estadísticas" desde el menú',
        'Selecciona un partido para ver sus estadísticas',
        'Filtra por set o el partido para análisis detallado',
        'Selecciona un jugador específico si lo deseas',
        'Navega entre las diferentes métricas',
      ],
    },
    {
      id: 'export',
      icon: 'file-export',
      title: 'Exportar Estadísticas',
      description: 'Descarga tus estadísticas en formato Excel para análisis externo.',
      steps: [
        'Abre las estadísticas de un partido',
        'Pulsa el botón de exportar (📤)',
        'Selecciona el formato deseado',
        'Comparte a través de redes sociales las estadísticas exportadas o genera un fichero Excel (función PRO)',
      ],
    },
    {
      id: 'tracking',
      icon: 'trending-up',
      title: 'Seguimiento de Progreso',
      description: 'Visualiza la evolución de tu equipo con gráficos avanzados.',
      steps: [
        'Accede a "Seguimiento" desde Estadísticas',
        'Selecciona el equipo',
        'Visualiza gráficos de línea, barras o dispersión',
        'Analiza tendencias y patrones de rendimiento',
        'Función exclusiva para usuarios PRO',
      ],
    },
    {
      id: 'scoreboard',
      icon: 'scoreboard',
      title: 'Marcador',
      description: 'Usa el marcador para seguir el resultado sin recoger estadísticas.',
      steps: [
        'Ve a "Marcador" desde el menú',
        'Configura los nombres de los equipos',
        'Usa los botones para sumar puntos',
        'El marcador gestiona automáticamente los sets',
        'Disponible para todos los usuarios',
      ],
    },
  ];

  // Características por rol - con campo especial para info button
  interface RoleFeatureExtended extends RoleFeature {
    infoType?: 'basicConfig' | 'proConfig';
  }

  const roleFeatures: RoleFeatureExtended[] = [
    { feature: 'Crear equipos', free: false, basic: '2 equipos', pro: 'Ilimitados' },
    { feature: 'Jugadores por equipo', free: false, basic: 'Ilimitados', pro: 'Ilimitados' },
    { feature: 'Partidos guardados', free: false, basic: 'Ilimitados', pro: 'Ilimitados' },
    { feature: 'Buscar partido por código', free: true, basic: true, pro: true },
    { feature: 'Marcador básico', free: true, basic: true, pro: true },
    { feature: 'Configuración de estadísticas', free: false, basic: true, pro: true, infoType: 'basicConfig' },
    { feature: 'Estadísticas avanzadas', free: false, basic: false, pro: true, infoType: 'proConfig' },
    { feature: 'Ver estadísticas de partido', free: false, basic: true, pro: true },
    { feature: 'Filtrar por set', free: false, basic: true, pro: true },
    { feature: 'Filtrar por jugador', free: false, basic: true, pro: true },
    { feature: 'Exportar a Excel', free: false, basic: false, pro: true },
    { feature: 'Seguimiento del equipo', free: false, basic: false, pro: true },
  ];

  // Render de un item de la guía
  const renderGuideSection = (section: GuideSection) => (
    <View key={section.id} style={styles.guideCard}>
      <View style={styles.guideCardHeader}>
        <View style={styles.guideIconContainer}>
          <MaterialCommunityIcons name={section.icon} size={28} color={Colors.primary} />
        </View>
        <Text style={styles.guideCardTitle}>{section.title}</Text>
      </View>
      <Text style={styles.guideCardDescription}>{section.description}</Text>
      {section.steps && (
        <View style={styles.stepsContainer}>
          {section.steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // Render icono de estado (check/cross)
  const renderFeatureStatus = (status: boolean | string) => {
    if (typeof status === 'string') {
      return <Text style={styles.featureLimitText}>{status}</Text>;
    }
    return status ? (
      <MaterialCommunityIcons name="check-circle" size={20} color="#22c55e" />
    ) : (
      <MaterialCommunityIcons name="close-circle" size={20} color="#ef4444" />
    );
  };

  // Render tabla de comparación de roles
  const renderRolesComparison = () => (
    <View style={styles.rolesContainer}>
      {/* Header de la tabla */}
      <View style={styles.tableHeader}>
        <View style={styles.featureColumn}>
          <Text style={styles.tableHeaderText}>Característica</Text>
        </View>
        <View style={styles.roleColumn}>
          <View style={[styles.roleBadge, { backgroundColor: Colors.textSecondary + '20' }]}>
            <Text style={[styles.roleBadgeText, { color: Colors.textSecondary }]}>GRATIS</Text>
          </View>
        </View>
        <View style={styles.roleColumn}>
          <View style={[styles.roleBadge, { backgroundColor: '#3b82f6' + '20' }]}>
            <Text style={[styles.roleBadgeText, { color: '#3b82f6' }]}>BÁSICO</Text>
          </View>
        </View>
        <View style={styles.roleColumn}>
          <View style={[styles.roleBadge, { backgroundColor: '#f59e0b' + '20' }]}>
            <MaterialCommunityIcons name="crown" size={12} color="#f59e0b" style={{ marginRight: 2 }} />
            <Text style={[styles.roleBadgeText, { color: '#f59e0b' }]}>PRO</Text>
          </View>
        </View>
      </View>

      {/* Filas de características */}
      {roleFeatures.map((item, index) => (
        <View 
          key={index} 
          style={[
            styles.tableRow, 
            index % 2 === 0 && styles.tableRowEven
          ]}
        >
          <View style={styles.featureColumn}>
            <View style={styles.featureWithInfo}>
              <Text style={styles.featureText}>{item.feature}</Text>
              {item.infoType && (
                <TouchableOpacity 
                  style={styles.infoButton}
                  onPress={() => setInfoModal(item.infoType!)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="information" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.roleColumn}>
            {renderFeatureStatus(item.free)}
          </View>
          <View style={styles.roleColumn}>
            {renderFeatureStatus(item.basic)}
          </View>
          <View style={styles.roleColumn}>
            {renderFeatureStatus(item.pro)}
          </View>
        </View>
      ))}

      {/* Descripción de cada rol */}
      <View style={styles.rolesDescriptionSection}>
        <Text style={styles.rolesDescriptionTitle}>Descripción de Planes</Text>
        
        {/* Plan Gratis */}
        <View style={styles.roleDescriptionCard}>
          <View style={styles.roleDescriptionHeader}>
            <View style={[styles.roleDescBadge, { backgroundColor: Colors.textSecondary + '20' }]}>
              <Text style={[styles.roleDescBadgeText, { color: Colors.textSecondary }]}>GRATIS</Text>
            </View>
            <Text style={styles.rolePrice}>0€/mes</Text>
          </View>
          <Text style={styles.roleDescriptionText}>
            Perfecto para espectadores. Busca partidos por código compartido y usa el marcador básico para seguir el resultado.
          </Text>
        </View>

        {/* Plan Básico */}
        <View style={styles.roleDescriptionCard}>
          <View style={styles.roleDescriptionHeader}>
            <View style={[styles.roleDescBadge, { backgroundColor: '#3b82f6' + '20' }]}>
              <Text style={[styles.roleDescBadgeText, { color: '#3b82f6' }]}>BÁSICO</Text>
            </View>
            <Text style={styles.rolePrice}>4,99€/mes</Text>
          </View>
          <Text style={styles.roleDescriptionText}>
            Crea hasta 2 equipos, registra estadísticas básicas y guarda partidos ilimitados. Incluye configuración básica y filtros esenciales.
          </Text>
        </View>

        {/* Plan Pro */}
        <View style={styles.roleDescriptionCard}>
          <View style={styles.roleDescriptionHeader}>
            <View style={[styles.roleDescBadge, { backgroundColor: '#f59e0b' + '20' }]}>
              <MaterialCommunityIcons name="crown" size={14} color="#f59e0b" style={{ marginRight: 4 }} />
              <Text style={[styles.roleDescBadgeText, { color: '#f59e0b' }]}>PRO</Text>
            </View>
            <Text style={styles.rolePrice}>9,99€/mes</Text>
          </View>
          <Text style={styles.roleDescriptionText}>
            Sin límites en equipos, jugadores ni partidos. Acceso a todas las estadísticas avanzadas, exportación a Excel, gráficos de seguimiento y análisis de tendencias.
          </Text>
        </View>
      </View>

      {/* Botón para seleccionar plan */}
      {onSelectPlan && (
        <TouchableOpacity 
          style={styles.selectPlanButton}
          onPress={onSelectPlan}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="arrow-up-bold-circle" size={22} color="#FFFFFF" />
          <Text style={styles.selectPlanButtonText}>Ver Planes y Precios</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Renderiza el contenido del modal de información de estadísticas
  const renderInfoModalContent = () => {
    const isBasic = infoModal === 'basicConfig';
    
    interface StatInfo {
      category: string;
      color: string;
      icon: React.FC<{ size?: number; color?: string }>;
      types: string[];
      note?: string;
      exclusive?: boolean;
    }

    // Estadísticas del plan básico
    const basicStats: StatInfo[] = [
      { 
        category: 'Recepción', 
        color: STAT_COLORS.reception, 
        icon: ReceptionIcon,
        types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'],
        note: 'Solo para Receptor y Líbero'
      },
      { 
        category: 'Ataque', 
        color: STAT_COLORS.attack, 
        icon: AttackIcon,
        types: ['Positivo', 'Error']
      },
      { 
        category: 'Bloqueo', 
        color: STAT_COLORS.block, 
        icon: BlockIcon,
        types: ['Positivo']
      },
      { 
        category: 'Saque', 
        color: STAT_COLORS.serve, 
        icon: ServeIcon,
        types: ['Punto directo', 'Error']
      },
    ];
    
    // Estadísticas adicionales PRO
    const proStats: StatInfo[] = [
      { 
        category: 'Recepción', 
        color: STAT_COLORS.reception, 
        icon: ReceptionIcon,
        types: ['Doble positivo', 'Positivo', 'Neutro', 'Error'],
        note: 'Todas las posiciones'
      },
      { 
        category: 'Ataque', 
        color: STAT_COLORS.attack, 
        icon: AttackIcon,
        types: ['Positivo', 'Neutro', 'Error']
      },
      { 
        category: 'Bloqueo', 
        color: STAT_COLORS.block, 
        icon: BlockIcon,
        types: ['Positivo', 'Neutro', 'Error']
      },
      { 
        category: 'Saque', 
        color: STAT_COLORS.serve, 
        icon: ServeIcon,
        types: ['Punto directo', 'Positivo', 'Neutro', 'Error']
      },
      { 
        category: 'Defensa', 
        color: STAT_COLORS.defense, 
        icon: DefenseIcon,
        types: ['Positivo', 'Neutro', 'Error'],
        exclusive: true
      },
      { 
        category: 'Colocación', 
        color: STAT_COLORS.set, 
        icon: SetIcon,
        types: ['Positivo', 'Neutro', 'Error'],
        exclusive: true
      },
    ];

    const stats = isBasic ? basicStats : proStats;

    return (
      <View style={styles.infoModalContent}>
        <View style={styles.infoModalHeader}>
          <View style={[styles.infoModalBadge, { backgroundColor: isBasic ? '#3b82f620' : '#f59e0b20' }]}>
            {!isBasic && <MaterialCommunityIcons name="crown" size={16} color="#f59e0b" style={{ marginRight: 4 }} />}
            <Text style={[styles.infoModalBadgeText, { color: isBasic ? '#3b82f6' : '#f59e0b' }]}>
              {isBasic ? 'BÁSICO' : 'PRO'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setInfoModal(null)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.infoModalTitle}>
          {isBasic ? 'Configuración de Estadísticas' : 'Estadísticas Avanzadas'}
        </Text>
        
        <Text style={styles.infoModalSubtitle}>
          {isBasic 
            ? 'Puedes activar o desactivar las siguientes opciones según tus necesidades:' 
            : 'Además de todas las opciones básicas, el plan PRO incluye:'}
        </Text>

        <ScrollView style={styles.infoModalScrollView} showsVerticalScrollIndicator={false}>
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <View 
                key={index} 
                style={[
                  styles.statInfoCard,
                  stat.exclusive && styles.statInfoCardExclusive
                ]}
              >
                <View style={styles.statInfoHeader}>
                  <View style={[styles.statIconContainer, { backgroundColor: stat.color + '20' }]}>
                    <IconComponent size={22} color={stat.color} />
                  </View>
                  <View style={styles.statInfoTitleContainer}>
                    <Text style={[styles.statInfoCategory, { color: stat.color }]}>{stat.category}</Text>
                    {stat.exclusive && (
                      <View style={styles.exclusiveBadge}>
                        <MaterialCommunityIcons name="star" size={10} color="#f59e0b" />
                        <Text style={styles.exclusiveText}>Exclusivo PRO</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.statTypesContainer}>
                  {stat.types.map((type, typeIndex) => (
                    <View key={typeIndex} style={[styles.statTypeBadge, { borderColor: stat.color + '40' }]}>
                      <Text style={[styles.statTypeText, { color: stat.color }]}>{type}</Text>
                    </View>
                  ))}
                </View>
                {stat.note && (
                  <Text style={styles.statNote}>
                    <MaterialCommunityIcons name="information-outline" size={12} color={Colors.textSecondary} /> {stat.note}
                  </Text>
                )}
              </View>
            );
          })}

          <View style={styles.infoModalNote}>
            <MaterialCommunityIcons name="cog" size={18} color={Colors.primary} />
            <Text style={styles.infoModalNoteText}>
              La configuración es totalmente personalizable. Puedes activar o desactivar cada opción según tus preferencias.
            </Text>
          </View>

          {isBasic && (
            <View style={styles.infoModalProHint}>
              <MaterialCommunityIcons name="crown" size={18} color="#f59e0b" />
              <Text style={styles.infoModalProHintText}>
                ¿Necesitas Defensa, Colocación o más opciones de registro? ¡Actualiza a PRO!
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      {/* Modal de información de estadísticas */}
      <Modal
        visible={infoModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setInfoModal(null)}
      >
        <View style={styles.infoModalOverlay}>
          {renderInfoModalContent()}
        </View>
      </Modal>

       {/* Header */}
            <View style={styles.header}>
              {onBack ? (
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={onBack}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="arrow-left" size={28} color={Colors.text} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.menuButton}
                  onPress={onOpenMenu}
                  activeOpacity={0.7}
                >
                  <MenuIcon size={28} color={Colors.text} />
                </TouchableOpacity>
              )}

              <View style={styles.headerCenter}>
                <MaterialCommunityIcons name="help-circle-outline" size={22} color={Colors.primary} />
                <Text style={styles.headerTitle}>Ayuda</Text>
              </View>

              <View style={styles.headerRight} />
            </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {onlyRoles ? (
            <View style={[styles.tab, styles.tabActive, { flex: 1 }]}>
              <MaterialCommunityIcons 
                name="account-star" 
                size={20} 
                color={Colors.textOnPrimary} 
              />
              <Text style={[styles.tabText, styles.tabTextActive]}>Planes</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'guide' && styles.tabActive]}
                onPress={() => setActiveTab('guide')}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name="book-open-page-variant" 
                  size={20} 
                  color={activeTab === 'guide' ? Colors.textOnPrimary : Colors.textSecondary} 
                />
                <Text style={[styles.tabText, activeTab === 'guide' && styles.tabTextActive]}>
                  Guía de Uso
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'roles' && styles.tabActive]}
                onPress={() => setActiveTab('roles')}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name="account-star" 
                  size={20} 
                  color={activeTab === 'roles' ? Colors.textOnPrimary : Colors.textSecondary} 
                />
                <Text style={[styles.tabText, activeTab === 'roles' && styles.tabTextActive]}>
                  Planes
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {activeTab === 'guide' ? (
          <>
            <View style={styles.introSection}>
              <MaterialCommunityIcons name="volleyball" size={48} color={Colors.primary} />
              <Text style={styles.introTitle}>Bienvenido a VBStats</Text>
              <Text style={styles.introText}>
                La aplicación definitiva para registrar y analizar estadísticas de voleibol. 
                Aprende a sacar el máximo provecho con esta guía completa.
              </Text>
            </View>
            {guideSections.map(renderGuideSection)}
            <View style={styles.bottomPadding} />
          </>
        ) : (
          <>
            <View style={styles.introSection}>
              <MaterialCommunityIcons name="shield-star" size={48} color={Colors.primary} />
              <Text style={styles.introTitle}>Planes y Funcionalidades</Text>
              <Text style={styles.introText}>
                Elige el plan que mejor se adapte a tus necesidades. Compara las funcionalidades 
                disponibles en cada nivel de suscripción.
              </Text>
            </View>
            {renderRolesComparison()}
            <View style={styles.bottomPadding} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? ANDROID_STATUS_BAR_HEIGHT : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
  },
  menuButton: {
    padding: Spacing.sm,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  headerRight: {
    width: 44,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: 'transparent',
    gap: Spacing.xs,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.textOnPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  introSection: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  introTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  introText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  guideCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  guideIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  guideCardTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  guideCardDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  stepsContainer: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  stepNumberText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
    paddingTop: 2,
  },
  rolesContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  featureColumn: {
    flex: 2,
    paddingHorizontal: Spacing.xs,
  },
  roleColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: Colors.backgroundLight + '50',
  },
  featureText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
  },
  featureLimitText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  rolesDescriptionSection: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.sm,
  },
  rolesDescriptionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  roleDescriptionCard: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  roleDescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  roleDescBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  roleDescBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  rolePrice: {
    fontSize: FontSizes.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  roleDescriptionText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  selectPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Shadows.md,
  },
  selectPlanButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomPadding: {
    height: Spacing.xxl,
  },
  featureWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoButton: {
    padding: 2,
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  infoModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    ...Shadows.lg,
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  infoModalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  infoModalBadgeText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  infoModalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  infoModalSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  infoModalScrollView: {
    flexGrow: 0,
  },
  statInfoCard: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  statInfoCardExclusive: {
    borderWidth: 1,
    borderColor: '#f59e0b40',
    backgroundColor: '#f59e0b08',
  },
  statInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  statInfoTitleContainer: {
    flex: 1,
  },
  statInfoCategory: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  exclusiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  exclusiveText: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
  },
  statTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  statTypeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  statTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  infoModalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primary + '10',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  infoModalNoteText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  infoModalProHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f59e0b10',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  infoModalProHintText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: '#b45309',
    lineHeight: 20,
    fontWeight: '500',
  },
});
