/** Only same-origin paths may be used as post-login destinations. */
export function safeCustomerReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/account";
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u0020]/.test(decoded) || decoded.startsWith("//")) return "/account";
    const url = new URL(value, "https://return.invalid");
    return url.origin === "https://return.invalid" ? `${url.pathname}${url.search}${url.hash}` : "/account";
  } catch { return "/account"; }
}
export function wholesaleRegistrationIntent(value: string): string | undefined {
  return ["/wholesale/finished", "/wholesale/checkout", "/id/wholesale/finished", "/id/wholesale/checkout"].includes(value) ? value : undefined;
}
