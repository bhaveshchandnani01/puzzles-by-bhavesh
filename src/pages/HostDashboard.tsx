import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Event, Team } from '../types';
import Round3HostPanel from '../components/Round3HostPanel';

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
        error instanceof Error ? error.message : 'Could not load dashboard data.',
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
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `event_id=eq.${event.id}`,
      }, () => void loadDashboard())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_rounds',
        filter: `event_id=eq.${event.id}`,
      }, () => void loadDashboard())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_bets',
      }, () => void loadDashboard())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round2_matches',
        filter: `event_id=eq.${event.id}`,
      }, () => void loadDashboard())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round2_predictions',
        filter: `event_id=eq.${event.id}`,
      }, () => void loadDashboard())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'events',
        filter: `id=eq.${event.id}`,
      }, () => void loadDashboard())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [event?.id, loadDashboard]);

  const settleBet = async (bet: TeamBet, result: 'won' | 'lost') => {
    if (!event || settlingBetId || bet.is_settled) return;

    const team = teams.find((item) => item.id === bet.team_id);
    const teamName = team?.team_name ?? 'this team';

    if (!window.confirm(
      `Confirm ${teamName} as ${result.toUpperCase()}?\n\nDifficulty: ${bet.difficulty}\nBet: ${bet.amount} coins\n\nThis updates the result and coin balance.`,
    )) return;

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
        throw new Error('Unexpected settlement response. Refresh and check the database.');
      }

      setSuccessMessage(
        `${teamName} marked ${result.toUpperCase()}. New balance: ${newBalance} coins.`,
      );
      await loadDashboard();
    } catch (error) {
      console.error('Could not settle Round 1 bet:', error);
      setErrorMessage(
        `Settlement failed: ${error instanceof Error ? error.message : 'Unknown error.'}`,
      );
    } finally {
      setSettlingBetId(null);
    }
  };

  const startRound2 = async () => {
    if (!event || round2Loading) return;

    if (!window.confirm('Start Round 2? All Round 1 bets must be settled first.')) return;

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
      setErrorMessage(error instanceof Error ? error.message : 'Could not start Round 2.');
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

    const firstTeam = teams.find((team) => team.id === teamA);
    const secondTeam = teams.find((team) => team.id === teamB);

    if (
      !firstTeam ||
      !secondTeam ||
      firstTeam.is_eliminated ||
      secondTeam.is_eliminated ||
      firstTeam.status === 'eliminated' ||
      secondTeam.status === 'eliminated'
    ) {
      setErrorMessage('Choose two active teams for the matchup.');
      return;
    }

    setRound2Loading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.from('round2_matches').insert({
        event_id: event.id,
        team_a_id: teamA,
        team_b_id: teamB,
        status: 'pending',
      });

      if (error) throw error;

      setTeamA('');
      setTeamB('');
      setSuccessMessage('Match created. Let the rivalry begin.');
      await loadDashboard();
    } catch (error) {
      console.error('Could not create match:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not create match.');
    } finally {
      setRound2Loading(false);
    }
  };

  const settleMatch = async (match: Round2Match, winnerId: string) => {
    if (!event || processingMatchId || match.status === 'settled') return;

    const winner = teams.find((team) => team.id === winnerId);
    const loserId = winnerId === match.team_a_id ? match.team_b_id : match.team_a_id;
    const loser = teams.find((team) => team.id === loserId);

    if (!window.confirm(
      `Declare ${winner?.team_name ?? 'selected team'} the winner?\n${loser?.team_name ?? 'Other team'} will be eliminated.`,
    )) return;

    setProcessingMatchId(match.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('settle_round2_match', {
        p_match_id: match.id,
        p_winner_team_id: winnerId,
      });

      if (error) throw error;

      setSuccessMessage(`${winner?.team_name ?? 'Team'} wins the matchup!`);
      await loadDashboard();
    } catch (error) {
      console.error('Could not settle match:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not settle match.');
    } finally {
      setProcessingMatchId(null);
    }
  };

  const adjustCoins = async () => {
    if (!event || !adminTeamId || !adminCoinAmount || !adminReason.trim()) return;

    const amount = Number(adminCoinAmount);
    if (!Number.isInteger(amount) || amount < 0) {
      setErrorMessage('Enter a valid non-negative whole number of coins.');
      return;
    }

    if (!window.confirm(
      `Apply coin adjustment?\nOperation: ${adminCoinMode}\nAmount: ${amount}\nReason: ${adminReason}`,
    )) return;

    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('host_adjust_team_coins', {
        p_event_id: event.id,
        p_team_id: adminTeamId,
        p_mode: adminCoinMode,
        p_amount: amount,
        p_reason: adminReason.trim(),
      });

      if (error) throw error;

      setAdminCoinAmount('');
      setAdminReason('');
      setSuccessMessage('Coin balance updated.');
      await loadDashboard();
    } catch (error) {
      console.error('Could not adjust coins:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not adjust coins.');
    } finally {
      setAdminBusy(false);
    }
  };

  const addTeam = async () => {
    if (!event || !newTeamName.trim() || !newTeamPhone.trim() || !newTeamPassword) return;

    if (newTeamPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('host_create_team_login', {
        p_event_id: event.id,
        p_team_name: newTeamName.trim(),
        p_phone: newTeamPhone.trim(),
        p_password: newTeamPassword,
      });

      if (error) throw error;

      setNewTeamName('');
      setNewTeamPhone('');
      setNewTeamPassword('');
      setSuccessMessage('Team login created.');
      await loadDashboard();
    } catch (error) {
      console.error('Could not create team login:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not create team login.');
    } finally {
      setAdminBusy(false);
    }
  };

  const saveTeamEdit = async () => {
    if (!event || !editTeamId || !editTeamName.trim()) return;

    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('host_rename_team', {
        p_event_id: event.id,
        p_team_id: editTeamId,
        p_new_name: editTeamName.trim(),
      });

      if (error) throw error;

      setSuccessMessage('Team name updated.');
      await loadDashboard();
    } catch (error) {
      console.error('Could not rename team:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not rename team.');
    } finally {
      setAdminBusy(false);
    }
  };

  const restoreTeam = async (team: Team) => {
    if (!event) return;
    if (!window.confirm(`Restore ${team.team_name}?`)) return;

    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('host_restore_team', {
        p_event_id: event.id,
        p_team_id: team.id,
      });

      if (error) throw error;

      setSuccessMessage(`${team.team_name} restored.`);
      await loadDashboard();
    } catch (error) {
      console.error('Could not restore team:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not restore team.');
    } finally {
      setAdminBusy(false);
    }
  };

  const removeTeam = async (team: Team) => {
    if (!event) return;
    if (!window.confirm(
      `Remove ${team.team_name}?\n\nThis cannot be undone if the team has no game history.`,
    )) return;

    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('host_remove_team', {
        p_event_id: event.id,
        p_team_id: team.id,
      });

      if (error) throw error;

      setEditTeamId('');
      setEditTeamName('');
      setSuccessMessage(`${team.team_name} removed.`);
      await loadDashboard();
    } catch (error) {
      console.error('Could not remove team:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not remove team.');
    } finally {
      setAdminBusy(false);
    }
  };

  const undoMatch = async (match: Round2Match) => {
    if (!event) return;
    if (!window.confirm('Undo this settled match and restore the teams?')) return;

    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('host_undo_round2_match', {
        p_event_id: event.id,
        p_match_id: match.id,
      });

      if (error) throw error;

      setSuccessMessage('Match undone.');
      await loadDashboard();
    } catch (error) {
      console.error('Could not undo match:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not undo match.');
    } finally {
      setAdminBusy(false);
    }
  };

  const resetRound = async (roundNumber: 1 | 2) => {
    if (!event) return;
    if (!window.confirm(
      `Reset Round ${roundNumber}?\n\nThis is destructive. Continue only if you have checked the game state.`,
    )) return;

    setAdminBusy(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.rpc('host_reset_round', {
        p_event_id: event.id,
        p_round_number: roundNumber,
      });

      if (error) throw error;

      setSuccessMessage(`Round ${roundNumber} reset.`);
      await loadDashboard();
    } catch (error) {
      console.error('Could not reset round:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not reset round.');
    } finally {
      setAdminBusy(false);
    }
  };

  const getTeamName = (teamId: string) =>
    teams.find((team) => team.id === teamId)?.team_name ?? 'Unknown Team';

  const activeTeams = teams.filter(
    (team) => !team.is_eliminated && team.status !== 'eliminated',
  );

  const pendingBets = bets.filter((bet) => !bet.is_settled);
  const settledBets = bets.filter((bet) => bet.is_settled);
  const pendingMatches = matches.filter((match) => match.status === 'pending');
  const settledMatches = matches.filter((match) => match.status === 'settled');
  const pendingPredictions = predictions.filter((prediction) => prediction.status === 'pending');

  if (loading) {
    return (
      <main className="host-dashboard puzzles-page">
        <div className="host-section">
          <p>Consulting the council of questionable decisions…</p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="host-dashboard puzzles-page">
        <section className="host-section">
          <h1>COINSPIRACY</h1>
          <p>No event is linked to this host account yet.</p>
          {errorMessage && <p className="host-alert-error">{errorMessage}</p>}
          <button type="button" onClick={() => void loadDashboard}>REFRESH DASHBOARD</button>
        </section>
      </main>
    );
  }

  return (
    <main className="host-dashboard puzzles-page">
      <header className="host-dashboard-header host-header">
        <div>
          <p className="host-eyebrow">THE CONTROL ROOM</p>
          <h1>PUZZLES <span>2026</span></h1>
          <p>God mode. Use responsibly.</p>
        </div>
        <button type="button" onClick={() => void loadDashboard}>REFRESH CHAOS</button>
      </header>

      {errorMessage && (
        <div className="host-alert-error" role="alert">
          <strong>Well, that wasn’t part of the game plan.</strong>
          <p>{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="host-alert-success" role="status">
          <strong>Operation questionable decision: successful.</strong>
          <p>{successMessage}</p>
        </div>
      )}

      <section className="host-section">
        <h2>THE CURRENT SITUATION</h2>
        <div className="host-stats-grid">
          <article className="host-stat-card">
            <span>REGISTERED TEAMS</span>
            <strong>{teams.length}</strong>
          </article>
          <article className="host-stat-card">
            <span>ACTIVE TEAMS</span>
            <strong>{activeTeams.length}</strong>
          </article>
          <article className="host-stat-card">
            <span>ROUND 1 BETS TO SETTLE</span>
            <strong>{pendingBets.length}</strong>
          </article>
          <article className="host-stat-card">
            <span>ROUND 2 MATCHES LEFT</span>
            <strong>{pendingMatches.length}</strong>
          </article>
        </div>
        <div className="host-round-card">
          <p><strong>Join code:</strong> {event.join_code ?? 'Not available'}</p>
          <p><strong>Game status:</strong> {event.status}</p>
          <p><strong>Starting coins:</strong> 20</p>
        </div>
      </section>

      <section className="host-section">
        <h2>THE ROAD AHEAD</h2>
        <div className="host-round-grid">
          <article className="host-round-card">
            <span className="host-round-number">01</span>
            <h3>TRUST YOUR GUT</h3>
            <p>Easy, medium, or hard. Put those coins where your confidence is.</p>
            <strong>{event.status === 'round1' ? 'CURRENT ROUND' : 'ROUND 1'}</strong>
          </article>
          <article className="host-round-card">
            <span className="host-round-number">02</span>
            <h3>FRIENDSHIP ENDS HERE</h3>
            <p>Matchups, predictions, and questionable loyalty.</p>
            <strong>{event.status === 'round2' ? 'CURRENT ROUND' : 'ROUND 2'}</strong>
          </article>
          <article className="host-round-card">
            <span className="host-round-number">03</span>
            <h3>THE BLIND AUCTION</h3>
            <p>Four power-ups. One wallet. Absolutely no financial literacy.</p>
            <strong>{event.status === 'round3' ? 'CURRENT ROUND' : 'ROUND 3'}</strong>
          </article>
          <article className="host-round-card host-round4-card">
            <span className="host-round-number">04</span>
            <h3>THE FINAL BOSS</h3>
            <p>One last chance to justify all that confidence.</p>
            <p>Round 4 gameplay is still being built. This button is a preview only and will not change the live event status.</p>
            <button
              type="button"
              className="host-round4-button"
              disabled
              title="Round 4 gameplay is not implemented yet"
            >
              START ROUND 4 · COMING SOON
            </button>
          </article>
        </div>
      </section>

      {event.status === 'round1' && (
        <section className="host-section">
          <h2>ROUND 01 · SETTLE THE BETS</h2>
          <p>Mark each team’s bet as won or lost. Check the details before confirming.</p>
          {!pendingBets.length && <p>No pending bets. Either everyone is settled or nobody has bet yet.</p>}
          <div className="host-bets-list">
            {pendingBets.map((bet) => (
              <article className="host-bet-card" key={bet.id}>
                <div className="host-bet-details">
                  <h3>{getTeamName(bet.team_id)}</h3>
                  <p>{bet.difficulty.toUpperCase()} · {bet.amount} COINS</p>
                  <p>{bet.is_locked ? 'Bet locked' : 'Bet not locked'}</p>
                </div>
                <div className="host-bet-actions">
                  <button
                    type="button"
                    disabled={settlingBetId !== null}
                    onClick={() => void settleBet(bet, 'won')}
                  >
                    {settlingBetId === bet.id ? 'PROCESSING…' : 'MARK WON'}
                  </button>
                  <button
                    type="button"
                    disabled={settlingBetId !== null}
                    onClick={() => void settleBet(bet, 'lost')}
                  >
                    {settlingBetId === bet.id ? 'PROCESSING…' : 'MARK LOST'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <button
            type="button"
            className="host-start-button"
            disabled={round2Loading || pendingBets.length > 0}
            onClick={() => void startRound2()}
          >
            {round2Loading ? 'PROCESSING…' : 'START ROUND 2'}
          </button>
          {pendingBets.length > 0 && <p>Settle all Round 1 bets before starting Round 2.</p>}
        </section>
      )}

      {event.status === 'round2' && (
        <>
          <section className="host-section">
            <h2>ROUND 02 · CREATE A MATCHUP</h2>
            <p>Choose two active teams. Someone’s confidence is about to become a cautionary tale.</p>
            <div className="host-match-controls">
              <label>
                Team A
                <select value={teamA} onChange={(e) => setTeamA(e.target.value)}>
                  <option value="">Choose team</option>
                  {activeTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.team_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Team B
                <select value={teamB} onChange={(e) => setTeamB(e.target.value)}>
                  <option value="">Choose team</option>
                  {activeTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.team_name}</option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={round2Loading} onClick={() => void createMatch()}>
                {round2Loading ? 'CREATING…' : 'CREATE MATCH'}
              </button>
            </div>
          </section>

          <section className="host-section">
            <h2>ROUND 02 · MATCHES</h2>
            {!matches.length && <p>No matches yet. The drama is still loading.</p>}
            <div className="host-bets-list">
              {matches.map((match) => {
                const isProcessing = processingMatchId === match.id;
                return (
                  <article className="host-bet-card" key={match.id}>
                    <div className="host-bet-details">
                      <h3>{getTeamName(match.team_a_id)} VS {getTeamName(match.team_b_id)}</h3>
                      <p>Status: {match.status.toUpperCase()}</p>
                      {match.winner_team_id && <p>Winner: {getTeamName(match.winner_team_id)}</p>}
                    </div>
                    {match.status === 'pending' && (
                      <div className="host-bet-actions">
                        <button
                          type="button"
                          disabled={processingMatchId !== null}
                          onClick={() => void settleMatch(match, match.team_a_id)}
                        >
                          {isProcessing ? 'PROCESSING…' : `${getTeamName(match.team_a_id)} WINS`}
                        </button>
                        <button
                          type="button"
                          disabled={processingMatchId !== null}
                          onClick={() => void settleMatch(match, match.team_b_id)}
                        >
                          {isProcessing ? 'PROCESSING…' : `${getTeamName(match.team_b_id)} WINS`}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="host-section">
            <h2>ROUND 02 · PREDICTIONS & REGRETS</h2>
            <p>Correct prediction payout: original stake plus 5 bonus coins.</p>
            {!predictions.length && <p>No predictions yet. The crystal balls are apparently offline.</p>}
            <div className="host-bets-list">
              {predictions.map((prediction) => (
                <article className="host-bet-card" key={prediction.id}>
                  <div className="host-bet-details">
                    <h3>{getTeamName(prediction.bettor_team_id)}</h3>
                    <p>Predicted winner: {getTeamName(prediction.target_team_id)}</p>
                    <p>Stake: {prediction.amount} coins</p>
                    <p>Payout: {prediction.payout} coins</p>
                  </div>
                  <strong>{prediction.status === 'pending' ? 'PENDING' : prediction.status.toUpperCase()}</strong>
                </article>
              ))}
            </div>
            <p>{pendingPredictions.length} prediction(s) still pending.</p>
          </section>
        </>
      )}

      <Round3HostPanel
        eventId={event.id}
        eventStatus={event.status}
        onRefresh={loadDashboard}
      />

      <section className="host-section">
        <h2>EMERGENCY POWERS · HANDLE WITH DRAMA</h2>
        <p>These controls can change live game data. Double-check before confirming.</p>
        <div className="host-round-card" style={{ display: 'grid', gap: '18px' }}>
          <div>
            <h3>Undo / Reset Rounds</h3>
            <p>Undo a settled Round 2 match, or reset a round if your database supports it.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              {settledMatches.map((match) => (
                <button key={match.id} type="button" disabled={adminBusy} onClick={() => void undoMatch(match)}>
                  UNDO: {getTeamName(match.team_a_id)} VS {getTeamName(match.team_b_id)}
                </button>
              ))}
              <button type="button" disabled={adminBusy} onClick={() => void resetRound(1)}>RESET ROUND 1</button>
              <button type="button" disabled={adminBusy} onClick={() => void resetRound(2)}>RESET ROUND 2</button>
            </div>
          </div>

          <div>
            <h3>Manage Coins</h3>
            <div className="host-admin-grid">
              <label>
                Team
                <select value={adminTeamId} onChange={(e) => setAdminTeamId(e.target.value)}>
                  <option value="">Choose team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name} ({team.coin_balance})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operation
                <select value={adminCoinMode} onChange={(e) => setAdminCoinMode(e.target.value as 'set' | 'add' | 'subtract')}>
                  <option value="set">Set exact balance</option>
                  <option value="add">Add coins</option>
                  <option value="subtract">Subtract coins</option>
                </select>
              </label>
              <label>
                {adminCoinMode === 'set' ? 'New balance' : adminCoinMode === 'add' ? 'Coins to add' : 'Coins to subtract'}
                <input type="number" min="0" step="1" value={adminCoinAmount} onChange={(e) => setAdminCoinAmount(e.target.value)} />
              </label>
              <label>
                Reason (required)
                <input value={adminReason} onChange={(e) => setAdminReason(e.target.value)} placeholder="e.g. Correcting test balance" />
              </label>
            </div>
            <button
              type="button"
              disabled={adminBusy || !adminTeamId || !adminCoinAmount || !adminReason.trim()}
              onClick={() => void adjustCoins()}
            >
              {adminBusy ? 'PROCESSING…' : 'APPLY COIN CHANGE'}
            </button>
            <p>Coin subtraction should not make a team’s balance negative.</p>
          </div>

          <div>
            <h3>Add Team Login</h3>
            <p>Create a team account and share the credentials with that team.</p>
            <div className="host-admin-grid">
              <label>
                Team name / username
                <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} autoComplete="off" />
              </label>
              <label>
                Player phone number
                <input value={newTeamPhone} onChange={(e) => setNewTeamPhone(e.target.value)} placeholder="Phone number" autoComplete="tel" />
              </label>
              <label>
                Password
                <input type="password" value={newTeamPassword} onChange={(e) => setNewTeamPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
              </label>
            </div>
            <button
              type="button"
              disabled={adminBusy || !newTeamName.trim() || !newTeamPhone.trim() || !newTeamPassword}
              onClick={() => void addTeam()}
            >
              {adminBusy ? 'CREATING LOGIN…' : 'CREATE TEAM LOGIN'}
            </button>
          </div>

          <div>
            <h3>Edit / Restore / Remove Teams</h3>
            <div className="host-admin-grid">
              <label>
                Team
                <select
                  value={editTeamId}
                  onChange={(e) => {
                    setEditTeamId(e.target.value);
                    setEditTeamName(teams.find((team) => team.id === e.target.value)?.team_name ?? '');
                  }}
                >
                  <option value="">Choose team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.team_name}</option>
                  ))}
                </select>
              </label>
              <label>
                New team name
                <input value={editTeamName} onChange={(e) => setEditTeamName(e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button type="button" disabled={adminBusy || !editTeamId || !editTeamName.trim()} onClick={() => void saveTeamEdit()}>
                SAVE TEAM NAME
              </button>
              {teams.filter((team) => team.is_eliminated || team.status === 'eliminated').map((team) => (
                <button key={team.id} type="button" disabled={adminBusy} onClick={() => void restoreTeam(team)}>
                  RESTORE {team.team_name}
                </button>
              ))}
              {editTeamId && (() => {
                const team = teams.find((item) => item.id === editTeamId);
                return team ? (
                  <button type="button" disabled={adminBusy} onClick={() => void removeTeam(team)}>
                    REMOVE SELECTED TEAM
                  </button>
                ) : null;
              })()}
            </div>
            <p>Removing a team may be blocked if it has Round 1 or Round 2 history.</p>
          </div>
        </div>
      </section>

      <section className="host-section">
        <h2>TEAMS & COIN BALANCES</h2>
        <div className="host-teams-list">
          {teams.map((team) => (
            <article className="host-team-card" key={team.id}>
              <div>
                <strong>{team.team_name}</strong>
                <p>{team.is_eliminated || team.status === 'eliminated' ? 'Eliminated' : 'Active'}</p>
              </div>
              <strong>{team.coin_balance} coins</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="host-section">
        <h2>ROUND 1 · SETTLED BETS</h2>
        {!settledBets.length && <p>No Round 1 bets settled yet.</p>}
        <div className="host-bets-list">
          {settledBets.map((bet) => {
            const team = teams.find((item) => item.id === bet.team_id);
            return (
              <article className="host-bet-card" key={bet.id}>
                <div className="host-bet-details">
                  <h3>{team?.team_name ?? 'Unknown Team'}</h3>
                  <p>{bet.difficulty.toUpperCase()} · {bet.amount} COINS</p>
                </div>
                <strong>{bet.result?.toUpperCase() ?? 'SETTLED'}</strong>
              </article>
            );
          })}
        </div>
      </section>

      {event.status === 'round2' && settledMatches.length > 0 && (
        <section className="host-section">
          <h2>COMPLETED ROUND 2 MATCHES</h2>
          <p>{settledMatches.length} match(es) settled.</p>
        </section>
      )}
    </main>
  );
}