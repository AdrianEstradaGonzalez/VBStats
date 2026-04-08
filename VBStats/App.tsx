import React, { useState, useEffect, useRef } from "react";
import { View, StatusBar, Alert, Platform, ActivityIndicator, Linking, BackHandler } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import './i18n';
import { 
  LoginScreen,
  SignUpScreen,
  ForgotPasswordScreen,
  ResetPasswordScreen,
  HomeScreen, 
  TeamsScreen, 
  StartMatchScreen, 
  StatsScreen,
  SettingsScreen,
  SelectTeamScreen,
  MatchDetailsScreen,
  MatchFieldScreen,
  ProfileScreen,
  GuideScreen,
  AdminPanelScreen,
  SendNotificationScreen,
  UserManagementScreen,
  Team,
  MatchDetails,
  MatchStatsScreen,
} from "./pages";
import SelectPlanScreen from "./pages/SelectPlanScreen";
import SearchByCodeScreen from "./pages/SearchByCodeScreen";
import ScoreboardScreen from "./pages/ScoreboardScreen";
import { Colors } from "./styles";
import { SideMenu } from "./components";
import FooterNav from "./components/FooterNav";
import CustomAlert from "./components/CustomAlert";
import { teamsService, playersService, usersService, Match } from "./services/api";
import { SubscriptionType, subscriptionService, TrialInfo, useAppleIAP } from "./services/subscriptionService";
import { checkAppVersion, VersionCheckResult } from "./services/versionService";
import { appleIAPService } from "./services/appleIAPService";
import { adminService } from "./services/adminService";
import { notificationService } from "./services/notificationService";

