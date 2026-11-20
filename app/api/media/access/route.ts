import { getChatGPTUser, chatGPTSignInPath } from "../../../chatgpt-auth";
import { getMediaAdmin, mediaBindingsReady } from "../../../../lib/media-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  const admin = await getMediaAdmin();
  return Response.json({
    ready: mediaBindingsReady(),
    signedIn: Boolean(user),
    isAdmin: Boolean(admin),
    signInUrl: chatGPTSignInPath("/index.html"),
  }, { headers: { "Cache-Control": "no-store" } });
}
