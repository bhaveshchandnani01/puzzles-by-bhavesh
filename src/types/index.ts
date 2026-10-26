export type EventStatus =
  | 'waiting'
  | 'registration_open'
  | 'registration_closed'
  | 'round1'
  | 'round2'
  | 'round3'
  | 'ended'

export type RoundStatus =
  | 'pending'
  | 'betting_open'
  | 'betting_closed'
  | 'in_progress'
  | 'settling'
  | 'completed'

export type TeamStatus = 'active' | 'eliminated' | 'winner'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Event {
  id: string
  name: string
  host_user_id: string | null
  status: EventStatus
  starting_coins: number
  round2_survival_bonus: number
  join_code: string
  registration_open: boolean
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  event_id: string
  user_id: string | null
  team_name: string
  phone_number: string
  coin_balance: number
  is_eliminated: boolean
  status: TeamStatus
  registered_at: string
  updated_at: string
}

export interface GameRound {
  id: string
  event_id: string
  round_number: 1 | 2 | 3
  status: RoundStatus
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
  created_at: string
  updated_at: string
}

export interface TeamBet {
  id: string
  round_id: string
  team_id: string
  difficulty: Difficulty
  amount: number
  is_locked: boolean
  result: 'win' | 'loss' | null
  is_settled: boolean
  settled_at: string | null
  created_at: string
}

export interface Match {
  id: string
  round_id: string
  team_a_id: string
  team_b_id: string | null
  winner_team_id: string | null
  status: 'pending' | 'in_progress' | 'completed'
  is_bye: boolean
  created_at: string
}

export interface MatchPrediction {
  id: string
  round_id: string
  team_id: string
  supported_team_id: string
  amount: 2 | 4 | 6 | 8
  is_locked: boolean
  is_settled: boolean
  settled_at: string | null
  created_at: string
}

export interface AuctionCard {
  id: string
  event_id: string
  card_number: number
  title: string        // hidden until is_revealed
  effect: string       // hidden until is_revealed
  rules: string | null // hidden until is_revealed
  min_bid: number
  status: 'upcoming' | 'bidding_open' | 'bidding_closed' | 'resolved'
  winner_team_id: string | null
  winning_bid: number | null
  is_revealed: boolean
  created_at: string
}

export interface AuctionBid {
  id: string
  card_id: string
  team_id: string
  amount: number
  submitted_at: string
  is_valid: boolean
  is_winner: boolean
}

export interface CoinTransaction {
  id: string
  team_id: string
  event_id: string
  amount: number
  balance_after: number
  reason: string
  reference_id: string | null
  reference_type: string | null
  actor_user_id: string | null
  idempotency_key: string
  created_at: string
}