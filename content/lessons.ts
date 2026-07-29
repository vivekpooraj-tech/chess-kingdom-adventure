import { Lesson } from "@/lib/types";

export const LESSONS: Lesson[] = [
  {
    dayNumber: 1,
    crystal: "pawn",
    title: "The Sleepy Pawn Village",
    storyBeat:
      "The Pawn Village has fallen asleep! Only you can wake the little Pawn Guards by showing them how to march forward and guard the Kingdom.",
    skillTags: ["pawn_movement", "pawn_capture"],
    steps: [
      { id: "s1", type: "story", title: "The Village Wakes" },
      { id: "s2", type: "minigame", title: "Pawn Race" },
      { id: "s3", type: "puzzle", title: "Guard the Path" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "First Pawn Duel" },
      { id: "s6", type: "reward", title: "Pawn Crystal Recovered!" },
    ],
  },
];

export function getLesson(dayNumber: number): Lesson | undefined {
  return LESSONS.find((l) => l.dayNumber === dayNumber);
}
