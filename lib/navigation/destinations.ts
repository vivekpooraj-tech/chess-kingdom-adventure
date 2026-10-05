/**
 * The product's named destinations, in ONE place: the canonical URL and the visible name of each
 * screen a user can be sent back to. Back buttons build their label from here, so the label and the
 * href can never disagree ("Back to Play" always goes to /play) and no legacy name (Kingdom Map,
 * Chess Kingdom Adventure) can creep back into navigation copy.
 *
 * Back buttons name their IMMEDIATE parent (Lesson -> Chess School, Online game -> Play,
 * Pattern Recognition -> Train Your Mind), never a generic "Back" and never "Home" by default.
 */
export type DestinationKey =
  | "HOME"
  | "PLAY"
  | "PUZZLES"
  | "LEARN"
  | "ACADEMY"
  | "CHESS_SCHOOL"
  | "TRAIN_YOUR_MIND"
  | "PROFILE"
  | "MORE";

export const DESTINATIONS: Record<DestinationKey, { href: string; label: string }> = {
  HOME: { href: "/home", label: "Home" },
  PLAY: { href: "/play", label: "Play" },
  PUZZLES: { href: "/puzzles", label: "Puzzles" },
  LEARN: { href: "/learn", label: "Learn" },
  ACADEMY: { href: "/academy", label: "Academy" },
  // /chess-school redirects to its classroom, which is the Chess School's main screen.
  CHESS_SCHOOL: { href: "/chess-school", label: "Chess School" },
  TRAIN_YOUR_MIND: { href: "/chess-mind", label: "Train Your Mind" },
  PROFILE: { href: "/profile", label: "Profile" },
  MORE: { href: "/more", label: "More" },
};

export const destinationHref = (key: DestinationKey): string => DESTINATIONS[key].href;

/** "Back to <name>" for a named destination. */
export const backLabel = (key: DestinationKey): string => `Back to ${DESTINATIONS[key].label}`;

/** Where a course's index sits in the hierarchy: Tactical Thinking is a Train Your Mind path, the rest live in Learn. */
export const courseParent = (courseId: string | undefined): DestinationKey =>
  courseId === "tactical-thinking" ? "TRAIN_YOUR_MIND" : "LEARN";
