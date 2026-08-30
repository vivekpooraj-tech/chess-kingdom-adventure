export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TimelineEntry {
  era: string;
  period: string;
  text: string;
}

export interface VideoLesson {
  id: string;
  title: string;
  subtitle: string;
  /**
   * The hero video. Produced externally and hosted in Supabase Storage
   * (public `academy-media` bucket). Kept as a real, typed field rather
   * than hardcoded into the UI so swapping the asset is a one-line content
   * change, not a code change. The page renders an honest "coming soon"
   * state when this is null, not a broken player.
   *
   * This source is portrait (9:16) — the player frame follows suit.
   */
  videoUrl: string | null;
  captionsUrl: string | null;
  /** Poster frame shown before playback; null falls back to a plain frame. */
  posterUrl: string | null;
  /** "portrait" (9:16) or "landscape" (16:9) — drives the player's aspect box. */
  orientation: "portrait" | "landscape";
  timeline: TimelineEntry[];
  quiz: QuizQuestion[];
}

export const HISTORY_OF_CHESS: VideoLesson = {
  id: "history-of-chess",
  title: "The History of Chess",
  subtitle: "From ancient India to the game on your board today.",
  videoUrl:
    "https://fyanjpjuttjzpikhfztk.supabase.co/storage/v1/object/public/academy-media/history-of-chess/hero.mp4",
  captionsUrl: null,
  posterUrl:
    "https://fyanjpjuttjzpikhfztk.supabase.co/storage/v1/object/public/academy-media/history-of-chess/hero-poster.jpg",
  orientation: "portrait",
  timeline: [
    {
      era: "Ancient India",
      period: "around the 6th century",
      text: "Chess's earliest known ancestor, chaturanga, appeared in India. Its four kinds of pieces stood for the four divisions of an ancient army: infantry, cavalry, elephants, and chariots — the great-great-grandparents of the pawn, knight, bishop, and rook.",
    },
    {
      era: "Persia",
      period: "soon after",
      text: "Chaturanga traveled to Persia and became shatranj. This is where two words every chess player still uses were born: \"shah\" (Persian for king) gives us \"check,\" and \"shah mat\" — \"the king is helpless\" — gives us \"checkmate.\"",
    },
    {
      era: "The Arab World",
      period: "7th–9th century",
      text: "After the Islamic conquest of Persia, shatranj spread across the Arab world. Scholars there took the game seriously — writing down openings, studying famous positions, and producing some of the earliest chess literature in history.",
    },
    {
      era: "Europe",
      period: "9th–15th century",
      text: "Trade routes and the Moorish presence in Spain carried chess into Europe, where it spread through the Middle Ages and slowly picked up local variations in rules and piece names along the way.",
    },
    {
      era: "Modern Chess",
      period: "late 1400s, Spain & Italy",
      text: "The biggest single change in chess history happened here: the Queen and Bishop — once slow, short-range pieces — were given the sweeping, long-range moves they have today. The game suddenly got much faster and sharper, and this \"new chess\" is essentially the game played all over the world now.",
    },
  ],
  quiz: [
    {
      id: "q1",
      question: "Where did the earliest ancestor of chess come from?",
      options: ["Egypt", "India", "China", "Rome"],
      correctIndex: 1,
    },
    {
      id: "q2",
      question: "What was that early ancestor called?",
      options: ["Shatranj", "Chaturanga", "Xiangqi", "Senet"],
      correctIndex: 1,
    },
    {
      id: "q3",
      question: "The word \"check\" comes from the Persian word for...",
      options: ["Queen", "Battle", "King", "Victory"],
      correctIndex: 2,
    },
    {
      id: "q4",
      question: "What does \"checkmate\" originally mean?",
      options: [
        "\"The game is over\"",
        "\"The king is helpless\"",
        "\"Well played\"",
        "\"Capture the king\"",
      ],
      correctIndex: 1,
    },
    {
      id: "q5",
      question: "Which two pieces got dramatically more powerful in the late 1400s, creating modern chess?",
      options: ["Rook & Knight", "Pawn & King", "Queen & Bishop", "Knight & Bishop"],
      correctIndex: 2,
    },
  ],
};
