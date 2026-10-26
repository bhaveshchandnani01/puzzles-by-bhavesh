
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Team } from '../types'

type GameRound = {
  id: string
  round_number: number
  status: string
  easy_min_bet: number
  easy_max_bet: number
  medium_min_bet: number
  medium_max_bet: number
  hard_min_bet: number
  hard_max_bet: number
  easy_multiplier: number
  medium_multiplier: number
  hard_multiplier: number
  easy_challenge: string | null
  medium_challenge: string | null
  hard_challenge: string | null
}

type Round2Match = {
  id: string
  event_id: string
  team_a_id: string
  team_b_id: string
  status: 'pending' | 'settled'
  winner_team_id: string | null
}

type Round2Prediction = {
  id: string
  event_id: string
  bettor_team_id: string
  target_team_id: string
  amount: number
  status: 'pending' | 'won' | 'lost'
  payout: number
}

type TeamBet = {
  id: string
  round_id: string
  team_id: string
  difficulty: string
  amount: number
  result: string | null
  is_settled: boolean
}

const difficulties = [
  { key: 'easy', label: 'Easy', multiplier: 2 },
  { key: 'medium', label: 'Medium', multiplier: 3 },
  { key: 'hard', label: 'Hard', multiplier: 4 },
] as const

type Difficulty = (typeof difficulties)[number]['key']

