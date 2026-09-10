// Application code. The framework never reads this folder; it is here so
// the route file above has something real to import.
export type Player = { seat: string; name: string; url: string; claimed: boolean };
export type Game = { token: string; players: Player[] };

export async function loadGame(db: unknown, token: string): Promise<Game> {
  void db;
  return {
    token,
    players: [
      { seat: '1', name: 'Alex', url: `https://example.com/game/${token}/player-1`, claimed: true },
      { seat: '2', name: 'Bea', url: `https://example.com/game/${token}/player-2`, claimed: false },
    ],
  };
}

export async function startGame(token: string): Promise<void> {
  await fetch(`/api/games/${token}/start`, { method: 'POST' });
}
