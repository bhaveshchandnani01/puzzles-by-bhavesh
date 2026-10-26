
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Event, Team } from '../types';

type GameRound = {
  id: string;
  event_id: string;
  round_number: number;
  status: string;
  easy_multiplier: number;
  medium_multiplier: number;
  hard_multiplier: number;
  easy_min_bet: number;
  easy_max_bet: number;
  medium_min_bet: number;
  medium_max_bet: number;
  hard_min_bet: number;
  hard_max_bet: number;
};

type TeamBet = {
  id: string;
  round_id: string;
  team_id: string;
  difficulty: string;
  amount: number;
  result: string | null;
  is_locked: boolean;
  is_settled: boolean;
  settled_at: string | null;
};

type Round2Match = {
  id: string;
  event_id: string;
  team_a_id: string;
  team_b_id: string;
  status: 'pending' | 'settled';
  winner_team_id: string | null;
  created_at?: string;
};

type Round2Prediction = {
  id: string;
  event_id: string;
  bettor_team_id: string;
  target_team_id: string;
  amount: number;
  status: 'pending' | 'won' | 'lost';
  payout: number;
  settled_at: string | null;
};

export default function HostDashboard() {
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [round, setRound] = useState<GameRound | null>(null);
  const [bets, setBets] = useState<TeamBet[]>([]);
  const [matches, setMatches] = useState<Round2Match[]>([]);
  const [predictions, setPredictions] = useState<Round2Prediction[]>([]);

  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');

  const [loading, setLoading] = useState(true);
  const [settlingBetId, setSettlingBetId] = useState<string | null>(null);
  const [processingMatchId, setProcessingMatchId] = useState<string | null>(null);
  const [round2Loading, setRound2Loading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Host-only admin controls
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminTeamId, setAdminTeamId] = useState('');
  const [adminCoinMode, setAdminCoinMode] = useState<'set' | 'add' | 'subtract'>('set');
  const [adminCoinAmount, setAdminCoinAmount] = useState('');
  const [adminReason, setAdminReason] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPhone, setNewTeamPhone] = useState('');
  const [newTeamPassword, setNewTeamPassword] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamId, setEditTeamId] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setErrorMessage('');

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('host_user_id', user.id)
        .maybeSingle();

      if (eventError) throw eventError;

      if (!eventData) {
        setEvent(null);
        setTeams([]);
        setRound(null);
        setBets([]);
        setMatches([]);
        setPredictions([]);
        return;
      }

      setEvent(eventData as Event);

      const [
        { data: teamData, error: teamError },
        { data: roundData, error: roundError },
        { data: matchData, error: matchError },
        { data: predictionData, error: predictionError },
      ] = await Promise.all([
        supabase
          .from('teams')
          .select('*')
          .eq('event_id', eventData.id)
          .order('registered_at', { ascending: true }),

        supabase
          .from('game_rounds')
          .select('*')
          .eq('event_id', eventData.id)
          .eq('round_number', 1)
          .maybeSingle(),

        supabase
          .from('round2_matches')
          .select('*')
          .eq('event_id', eventData.id)
          .order('created_at', { ascending: true }),

        supabase
          .from('round2_predictions')
          .select('*')
          .eq('event_id', eventData.id)
          .order('created_at', { ascending: true }),
      ]);

      if (teamError) throw teamError;
      if (roundError) throw roundError;
      if (matchError) throw matchError;
      if (predictionError) throw predictionError;

      setTeams((teamData ?? []) as Team[]);
      setRound((roundData ?? null) as GameRound | null);
      setMatches((matchData ?? []) as Round2Match[]);
      setPredictions((predictionData ?? []) as Round2Prediction[]);

      if (roundData) {
        const { data: betData, error: betError } = await supabase
          .from('team_bets')
          .select('*')
          .eq('round_id', roundData.id)
          .order('created_at', { ascending: true });

        if (betError) throw betError;
        setBets((betData ?? []) as TeamBet[]);
      } else {
        setBets([]);
      }
    } catch (error) {
      console.error('Dashboard loading error:', error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not load dashboard data.',
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!event?.id) return;

    const channel = supabase
      .channel(`host-dashboard-${event.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `event_id=eq.${event.id}`,
        },
        () => void loadDashboard(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `event_id=eq.${event.id}`,
        },
        () => void loadDashboard(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_bets',
        },
        () => void loadDashboard(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round2_matches',
          filter: `event_id=eq.${event.id}`,
        },
        () => void loadDashboard(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round2_predictions',
          filter: `event_id=eq.${event.id}`,
        },
        () => void loadDashboard(),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${event.id}`,
        },
        () => void loadDashboard(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [event?.id, loadDashboard]);

  const settleBet = async (
    bet: TeamBet,
    result: 'won' | 'lost',
  ) => {
    if (!event || settlingBetId || bet.is_settled) return;

    const team = teams.find((item) => item.id === bet.team_id);
    const teamName = team?.team_name ?? 'this team';

    const confirmed = window.confirm(
      `Confirm ${teamName} as ${result.toUpperCase()}?\n\n` +
        `Difficulty: ${bet.difficulty}\n` +
        `Bet: ${bet.amount} coins\n\n` +
        'This action will update the result and coin balance.',
    );

    if (!confirmed) return;

    setSettlingBetId(bet.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { data, error } = await supabase.rpc('settle_round1_bet', {
        p_bet_id: bet.id,
        p_result: result,
      });

      if (error) throw error;

      const newBalance = Number(data);

      if (!Number.isFinite(newBalance)) {
        throw new Error(
          'Unexpected settlement response. Refresh and check the database.',
        );
      }

      setSuccessMessage(
        `${teamName} marked ${result.toUpperCase()}. New balance: ${newBalance} coins.`,
      );

      await loadDashboard();
    } catch (error) {
      console.error('Could not settle Round 1 bet:', error);
      setErrorMessage(
        `Settlement failed: ${
          error instanceof Error ? error.message : 'Unknown error.'
        }`,
      );
    } finally {
      setSettlingBetId(null);
    }
  };

  const startRound2 = async () => {
    if (!event || round2Loading) return;

    if (
      !window.confirm(
        'Start Round 2? All Round 1 bets must be settled first.',
      )
    ) {
      return;
    }

    setRound2Loading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('start_round2', {
        p_event_id: event.id,
      });

      if (error) throw error;

      setSuccessMessage('Round 2 is now active!');
      await loadDashboard();
    } catch (error) {
      console.error('Could not start Round 2:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not start Round 2.',
      );
    } finally {
      setRound2Loading(false);
    }
  };

  const createMatch = async () => {
    if (!event || round2Loading) return;

    if (!teamA || !teamB || teamA === teamB) {
      setErrorMessage('Choose two different teams for the matchup.');
      return;
    }

    const firstTeam = teams.find((t) => t.id === teamA);
    const secondTeam = teams.find((t) => t.id === teamB);

    if (
      !firstTeam ||
      !secondTeam ||
      firstTeam.is_eliminated ||
      secondTeam.is_eliminated ||
      firstTeam.status === 'eliminated' ||
      secondTeam.status === 'eliminated'
    ) {
      setErrorMessage('Choose two active teams.');
      return;
    }

    setRound2Loading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('create_round2_match', {
        p_event_id: event.id,
        p_team_a_id: teamA,
        p_team_b_id: teamB,
      });

      if (error) throw error;

      setSuccessMessage(
        `Match created: ${firstTeam.team_name} vs ${secondTeam.team_name}.`,
      );
      setTeamA('');
      setTeamB('');
      await loadDashboard();
    } catch (error) {
      console.error('Could not create matchup:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not create matchup.',
      );
    } finally {
      setRound2Loading(false);
    }
  };

  const settleMatch = async (
    match: Round2Match,
    winnerId: string,
  ) => {
    if (processingMatchId || match.status !== 'pending') return;

    const winner = teams.find((t) => t.id === winnerId);
    const loserId =
      winnerId === match.team_a_id ? match.team_b_id : match.team_a_id;
    const loser = teams.find((t) => t.id === loserId);

    if (!winner || !loser) {
      setErrorMessage('Could not find both teams for this matchup.');
      return;
    }

    const confirmed = window.confirm(
      `Declare ${winner.team_name} the winner?\n\n` +
        `${loser.team_name} will be eliminated and their remaining coins set to zero. ` +
        'Predictions targeting either team will be settled.',
    );

    if (!confirmed) return;

    setProcessingMatchId(match.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('settle_round2_match', {
        p_match_id: match.id,
        p_winner_team_id: winnerId,
      });

      if (error) throw error;

      setSuccessMessage(
        `${winner.team_name} wins! ${loser.team_name} is eliminated. Predictions have been settled.`,
      );

      await loadDashboard();
    } catch (error) {
      console.error('Could not settle Round 2 match:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not settle match.',
      );
    } finally {
      setProcessingMatchId(null);
    }
  };

  const runAdminAction = async (
    rpcName: string,
    args: Record<string, unknown>,
    confirmation: string,
    success: string,
  ) => {
    if (!event || adminBusy) return;
    if (!window.confirm(confirmation)) return;
    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { error } = await supabase.rpc(rpcName as never, args as never);
      if (error) throw error;
      setSuccessMessage(success);
      await loadDashboard();
    } catch (error) {
      console.error(`Admin action ${rpcName} failed:`, error);
      setErrorMessage(error instanceof Error ? error.message : 'Admin action failed.');
    } finally {
      setAdminBusy(false);
    }
  };

  const adjustCoins = async () => {
    if (!event || !adminTeamId) {
      setErrorMessage('Choose a team first.');
      return;
    }
    const amount = Number(adminCoinAmount);
    if (!Number.isSafeInteger(amount) || amount < 0 || (adminCoinMode !== 'set' && amount === 0)) {
      setErrorMessage('Enter a valid whole-number coin amount.');
      return;
    }
    if (!adminReason.trim()) {
      setErrorMessage('Enter a reason for the coin adjustment.');
      return;
    }
    const team = teams.find((item) => item.id === adminTeamId);
    const rpcMode = adminCoinMode === 'set' ? 'set' : 'adjust';
    const signedAmount = adminCoinMode === 'subtract' ? -amount : amount;
    const operation = adminCoinMode === 'set' ? `set ${team?.team_name}'s balance to ${amount}` : `${adminCoinMode === 'add' ? 'add' : 'subtract'} ${amount} coins ${adminCoinMode === 'add' ? 'to' : 'from'} ${team?.team_name}`;
    await runAdminAction(
      'admin_adjust_team_coins',
      { p_event_id: event.id, p_team_id: adminTeamId, p_mode: rpcMode, p_amount: signedAmount, p_reason: adminReason.trim() },
      `Confirm coin change: ${operation}?\n\nReason: ${adminReason.trim()}`, 
      `Coin balance updated for ${team?.team_name ?? 'team'}.`,
    );
    setAdminCoinAmount('');
    setAdminReason('');
  };

  const addTeam = async () => {
    if (!event || adminBusy) return;

    const teamName = newTeamName.trim();
    const phone = newTeamPhone.trim();
    const password = newTeamPassword;

    if (!teamName || !phone || !password) {
      setErrorMessage('Enter the team name, player phone number, and password.');
      return;
    }

    if (!/^\\+?[0-9\\s()-]{8,20}$/.test(phone)) {
      setErrorMessage('Enter a valid phone number.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('puzzles-auth', {
        body: {
          action: 'host_create_team',
          eventId: event.id,
          teamName,
          phone,
          password,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSuccessMessage(`Login created for “${teamName}”. Share the team name and password with the player.`);
      setNewTeamName('');
      setNewTeamPhone('');
      setNewTeamPassword('');
      await loadDashboard();
    } catch (error) {
      console.error('Could not create team login:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not create the team login.',
      );
    } finally {
      setAdminBusy(false);
    }
  };

  const saveTeamEdit = async () => {
    if (!event || !editTeamId || !editTeamName.trim()) {
      setErrorMessage('Choose a team and enter its new name.');
      return;
    }
    const team = teams.find((item) => item.id === editTeamId);
    await runAdminAction(
      'admin_edit_team',
      { p_event_id: event.id, p_team_id: editTeamId, p_team_name: editTeamName.trim(), p_restore: false },
      `Rename “${team?.team_name ?? 'team'}” to “${editTeamName.trim()}”?`,
      'Team name updated.',
    );
    setEditTeamName('');
  };

  const restoreTeam = async (team: Team) => {
    if (!event) return;
    await runAdminAction(
      'admin_edit_team',
      { p_event_id: event.id, p_team_id: team.id, p_team_name: team.team_name, p_restore: true },
      `Restore ${team.team_name}? This marks the team active but does not automatically refund or change its coins.`,
      `${team.team_name} restored.`,
    );
  };

  const removeTeam = async (team: Team) => {
    if (!event) return;
    await runAdminAction(
      'admin_remove_team',
      { p_event_id: event.id, p_team_id: team.id },
      `Permanently remove ${team.team_name}?\n\nThis is allowed only if the team has no Round 1 or Round 2 game history.`,
      `${team.team_name} removed.`,
    );
  };

  const undoMatch = async (match: Round2Match) => {
    if (!event || match.status !== 'settled') return;
    await runAdminAction(
      'admin_undo_round2_match',
      { p_match_id: match.id },
      `Undo this match result?\n\nThe database will restore the saved pre-settlement team balances/statuses and reopen its predictions. This is available only for matches settled after the admin migration and with no later match activity.`,
      'Match result undone.',
    );
  };

  const resetRound = async (roundNumber: 1 | 2) => {
    if (!event) return;
    const rpcName = roundNumber === 1 ? 'admin_reset_round1' : 'admin_reset_round2';
    const warning = roundNumber === 1
      ? 'Reset Round 1? All Round 1 bets will be removed, all teams will return to the event starting coin balance, and Round 2 data must not exist.'
      : 'Reset Round 2? All Round 2 matches and predictions will be cleared and teams restored to the saved Round 2 starting balances. This requires a snapshot captured when Round 2 started.';
    await runAdminAction(rpcName, { p_event_id: event.id }, warning, `Round ${roundNumber} reset completed.`);
  };

  if (loading) {
    return (
      <main className="host-dashboard">
        <p>Loading dashboard...</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="host-dashboard">
        <h1>Host Dashboard</h1>
        <p>No event was found for this account.</p>
        {errorMessage && <p role="alert">{errorMessage}</p>}
        <button onClick={() => void loadDashboard()}>Refresh</button>
      </main>
    );
  }

  const pendingBets = bets.filter((bet) => !bet.is_settled);
  const settledBets = bets.filter((bet) => bet.is_settled);
  const pendingMatches = matches.filter((match) => match.status === 'pending');
  const settledMatches = matches.filter((match) => match.status === 'settled');
  const pendingPredictions = predictions.filter(
    (prediction) => prediction.status === 'pending',
  );

  const activeTeams = teams.filter(
    (team) =>
      !team.is_eliminated && team.status !== 'eliminated',
  );

  const getTeamName = (id: string) =>
    teams.find((team) => team.id === id)?.team_name ?? 'Unknown team';

  const getMultiplier = (difficulty: string) => {
    if (!round) return 0;

    switch (difficulty.toLowerCase()) {
      case 'easy':
        return round.easy_multiplier;
      case 'medium':
        return round.medium_multiplier;
      case 'hard':
        return round.hard_multiplier;
      default:
        return 0;
    }
  };

  return (
    <main className="host-dashboard">
      <header className="host-dashboard-header">
        <div>
          <p className="host-eyebrow">HOST CONTROL PANEL</p>
          <h1>{event.name}</h1>
          <p>
            Event status: <strong>{event.status}</strong>
          </p>
          <p>
            Join code: <strong>{event.join_code}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={Boolean(settlingBetId || processingMatchId || round2Loading)}
        >
          Refresh Dashboard
        </button>
      </header>

      {errorMessage && (
        <div className="host-alert host-alert-error" role="alert">
          <strong>Something needs your attention</strong>
          <p>{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="host-alert host-alert-success" role="status">
          {successMessage}
        </div>
      )}

      <section className="host-stats">
        <article className="host-stat-card">
          <span>Total Teams</span>
          <strong>{teams.length}</strong>
        </article>

        <article className="host-stat-card">
          <span>Round 1 Pending Bets</span>
          <strong>{pendingBets.length}</strong>
        </article>

        <article className="host-stat-card">
          <span>Round 2 Pending Matches</span>
          <strong>{pendingMatches.length}</strong>
        </article>

        <article className="host-stat-card">
          <span>Pending Predictions</span>
          <strong>{pendingPredictions.length}</strong>
        </article>
      </section>

      <section className="host-section">
        <h2>Round Information</h2>

        {round ? (
          <div className="host-round-card">
            <p>
              Round 1 · <strong>{round.status}</strong>
            </p>
            <div className="host-multipliers">
              <span>Easy ×{round.easy_multiplier}</span>
              <span>Medium ×{round.medium_multiplier}</span>
              <span>Hard ×{round.hard_multiplier}</span>
            </div>
          </div>
        ) : (
          <p>No Round 1 configuration was found.</p>
        )}

        {event.status === 'round1' && (
          <div style={{ marginTop: '18px' }}>
            <p>
              Settle all Round 1 bets before moving to the next round.
            </p>
            <button
              type="button"
              onClick={() => void startRound2()}
              disabled={round2Loading || pendingBets.length > 0}
            >
              {round2Loading ? 'PROCESSING…' : 'START ROUND 2'}
            </button>
            {pendingBets.length > 0 && (
              <p>
                {pendingBets.length} Round 1 bet(s) still need a result.
              </p>
            )}
          </div>
        )}

        {event.status === 'round2' && (
          <p style={{ marginTop: '16px' }}>
            Round 2 is active. Create matchups and settle results below.
          </p>
        )}
      </section>

      <section className="host-section">
        <h2>Round 1 — Pending Bets</h2>
        <p>Confirm each team's result once. The database handles the payout.</p>

        {!pendingBets.length && <p>No pending Round 1 bets.</p>}

        <div className="host-bets-list">
          {pendingBets.map((bet) => {
            const team = teams.find((item) => item.id === bet.team_id);
            const multiplier = getMultiplier(bet.difficulty);
            const potentialPayout = bet.amount * multiplier;
            const isProcessing = settlingBetId === bet.id;

            return (
              <article className="host-bet-card" key={bet.id}>
                <div className="host-bet-details">
                  <h3>{team?.team_name ?? 'Unknown Team'}</h3>
                  <p>
                    {bet.difficulty.toUpperCase()} · {bet.amount} COINS
                  </p>
                  <p>
                    Current balance: {team?.coin_balance ?? '—'} coins
                  </p>
                  <p>If won: {potentialPayout} coins paid out</p>
                  <span className="host-bet-pending">PENDING</span>
                </div>

                <div className="host-bet-actions">
                  <button
                    type="button"
                    className="host-bet-won"
                    disabled={Boolean(settlingBetId)}
                    onClick={() => void settleBet(bet, 'won')}
                  >
                    {isProcessing ? 'Processing...' : 'WON'}
                  </button>

                  <button
                    type="button"
                    className="host-bet-lost"
                    disabled={Boolean(settlingBetId)}
                    onClick={() => void settleBet(bet, 'lost')}
                  >
                    {isProcessing ? 'Processing...' : 'LOST'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {event.status === 'round2' && (
        <>
          <section className="host-section">
            <h2>Round 2 — Create Matchup</h2>
            <p>
              Choose two active teams. Teams should make their predictions
              before you settle a match.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginTop: '16px',
              }}
            >
              <label>
                <span>Team A</span>
                <select
                  value={teamA}
                  onChange={(e) => setTeamA(e.target.value)}
                  disabled={round2Loading}
                  style={{ display: 'block', width: '100%', marginTop: '8px' }}
                >
                  <option value="">Choose Team A</option>
                  {activeTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Team B</span>
                <select
                  value={teamB}
                  onChange={(e) => setTeamB(e.target.value)}
                  disabled={round2Loading}
                  style={{ display: 'block', width: '100%', marginTop: '8px' }}
                >
                  <option value="">Choose Team B</option>
                  {activeTeams
                    .filter((team) => team.id !== teamA)
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.team_name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => void createMatch()}
              disabled={round2Loading || !teamA || !teamB || teamA === teamB}
              style={{ marginTop: '16px' }}
            >
              {round2Loading ? 'PROCESSING…' : 'CREATE MATCH'}
            </button>
          </section>

          <section className="host-section">
            <h2>Round 2 — Matchups</h2>
            <p>
              Select the winner after the match has finished. Each match can
              only be settled once.
            </p>

            {!matches.length && <p>No Round 2 matchups created yet.</p>}

            <div className="host-bets-list">
              {matches.map((match) => {
                const isProcessing = processingMatchId === match.id;

                return (
                  <article className="host-bet-card" key={match.id}>
                    <div className="host-bet-details">
                      <h3>
                        {getTeamName(match.team_a_id)} vs{' '}
                        {getTeamName(match.team_b_id)}
                      </h3>

                      {match.status === 'pending' ? (
                        <span className="host-bet-pending">
                          AWAITING RESULT
                        </span>
                      ) : (
                        <span className="host-bet-won">
                          WINNER: {getTeamName(match.winner_team_id ?? '')}
                        </span>
                      )}
                    </div>

                    {match.status === 'pending' && (
                      <div className="host-bet-actions">
                        <button
                          type="button"
                          className="host-bet-won"
                          disabled={Boolean(processingMatchId || round2Loading)}
                          onClick={() =>
                            void settleMatch(match, match.team_a_id)
                          }
                        >
                          {isProcessing
                            ? 'PROCESSING…'
                            : `${getTeamName(match.team_a_id)} WINS`}
                        </button>

                        <button
                          type="button"
                          className="host-bet-lost"
                          disabled={Boolean(processingMatchId || round2Loading)}
                          onClick={() =>
                            void settleMatch(match, match.team_b_id)
                          }
                        >
                          {isProcessing
                            ? 'PROCESSING…'
                            : `${getTeamName(match.team_b_id)} WINS`}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="host-section">
            <h2>Round 2 — Prediction Results</h2>
            <p>
              Correct prediction payout: original stake plus 5 bonus coins.
            </p>

            {!predictions.length && <p>No predictions submitted yet.</p>}

            <div className="host-bets-list">
              {predictions.map((prediction) => (
                <article className="host-bet-card" key={prediction.id}>
                  <div className="host-bet-details">
                    <h3>{getTeamName(prediction.bettor_team_id)}</h3>
                    <p>
                      Predicted winner: {getTeamName(prediction.target_team_id)}
                    </p>
                    <p>Stake: {prediction.amount} coins</p>
                    <p>Payout: {prediction.payout} coins</p>
                  </div>

                  <strong>
                    {prediction.status === 'pending'
                      ? 'PENDING'
                      : prediction.status.toUpperCase()}
                  </strong>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="host-section">
        <h2>Admin Controls</h2>
        <p>Emergency controls are host-authorized and record coin adjustment reasons. Destructive actions ask for confirmation.</p>

        <div className="host-round-card" style={{ display: 'grid', gap: '18px' }}>
          <div>
            <h3>Undo / Reset Rounds</h3>
            <p>Undo a single settled Round 2 match, or reset a whole round when a safe database snapshot is available.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              {settledMatches.map((match) => (
                <button key={match.id} type="button" disabled={adminBusy} onClick={() => void undoMatch(match)}>
                  UNDO: {getTeamName(match.team_a_id)} vs {getTeamName(match.team_b_id)}
                </button>
              ))}
              <button type="button" disabled={adminBusy} onClick={() => void resetRound(1)}>RESET ROUND 1</button>
              <button type="button" disabled={adminBusy} onClick={() => void resetRound(2)}>RESET ROUND 2</button>
            </div>
          </div>

          <div>
            <h3>Manage Coins</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '10px' }}>
              <label>Team
                <select value={adminTeamId} onChange={(e) => setAdminTeamId(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '6px' }}>
                  <option value="">Choose team</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.team_name} ({team.coin_balance})</option>)}
                </select>
              </label>
              <label>Operation
                <select value={adminCoinMode} onChange={(e) => setAdminCoinMode(e.target.value as 'set' | 'add' | 'subtract')} style={{ display: 'block', width: '100%', marginTop: '6px' }}>
                  <option value="set">Set exact balance</option>
                  <option value="add">Add coins</option>
                  <option value="subtract">Subtract coins</option>
                </select>
              </label>
              <label>{adminCoinMode === 'set' ? 'New balance' : adminCoinMode === 'add' ? 'Coins to add' : 'Coins to subtract'}
                <input type="number" min="0" step="1" value={adminCoinAmount} onChange={(e) => setAdminCoinAmount(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '6px' }} />
              </label>
              <label>Reason (required)
                <input value={adminReason} onChange={(e) => setAdminReason(e.target.value)} placeholder="e.g. Correcting test balance" style={{ display: 'block', width: '100%', marginTop: '6px' }} />
              </label>
            </div>
            <button type="button" disabled={adminBusy || !adminTeamId || !adminCoinAmount || !adminReason.trim()} onClick={() => void adjustCoins()} style={{ marginTop: '12px' }}>{adminBusy ? 'PROCESSING…' : 'APPLY COIN CHANGE'}</button>
            <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Coin subtraction is rejected if it would make the balance negative.</p>
          </div>

          <div>
            <h3>Add Team Login</h3>
            <p>Create a team account here and share the team name and password with the player. The password stays as entered unless you change it.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '10px' }}>
              <label>Team name / username<input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} autoComplete="off" style={{ display: 'block', width: '100%', marginTop: '6px' }} /></label>
              <label>Player phone number<input value={newTeamPhone} onChange={(e) => setNewTeamPhone(e.target.value)} placeholder="Phone number" autoComplete="tel" style={{ display: 'block', width: '100%', marginTop: '6px' }} /></label>
              <label>Permanent password<input type="password" value={newTeamPassword} onChange={(e) => setNewTeamPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" style={{ display: 'block', width: '100%', marginTop: '6px' }} /></label>
            </div>
            <button type="button" disabled={adminBusy || !newTeamName.trim() || !newTeamPhone.trim() || !newTeamPassword} onClick={() => void addTeam()} style={{ marginTop: '12px' }}>{adminBusy ? 'CREATING LOGIN…' : 'CREATE TEAM LOGIN'}</button>
          </div>

          <div>
            <h3>Edit / Restore / Remove Teams</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '10px' }}>
              <label>Team
                <select value={editTeamId} onChange={(e) => { setEditTeamId(e.target.value); setEditTeamName(teams.find((team) => team.id === e.target.value)?.team_name ?? ''); }} style={{ display: 'block', width: '100%', marginTop: '6px' }}>
                  <option value="">Choose team</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.team_name}</option>)}
                </select>
              </label>
              <label>New team name<input value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '6px' }} /></label>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button type="button" disabled={adminBusy || !editTeamId || !editTeamName.trim()} onClick={() => void saveTeamEdit()}>SAVE TEAM NAME</button>
              {teams.filter((team) => team.is_eliminated || team.status === 'eliminated').map((team) => (
                <button key={team.id} type="button" disabled={adminBusy} onClick={() => void restoreTeam(team)}>RESTORE {team.team_name}</button>
              ))}
              {editTeamId && (() => { const team = teams.find((item) => item.id === editTeamId); return team ? <button type="button" disabled={adminBusy} onClick={() => void removeTeam(team)}>REMOVE SELECTED TEAM</button> : null; })()}
            </div>
            <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Removal is blocked by the database if the team has any Round 1 or Round 2 history. Teams with history should be restored or renamed instead.</p>
          </div>
        </div>
      </section>

      <section className="host-section">
        <h2>Teams & Coin Balances</h2>

        <div className="host-teams-list">
          {teams.map((team) => (
            <article className="host-team-card" key={team.id}>
              <div>
                <strong>{team.team_name}</strong>
                <p>
                  {team.is_eliminated || team.status === 'eliminated'
                    ? 'Eliminated'
                    : 'Active'}
                </p>
              </div>
              <strong>{team.coin_balance} coins</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="host-section">
        <h2>Round 1 — Settled Bets</h2>

        {!settledBets.length && <p>No Round 1 bets settled yet.</p>}

        <div className="host-bets-list">
          {settledBets.map((bet) => {
            const team = teams.find((item) => item.id === bet.team_id);

            return (
              <article className="host-bet-card" key={bet.id}>
                <div className="host-bet-details">
                  <h3>{team?.team_name ?? 'Unknown Team'}</h3>
                  <p>
                    {bet.difficulty.toUpperCase()} · {bet.amount} COINS
                  </p>
                </div>
                <strong>{bet.result?.toUpperCase() ?? 'SETTLED'}</strong>
              </article>
            );
          })}
        </div>
      </section>

      {event.status === 'round2' && settledMatches.length > 0 && (
        <section className="host-section">
          <h2>Completed Round 2 Matches</h2>
          <p>{settledMatches.length} match(es) settled.</p>
        </section>
      )}
    </main>
  );
}
