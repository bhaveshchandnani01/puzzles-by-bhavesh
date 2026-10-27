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
  winner_team_id?: string | null
  winning_bid?: number | null
}

type Bid = {
  card_id: string
  team_id: string
  team_name: string
  amount: number
  submitted_at: string
}

type Result = {
  card_number: number
  title: string
  effect: string
  rules: string | null
  winner_team_name: string | null
  winning_bid: number | null
}

const blank = () => ({ title: '', effect: '', rules: '', min_bid: '1' })

export default function Round3HostPanel({
  eventId,
  eventStatus,
  onRefresh,
}: {
  eventId: string
  eventStatus: string
  onRefresh: () => Promise<unknown>
}) {
  const [cards, setCards] = useState<Card[]>([])
  const [bids, setBids] = useState<Bid[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [drafts, setDrafts] = useState([blank(), blank(), blank(), blank()])
  const [tieChoices, setTieChoices] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')

    if (eventStatus !== 'round3') {
      setCards([])
      setBids([])
      setResults([])
      return
    }

    const { data, error: rpcError } = await supabase.rpc(
      'get_round3_cards',
      { p_event_id: eventId },
    )

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setCards((Array.isArray(data) ? data : []) as Card[])

    const allResolved =
      Array.isArray(data) &&
      data.length === 4 &&
      data.every((c: any) => c.status === 'resolved')

    if (allResolved) {
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
  }, [eventId, eventStatus])

  useEffect(() => {
    void load()
  }, [load])

  async function action(
    name: string,
    args: Record<string, unknown>,
    success: string,
  ) {
    if (busy) return

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const { data, error: rpcError } = await supabase.rpc(
        name as never,
        args as never,
      )

      if (rpcError) throw rpcError

      setMessage(success)
      await load()
      await onRefresh()

      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function createFourCards() {
    if (
      drafts.some(
        c =>
          !c.title.trim() ||
          !c.effect.trim() ||
          !Number.isSafeInteger(Number(c.min_bid)) ||
          Number(c.min_bid) < 1,
      )
    ) {
      setError(
        'Enter a title, effect, and positive whole-number minimum bid for all four cards.',
      )
      return
    }

    if (
      !window.confirm(
        'Create these four visible Round 3 cards? Card details will be visible to all teams before bidding.',
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      for (let i = 0; i < 4; i++) {
        const c = drafts[i]

        const { error: rpcError } = await supabase.rpc(
          'create_round3_card',
          {
            p_event_id: eventId,
            p_card_number: i + 1,
            p_title: c.title.trim(),
            p_effect: c.effect.trim(),
            p_rules: c.rules.trim() || null,
            p_min_bid: Number(c.min_bid),
          },
        )

        if (rpcError) throw rpcError
      }

      setMessage('Four cards created.')
      await load()
      await onRefresh()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not create cards. If only some were created, check the dashboard before retrying.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function revealBids() {
    const data = await action(
      'get_round3_bids_for_host',
      { p_event_id: eventId },
      'All bids loaded for host review.',
    )

    if (data) {
      setBids((Array.isArray(data) ? data : []) as Bid[])
    }
  }

  async function resolve() {
    const byCard = new Map<string, Bid[]>()

    for (const b of bids) {
      byCard.set(b.card_id, [
        ...(byCard.get(b.card_id) ?? []),
        b,
      ])
    }

    const missingTie = cards.some(card => {
      const list = byCard.get(card.id) ?? []
      const max = Math.max(0, ...list.map(b => b.amount))
      const top = list.filter(b => b.amount === max && max > 0)

      return top.length > 1 && !tieChoices[card.id]
    })

    if (missingTie) {
      setError('Choose a winner for every tied card first.')
      return
    }

    const tieMap: Record<string, string> = {}

    for (const [cardId, teamId] of Object.entries(tieChoices)) {
      if (teamId) tieMap[cardId] = teamId
    }

    if (
      !window.confirm(
        'Resolve all four cards and deduct only winning bids? Results will be revealed together.',
      )
    ) {
      return
    }

    await action(
      'resolve_round3_auction',
      {
        p_event_id: eventId,
        p_tie_winners: tieMap,
      },
      'Round 3 resolved. All results are now revealed.',
    )

    await revealResults()
  }

  async function revealResults() {
    const { data, error: rpcError } = await supabase.rpc(
      'get_round3_results',
      { p_event_id: eventId },
    )

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setResults(
      (Array.isArray(data) ? data : []) as Result[],
    )
  }

  const allFour = cards.length === 4
  const status = cards[0]?.status

  const bidsByCard = (id: string) =>
    bids.filter(b => b.card_id === id)

  const topBids = (card: Card) => {
    const list = bidsByCard(card.id)
    const max = Math.max(0, ...list.map(b => b.amount))

    return list.filter(b => b.amount === max && max > 0)
  }

  return (
    <section className="host-section">
      <h2>Round 3 — Blind Card Auction</h2>

      <p>
        Card details are public from the start. Bids remain hidden
        from teams until bidding closes. Winning results are
        revealed together.
      </p>

      {error && (
        <p role="alert" className="host-alert host-alert-error">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="host-alert host-alert-success">
          {message}
        </p>
      )}

      {eventStatus === 'round2' && (
        <div style={{ marginTop: 16 }}>
          <p>
            Move to Round 3 once all Round 2 matches are settled.
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  'Start Round 3? This advances the event and enables auction card setup.',
                )
              ) {
                void action(
                  'start_round3',
                  { p_event_id: eventId },
                  'Round 3 is now active.',
                )
              }
            }}
          >
            START ROUND 3
          </button>
        </div>
      )}

      {eventStatus === 'round3' &&
        !allFour &&
        status !== 'bidding_open' && (
          <div
            className="host-round-card"
            style={{ display: 'grid', gap: 12 }}
          >
            <h3>Create four cards</h3>

            {drafts.map((c, i) => (
              <fieldset
                key={i}
                style={{
                  display: 'grid',
                  gap: 8,
                  border: '1px solid #7775',
                  padding: 12,
                }}
              >
                <legend>Card {i + 1}</legend>

                <label>
                  Title
                  <input
                    value={c.title}
                    onChange={e =>
                      setDrafts(old =>
                        old.map((x, j) =>
                          j === i
                            ? { ...x, title: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  Effect
                  <textarea
                    value={c.effect}
                    onChange={e =>
                      setDrafts(old =>
                        old.map((x, j) =>
                          j === i
                            ? { ...x, effect: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  Rules (optional)
                  <textarea
                    value={c.rules}
                    onChange={e =>
                      setDrafts(old =>
                        old.map((x, j) =>
                          j === i
                            ? { ...x, rules: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  Minimum bid
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={c.min_bid}
                    onChange={e =>
                      setDrafts(old =>
                        old.map((x, j) =>
                          j === i
                            ? { ...x, min_bid: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
              </fieldset>
            ))}

            <button
              type="button"
              disabled={busy || allFour}
              onClick={() => void createFourCards()}
            >
              {busy ? 'WORKING…' : 'CREATE FOUR CARDS'}
            </button>
          </div>
        )}

      {allFour && (
        <div className="host-bets-list">
          {[...cards]
            .sort((a, b) => a.card_number - b.card_number)
            .map(card => (
              <article className="host-bet-card" key={card.id}>
                <div className="host-bet-details">
                  <h3>
                    Card {card.card_number}: {card.title}
                  </h3>

                  <p>{card.effect}</p>

                  {card.rules && <p>Rules: {card.rules}</p>}

                  <p>
                    Minimum bid: {card.min_bid} coins · Status:{' '}
                    {card.status}
                  </p>
                </div>

                {bids.length > 0 && (
                  <div style={{ width: '100%' }}>
                    <strong>Bids (host only)</strong>

                    {bidsByCard(card.id).map(b => (
                      <p key={`${b.card_id}-${b.team_id}`}>
                        {b.team_name}: {b.amount} coins
                      </p>
                    ))}

                    {topBids(card).length > 1 && (
                      <label>
                        Tie winner
                        <select
                          value={tieChoices[card.id] ?? ''}
                          onChange={e =>
                            setTieChoices(old => ({
                              ...old,
                              [card.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Choose tied team</option>

                          {topBids(card).map(b => (
                            <option
                              key={b.team_id}
                              value={b.team_id}
                            >
                              {b.team_name} ({b.amount})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </article>
            ))}
        </div>
      )}

      {eventStatus === 'round3' && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 16,
          }}
        >
          {allFour && status === 'upcoming' && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void action(
                  'open_round3_auction',
                  { p_event_id: eventId },
                  'Bidding is open for all four cards.',
                )
              }
            >
              OPEN BIDDING
            </button>
          )}

          {allFour && status === 'bidding_open' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Close bidding for all four cards? Teams will no longer be able to edit bids.',
                  )
                ) {
                  void action(
                    'close_round3_bidding',
                    { p_event_id: eventId },
                    'Bidding closed for all cards.',
                  )
                }
              }}
            >
              CLOSE BIDDING
            </button>
          )}

          {allFour && status === 'bidding_closed' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void revealBids()}
            >
              VIEW ALL BIDS
            </button>
          )}

          {allFour &&
            status === 'bidding_closed' &&
            bids.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void resolve()}
              >
                RESOLVE &amp; REVEAL ALL
              </button>
            )}

          {allFour && status === 'resolved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void revealResults()}
            >
              REFRESH RESULTS
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
          >
            REFRESH ROUND 3
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="host-bets-list" style={{ marginTop: 16 }}>
          <h3>Final results</h3>

          {results.map((r, i) => (
            <article
              className="host-bet-card"
              key={`${r.card_number}-${i}`}
            >
              <div className="host-bet-details">
                <h3>
                  Card {r.card_number}: {r.title}
                </h3>

                <p>{r.effect}</p>

                <strong>
                  {r.winner_team_name
                    ? `${r.winner_team_name} won for ${r.winning_bid} coins`
                    : 'No bids — no winner'}
                </strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}