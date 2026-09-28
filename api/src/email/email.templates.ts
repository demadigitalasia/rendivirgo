const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type EmailLineItem = {
  name: string;
  quantity: number;
  lineTotal: number;
};

export type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
  shippingName: string | null;
  items: EmailLineItem[];
  customerNote?: string | null;
};

const money = (currency: string, value: number): string =>
  `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const layout = (options: { heading: string; intro: string; body: string; footer?: string }): string => `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f4ef;font-family:Georgia,'Times New Roman',serif;color:#22201c;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="letter-spacing:0.28em;font-size:11px;text-transform:uppercase;color:#6b7a5a;">RENDI VIRGO</div>
      <div style="background:#ffffff;border:1px solid #e7e2d8;border-radius:14px;padding:28px;margin-top:14px;">
        <h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(options.heading)}</h1>
        <p style="font-size:14px;line-height:1.6;color:#4c483f;margin:0 0 18px;">${escapeHtml(options.intro)}</p>
        ${options.body}
      </div>
      <p style="font-size:12px;color:#8a8477;margin-top:16px;line-height:1.6;">${
        options.footer ?? "RENDI VIRGO · Indonesian natural stones · rendivirgo.com"
      }</p>
    </div>
  </body>
</html>`;

const itemsTable = (data: OrderEmailData): string => `
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 18px;">
    <tbody>
      ${data.items
        .map(
          (item) => `<tr>
            <td style="padding:7px 0;border-bottom:1px solid #efeae0;">${escapeHtml(item.name)} × ${item.quantity}</td>
            <td style="padding:7px 0;border-bottom:1px solid #efeae0;text-align:right;">${money(data.currency, item.lineTotal)}</td>
          </tr>`,
        )
        .join("")}
      <tr>
        <td style="padding:7px 0;color:#6f695e;">Shipping${data.shippingName ? ` (${escapeHtml(data.shippingName)})` : ""}</td>
        <td style="padding:7px 0;text-align:right;">${
          data.shippingCost === 0 ? "Free" : money(data.currency, data.shippingCost)
        }</td>
      </tr>
      ${
        data.discountTotal > 0
          ? `<tr><td style="padding:7px 0;color:#6f695e;">Discount</td><td style="padding:7px 0;text-align:right;">−${money(
              data.currency,
              data.discountTotal,
            )}</td></tr>`
          : ""
      }
      <tr>
        <td style="padding:10px 0;font-weight:bold;">Total</td>
        <td style="padding:10px 0;text-align:right;font-weight:bold;">${money(data.currency, data.total)}</td>
      </tr>
    </tbody>
  </table>`;

export const renderOrderReceivedEmail = (data: OrderEmailData & { paypalEnabled: boolean }): string =>
  layout({
    heading: `Thank you, ${data.customerName.split(" ")[0] || data.customerName}`,
    intro: data.paypalEnabled
      ? `We received order ${data.orderNumber}. Complete the PayPal payment to confirm it — this email is your summary.`
      : `We received order ${data.orderNumber}. We will follow up by email with payment instructions.`,
    body: `${itemsTable(data)}${
      data.customerNote
        ? `<p style="font-size:13px;color:#6f695e;">Your note: ${escapeHtml(data.customerNote)}</p>`
        : ""
    }`,
    footer: `Order ${escapeHtml(data.orderNumber)} · Payment pending · rendivirgo.com`,
  });

export const renderOrderPaidEmail = (data: OrderEmailData): string =>
  layout({
    heading: "Payment received — order confirmed",
    intro: `Your payment for order ${data.orderNumber} has been confirmed. We will pack your stones within 1–3 business days and email tracking details as soon as they ship.`,
    body: itemsTable(data),
    footer: `Order ${escapeHtml(data.orderNumber)} · Paid · rendivirgo.com`,
  });

export const renderNewOrderAdminEmail = (data: OrderEmailData & { email: string }): string =>
  layout({
    heading: `New order ${data.orderNumber}`,
    intro: `${data.customerName} (${data.email}) placed an order for ${money(data.currency, data.total)}.`,
    body: itemsTable(data),
    footer: "RENDI VIRGO admin notification",
  });

export const renderNewMessageAdminEmail = (message: {
  name: string;
  email: string;
  subject: string;
  body: string;
}): string =>
  layout({
    heading: `New contact message: ${message.subject}`,
    intro: `From ${message.name} (${message.email})`,
    body: `<p style="font-size:14px;line-height:1.6;white-space:pre-wrap;color:#3d3931;">${escapeHtml(message.body)}</p>`,
    footer: "RENDI VIRGO admin notification",
  });

export const renderNewReviewAdminEmail = (review: {
  productName: string;
  name: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
}): string =>
  layout({
    heading: `New review pending — ${review.productName}`,
    intro: `${review.name} rated it ${review.rating}/5${review.verifiedPurchase ? " (verified purchase)" : ""}. Approve or reject it in the admin.`,
    body: `<div style="font-size:14px;line-height:1.6;color:#3d3931;">
      ${review.title ? `<p style="font-weight:bold;margin:0 0 6px;">${escapeHtml(review.title)}</p>` : ""}
      <p style="white-space:pre-wrap;margin:0;">${escapeHtml(review.body)}</p>
    </div>`,
    footer: "RENDI VIRGO admin notification",
  });

export const renderOrdersLinkEmail = (data: { link: string; expiresMinutes: number }): string =>
  layout({
    heading: "Your RENDI VIRGO orders",
    intro: `Use the button below to open your order history. This link expires in ${data.expiresMinutes} minutes and only works on this device.`,
    body: `<p style="margin:0 0 8px;"><a href="${escapeHtml(data.link)}" style="display:inline-block;background:#22201c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;">View my orders</a></p>
      <p style="font-size:12px;color:#8a8477;word-break:break-all;">${escapeHtml(data.link)}</p>`,
    footer: "If you did not request this, you can safely ignore this email.",
  });

export const renderPasswordResetEmail = (data: { name: string; link: string; expiresMinutes: number }): string =>
  layout({
    heading: "Reset your admin password",
    intro: `Hi ${data.name}, we received a request to reset the RENDI VIRGO admin password. This link expires in ${data.expiresMinutes} minutes and can be used once.`,
    body: `<p style="margin:0 0 8px;"><a href="${escapeHtml(data.link)}" style="display:inline-block;background:#22201c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;">Choose a new password</a></p>
      <p style="font-size:12px;color:#8a8477;word-break:break-all;">${escapeHtml(data.link)}</p>`,
    footer: "If you did not request this, you can ignore this email — your password stays unchanged.",
  });
