import { BuddyOption } from "@/lib/types";

// Only "Wise Owl" is fully built for the 4-day v1 slice — the other five are
// shown as "coming soon" so the picker UI is ready for them without the
// personas/voice work being on the critical path.
export const BUDDIES: BuddyOption[] = [
  {
    id: "wise-owl",
    name: "Ollie the Owl",
    piece: null,
    emoji: "🦉",
    personality:
      "Warm, patient, a little bit silly. Loves puns about chess pieces. Never says 'wrong' — always 'let's see what happens if...'",
    greeting: "Hoo-hoo! I'm Ollie. Ready to explore the Chess Kingdom together?",
    encouragement: [
      "Ooo, nice thinking!",
      "You're getting sharper every day!",
      "That's exactly how a real chess player thinks!",
      "Let's try that again — you're SO close.",
    ],
    builtIn: true,
  },
  { id: "dragon", name: "Ember the Dragon", piece: null, emoji: "🐉", personality: "", greeting: "", encouragement: [], builtIn: false },
  { id: "panda", name: "Mochi the Panda", piece: null, emoji: "🐼", personality: "", greeting: "", encouragement: [], builtIn: false },
  { id: "robot", name: "Byte the Robot", piece: null, emoji: "🤖", personality: "", greeting: "", encouragement: [], builtIn: false },
  { id: "fox", name: "Sly the Fox", piece: null, emoji: "🦊", personality: "", greeting: "", encouragement: [], builtIn: false },
  { id: "unicorn", name: "Star the Unicorn", piece: null, emoji: "🦄", personality: "", greeting: "", encouragement: [], builtIn: false },
];
