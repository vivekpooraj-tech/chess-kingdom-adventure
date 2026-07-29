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
];

export function getLesson(dayNumber: number): Lesson | undefined {
  return LESSONS.find((l) => l.dayNumber === dayNumber);
}