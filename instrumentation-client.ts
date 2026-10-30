import { initBotId } from 'botid/client/core';

// Vercel BotID attaches an invisible challenge to live Ask Steven questions, so /api/ask can turn
// bots away before any work is done. It does nothing in development.
initBotId({ protect: [{ path: '/api/ask', method: 'POST' }] });
