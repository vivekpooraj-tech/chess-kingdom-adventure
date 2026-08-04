/**
 * Preset-only social interaction for online multiplayer — no freeform text
 * input anywhere. This is a deliberate child-safety choice, not a missing
 * feature: an invite-link-based match has no identity verification on who
 * actually joins, so open text chat between children here would be a real
 * risk. Every message a player can send is one of these fixed, pre-approved
 * phrases or emoji.
 */
export const QUICK_CHAT_PHRASES: string[] = [
  "Good luck! 🍀",
  "Good move! 👍",
  "Nice game! 🎉",
  "Hmm, thinking... 🤔",
  "Oops! 😅",
  "Wow! 😮",
  "Well played! 🤝",
  "Rematch? 🔄",
];

export const EMOJI_REACTIONS: string[] = ["😊", "😲", "🎉", "😅", "👍", "🤔"];
