import type { Api } from "grammy";
import { ownerOfConnection, saveConnection, saveOwner } from "../../owners";

// business_connection_id → Telegram id of the account that connected the bot.
// Normally saved from the business_connection update; if that was missed (e.g. the bot
// was connected before the database existed), ask Telegram once and save the answer.
export async function resolveOwner(api: Api, connectionId: string) {
  const known = ownerOfConnection(connectionId);
  if (known !== undefined) return known;

  const connection = await api.getBusinessConnection(connectionId);
  saveOwner({ id: connection.user.id, name: connection.user.first_name });
  saveConnection(connection.id, connection.user.id, connection.is_enabled);
  return connection.user.id;
}
