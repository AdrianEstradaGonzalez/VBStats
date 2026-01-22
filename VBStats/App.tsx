import React, { useState, useEffect } from "react";
import { View, StatusBar, Alert, Platform, ActivityIndicator } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { 
  LoginScreen,
  SignUpScreen,
  HomeScreen, 
  TeamsScreen, 
  StartMatchScreen, 
  StatsScreen,
  SettingsScreen,
  SelectTeamScreen,
  MatchDetailsScreen,
  MatchFieldScreen,
  ProfileScreen,
  Team,
  MatchDetails,
} from "./pages";
import SelectPlanScreen from "./pages/SelectPlanScreen";
import SearchByCodeScreen from "./pages/SearchByCodeScreen";
import ScoreboardScreen from "./pages/ScoreboardScreen";
import { Colors } from "./styles";
import { SideMenu } from "./components";
import CustomAlert from "./components/CustomAlert";
import { teamsService, playersService, usersService, Match } from "./services/api";
import { SubscriptionType, subscriptionService } from "./services/subscriptionService";

type Screen = 'home' | 'teams' | 'startMatch' | 'stats' | 'settings' | 'profile' | 'selectTeam' | 'matchDetails' | 'matchField' | 'startMatchFlow' | 'scoreboard' | 'searchByCode' | 'selectPlan';

// Keys for AsyncStorage
const STORAGE_KEYS = {
  USER_SESSION: '@VBStats:userSession',
};

interface StoredSession {
  userId: number;
  userName: string;
  userEmail: string;
  sessionToken: string | null;
}

