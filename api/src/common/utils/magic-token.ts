import { createHmac, timingSafeEqual } from "node:crypto";

export type MagicTokenPayload = {
  email: string;
  exp: number;
};

export function signMagicToken(payload: MagicTokenPayload, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifyMagicToken(token: string, secret: string): MagicTokenPayload | null {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<MagicTokenPayload>;
    if (typeof payload.email !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return { email: payload.email, exp: payload.exp };
  } catch {
    return null;
  }
}
