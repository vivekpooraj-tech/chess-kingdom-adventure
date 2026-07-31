import { Lesson } from "@/lib/types";

/**
 * Days 1 through this number are free; anything beyond requires
 * parents.premium_status === 'premium'. Matches the "$29.99 one-time
 * purchase, unlock everything forever" model from the PRD.
 */
export const FREE_DAY_LIMIT = 3;

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
  {
    dayNumber: 7,
    crystal: "knight",
    title: "The Knight's Fork Academy",
    storyBeat:
      "All six Crystals are found — but the Shadow King is stirring! The Knights want to teach you their sneakiest trick: forking two enemies at once.",
    skillTags: ["knight_movement", "fork_pattern"],
    minigameId: "knight-fork-execute",
    puzzle: {
      fen: "4k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
      prompt: "Find the fork — move the Knight to threaten two squares at once!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/2N5/8/PPPPPPPP/4K1N1 w - - 0 1",
      prompt: "Make 3 good Knight or Pawn moves to practice your forks.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Knights' Secret Trick" },
      { id: "s2", type: "minigame", title: "Fork the Targets" },
      { id: "s3", type: "puzzle", title: "Find the Fork" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Fork Academy Duel" },
      { id: "s6", type: "reward", title: "Fork Badge Earned!" },
    ],
  },
  {
    dayNumber: 8,
    crystal: "bishop",
    title: "The Bishop's Pin Trial",
    storyBeat:
      "Deep in the archives, the Bishops guard a clever secret: pinning an enemy piece so it can't dare to move! Learn to spot the pin.",
    skillTags: ["bishop_movement", "pin_pattern"],
    minigameId: "bishop-pin-spot",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/5BK1 w - - 0 1",
      prompt: "Move the Bishop along its diagonal to line up a pin!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/5BK1 w - - 0 1",
      prompt: "Make 3 good Bishop or Pawn moves to practice pinning.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Archive's Secret" },
      { id: "s2", type: "minigame", title: "Bishop's Pin Memory" },
      { id: "s3", type: "puzzle", title: "Line Up the Pin" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Pin Trial Duel" },
      { id: "s6", type: "reward", title: "Pin Badge Earned!" },
    ],
  },
  {
    dayNumber: 9,
    crystal: "rook",
    title: "The Rook's Back-Rank Watch",
    storyBeat:
      "The Shadow King loves to sneak along the back rank! The Rooks are the Kingdom's best watchtowers — help them guard the last row.",
    skillTags: ["rook_movement", "back_rank_mate"],
    minigameId: "rook-back-rank",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/4KR2 w - - 0 1",
      prompt: "Move the Rook to guard the back rank!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4KR2 w - - 0 1",
      prompt: "Make 3 good Rook or Pawn moves to hold the watch.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "Shadows on the Back Rank" },
      { id: "s2", type: "minigame", title: "Back-Rank Watch" },
      { id: "s3", type: "puzzle", title: "Guard the Back Rank" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Watchtower Duel" },
      { id: "s6", type: "reward", title: "Watch Badge Earned!" },
    ],
  },
  {
    dayNumber: 10,
    crystal: "queen",
    title: "The Queen's Checkmate Finale",
    storyBeat:
      "This is it — the Shadow King is nearly defeated! Bring the Queen and King together for one final, glorious checkmate to end the shadow's reign.",
    skillTags: ["queen_movement", "queen_king_mate"],
    minigameId: "queen-mate-pattern",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/3QK3 w - - 0 1",
      prompt: "Move the Queen to close in for checkmate!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/3QK3 w - - 0 1",
      prompt: "Make 3 good Queen or Pawn moves for your final trial.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Final Stand" },
      { id: "s2", type: "minigame", title: "Deliver Checkmate" },
      { id: "s3", type: "puzzle", title: "Close In for Mate" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Final Duel" },
      { id: "s6", type: "reward", title: "Champion of the Kingdom!" },
    ],
  },
  {
    dayNumber: 11,
    crystal: "pawn",
    title: "The Opening Gambit Garden",
    storyBeat:
      "Welcome to the Intermediate Kingdom! In this new garden, the wisest Pawns teach the first rule of every great game: control the center of the board early.",
    skillTags: ["pawn_movement", "opening_principles"],
    minigameId: "pawn-double-step",
    puzzle: {
      fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
      prompt: "Push your Pawn forward to claim the center!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
      prompt: "Make 3 good opening moves to control the center.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "Welcome to the Intermediate Kingdom" },
      { id: "s2", type: "minigame", title: "Claim the Center" },
      { id: "s3", type: "puzzle", title: "Push for the Center" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Opening Garden Duel" },
      { id: "s6", type: "reward", title: "Opening Badge Earned!" },
    ],
  },
  {
    dayNumber: 12,
    crystal: "knight",
    title: "The Knight's Secret Outpost",
    storyBeat:
      "Deep in the woods, the wisest old Knight guards a secret: a strong square deep in enemy territory where no Pawn can ever chase you away.",
    skillTags: ["knight_movement", "knight_outpost"],
    minigameId: "knight-outpost",
    puzzle: {
      fen: "4k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
      prompt: "Move the Knight to find its strongest outpost!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/5N2/PPPPPPPP/4K1N1 w - - 0 1",
      prompt: "Make 3 good Knight or Pawn moves to reach the outpost.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Old Knight's Secret" },
      { id: "s2", type: "minigame", title: "Find the Outpost" },
      { id: "s3", type: "puzzle", title: "Settle the Outpost" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Outpost Duel" },
      { id: "s6", type: "reward", title: "Outpost Badge Earned!" },
    ],
  },
  {
    dayNumber: 13,
    crystal: "bishop",
    title: "The Twin Bishops' Gallery",
    storyBeat:
      "In the Gallery of Light, two Bishops stand together — one for the light squares, one for the dark. Together, they see the whole board at once!",
    skillTags: ["bishop_movement", "bishop_pair"],
    minigameId: "bishop-pair",
    puzzle: {
      fen: "4k3/8/8/1B4B1/8/8/8/4K3 w - - 0 1",
      prompt: "Move either Bishop to show off the pair's power!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/1B4B1/8/8/PPPPPPPP/4K3 w - - 0 1",
      prompt: "Make 3 good Bishop or Pawn moves with your twin Bishops.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Gallery of Light" },
      { id: "s2", type: "minigame", title: "Twin Bishops' Reflexes" },
      { id: "s3", type: "puzzle", title: "Show the Pair's Power" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Gallery Duel" },
      { id: "s6", type: "reward", title: "Bishop Pair Badge Earned!" },
    ],
  },
  {
    dayNumber: 14,
    crystal: "rook",
    title: "The Open File Expressway",
    storyBeat:
      "A brand-new road has opened through the Kingdom — a file with no Pawns blocking the way! The Rooks love nothing more than a wide-open road.",
    skillTags: ["rook_movement", "open_file"],
    minigameId: "rook-open-file",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/4KR2 w - - 0 1",
      prompt: "Slide the Rook down the open road!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/3RK3 w - - 0 1",
      prompt: "Make 3 good Rook or Pawn moves down the open file.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Road Opens" },
      { id: "s2", type: "minigame", title: "Race the Open File" },
      { id: "s3", type: "puzzle", title: "Take the Open Road" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Expressway Duel" },
      { id: "s6", type: "reward", title: "Open File Badge Earned!" },
    ],
  },
  {
    dayNumber: 15,
    crystal: "king",
    title: "The Promotion Road's End",
    storyBeat:
      "One brave little Pawn has marched the whole way across the Kingdom! With your King's help nearby, it's about to become something amazing.",
    skillTags: ["promotion", "basic_endgames"],
    minigameId: "mixed-endgame-maze",
    puzzle: {
      fen: "4k3/8/4P3/8/8/8/8/4K3 w - - 0 1",
      prompt: "March the Pawn closer to promotion!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
      prompt: "Make 3 good King or Pawn moves to escort your Pawn home.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "One Pawn's Long Journey" },
      { id: "s2", type: "minigame", title: "Remember the Promotion Path" },
      { id: "s3", type: "puzzle", title: "March Toward Promotion" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Promotion Road Duel" },
      { id: "s6", type: "reward", title: "Promotion Badge Earned!" },
    ],
  },
  {
    dayNumber: 16,
    crystal: "pawn",
    title: "The Passed Pawn's Sprint",
    storyBeat:
      "This lone Pawn has no enemy Pawns left to stop it! When a Pawn breaks free like this, the Kingdom calls it a 'passed pawn' — and it's a race to the finish!",
    skillTags: ["pawn_movement", "pawn_structure"],
    minigameId: "pawn-race",
    puzzle: {
      fen: "4k3/8/P7/8/8/8/8/4K3 w - - 0 1",
      prompt: "Sprint the passed Pawn down the open lane!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1",
      prompt: "Make 3 good Pawn or King moves in the sprint.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Pawn Breaks Free" },
      { id: "s2", type: "minigame", title: "Sprint the Pawn" },
      { id: "s3", type: "puzzle", title: "Race to the Finish" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Sprint Duel" },
      { id: "s6", type: "reward", title: "Passed Pawn Badge Earned!" },
    ],
  },
  {
    dayNumber: 17,
    crystal: "knight",
    title: "The Knight's Hidden Ambush",
    storyBeat:
      "Sneaky! When the Knight steps aside, it can reveal a surprise attack from the piece hiding right behind it. The Kingdom calls this a 'discovered attack.'",
    skillTags: ["knight_movement", "tactics_mixed"],
    minigameId: "knight-fork-spot",
    puzzle: {
      fen: "4k3/8/8/3N4/8/8/8/3RK3 w - - 0 1",
      prompt: "Move the Knight aside to reveal the hidden ambush!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/3N4/8/PPPPPPPP/3RK3 w - - 0 1",
      prompt: "Make 3 good Knight or Pawn moves to set up the ambush.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "Something's Hiding Behind the Knight" },
      { id: "s2", type: "minigame", title: "Remember the Ambush" },
      { id: "s3", type: "puzzle", title: "Spring the Ambush" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Ambush Duel" },
      { id: "s6", type: "reward", title: "Ambush Badge Earned!" },
    ],
  },
  {
    dayNumber: 18,
    crystal: "bishop",
    title: "The Bishop's Long Skewer",
    storyBeat:
      "The Bishop has learned a dazzling trick: lining up two enemies on the very same diagonal, so moving one exposes the other! This is called a 'skewer.'",
    skillTags: ["bishop_movement", "pin_pattern"],
    minigameId: "bishop-pin-execute",
    puzzle: {
      fen: "4k3/8/8/8/2B5/8/8/4K3 w - - 0 1",
      prompt: "Line up the Bishop's diagonal for a skewer!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/2B5/8/PPPPPPPP/4K3 w - - 0 1",
      prompt: "Make 3 good Bishop or Pawn moves to practice your skewer.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Dazzling Diagonal Trick" },
      { id: "s2", type: "minigame", title: "Skewer Reflexes" },
      { id: "s3", type: "puzzle", title: "Line Up the Skewer" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Skewer Duel" },
      { id: "s6", type: "reward", title: "Skewer Badge Earned!" },
    ],
  },
  {
    dayNumber: 19,
    crystal: "rook",
    title: "The Doubled Rooks' Tower",
    storyBeat:
      "Two Rooks stacked on the very same file are twice as strong! The Kingdom's engineers call this the 'doubled rooks' — an unstoppable tower of power.",
    skillTags: ["rook_movement", "rook_doubling"],
    minigameId: "rook-doubling",
    puzzle: {
      fen: "4k3/8/8/3R4/8/8/8/3RK3 w - - 0 1",
      prompt: "Move a Rook to stack the tower on one file!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/3R4/8/8/PPPPPPPP/3RK3 w - - 0 1",
      prompt: "Make 3 good Rook or Pawn moves to build your tower.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Engineers' Secret" },
      { id: "s2", type: "minigame", title: "Stack the Tower" },
      { id: "s3", type: "puzzle", title: "Double the Rooks" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Tower Duel" },
      { id: "s6", type: "reward", title: "Doubled Rooks Badge Earned!" },
    ],
  },
  {
    dayNumber: 20,
    crystal: "queen",
    title: "The Tournament Trial",
    storyBeat:
      "You've learned so much! The Kingdom's grandest hall now hosts your very first Tournament Trial — bring everything you've learned together with your powerful Queen.",
    skillTags: ["queen_movement", "tactics_mixed"],
    minigameId: "queen-power-sweep",
    puzzle: {
      fen: "4k3/8/8/8/8/8/8/3QK3 w - - 0 1",
      prompt: "Sweep the Queen across the board for the Trial!",
    },
    miniMatch: {
      fen: "4k3/pppppppp/8/8/8/8/PPPPPPPP/3QK3 w - - 0 1",
      prompt: "Make 3 good Queen or Pawn moves to win your Trial.",
      movesRequired: 3,
    },
    steps: [
      { id: "s1", type: "story", title: "The Grand Hall Awaits" },
      { id: "s2", type: "minigame", title: "Tournament Reflexes" },
      { id: "s3", type: "puzzle", title: "Open the Trial" },
      { id: "s4", type: "ai_chat", title: "Chat with Ollie" },
      { id: "s5", type: "mini_match", title: "Trial Duel" },
      { id: "s6", type: "reward", title: "Tournament Badge Earned!" },
    ],
  },
];

export function getLesson(dayNumber: number): Lesson | undefined {
  return LESSONS.find((l) => l.dayNumber === dayNumber);
}
