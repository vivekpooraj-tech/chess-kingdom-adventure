import type { WorldId } from "@/lib/world/worlds";

/**
 * The Play LANDING page (the screen before a game starts), one source for all three worlds.
 *
 * Routes and what each destination does never change with the world: only the words around them do.
 * The presentation components (EnchantedPlay / AtelierPlay / ClassicPlay) read this table, so every
 * destination exists in every world and a route cannot drift between them. Game mechanics live behind
 * these routes (free-play, matchmaking, tournaments, the world map) and are shared by all worlds.
 */

export type PlayDestinationId = "computer" | "online" | "tournament" | "world";

export const PLAY_ROUTES = {
  computer: "/free-play",
  online: "/matchmaking",
  tournament: "/play/tournaments",
  world: "/world",
  tactics: "/puzzles/tactics",
  puzzles: "/puzzles",
} as const;

export interface PlayDestinationCopy {
  title: string;
  description: string;
}

export interface PlayWorldCopy {
  kicker: string;
  title: string;
  lede: string;
  destinations: Record<PlayDestinationId, PlayDestinationCopy>;
  invite: PlayDestinationCopy;
  today: string;
  tactics: { label: string; title: string };
  morePuzzles: string;
}

// What each destination does (shared, factual). Worlds add voice to the TITLE, never change the meaning.
const DESCRIPTION: Record<PlayDestinationId | "invite", string> = {
  computer: "A full game against an opponent your size.",
  online: "A fair match against another player, worldwide.",
  tournament: "Join a Swiss-style tournament — multiple rounds, real standings.",
  world: "Play in extraordinary places. Same rules, remarkable view.",
  invite: "Send them a link to a game just for you two.",
};

export const PLAY_COPY: Record<WorldId, PlayWorldCopy> = {
  enchanted: {
    kicker: "Enchanted Kingdom",
    title: "Choose Your Quest",
    lede: "Pick your opponent. The board does the rest.",
    destinations: {
      computer: { title: "Quest Match", description: DESCRIPTION.computer },
      online: { title: "Multiplayer Quest", description: DESCRIPTION.online },
      tournament: { title: "Kingdom Tournament", description: DESCRIPTION.tournament },
      world: { title: "World Adventure", description: DESCRIPTION.world },
    },
    invite: { title: "Invite a Friend", description: DESCRIPTION.invite },
    today: "Today's quest",
    tactics: { label: "Tactics Trainer", title: "Forks, pins, skewers and more" },
    morePuzzles: "Practice more puzzles",
  },
  atelier: {
    kicker: "Master Training Atelier",
    title: "Match Training",
    lede: "Pick your opponent. The board does the rest.",
    destinations: {
      computer: { title: "Sparring Session", description: DESCRIPTION.computer },
      online: { title: "Rated Sparring", description: DESCRIPTION.online },
      tournament: { title: "Competition", description: DESCRIPTION.tournament },
      world: { title: "World Match", description: DESCRIPTION.world },
    },
    invite: { title: "Invite a Friend", description: DESCRIPTION.invite },
    today: "Today",
    tactics: { label: "Tactics Trainer", title: "Forks, pins, skewers and more" },
    morePuzzles: "Practice more puzzles",
  },
  classic: {
    kicker: "Classic Pro",
    title: "Play",
    lede: "Pick your opponent. The board does the rest.",
    destinations: {
      computer: { title: "Computer Match", description: DESCRIPTION.computer },
      online: { title: "Online Match", description: DESCRIPTION.online },
      tournament: { title: "Tournament", description: DESCRIPTION.tournament },
      world: { title: "Chess Mind World", description: DESCRIPTION.world },
    },
    invite: { title: "Invite a Friend", description: DESCRIPTION.invite },
    today: "Today",
    tactics: { label: "Tactics Trainer", title: "Forks, pins, skewers and more" },
    morePuzzles: "Practice more puzzles",
  },
};

/** The order destinations appear in, in every world. */
export const PLAY_DESTINATION_ORDER: readonly PlayDestinationId[] = ["computer", "online", "tournament", "world"];
