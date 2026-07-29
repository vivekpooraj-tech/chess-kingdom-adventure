import { Lesson } from "@/lib/types";

export const LESSONS: Lesson[] = [
  {
    dayNumber: 1,
    crystal: "pawn",
    title: "The Sleepy Pawn Village",
    storyBeat:
      "The Pawn Village has fallen asleep! Only you can wake the little Pawn Guards by showing them how to march forward and guard the Kingdom.",
    skillTags: ["pawn_movement", "pawn_capture"],
    minigameId: "pawn-race",
    puzzle: {
      fen: "4k3/8/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
      prompt: "Guard the Path — move any Pawn Guard forward!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
      prompt: "Make 3 good pawn moves to win this mini match.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Village Wakes" },
      { id: "s2", type: "minigame", title: "Pawn Race" },
      { id: "s3", type: "puzzle", title: "Guard the Path" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "First Pawn Duel" },
      { id: "s6", type: "reward", title: "Pawn Crystal Recovered!" },
    ],
  },
  {
    dayNumber: 2,
    crystal: "knight",
    title: "The Whispering Knight Forest",
    storyBeat:
      "Deep in the forest, the Knights have forgotten their famous zig-zag jump! Help them remember their special L-shaped leap to clear the tangled woods.",
    skillTags: ["knight_movement"],
    minigameId: "knight-memory",
    puzzle: {
      fen: "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1",
      prompt: "Find the Knight's Jump — move the Knight anywhere it can leap!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/1N2K1N1 w - - 0 1",
      prompt: "Make 3 good Knight or Pawn moves to clear the forest path.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Forest Awakens" },
      { id: "s2", type: "minigame", title: "Knight's Memory Match" },
      { id: "s3", type: "puzzle", title: "Find the Knight's Jump" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Forest Path Duel" },
      { id: "s6", type: "reward", title: "Knight Crystal Recovered!" },
    ],
  },
  {
    dayNumber: 3,
    crystal: "bishop",
    title: "The Bishop's Hall of Light",
    storyBeat:
      "The Hall of Light has gone dim! The Bishops need your quick eyes to catch the light beams zig-zagging along the diagonals before they fade.",
    skillTags: ["bishop_movement"],
    minigameId: "bishop-diagonal-catch",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/2B1K3 w - - 0 1",
      prompt: "Light the Diagonal — move the Bishop along its slanted path!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/2B1KB2 w - - 0 1",
      prompt: "Make 3 good Bishop or Pawn moves to relight the Hall.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Hall Grows Dim" },
      { id: "s2", type: "minigame", title: "Diagonal Catch" },
      { id: "s3", type: "puzzle", title: "Light the Diagonal" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Hall of Light Duel" },
      { id: "s6", type: "reward", title: "Bishop Crystal Recovered!" },
    ],
  },
  {
    dayNumber: 4,
    crystal: "rook",
    title: "The Rook's Iron Corridor",
    storyBeat:
      "The great Iron Corridor has rusted shut! The Rooks need to charge straight down the halls — up, down, left, or right — to break it open.",
    skillTags: ["rook_movement"],
    minigameId: "rook-charge",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
      prompt: "Charge the Corridor — move the Rook in a straight line!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1",
      prompt: "Make 3 good Rook or Pawn moves to clear the corridor.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Corridor Rusts Shut" },
      { id: "s2", type: "minigame", title: "Rook's Charge" },
      { id: "s3", type: "puzzle", title: "Charge the Corridor" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Iron Corridor Duel" },
      { id: "s6", type: "reward", title: "Rook Crystal Recovered!" },
    ],
  },
  {
    dayNumber: 5,
    crystal: "queen",
    title: "The Queen's Grand Court",
    storyBeat:
      "The Grand Court has lost its music! The Queen moves like no other piece — any direction, any distance — help her sweep through the court and bring back the melody.",
    skillTags: ["queen_movement"],
    minigameId: "queen-memory",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/3QK3 w - - 0 1",
      prompt: "Sweep the Court — move the Queen any direction you like!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/3QK3 w - - 0 1",
      prompt: "Make 3 good Queen or Pawn moves to restore the court.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Music Fades" },
      { id: "s2", type: "minigame", title: "Queen's Memory Vault" },
      { id: "s3", type: "puzzle", title: "Sweep the Court" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Grand Court Duel" },
      { id: "s6", type: "reward", title: "Queen Crystal Recovered!" },
    ],
  },
  {
    dayNumber: 6,
    crystal: "king",
    title: "The King's Careful Throne Room",
    storyBeat:
      "The Shadow King's magic looms nearby! Your King must take small, careful steps — just one square at a time — and always stay safely guarded.",
    skillTags: ["king_movement", "king_safety"],
    minigameId: "king-castle-race",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      prompt: "Take a careful step — move your King just one square!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/5RK1 w - - 0 1",
      prompt: "Make 3 good King or Pawn moves to keep your King safe.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Shadow Draws Near" },
      { id: "s2", type: "minigame", title: "King's Careful Walk" },
      { id: "s3", type: "puzzle", title: "Take a Careful Step" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Throne Room Duel" },
      { id: "s6", type: "reward", title: "King Crystal Recovered!" },
    ],
  },
];

export function getLesson(dayNumber: number): Lesson | undefined {
  return LESSONS.find((l) => l.dayNumber === dayNumber);
}