type Screen = 'home' | 'teams' | 'startMatch' | 'stats' | 'settings' | 'profile' | 'selectTeam' | 'matchDetails' | 'matchField' | 'startMatchFlow' | 'scoreboard' | 'searchByCode' | 'selectPlan' | 'guide' | 'matchStatsFromCode' | 'adminPanel' | 'sendNotification' | 'userManagement';

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
  const { t } = useTranslation();
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [showSelectPlan, setShowSelectPlan] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<{ email: string; password: string; name?: string } | null>(null);
  const [pendingRegisteredUserId, setPendingRegisteredUserId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>('free');
  const [subscriptionCancelledPending, setSubscriptionCancelledPending] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState(true);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [activeTrial, setActiveTrial] = useState<TrialInfo | null>(null);
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
  const [statsResetKey, setStatsResetKey] = useState(0);
  const [showCancelSubscriptionAlert, setShowCancelSubscriptionAlert] = useState(false);
  const [showCancelSuccessAlert, setShowCancelSuccessAlert] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const screenHistoryRef = useRef<Screen[]>([]);
  const isBackNavigationRef = useRef(false);
  const previousScreenRef = useRef<Screen>('home');

  // Check app version on start
  useEffect(() => {
    const checkVersion = async () => {
      const result = await checkAppVersion();
      if (result.needsUpdate) {
        setUpdateInfo(result);
        setShowUpdateAlert(true);
      }
    };
    checkVersion();
  }, []);

  // Load saved language preference on start
  useEffect(() => {
    const { loadSavedLanguage } = require('./i18n');
    loadSavedLanguage();
  }, []);

  // Load saved session on app start
  useEffect(() => {
    loadSavedSession();
  }, []);

  // Track navigation history for Android back button
  useEffect(() => {
    if (previousScreenRef.current !== currentScreen) {
      if (!isBackNavigationRef.current) {
        screenHistoryRef.current.push(previousScreenRef.current);
      }
      isBackNavigationRef.current = false;
      previousScreenRef.current = currentScreen;
    }
  }, [currentScreen]);

  // Reset history when auth state changes
  useEffect(() => {
    if (!isLoggedIn) {
      screenHistoryRef.current = [];
      previousScreenRef.current = currentScreen;
    }
  }, [isLoggedIn, currentScreen]);

  // Android hardware back button handling
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = (): boolean => {
      if (menuVisible) {
        setMenuVisible(false);
        return true;
      }

      if (!isLoggedIn) {
        if (showResetPassword) {
          setShowResetPassword(false);
          setShowForgotPassword(true);
          return true;
        }
        if (showForgotPassword) {
          setShowForgotPassword(false);
          return true;
        }
        if (showSignUp) {
          setShowSignUp(false);
          return true;
        }
        if (showSelectPlan) {
          setShowSelectPlan(false);
          setShowSignUp(true);
          return true;
        }
        return false;
      }

      const history = screenHistoryRef.current;
      if (history.length > 0) {
        const previous = history.pop() as Screen;
        isBackNavigationRef.current = true;
        setCurrentScreen(previous);
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [menuVisible, isLoggedIn, showResetPassword, showForgotPassword, showSignUp, showSelectPlan, currentScreen]);

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
      // Check superadmin status
      adminService.isSuperadmin(userId).then(setIsSuperadmin);
      // Register push notification token
      notificationService.registerForPushNotifications(userId);
    }
  }, [isLoggedIn, userId]);

  const loadSubscription = async () => {
    if (!userId) return;
    try {
      // On iOS, check for pending (unfinished) Apple IAP transactions first.
      // This handles cases where a purchase was made but verification failed
      // (e.g., APPLE_SHARED_SECRET was not configured on the server).
      if (Platform.OS === 'ios') {
        try {
          const recovery = await appleIAPService.recoverPendingTransactions(userId);
          if (recovery.recovered) {
            console.log('\u2705 Recovered pending Apple transaction:', recovery.productId);
          }
        } catch (recoveryError) {
          console.error('Error recovering pending Apple transactions:', recoveryError);
        }
      }

      const subscription = await subscriptionService.getSubscription(userId);
      setSubscriptionType(subscription.type);
      setSubscriptionCancelledPending(subscription.cancelAtPeriodEnd || false);
      setSubscriptionExpiresAt(subscription.expiresAt || null);
      setAutoRenew(subscription.autoRenew !== false);
      setActiveTrial(subscription.activeTrial || null);
      setSubscriptionLoaded(true);
    } catch (error) {
      console.error('Error loading subscription:', error);
      setSubscriptionType('free');
      setSubscriptionCancelledPending(false);
      setSubscriptionExpiresAt(null);
      setAutoRenew(true);
      setActiveTrial(null);
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
        setSubscriptionExpiresAt(subscription.expiresAt || null);
        setAutoRenew(subscription.autoRenew !== false);
        setActiveTrial(subscription.activeTrial || null);
        setSubscriptionLoaded(true);
      } catch (subError) {
        console.error('Error loading subscription during login:', subError);
        setSubscriptionType('free');
        setSubscriptionCancelledPending(false);
        setSubscriptionExpiresAt(null);
        setAutoRenew(true);
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
    setShowForgotPassword(true);
  };

  const handleBackFromForgotPassword = () => {
    setShowForgotPassword(false);
    setShowResetPassword(false);
    setResetPasswordEmail('');
  };

  const handleCodeSent = (email: string) => {
    setResetPasswordEmail(email);
    setShowForgotPassword(false);
    setShowResetPassword(true);
  };

  const handlePasswordResetSuccess = () => {
    setShowResetPassword(false);
    setShowForgotPassword(false);
    setResetPasswordEmail('');
    // El usuario ahora puede iniciar sesión con su nueva contraseña
  };

  // Demo period: all accounts get PRO free until Oct 1, 2026
  const DEMO_END_DATE = new Date('2026-10-01T00:00:00');
  const isDemoPeriod = new Date() < DEMO_END_DATE;

  const handleSignUp = async (email: string, password: string, name?: string): Promise<boolean> => {
    if (isDemoPeriod) {
      // During demo period, create user directly with PRO (backend assigns PRO until Sept 30, 2026)
      try {
        const user = await usersService.register({ email, password, name });
        const displayName = user.name || email.split('@')[0];
        setUserId(user.id);
        setUserName(displayName);
        setUserEmail(user.email);
        setSessionToken(user.session_token || null);

        await saveSession({
          userId: user.id,
          userName: displayName,
          userEmail: user.email,
          sessionToken: user.session_token || null,
        });

        // Load subscription info
        try {
          const subscription = await subscriptionService.getSubscription(user.id);
          setSubscriptionType(subscription.type);
          setSubscriptionCancelledPending(subscription.cancelAtPeriodEnd || false);
          setSubscriptionExpiresAt(subscription.expiresAt || null);
          setAutoRenew(subscription.autoRenew !== false);
          setActiveTrial(subscription.activeTrial || null);
          setSubscriptionLoaded(true);
        } catch (subError) {
          console.error('Error loading subscription after demo signup:', subError);
          setSubscriptionType('pro');
          setSubscriptionLoaded(true);
        }

        setShowSignUp(false);
        setIsLoggedIn(true);
        setCurrentScreen('home');
        return true;
      } catch (error) {
        console.error('Demo sign up error:', error);
        return false;
      }
    }

    // After demo period: show plan selection
    setPendingRegistration({ email, password, name });
    setPendingRegisteredUserId(null);
    setShowSignUp(false);
    setShowSelectPlan(true);
    return true;
  };

  const ensurePendingRegistrationUser = async (): Promise<number | null> => {
    if (userId) return userId;
    if (pendingRegisteredUserId) return pendingRegisteredUserId;
    if (!pendingRegistration) return null;

    try {
      const user = await usersService.register(pendingRegistration);
      setUserId(user.id);
      setPendingRegisteredUserId(user.id);
      setUserName(user.name || pendingRegistration.email.split("@")[0]);
      setUserEmail(user.email);
      setSessionToken(user.session_token || null);
      return user.id;
    } catch (error) {
      console.error('Sign up error:', error);
      return null;
    }
  };

  const handlePlanSelected = async (plan: SubscriptionType) => {
    const effectiveUserId = userId || pendingRegisteredUserId || await ensurePendingRegistrationUser();
    if (!effectiveUserId) {
      setShowSelectPlan(false);
      setShowSignUp(true);
      return;
    }

    if (effectiveUserId) {
      try {
        if (plan === 'free' && !isDemoPeriod) {
          await subscriptionService.updateSubscription(effectiveUserId, plan);
          setSubscriptionType(plan);
        } else if (plan === 'free' && isDemoPeriod) {
          // During demo period, keep PRO even if user selected free
          setSubscriptionType('pro');
        } else {
          // Set the plan type immediately (it was already verified by Stripe)
          setSubscriptionType(plan);
          // Then fetch full subscription details from server (which also syncs with Stripe)
          const subscription = await subscriptionService.getSubscription(effectiveUserId);
          setSubscriptionType(subscription.type);
          setSubscriptionCancelledPending(subscription.cancelAtPeriodEnd || false);
          setSubscriptionExpiresAt(subscription.expiresAt || null);
          setAutoRenew(subscription.autoRenew !== false);
          setActiveTrial(subscription.activeTrial || null);
          setSubscriptionLoaded(true);
        }
      } catch (error) {
        console.error('Error updating subscription:', error);
        // Keep the plan type that was passed in even if fetch fails
        setSubscriptionType(plan);
      }
    }
    setShowSelectPlan(false);
    setPendingRegistration(null);
    setPendingRegisteredUserId(null);
    setIsLoggedIn(true);
    setCurrentScreen('home');
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

  const openStatsScreen = () => {
    setStatsResetKey(prev => prev + 1);
    setCurrentScreen('stats');
  };

  const handleNavigate = (screen: string) => {
    if (screen === 'startMatch') {
      // Go to start match flow screen to check for ongoing matches
      setCurrentScreen('startMatchFlow');
    } else if (screen === 'stats') {
      openStatsScreen();
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
    setSubscriptionExpiresAt(null);
    setAutoRenew(true);
    setSubscriptionLoaded(false);
    setActiveTrial(null);
    setIsSuperadmin(false);
    setPendingRegistration(null);
    setPendingRegisteredUserId(null);
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
        setAutoRenew(false);
        // Don't change to free immediately - user keeps access until period ends
        loadSubscription();
      } else {
        const errorData = await response.json();
        console.error('Cancel error:', errorData);
        Alert.alert(t('common.error'), t('app.cancelError'));
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      Alert.alert(t('common.error'), t('app.cancelErrorGeneral'));
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
            onEnsureUser={ensurePendingRegistrationUser}
            onBack={() => setCurrentScreen('home')}
            currentPlan={subscriptionType}
            userId={userId || pendingRegisteredUserId}
            cancelAtPeriodEnd={subscriptionCancelledPending || !autoRenew}
          />
        );
      case 'searchByCode':
        return (
          <SearchByCodeScreen
            onOpenMenu={handleOpenMenu}
            userId={userId}
            onMatchFound={(match) => {
              setViewingMatch(match);
              setCurrentScreen('matchStatsFromCode');
            }}
          />
        );
      case 'matchStatsFromCode':
        if (!viewingMatch) {
          return (
            <SearchByCodeScreen
              userId={userId}
              onMatchFound={(match) => {
                setViewingMatch(match);
                setCurrentScreen('matchStatsFromCode');
              }}
            />
          );
        }
        return (
          <MatchStatsScreen
            match={viewingMatch}
            subscriptionType="free"
            hideExportOptions={true}
            onBack={() => {
              setViewingMatch(null);
              setCurrentScreen(subscriptionType === 'free' ? 'home' : 'searchByCode');
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
            onContinueMatch={async (match: Match) => {
              console.log('🔄 [startMatch] Continuando partido:', match.id);
              if (!match.team_id) {
                console.error('❌ team_id no disponible para el partido:', match.id);
                return;
              }

              let team = teams.find(t => t.id === match.team_id);
              if (!team && userId) {
                try {
                  team = await teamsService.getById(match.team_id, userId);
                } catch (error) {
                  console.error('❌ Error cargando equipo para reanudar:', error);
                }
              }

              const details = {
                teamId: match.team_id,
                teamName: match.team_name || team?.name || 'Equipo',
                rivalTeam: match.opponent || '',
                date: match.date ? new Date(match.date) : new Date(),
                isHome: match.location === 'home',
              };

              setResumeMatchId(match.id);
              setMatchDetails(details);
              setCurrentScreen('matchField');
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
            onContinueMatch={async (match: Match) => {
              console.log('🔄 [startMatchFlow] Continuando partido:', match.id);
              if (!match.team_id) {
                console.error('❌ team_id no disponible para el partido:', match.id);
                return;
              }

              let team = teams.find(t => t.id === match.team_id);
              if (!team && userId) {
                try {
                  team = await teamsService.getById(match.team_id, userId);
                } catch (error) {
                  console.error('❌ Error cargando equipo para reanudar:', error);
                }
              }

              const details = {
                teamId: match.team_id,
                teamName: match.team_name || team?.name || 'Equipo',
                rivalTeam: match.opponent || '',
                date: match.date ? new Date(match.date) : new Date(),
                isHome: match.location === 'home',
              };

              setResumeMatchId(match.id);
              setMatchDetails(details);
              setCurrentScreen('matchField');
            }}
          />
        );
      case 'stats':
        return (
          <StatsScreen 
            onOpenMenu={handleOpenMenu}
            userId={userId}
            teams={teams}
            subscriptionType={subscriptionType}
            onUpgradeToPro={handleUpgradeToPro}
            resetTrackingKey={statsResetKey}
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
            subscriptionExpiresAt={subscriptionExpiresAt}
            cancelAtPeriodEnd={subscriptionCancelledPending}
            autoRenew={autoRenew}
            activeTrial={activeTrial}
            hasAppleSubscription={Platform.OS === 'ios'}
            onSubscriptionCancelled={() => {
              // Don't change to free immediately - user keeps access until expiration
              // Just refresh the subscription state to show cancellation info
              loadSubscription();
            }}
            onSubscriptionReactivated={() => {
              // Refresh subscription state to reflect reactivation
              loadSubscription();
            }}
            onLogout={handleLogout}
          />
        );
      case 'guide':
        return (
          <GuideScreen 
            onBack={() => setCurrentScreen('home')}
            onOpenMenu={handleOpenMenu}
            onSelectPlan={handleUpgradeToPro}
            subscriptionType={subscriptionType}
          />
        );
      case 'adminPanel':
        return (
          <AdminPanelScreen
            onOpenMenu={handleOpenMenu}
            onNavigate={handleNavigate}
          />
        );
      case 'sendNotification':
        return (
          <SendNotificationScreen
            onBack={() => setCurrentScreen('adminPanel')}
            userId={userId}
          />
        );
      case 'userManagement':
        return (
          <UserManagementScreen
            onBack={() => setCurrentScreen('adminPanel')}
            userId={userId}
          />
        );
      default:
        // Free users see search by code screen as home
        if (subscriptionType === 'free') {
          return (
            <SearchByCodeScreen
              onOpenMenu={handleOpenMenu}
              userId={userId}
              onMatchFound={(match) => {
                setViewingMatch(match);
                setCurrentScreen('matchStatsFromCode');
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
            onEnsureUser={ensurePendingRegistrationUser}
            onBack={() => {
              setShowSelectPlan(false);
              setShowSignUp(true);
            }}
            currentPlan={undefined}
            userId={userId || pendingRegisteredUserId}
          />
        ) : showSignUp ? (
          <SignUpScreen
            onSignUp={handleSignUp}
            onBackToLogin={handleBackToLogin}
            onViewPlans={isDemoPeriod ? undefined : () => {
              setShowSignUp(false);
              setShowSelectPlan(true);
            }}
          />
        ) : showForgotPassword ? (
          <ForgotPasswordScreen
            onBack={handleBackFromForgotPassword}
            onCodeSent={handleCodeSent}
          />
        ) : showResetPassword ? (
          <ResetPasswordScreen
            email={resetPasswordEmail}
            onBack={handleBackFromForgotPassword}
            onSuccess={handlePasswordResetSuccess}
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
          <View style={{ flex: 1 }}>
            {renderCurrentScreen()}
          </View>
          {!['selectTeam', 'matchDetails', 'matchField', 'matchStatsFromCode', 'selectPlan', 'sendNotification', 'userManagement'].includes(currentScreen) && subscriptionLoaded && (
            <FooterNav
              currentScreen={currentScreen}
              subscriptionType={subscriptionType}
              onNavigate={handleNavigate}
            />
          )}
          {currentScreen !== 'selectPlan' && currentScreen !== 'matchStatsFromCode' && subscriptionLoaded && (
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
              isSuperadmin={isSuperadmin}
            />
          )}
        </>
      )}

      <CustomAlert
        visible={showSessionAlert}
        title={t('app.sessionOtherDevice')}
        message={t('app.sessionMessage')}
        buttons={[
          {
            text: t('app.closeSession'),
            onPress: handleForcedLogout,
            style: 'destructive',
          },
        ]}
        onClose={handleForcedLogout}
      />

      <CustomAlert
        visible={showCancelSubscriptionAlert}
        title={t('app.cancelSubscription')}
        message={t('app.cancelSubscriptionConfirm', { type: subscriptionType === 'pro' ? 'PRO' : t('common.basic') })}
        type="warning"
        icon={<MaterialCommunityIcons name="alert" size={32} color={Colors.warning} />}
        buttons={[
          {
            text: t('app.keepPlan'),
            onPress: () => setShowCancelSubscriptionAlert(false),
            style: 'cancel',
          },
          {
            text: isCancelling ? t('app.cancelling') : t('app.yesCancelPlan'),
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
        title={t('app.cancelSuccess')}
        message={t('app.cancelSuccessMessage')}
        type="success"
        icon={<MaterialCommunityIcons name="check-circle" size={32} color="#22c55e" />}
        buttons={[
          {
            text: t('common.understood'),
            onPress: () => setShowCancelSuccessAlert(false),
            style: 'default',
          },
        ]}
        onClose={() => setShowCancelSuccessAlert(false)}
      />

      {/* Update Required Alert */}
      <CustomAlert
        visible={showUpdateAlert}
        title={t('app.updateRequired')}
        message={updateInfo?.message || t('app.updateMessage')}
        type="warning"
        icon={<MaterialCommunityIcons name="cellphone-arrow-down" size={48} color="#f59e0b" />}
        iconBackgroundColor="#f59e0b15"
        buttons={[
          {
            text: t('app.updateNow'),
            icon: <MaterialCommunityIcons name={Platform.OS === 'ios' ? 'apple' : 'google-play'} size={18} color="#FFFFFF" />,
            onPress: () => {
              if (updateInfo?.storeUrl) {
                Linking.openURL(updateInfo.storeUrl).catch(err => {
                  console.error('Error opening store URL:', err);
                });
              }
            },
            style: 'primary',
          },
        ]}
        onClose={() => {
          // No permitir cerrar - es obligatorio actualizar
        }}
      />
    </View>
  );
}