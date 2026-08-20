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

/**
 * Draw offers ride the same host_reaction/guest_reaction Realtime channel
 * as quick-chat/emoji (see sendReaction in lib/supabase/queries.ts) instead
 * of a new column — a suffixed timestamp keeps every offer's value unique
 * so a second offer after a declined one is recognized as new (see
 * OnlineGamePage's dismissedDrawOfferRef). Available in every match type,
 * unlike quick chat/emoji, which are hidden for stranger opponents.
 */
export const DRAW_OFFER_PREFIX = "__draw_offer__:";
