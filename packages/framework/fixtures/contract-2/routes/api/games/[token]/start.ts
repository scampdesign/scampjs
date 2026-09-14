import type { LoadContext } from 'scampjs/runtime';
import { startGame } from '@/lib/game';

export const POST = async ({ params, env }: LoadContext<{ token: string }>) => {
  const game = await startGame(env.DB, params.token);
  return Response.json({ game });
};
