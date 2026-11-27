import type { Api } from "grammy";

// business_connection_id → Telegram id of the account that connected the bot.
// Memory only: after a restart it's fetched again on the first message.
const owners = new Map<string, number>();

export function rememberOwner(connectionId: string, userId: number) {
  owners.set(connectionId, userId);
}

export async function getOwner(api: Api, connectionId: string) {
  const cached = owners.get(connectionId);
  if (cached) return cached;

  const connection = await api.getBusinessConnection(connectionId);
  owners.set(connectionId, connection.user.id);
  return connection.user.id;
}
