/**
 * Minimum number of knight moves between two squares on an otherwise empty
 * board — pure movement geometry (BFS over the knight's move graph), not
 * dependent on any actual game position. Used by the Chess Mind "Spatial
 * Thinking" module to generate real, verifiable questions/answers rather
 * than pre-authored trivia.
 */
const KNIGHT_OFFSETS: [number, number][] = [
  [1, 2], [2, 1], [-1, 2], [-2, 1],
  [1, -2], [2, -1], [-1, -2], [-2, -1],
];

function squareToCoord(square: string): [number, number] {
  const file = square.charCodeAt(0) - 97; // 'a' -> 0
  const rank = parseInt(square[1], 10) - 1; // '1' -> 0
  return [file, rank];
}

function coordToSquare(file: number, rank: number): string {
  return String.fromCharCode(97 + file) + (rank + 1);
}

export function knightDistance(from: string, to: string): number {
  if (from === to) return 0;

  let frontier: [number, number][] = [squareToCoord(from)];
  const visited = new Set<string>([from]);
  let dist = 0;

  while (frontier.length > 0) {
    dist++;
    const next: [number, number][] = [];
    for (const [f, r] of frontier) {
      for (const [df, dr] of KNIGHT_OFFSETS) {
        const nf = f + df;
        const nr = r + dr;
        if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
        const sq = coordToSquare(nf, nr);
        if (sq === to) return dist;
        if (!visited.has(sq)) {
          visited.add(sq);
          next.push([nf, nr]);
        }
      }
    }
    frontier = next;
  }
  // Unreachable never actually happens on a connected 8x8 knight graph,
  // but the type stays honest about it rather than asserting impossible.
  return -1;
}

export function randomSquare(exclude?: string): string {
  let sq: string;
  do {
    const file = Math.floor(Math.random() * 8);
    const rank = Math.floor(Math.random() * 8);
    sq = coordToSquare(file, rank);
  } while (sq === exclude);
  return sq;
}
