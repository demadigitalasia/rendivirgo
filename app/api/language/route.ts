import { cookies } from "next/headers";
import { languageCookieName, supportedLanguages } from "@/lib/locale";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { language?: unknown } | null;
  if (typeof payload?.language !== "string" || !supportedLanguages.includes(payload.language as "en" | "id")) {
    return Response.json({ message: "Unsupported language" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(languageCookieName, payload.language, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return Response.json({ language: payload.language });
}
