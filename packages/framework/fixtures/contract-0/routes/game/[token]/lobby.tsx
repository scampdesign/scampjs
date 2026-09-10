import { useState } from 'preact/hooks';
import type { LoadContext, RouteProps } from 'scampjs/runtime';
import Lobby from '@/views/Lobby/Lobby';
import { loadGame, startGame } from '@/lib/game';

export const render = 'client';

export async function load({ params, env }: LoadContext<{ token: string }>) {
  return { game: await loadGame(env.DB, params.token) };
}

export default function LobbyRoute({ params, data }: RouteProps<typeof load>) {
  const [starting, setStarting] = useState(false);
  const { game } = data;
  const joined = game.players.filter((p) => p.claimed).length;

  return (
    <Lobby
      code={params.token}
      joinedLabel={`${joined} of ${game.players.length} joined`}
      players={game.players.map((p) => ({
        id: p.seat,
        label: `Player ${p.seat} · ${p.name}`,
        url: p.url,
        status: p.claimed ? 'Joined' : 'Open',
      }))}
      waiting={joined < game.players.length}
      canStart={joined === game.players.length && !starting}
      onCopy={(id) => {
        const url = game.players.find((p) => p.seat === id)?.url;
        if (url) void navigator.clipboard.writeText(url);
      }}
      onStart={() => {
        setStarting(true);
        void startGame(params.token);
      }}
    />
  );
}