export default function App() {
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSelectPlan, setShowSelectPlan] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<{ email: string; password: string; name?: string } | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>('free');
  const [subscriptionCancelledPending, setSubscriptionCancelledPending] = useState(false);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [showSessionAlert, setShowSessionAlert] = useState(false);
  const [sessionCheckBlocked, setSessionCheckBlocked] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [menuVisible, setMenuVisible] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [resumeMatchId, setResumeMatchId] = useState<number | null>(null);
  const [viewingMatch, setViewingMatch] = useState<Match | null>(null);
  const [showCancelSubscriptionAlert, setShowCancelSubscriptionAlert] = useState(false);
  const [showCancelSuccessAlert, setShowCancelSuccessAlert] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Load saved session on app start
  useEffect(() => {
    loadSavedSession();
  }, []);

  const loadSavedSession = async () => {
    try {
      const savedSession = await AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION);
      if (savedSession) {
        const session: StoredSession = JSON.parse(savedSession);
        // Verify session is still valid on server
        try {
          const currentSession = await usersService.getSession(session.userId);
          // Check if session token matches (session still valid)
          if (currentSession.session_token === session.sessionToken) {
            setUserId(session.userId);
            setUserName(session.userName);
            setUserEmail(session.userEmail);
            setSessionToken(session.sessionToken);
            setIsLoggedIn(true);
          } else {
            // Session invalidated (logged in elsewhere), clear stored session
            await AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION);
          }
        } catch (error) {
          console.warn('Error verifying session, keeping local session:', error);
          // If server check fails, still use local session (offline support)
          setUserId(session.userId);
          setUserName(session.userName);
          setUserEmail(session.userEmail);
          setSessionToken(session.sessionToken);
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.error('Error loading saved session:', error);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const saveSession = async (session: StoredSession) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const clearSession = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  // Load teams and subscription from backend when user logs in
  useEffect(() => {
    if (isLoggedIn && userId) {
      loadTeams();
      loadSubscription();
    }
  }, [isLoggedIn, userId]);

  const loadSubscription = async () => {
    if (!userId) return;
    try {
      const subscription = await subscriptionService.getSubscription(userId);
      setSubscriptionType(subscription.type);
      setSubscriptionCancelledPending(subscription.cancelAtPeriodEnd || false);
      setSubscriptionLoaded(true);
    } catch (error) {
      console.error('Error loading subscription:', error);
      setSubscriptionType('free');
      setSubscriptionCancelledPending(false);
      setSubscriptionLoaded(true);
    }
  };

  const loadTeams = async () => {
    if (!userId) return;
    
    try {
      const [fetchedTeams, allPlayers] = await Promise.all([
        teamsService.getAll(userId),
        playersService.getAll()
      ]);
      
      // Add players to each team
      const teamsWithPlayers = fetchedTeams.map(team => {
        const teamPlayers = allPlayers.filter(p => p.team_id === team.id);
        return {
          ...team,
          players: teamPlayers,
          playerCount: teamPlayers.length
        };
      });
      
      setTeams(teamsWithPlayers);
      console.log('Teams loaded with players:', teamsWithPlayers.map(t => `${t.name}: ${t.players?.length || 0} jugadores`));
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      const user = await usersService.login({ email, password });
      const name = user.name || email.split("@")[0];
      
      setUserId(user.id);
      setUserName(name);
      setUserEmail(user.email);
      setSessionToken(user.session_token || null);
      
      // Save session to persist login
      await saveSession({
        userId: user.id,
        userName: name,
        userEmail: user.email,
        sessionToken: user.session_token || null,
      });
      
      // Load subscription BEFORE marking as logged in
      try {
        const subscription = await subscriptionService.getSubscription(user.id);
        setSubscriptionType(subscription.type);
        setSubscriptionCancelledPending(subscription.cancelAtPeriodEnd || false);
        setSubscriptionLoaded(true);
      } catch (subError) {
        console.error('Error loading subscription during login:', subError);
        setSubscriptionType('free');
        setSubscriptionCancelledPending(false);
        setSubscriptionLoaded(true);
      }
      
      setIsLoggedIn(true);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const handleForgotPassword = () => {
    console.log("Forgot password");
  };

  const handleSignUp = async (email: string, password: string, name?: string): Promise<boolean> => {
    try {
      const user = await usersService.register({ email, password, name });
      // Después de registrar exitosamente, guardamos datos y mostramos selección de plan
      setUserId(user.id);
      setUserName(user.name || email.split("@")[0]);
      setUserEmail(user.email);
      setSessionToken(user.session_token || null);
      setPendingRegistration({ email, password, name });
      setShowSignUp(false);
      setShowSelectPlan(true);
      return true;
    } catch (error) {
      console.error('Sign up error:', error);
      return false;
    }
  };

  const handlePlanSelected = async (plan: SubscriptionType) => {
    if (userId) {
      try {
        await subscriptionService.updateSubscription(userId, plan);
        setSubscriptionType(plan);
      } catch (error) {
        console.error('Error updating subscription:', error);
      }
    }
    setShowSelectPlan(false);
    setPendingRegistration(null);
    setIsLoggedIn(true);
    // Free users go to searchByCode screen
    if (plan === 'free') {
      setCurrentScreen('searchByCode');
    }
  };

  const handleUpgradeToPro = () => {
    setCurrentScreen('selectPlan');
  };

  const handleShowSignUp = () => {
    setShowSignUp(true);
  };

  const handleBackToLogin = () => {
    setShowSignUp(false);
  };

  const handleNavigate = (screen: string) => {
    if (screen === 'startMatch') {
      // Go to start match flow screen to check for ongoing matches
      setCurrentScreen('startMatchFlow');
    } else {
      setCurrentScreen(screen as Screen);
    }
    setMenuVisible(false);
  };

  const handleLogout = async () => {
    // Clear saved session first
    await clearSession();
    
    if (userId) {
      try {
        await usersService.logout(userId);
      } catch (error) {
        console.warn('Logout error (ignored):', error);
      }
    }
    setIsLoggedIn(false);
    setUserId(null);
    setUserName("");
    setUserEmail("");
    setSessionToken(null);
    setSubscriptionType('free');
    setSubscriptionCancelledPending(false);
    setSubscriptionLoaded(false);
    setCurrentScreen('home');
    setMenuVisible(false);
  };

  const handleForcedLogout = async () => {
    setShowSessionAlert(false);
    await handleLogout();
  };

  // Session checker: enforce single active device per account
  useEffect(() => {
    if (!isLoggedIn || !userId || !sessionToken) return;
    if (sessionCheckBlocked) return;

    let isMounted = true;
    const checkSession = async () => {
      try {
        const current = await usersService.getSession(userId);
        if (!isMounted) return;
        if (current.session_token && current.session_token !== sessionToken) {
          // Another device logged in
          setShowSessionAlert(true);
          setSessionCheckBlocked(true);
        }
      } catch (error) {
        console.warn('Session check failed:', error);
      }
    };

    // Initial check and interval
    checkSession();
    const interval = setInterval(checkSession, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLoggedIn, userId, sessionToken, sessionCheckBlocked]);

  const handleOpenMenu = () => {
    setMenuVisible(true);
  };

  const handleCancelSubscription = async () => {
    if (!userId) return;
    
    setIsCancelling(true);
    try {
      const response = await fetch(`${subscriptionService.SUBSCRIPTIONS_URL}/${userId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setShowCancelSubscriptionAlert(false);
        setShowCancelSuccessAlert(true);
        setSubscriptionCancelledPending(true);
        // Don't change to free immediately - user keeps access until period ends
      } else {
        const errorData = await response.json();
        console.error('Cancel error:', errorData);
        Alert.alert('Error', 'No se pudo cancelar la suscripción. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      Alert.alert('Error', 'Error al cancelar la suscripción.');
    } finally {
      setIsCancelling(false);
    }
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'selectPlan':
        return (
          <SelectPlanScreen
            onPlanSelected={handlePlanSelected}
            onBack={() => setCurrentScreen('home')}
            currentPlan={subscriptionType}
            userId={userId}
          />
        );
      case 'searchByCode':
        return (
          <SearchByCodeScreen
            onOpenMenu={handleOpenMenu}
            onMatchFound={(match) => {
              setViewingMatch(match);
              setCurrentScreen('stats');
            }}
          />
        );
      case 'scoreboard':
        return (
          <ScoreboardScreen
            onOpenMenu={handleOpenMenu}
          />
        );
      case 'teams':
        return (
          <TeamsScreen 
            onOpenMenu={handleOpenMenu}
            teams={teams}
            onTeamsChange={setTeams}
            userId={userId}
            subscriptionType={subscriptionType}
            onUpgradeToPro={handleUpgradeToPro}
          />
        );
      case 'selectTeam':
        return (
          <SelectTeamScreen 
            onBack={() => setCurrentScreen('home')}
            onOpenMenu={handleOpenMenu}
            userId={userId}
            onTeamSelected={(teamId, teamName) => {
              setSelectedTeamId(teamId);
              setSelectedTeamName(teamName);
              setCurrentScreen('matchDetails');
            }}
          />
        );
      case 'matchDetails':
        return (
          <MatchDetailsScreen 
            teamId={selectedTeamId!}
            teamName={selectedTeamName}
            onBack={() => setCurrentScreen('selectTeam')}
            onOpenMenu={handleOpenMenu}
            onStartMatch={(details) => {
              setMatchDetails(details);
              setCurrentScreen('matchField');
            }}
          />
        );
      case 'matchField':
        return (
          <MatchFieldScreen 
            matchDetails={matchDetails!}
            onOpenMenu={handleOpenMenu}
            userId={userId}
            resumeMatchId={resumeMatchId}
          />
        );
      case 'startMatch':
        return (
          <StartMatchScreen 
            teams={teams}
            onOpenMenu={handleOpenMenu}
            userId={userId}
            onStartMatch={(team) => {
              // Clear any resume state and go to select team flow
              setResumeMatchId(null);
              setSelectedTeamId(team.id);
              setSelectedTeamName(team.name);
              setCurrentScreen('matchDetails');
            }}
            onContinueMatch={(match: Match) => {
              // Set up for resume: find team and create match details
              console.log('🔄 [startMatch] Continuando partido:', match.id);
              const team = teams.find(t => t.id === match.team_id);
              console.log('👥 Equipo encontrado:', team?.name, 'con', team?.players?.length, 'jugadores');
              if (team) {
                setResumeMatchId(match.id);
                const details = {
                  teamId: match.team_id!,
                  teamName: match.team_name || team.name,
                  players: team.players || [],
                  rivalTeam: match.opponent || '',
                  date: match.date ? new Date(match.date) : new Date(),
                  isHome: match.location === 'home',
                };
                console.log('📋 Match details:', details);
                setMatchDetails(details);
                setCurrentScreen('matchField');
              } else {
                console.error('❌ Equipo no encontrado para team_id:', match.team_id);
              }
            }}
          />
        );
      case 'startMatchFlow':
        return (
          <StartMatchScreen 
            teams={teams}
            onBack={() => setCurrentScreen('home')}
            onOpenMenu={handleOpenMenu}
            userId={userId}
            onStartMatch={(team) => {
              // Clear any resume state and go to match details
              setResumeMatchId(null);
              setSelectedTeamId(team.id);
              setSelectedTeamName(team.name);
              setCurrentScreen('matchDetails');
            }}
            onContinueMatch={(match: Match) => {
              // Set up for resume: find team and create match details
              console.log('🔄 [startMatchFlow] Continuando partido:', match.id);
              const team = teams.find(t => t.id === match.team_id);
              console.log('👥 Equipo encontrado:', team?.name, 'con', team?.players?.length, 'jugadores');
              if (team) {
                setResumeMatchId(match.id);
                const details = {
                  teamId: match.team_id!,
                  teamName: match.team_name || team.name,
                  players: team.players || [],
                  rivalTeam: match.opponent || '',
                  date: match.date ? new Date(match.date) : new Date(),
                  isHome: match.location === 'home',
                };
                console.log('📋 Match details:', details);
                setMatchDetails(details);
                setCurrentScreen('matchField');
              } else {
                console.error('❌ Equipo no encontrado para team_id:', match.team_id);
              }
            }}
          />
        );
      case 'stats':
        return (
          <StatsScreen 
            onOpenMenu={handleOpenMenu}
            userId={userId}
          />
        );
      case 'settings':
        return (
          <SettingsScreen 
            onOpenMenu={handleOpenMenu}
            userId={userId}
            subscriptionType={subscriptionType}
            onUpgradeToPro={handleUpgradeToPro}
          />
        );
      case 'profile':
        return (
          <ProfileScreen 
            onOpenMenu={handleOpenMenu}
            userId={userId}
            userName={userName}
            userEmail={userEmail}
            subscriptionType={subscriptionType}
            onSubscriptionCancelled={() => {
              // Don't change to free immediately - user keeps access until expiration
              // Just show a message, the subscription type stays the same
              loadSubscription();
            }}
          />
        );
      default:
        // Free users see search by code screen as home
        if (subscriptionType === 'free') {
          return (
            <SearchByCodeScreen
              onOpenMenu={handleOpenMenu}
              onMatchFound={(match) => {
                setViewingMatch(match);
                setCurrentScreen('stats');
              }}
            />
          );
        }
        return (
          <HomeScreen 
            userName={userName}
            userEmail={userEmail}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onOpenMenu={handleOpenMenu}
          />
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.background}
        translucent={false}
      />
      {isLoadingSession ? (
        // Pantalla de carga mientras se verifica la sesión
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !isLoggedIn ? (
        showSelectPlan ? (
          <SelectPlanScreen
            onPlanSelected={handlePlanSelected}
            onBack={() => {
              setShowSelectPlan(false);
              setShowSignUp(true);
            }}
            currentPlan="free"
            userId={userId}
          />
        ) : showSignUp ? (
          <SignUpScreen
            onSignUp={handleSignUp}
            onBackToLogin={handleBackToLogin}
          />
        ) : (
          <LoginScreen
            onLogin={handleLogin}
            onForgotPassword={handleForgotPassword}
            onSignUp={handleShowSignUp}
          />
        )
      ) : (
        <>
          {renderCurrentScreen()}
          {currentScreen !== 'selectPlan' && subscriptionLoaded && (
            <SideMenu
              visible={menuVisible}
              onClose={() => setMenuVisible(false)}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              onUpgradePlan={handleUpgradeToPro}
              onCancelSubscription={() => setShowCancelSubscriptionAlert(true)}
              userName={userName}
              userEmail={userEmail}
              subscriptionType={subscriptionType}
              subscriptionCancelledPending={subscriptionCancelledPending}
            />
          )}
        </>
      )}

      <CustomAlert
        visible={showSessionAlert}
        title="Sesión iniciada en otro dispositivo"
        message="Solo se permite una sesión activa por cuenta. Cierra sesión para continuar."
        buttons={[
          {
            text: 'Cerrar sesión',
            onPress: handleForcedLogout,
            style: 'destructive',
          },
        ]}
        onClose={handleForcedLogout}
      />

      <CustomAlert
        visible={showCancelSubscriptionAlert}
        title="Cancelar Suscripción"
        message={`¿Estás seguro de que quieres cancelar tu plan ${subscriptionType === 'pro' ? 'PRO' : 'BÁSICO'}? Podrás seguir usando las funciones de tu plan actual hasta que finalice tu período de pago. Después pasarás automáticamente al plan gratuito.`}
        type="warning"
        icon={<MaterialCommunityIcons name="alert" size={32} color={Colors.warning} />}
        buttons={[
          {
            text: 'No, mantener',
            onPress: () => setShowCancelSubscriptionAlert(false),
            style: 'cancel',
          },
          {
            text: isCancelling ? 'Cancelando...' : 'Sí, cancelar',
            onPress: () => {
              if (!isCancelling) {
                handleCancelSubscription();
              }
            },
            style: 'destructive',
          },
        ]}
        onClose={() => setShowCancelSubscriptionAlert(false)}
      />

      <CustomAlert
        visible={showCancelSuccessAlert}
        title="Suscripción Cancelada"
        message="Tu suscripción no se renovará. Podrás seguir usando las funciones de tu plan actual hasta que finalice tu período de pago."
        type="success"
        icon={<MaterialCommunityIcons name="check-circle" size={32} color="#22c55e" />}
        buttons={[
          {
            text: 'Entendido',
            onPress: () => setShowCancelSuccessAlert(false),
            style: 'default',
          },
        ]}
        onClose={() => setShowCancelSuccessAlert(false)}
      />
    </View>
  );
}