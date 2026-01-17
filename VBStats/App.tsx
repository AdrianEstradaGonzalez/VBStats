import React, { useState, useEffect } from "react";
import { View, StatusBar, Alert, Platform } from "react-native";
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
  Team,
  MatchDetails,
} from "./pages";
import { Colors } from "./styles";
import { SideMenu } from "./components";
import { teamsService, playersService, usersService, Match } from "./services/api";

type Screen = 'home' | 'teams' | 'startMatch' | 'stats' | 'settings' | 'profile' | 'selectTeam' | 'matchDetails' | 'matchField' | 'startMatchFlow';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [menuVisible, setMenuVisible] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [resumeMatchId, setResumeMatchId] = useState<number | null>(null);

  // Load teams from backend when user logs in
  useEffect(() => {
    if (isLoggedIn && userId) {
      loadTeams();
    }
  }, [isLoggedIn, userId]);

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
      setUserId(user.id);
      setUserName(user.name || email.split("@")[0]);
      setUserEmail(user.email);
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
      // Después de registrar exitosamente, iniciamos sesión automáticamente
      setUserId(user.id);
      setUserName(user.name || email.split("@")[0]);
      setUserEmail(user.email);
      setIsLoggedIn(true);
      setShowSignUp(false);
      return true;
    } catch (error) {
      console.error('Sign up error:', error);
      return false;
    }
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

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserId(null);
    setUserName("");
    setUserEmail("");
    setCurrentScreen('home');
    setMenuVisible(false);
  };

  const handleOpenMenu = () => {
    setMenuVisible(true);
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'teams':
        return (
          <TeamsScreen 
            onOpenMenu={handleOpenMenu}
            teams={teams}
            onTeamsChange={setTeams}
            userId={userId}
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
              const team = teams.find(t => t.id === match.team_id);
              if (team) {
                setResumeMatchId(match.id);
                setMatchDetails({
                  teamId: match.team_id!,
                  teamName: match.team_name || team.name,
                  players: team.players || [],
                  rivalTeam: match.opponent || '',
                  date: match.date ? new Date(match.date) : new Date(),
                  isHome: match.location === 'home',
                });
                setCurrentScreen('matchField');
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
              const team = teams.find(t => t.id === match.team_id);
              if (team) {
                setResumeMatchId(match.id);
                setMatchDetails({
                  teamId: match.team_id!,
                  teamName: match.team_name || team.name,
                  players: team.players || [],
                  rivalTeam: match.opponent || '',
                  date: match.date ? new Date(match.date) : new Date(),
                  isHome: match.location === 'home',
                });
                setCurrentScreen('matchField');
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
          />
        );
      default:
        return (
          <HomeScreen 
            userName={userName}
            userEmail={userEmail}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
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
      {!isLoggedIn ? (
        showSignUp ? (
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
          {currentScreen !== 'home' && (
            <SideMenu
              visible={menuVisible}
              onClose={() => setMenuVisible(false)}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              userName={userName}
              userEmail={userEmail}
            />
          )}
        </>
      )}
    </View>
  );
}