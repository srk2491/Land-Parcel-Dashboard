import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";

export async function getMediaAdmin() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const allowedIds = new Set(
    (env.MEDIA_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return allowedIds.has(user.userId) ? user : null;
}

export function mediaBindingsReady() {
  return Boolean(env.DB && env.BUCKET);
}
