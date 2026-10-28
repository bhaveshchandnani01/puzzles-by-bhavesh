export const gameCopy = {
  brand: {
    name: 'PUZZLES 2026',
    tagline: 'Brains optional. Confidence mandatory.',
    loading: [
      'Consulting the council of questionable decisions...',
      'Calculating absolutely unnecessary risks...',
      'Convincing the servers this is a good idea...',
      'The plot is loading. Please panic responsibly.',
    ],
  },

  auth: {
    title: 'WELCOME TO THE CIRCUS.',
    subtitle: 'Your questionable decisions start here.',
    teamName: 'Name your team. Embarrass them later.',
    phone: 'Your phone number. We promise no spam from the opposition.',
    joinCode: 'Got a secret code? Act mysterious and enter it.',
    submit: 'LET ME IN',
    footer: 'No experience required. Delusion preferred.',
  },

  waitingRoom: {
    title: 'THE CALM BEFORE THE CHAOS.',
    subtitle: 'You are in. Your strategy remains unverified.',
    waiting: 'The host is cooking. Results may vary.',
    ready: 'Looking confident. That is concerning.',
    waitingForPlayers: 'Waiting for your rivals to make a mistake.',
    startHint: 'Stretch your brain. Or whatever is available.',
  },

  coins: {
    title: 'YOUR FINANCIAL SITUATION',
    balance: 'Your wallet. Your downfall.',
    starting: 'Twenty coins. Infinite bad decisions.',
    lowBalance: 'Your financial advisor has left the chat.',
    broke: 'Broke in a game. Iconic.',
  },

  round1: {
    title: 'ROUND 01: TRUST YOUR GUT.',
    subtitle: 'Your gut has never faced consequences. Until now.',
    easy: 'Easy mode. Famous last words.',
    medium: 'Medium. Where confidence goes to get humbled.',
    hard: 'Hard mode. We respect the delusion.',
    bet: 'PUT YOUR COINS WHERE YOUR CONFIDENCE IS',
    correct: 'OKAY, EINSTEIN. WE SEE YOU.',
    incorrect: 'Bold answer. The question disagrees.',
  },

  round2: {
    title: 'ROUND 02: FRIENDSHIP ENDS HERE.',
    subtitle: 'It is not personal. Actually, it is a little personal.',
    prediction: 'Trust your gut. Your gut has no accountability.',
    matchup: 'Two teams enter. Someone gets humbled.',
    eliminated: 'A beautiful run. An unfortunate plot twist.',
    survivor: 'Still standing. Suspiciously competent.',
  },

  round3: {
    title: 'THE BLIND CARD AUCTION',
    subtitle: 'Trust nobody. Especially your own math.',
    description: 'Four power-ups. One wallet. Absolutely no financial literacy.',
    empty: 'No cards yet. The host is still plotting.',
    bidHint: 'Bid in silence. Regret in public.',
    bidSaved: 'Bid locked in. Your future self is nervous.',
    bidUpdated: 'Bid updated. Character development.',
    biddingOpen: 'THE AUCTION IS LIVE. ACT NATURALLY.',
    biddingClosed: 'PENS DOWN. REGRETS MAY CONTINUE.',
    results: 'THE BIDS ARE IN. THE FRIENDSHIPS ARE OUT.',
    won: 'Congratulations. Your wallet is in mourning.',
    lost: 'You kept your coins. And lost the opportunity.',
    noBids: 'Nobody bid. The cards are taking this personally.',
  },

  finalRound: {
    title: 'THE FINAL BOSS.',
    subtitle: 'One last chance to justify all that confidence.',
    ready: 'No more warm-ups. No more excuses.',
    victory: 'BRAINS, BLUFFS, AND BEAUTIFUL NONSENSE.',
    defeat: 'Second place is just first place in an alternate universe.',
  },

  host: {
    title: 'GOD MODE. USE RESPONSIBLY.',
    subtitle: 'You control the chaos. Allegedly.',
    start: 'UNLEASH THE CHAOS',
    openBidding: 'LET THE BAD DECISIONS BEGIN',
    closeBidding: 'CUT OFF THE FINANCIAL DAMAGE',
    reveal: 'REVEAL THE DAMAGE',
    refresh: 'CHECK THE CHAOS',
    confirm: 'Are you sure? There is no undo button for drama.',
  },

  feedback: {
    genericError: 'Well, that was not part of the game plan.',
    networkError: 'The internet has chosen violence.',
    loading: 'Hold on. The plot is loading.',
    success: 'Operation questionable decision: successful.',
    retry: 'One more time. For the plot.',
  },
} as const;

export type GameCopy = typeof gameCopy;