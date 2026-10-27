import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Card = {
  id: string
  card_number: number
  title: string
  effect: string
  rules: string | null
  min_bid: number
  status: 'upcoming' | 'bidding_open' | 'bidding_closed' | 'resolved'
  own_bid: number | null
}

type Result = {
  card_number: number
  title: string
  effect: string
  rules: string | null
  winner_team_name: string | null
  winning_bid: number | null
}

export default function Round3TeamPanel({
  eventId,
  balance,
  eliminated,
  onRefresh,
}: {
  eventId: string
  balance: number
  eliminated: boolean
  onRefresh: () => Promise<unknown>
}) {
  const [eventStatus, setEventStatus] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Result[]>([])
  const [busyCard, setBusyCard] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('status')
      .eq('id', eventId)
      .maybeSingle()

    if (eventError) {
      setError(eventError.message)
      return
    }

    setEventStatus(event?.status ?? '')

    if (event?.status !== 'round3') {
      setCards([])
      setResults([])
      return
    }

    const { data, error: cardError } = await supabase.rpc(
      'get_round3_cards',
      { p_event_id: eventId },
    )

    if (cardError) {
      setError(cardError.message)
      return
    }

    const list = (Array.isArray(data) ? data : []) as Card[]
    setCards(list)

    setAmounts(old => {
      const next = { ...old }

      for (const card of list) {
        if (next[card.id] === undefined) {
          next[card.id] =
            card.own_bid == null ? '' : String(card.own_bid)
        }
      }

      return next
    })

    if (
      list.length === 4 &&
      list.every(card => card.status === 'resolved')
    ) {
      const { data: resultData, error: resultError } =
        await supabase.rpc('get_round3_results', {
          p_event_id: eventId,
        })

      if (resultError) {
        setError(resultError.message)
      } else {
        setResults(
          (Array.isArray(resultData) ? resultData : []) as Result[],
        )
      }
    } else {
      setResults([])
    }

    setError('')
  }, [eventId])

  useEffect(() => {
  void load()

  const interval = window.setInterval(() => {
    void load()
  }, 3000)

  return () => window.clearInterval(interval)
}, [load])

  async function submit(card: Card) {
    if (busyCard || eliminated || card.status !== 'bidding_open') {
      return
    }

    const amount = Number(amounts[card.id])

    if (!Number.isSafeInteger(amount) || amount < card.min_bid) {
      setError(
        `Card ${card.card_number}: enter a whole-number bid of at least ${card.min_bid}.`,
      )
      return
    }

    const currentTotal = cards.reduce(
      (sum, c) =>
        sum + (c.id === card.id ? 0 : (c.own_bid ?? 0)),
      0,
    )

    if (currentTotal + amount > balance) {
      setError(
        `Your combined bids cannot exceed your current ${balance}-coin balance.`,
      )
      return
    }

    setBusyCard(card.id)
    setError('')
    setMessage('')

    try {
      const { error: rpcError } = await supabase.rpc(
        'submit_round3_bid',
        {
          p_event_id: eventId,
          p_card_id: card.id,
          p_amount: amount,
        },
      )

      if (rpcError) throw rpcError

      setMessage(
        `Your bid for Card ${card.card_number} is saved. You can edit it while bidding remains open.`,
      )

      await load()
      await onRefresh()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not submit bid.',
      )
    } finally {
      setBusyCard(null)
    }
  }

  if (eventStatus !== 'round3') return null

  return (
    <section className="waiting-betting">
      <p className="waiting-label">ROUND 03</p>

      <h2>The Blind Card Auction</h2>

      <p className="waiting-description">
        All four cards and their effects are visible now. Your bids
        are private. You can bid on multiple cards and edit each bid
        until the host closes bidding. Only winning bids are deducted.
      </p>

      <p className="waiting-subtext">
        Available balance: {balance} coins · Combined bids are
        limited to your balance.
      </p>

      {error && (
        <p className="waiting-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="waiting-bet-message" role="status">
          {message}
        </p>
      )}

      <div className="waiting-difficulty-list">
        {[...cards]
          .sort((a, b) => a.card_number - b.card_number)
          .map(card => (
            <article
              className="waiting-difficulty"
              key={card.id}
            >
              <span className="waiting-difficulty-top">
                <span>
                  Card {card.card_number}: {card.title}
                </span>
                <strong>Min {card.min_bid}</strong>
              </span>

              <p className="waiting-difficulty-challenge">
                {card.effect}
              </p>

              {card.rules && (
                <p className="waiting-subtext">
                  Rules: {card.rules}
                </p>
              )}

              <p className="waiting-subtext">
                Status: {card.status.replace('_', ' ').toUpperCase()}
              </p>

              {card.status === 'bidding_open' && !eliminated && (
                <div className="waiting-bet-input">
                  <label htmlFor={`round3-bid-${card.id}`}>
                    Your bid (coins)
                  </label>

                  <input
                    id={`round3-bid-${card.id}`}
                    type="number"
                    min={card.min_bid}
                    max={balance}
                    step={1}
                    value={amounts[card.id] ?? ''}
                    onChange={e =>
                      setAmounts(old => ({
                        ...old,
                        [card.id]: e.target.value,
                      }))
                    }
                    placeholder={`Minimum ${card.min_bid}`}
                    disabled={busyCard !== null}
                  />

                  <button
                    type="button"
                    className="waiting-submit-bet"
                    disabled={
                      busyCard !== null || !amounts[card.id]
                    }
                    onClick={() => void submit(card)}
                  >
                    {busyCard === card.id
                      ? 'SAVING…'
                      : card.own_bid == null
                        ? 'SUBMIT BID'
                        : 'UPDATE BID'}
                  </button>

                  {card.own_bid != null && (
                    <p className="waiting-subtext">
                      Your current bid: {card.own_bid} coins.
                      Competitors cannot see it.
                    </p>
                  )}
                </div>
              )}

              {card.status === 'bidding_open' && eliminated && (
                <p>Eliminated teams cannot bid.</p>
              )}

              {card.status !== 'bidding_open' &&
                card.own_bid != null && (
                  <p className="waiting-subtext">
                    Your submitted bid: {card.own_bid} coins
                  </p>
                )}
            </article>
          ))}
      </div>

      {cards.length === 0 && (
        <p className="waiting-message">
          The host has not created the four auction cards yet.
        </p>
      )}

      {cards.length > 0 &&
        cards.every(card => card.status === 'resolved') &&
        results.length > 0 && (
          <div className="waiting-bet-confirmation">
            <p className="waiting-label">
              AUCTION RESULTS REVEALED
            </p>

            {results.map((r, i) => (
              <p key={`${r.card_number}-${i}`}>
                <strong>
                  Card {r.card_number}: {r.title}
                </strong>{' '}
                —{' '}
                {r.winner_team_name
                  ? `${r.winner_team_name} won for ${r.winning_bid} coins`
                  : 'No bids; no winner'}
                .
              </p>
            ))}
          </div>
        )}

      <button type="button" onClick={() => void load()}>
        REFRESH AUCTION
      </button>
    </section>
  )
}