export function WaitingRoom() {
  const { team } = useAuth()

  const [teams, setTeams] = useState<Team[]>([])
  const [round, setRound] = useState<GameRound | null>(null)
  const [bet, setBet] = useState<TeamBet | null>(null)
  const [round2Matches, setRound2Matches] = useState<Round2Match[]>([])
  const [round2Predictions, setRound2Predictions] = useState<Round2Prediction[]>([])
  const [predictionTarget, setPredictionTarget] = useState('')
  const [predictionAmount, setPredictionAmount] = useState('')
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionMessage, setPredictionMessage] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [amount, setAmount] = useState('')

  const [loading, setLoading] = useState(true)
  const [betLoading, setBetLoading] = useState(false)
  const [error, setError] = useState('')
  const [betMessage, setBetMessage] = useState('')

  const loadData = useCallback(async () => {
    if (!team?.event_id) {
      setLoading(false)
      return
    }

    const [teamsResult, roundsResult, matchesResult, predictionsResult] = await Promise.all([
      supabase
        .from('teams')
        .select(
          'id, event_id, team_name, coin_balance, status, is_eliminated, registered_at, updated_at',
        )
        .eq('event_id', team.event_id)
        .order('registered_at', { ascending: true }),

      supabase
        .from('game_rounds')
        .select(
          'id, round_number, status, easy_min_bet, easy_max_bet, medium_min_bet, medium_max_bet, hard_min_bet, hard_max_bet, easy_multiplier, medium_multiplier, hard_multiplier, easy_challenge, medium_challenge, hard_challenge',
        )
        .eq('event_id', team.event_id)
        .eq('round_number', 1)
        .maybeSingle(),

      supabase
        .from('round2_matches')
        .select('id, event_id, team_a_id, team_b_id, status, winner_team_id')
        .eq('event_id', team.event_id)
        .order('created_at', { ascending: true }),

      supabase
        .from('round2_predictions')
        .select('id, event_id, bettor_team_id, target_team_id, amount, status, payout')
        .eq('event_id', team.event_id)
        .eq('bettor_team_id', team.id)
        .order('created_at', { ascending: true }),
    ])

    if (teamsResult.error) {
      setError(teamsResult.error.message)
      setLoading(false)
      return
    }

    setTeams((teamsResult.data ?? []) as Team[])
    setError('')

    if (matchesResult.error) {
      setError(matchesResult.error.message)
      setLoading(false)
      return
    }
    setRound2Matches((matchesResult.data ?? []) as Round2Match[])

    if (predictionsResult.error) {
      setError(predictionsResult.error.message)
      setLoading(false)
      return
    }
    setRound2Predictions((predictionsResult.data ?? []) as Round2Prediction[])

    if (roundsResult.error) {
      setError(roundsResult.error.message)
      setLoading(false)
      return
    }

    const currentRound = roundsResult.data as GameRound | null
    setRound(currentRound)

    if (currentRound) {
      const betResult = await supabase
        .from('team_bets')
        .select('id, round_id, team_id, difficulty, amount, result, is_settled')
        .eq('round_id', currentRound.id)
        .eq('team_id', team.id)
        .maybeSingle()

      if (betResult.error) {
        setError(betResult.error.message)
      } else {
        setBet(betResult.data as TeamBet | null)
      }
    } else {
      setBet(null)
    }

    setLoading(false)
  }, [team?.event_id, team?.id])

  useEffect(() => {
    if (!team?.event_id) {
      setLoading(false)
      return
    }

    let active = true

    const refresh = async () => {
      if (!active) return
      await loadData()
    }

    void refresh()

    const channel = supabase
      .channel(`waiting-room-${team.event_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `event_id=eq.${team.event_id}`,
        },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rounds',
          filter: `event_id=eq.${team.event_id}`,
        },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_bets',
        },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round2_matches',
          filter: `event_id=eq.${team.event_id}`,
        },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round2_predictions',
          filter: `event_id=eq.${team.event_id}`,
        },
        () => void refresh(),
      )
      .subscribe()

    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [team?.event_id, loadData])

  if (!team) {
    return (
      <main className="puzzles-page">
        <div className="waiting-shell">
          <p>Your team is loading. Please refresh in a moment.</p>
        </div>
      </main>
    )
  }

  const ownTeam = teams.find((item) => item.id === team.id) ?? team
  const currentBalance = ownTeam.coin_balance ?? 0

  const selectedDifficulty = difficulties.find(
    (item) => item.key === difficulty,
  )!

  const minBet = round
    ? round[`${difficulty}_min_bet` as keyof GameRound] as number
    : 1

  const maxBet = round
    ? Number(round[`${difficulty}_max_bet` as keyof GameRound] ?? 0)
    : currentBalance


  const multiplier = round
    ? round[`${difficulty}_multiplier` as keyof GameRound] as number
    : selectedDifficulty.multiplier

  const bettingOpen =
    round?.round_number === 1 && round.status === 'betting_open'

  const canBet =
    bettingOpen &&
    !bet &&
    !ownTeam.is_eliminated &&
    ownTeam.status !== 'eliminated'

  async function submitBet() {
    if (!round || !canBet) return

    const parsedAmount = Number(amount)

    if (
      !Number.isInteger(parsedAmount) ||
      parsedAmount < minBet ||
      parsedAmount > maxBet
    ) {
      setBetMessage(`Enter a whole number between ${minBet} and ${maxBet}.`)
      return
    }

    if (parsedAmount > currentBalance) {
      setBetMessage('Your team does not have enough coins.')
      return
    }

    const confirmed = window.confirm(
      `Bet ${parsedAmount} coins on ${difficulty.toUpperCase()}? Your stake will be deducted immediately.`,
    )

    if (!confirmed) return

    setBetLoading(true)
    setBetMessage('')

    const { error: submitError } = await supabase.rpc(
      'submit_round1_bet',
      {
        p_round_id: round.id,
        p_difficulty: difficulty,
        p_amount: parsedAmount,
      },
    )

    if (submitError) {
      setBetMessage(submitError.message)
    } else {
      setBetMessage('Bet locked! Wait for the host to announce your result.')
      setAmount('')
      await loadData()
    }

    setBetLoading(false)
  }

  const activeRound2Matches = round2Matches.filter((match) => match.status === 'pending')
  const myPredictionForTarget = (targetTeamId: string) =>
    round2Predictions.find((prediction) => prediction.target_team_id === targetTeamId)

  async function submitRound2Prediction() {
    if (!team?.event_id || !predictionTarget || predictionLoading) return

    const amountToStake = Number(predictionAmount)
    if (!Number.isSafeInteger(amountToStake) || amountToStake <= 0) {
      setPredictionMessage('Enter a whole number of coins greater than zero.')
      return
    }
    if (amountToStake > currentBalance) {
      setPredictionMessage('Your team does not have enough coins.')
      return
    }
    if (ownTeam.is_eliminated || ownTeam.status === 'eliminated') {
      setPredictionMessage('Eliminated teams cannot place predictions.')
      return
    }
    if (myPredictionForTarget(predictionTarget)) {
      setPredictionMessage('Your team has already predicted this team.')
      return
    }

    const target = teams.find((item) => item.id === predictionTarget)
    const confirmed = window.confirm(
      `Stake ${amountToStake} coins on ${target?.team_name ?? 'this team'} to win? Correct predictions pay the stake plus 5 bonus coins.`,
    )
    if (!confirmed) return

    setPredictionLoading(true)
    setPredictionMessage('')
    const { error: predictionError } = await supabase.rpc('place_round2_prediction', {
      p_event_id: team.event_id,
      p_target_team_id: predictionTarget,
      p_amount: amountToStake,
    })

    if (predictionError) {
      setPredictionMessage(predictionError.message)
    } else {
      setPredictionMessage('Prediction locked! Your stake has been deducted.')
      setPredictionAmount('')
      setPredictionTarget('')
      await loadData()
    }
    setPredictionLoading(false)
  }

  return (
    <main className="puzzles-page waiting-page">
      <div className="waiting-shell">
        <header className="waiting-header">
          <div className="waiting-mark">♛</div>
          <p className="waiting-eyebrow">PUZZLES 2026 · TEAM LOBBY</p>
          <h1>
            You're in,
            <br />
            <span>{team.team_name}.</span>
          </h1>
          <p className="waiting-description">
            Your team is in the arena. Get ready to think, compete, and outplay.
          </p>
          <div className="waiting-status">
            <span className="waiting-status-dot" />
            {bettingOpen ? 'ROUND 1 · BETTING OPEN' : 'WAITING FOR HOST'}
          </div>
        </header>

        <section className="waiting-balance">
          <div>
            <p className="waiting-label">YOUR CURRENT BALANCE</p>
            <p className="waiting-coins">
              <span aria-hidden="true">◈</span> {currentBalance}
              <span className="waiting-coin-word">coins</span>
            </p>
            <p className="waiting-subtext">
              Your coins update as bets are placed and settled.
            </p>
          </div>
          <div className="waiting-coin-icon" aria-hidden="true">
            ◈
          </div>
        </section>

        <section className="waiting-betting">
          <p className="waiting-label">ROUND 01</p>
          <h2>Place your bet</h2>
          <p className="waiting-description">
            Choose one challenge and stake your coins. Once submitted, your bet
            is locked for this round.
          </p>

          {loading && (
            <p className="waiting-message">Loading round details…</p>
          )}

          {!loading && !round && (
            <p className="waiting-message">
              The host hasn't configured Round 1 yet.
            </p>
          )}

          {!loading && round && (
            <>
              <div className="waiting-difficulty-list">
                {difficulties.map((item) => {
                  const isSelected = difficulty === item.key
                  const itemChallenge =
                    round[`${item.key}_challenge` as keyof GameRound]

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`waiting-difficulty ${
                        isSelected ? 'is-selected' : ''
                      }`}
                      onClick={() => {
                        if (!canBet) return
                        setDifficulty(item.key)
                        setBetMessage('')
                      }}
                      disabled={!canBet || betLoading}
                    >
                      <span className="waiting-difficulty-top">
                        <span>{item.label}</span>
                        <strong>×{round[`${item.key}_multiplier` as keyof GameRound] as number}</strong>
                      </span>
                      <span className="waiting-difficulty-limits">
                        {round[`${item.key}_min_bet` as keyof GameRound] as number}
                        {'–'}
                        {round[`${item.key}_max_bet` as keyof GameRound] as number}
                        {' coins'}
                      </span>
                      <span className="waiting-difficulty-challenge">
                        {typeof itemChallenge === 'string' && itemChallenge
                          ? itemChallenge
                          : 'Challenge details coming soon'}
                      </span>
                    </button>
                  )
                })}
              </div>

              {bet ? (
                <div className="waiting-bet-confirmation">
                  <p className="waiting-label">YOUR BET IS LOCKED</p>
                  <h3>
                    {bet.difficulty.toUpperCase()} · {bet.amount} coins
                  </h3>
                  <p>
                    {bet.is_settled
                      ? bet.result === 'won'
                        ? 'You won! Your payout has been added to your balance.'
                        : 'This bet was lost. Your stake has been deducted.'
                      : 'Waiting for the host to mark your result.'}
                  </p>
                  {bet.is_settled && (
                    <p>Result: {bet.result?.toUpperCase()}</p>
                  )}
                </div>
              ) : bettingOpen ? (
                <>
                  <div className="waiting-bet-input">
                    <label htmlFor="bet-amount">Your bet amount</label>
                    <input
                      id="bet-amount"
                      type="number"
                      min={minBet}
                      max={Math.min(Number(maxBet), currentBalance)}
                      step={1}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder={`${minBet}–${Math.min(Number(maxBet), currentBalance)} coins`}
                      disabled={!canBet || betLoading}
                    />
                    <p>
                      Allowed: {minBet}–{maxBet} coins · Current balance:{' '}
                      {currentBalance}
                    </p>
                  </div>

                  <div className="waiting-payout">
                    <span>Potential total payout</span>
                    <strong>
                      {Number.isInteger(Number(amount)) && Number(amount) > 0
                        ? Number(amount) * multiplier
                        : 0}{' '}
                      coins
                    </strong>
                    <span>If you win · ×{multiplier}</span>
                  </div>

                  <button
                    type="button"
                    className="waiting-submit-bet"
                    onClick={() => void submitBet()}
                    disabled={!canBet || betLoading}
                  >
                    {betLoading ? 'LOCKING BET…' : 'LOCK IN BET'}
                  </button>
                </>
              ) : (
                <p className="waiting-message">
                  Betting is closed. Wait for the host to open the round.
                </p>
              )}

              {betMessage && (
                <p className="waiting-bet-message" role="status">
                  {betMessage}
                </p>
              )}

              {error && (
                <p className="waiting-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </section>

        <section className="waiting-betting">
          <p className="waiting-label">ROUND 02</p>
          <h2>Back a team to win</h2>
          <p className="waiting-description">
            Choose a team in a pending matchup and stake coins on them. A correct prediction returns your stake plus 5 bonus coins.
          </p>

          {activeRound2Matches.length === 0 ? (
            <p className="waiting-message">No Round 2 matchups are open for predictions yet. The host needs to create a matchup first.</p>
          ) : (
            <>
              <div className="waiting-difficulty-list">
                {activeRound2Matches.map((match) => {
                  const teamAItem = teams.find((item) => item.id === match.team_a_id)
                  const teamBItem = teams.find((item) => item.id === match.team_b_id)
                  const targetA = myPredictionForTarget(match.team_a_id)
                  const targetB = myPredictionForTarget(match.team_b_id)
                  return (
                    <article key={match.id} className="waiting-difficulty">
                      <span className="waiting-difficulty-top">
                        <span>{teamAItem?.team_name ?? 'Team A'} vs {teamBItem?.team_name ?? 'Team B'}</span>
                      </span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                        <button type="button" className={predictionTarget === match.team_a_id ? 'waiting-submit-bet' : ''} disabled={Boolean(targetA) || predictionLoading || ownTeam.is_eliminated || ownTeam.status === 'eliminated'} onClick={() => { setPredictionTarget(match.team_a_id); setPredictionMessage('') }}>
                          {targetA ? `Backed ${teamAItem?.team_name ?? 'Team A'}` : `Back ${teamAItem?.team_name ?? 'Team A'}`}
                        </button>
                        <button type="button" className={predictionTarget === match.team_b_id ? 'waiting-submit-bet' : ''} disabled={Boolean(targetB) || predictionLoading || ownTeam.is_eliminated || ownTeam.status === 'eliminated'} onClick={() => { setPredictionTarget(match.team_b_id); setPredictionMessage('') }}>
                          {targetB ? `Backed ${teamBItem?.team_name ?? 'Team B'}` : `Back ${teamBItem?.team_name ?? 'Team B'}`}
                        </button>
                      </div>
                      {(targetA || targetB) && (
                        <p className="waiting-difficulty-challenge">Your prediction: {teams.find((item) => item.id === (targetA ?? targetB)?.target_team_id)?.team_name} · {((targetA ?? targetB)?.amount ?? 0)} coins · {(targetA ?? targetB)?.status?.toUpperCase()}</p>
                      )}
                    </article>
                  )
                })}
              </div>

              {predictionTarget && (
                <div className="waiting-bet-input">
                  <label htmlFor="round2-prediction-amount">Coins to stake</label>
                  <input id="round2-prediction-amount" type="number" min={1} max={currentBalance} step={1} value={predictionAmount} onChange={(event) => setPredictionAmount(event.target.value)} placeholder={`1–${currentBalance} coins`} disabled={predictionLoading} />
                  <p>Current balance: {currentBalance} coins · Correct prediction: stake + 5 bonus coins.</p>
                  <button type="button" className="waiting-submit-bet" onClick={() => void submitRound2Prediction()} disabled={predictionLoading || !predictionAmount || currentBalance <= 0}>
                    {predictionLoading ? 'LOCKING PREDICTION…' : 'LOCK IN PREDICTION'}
                  </button>
                </div>
              )}
            </>
          )}

          {round2Predictions.length > 0 && (
            <div className="waiting-bet-confirmation" style={{ marginTop: '16px' }}>
              <p className="waiting-label">YOUR ROUND 2 PREDICTIONS</p>
              {round2Predictions.map((prediction) => (
                <p key={prediction.id}>
                  {teams.find((item) => item.id === prediction.target_team_id)?.team_name ?? 'Team'} · {prediction.amount} coins · {prediction.status.toUpperCase()}{prediction.status === 'won' ? ` · Payout ${prediction.payout} coins` : ''}
                </p>
              ))}
            </div>
          )}
          {predictionMessage && <p className="waiting-bet-message" role="status">{predictionMessage}</p>}
        </section>

        <section className="waiting-teams">
          <div className="waiting-section-heading">
            <div>
              <p className="waiting-label">THE COMPETITION</p>
              <h2>Teams in the room</h2>
            </div>
            <span className="waiting-team-count">
              {teams.length} {teams.length === 1 ? 'TEAM' : 'TEAMS'}
            </span>
          </div>

          {loading && (
            <p className="waiting-message">Finding your fellow competitors…</p>
          )}

          {error && (
            <p className="waiting-error" role="alert">
              Couldn't load teams: {error}
            </p>
          )}

          {!loading && !error && (
            <div className="waiting-team-list">
              {teams.map((item, index) => {
                const isCurrentTeam = item.id === team.id
                const isEliminated =
                  item.is_eliminated || item.status === 'eliminated'

                return (
                  <div
                    key={item.id}
                    className={`waiting-team-row ${
                      isCurrentTeam ? 'waiting-team-current' : ''
                    }`}
                  >
                    <div className="waiting-team-number">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <div className="waiting-team-info">
                      <p className="waiting-team-name">{item.team_name}</p>
                      <p className="waiting-team-caption">
                        {isCurrentTeam
                          ? 'YOUR TEAM'
                          : isEliminated
                            ? 'ELIMINATED'
                            : 'COMPETITOR'}
                      </p>
                    </div>

                    <span
                      className={`waiting-team-status ${
                        isEliminated ? 'is-eliminated' : ''
                      }`}
                    >
                      {isEliminated ? 'OUT' : 'READY'}
                    </span>
                  </div>
                )
              })}

              {teams.length === 0 && (
                <p className="waiting-message">
                  The room is quiet. Other teams will appear here when they join.
                </p>
              )}
            </div>
          )}
        </section>

        <footer className="waiting-footer">
          <span>STAY SHARP.</span>
          <span>THE GAME STARTS WHEN THE HOST SAYS SO.</span>
        </footer>
      </div>
    </main>
  )
}
