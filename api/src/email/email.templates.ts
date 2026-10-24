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

export const renderOrderReceivedEmail = (data: OrderEmailData & {
  paypalEnabled: boolean;
  paymentMethod: string;
  bankTransfer: { bankName: string; accountName: string; accountNumber: string; swiftCode: string };
}): string => {
  const bankDetails = data.paymentMethod === "BankTransfer"
    ? `<div style="border:1px solid #e7e2d8;border-radius:10px;padding:16px;margin:18px 0;background:#fbfaf7;">
        <strong>Bank transfer details</strong>
        <p style="font-size:13px;line-height:1.8;margin:10px 0 0;">
          ${escapeHtml(data.bankTransfer.bankName)}<br>
          ${data.bankTransfer.accountName ? `Account holder: ${escapeHtml(data.bankTransfer.accountName)}<br>` : ""}
          Account number: ${escapeHtml(data.bankTransfer.accountNumber)}<br>
          SWIFT: ${escapeHtml(data.bankTransfer.swiftCode)}<br>
          Amount: <strong>${money(data.currency, data.total)}</strong>
        </p>
        <p style="font-size:12px;line-height:1.6;color:#6f695e;margin:10px 0 0;">Please transfer within 72 hours and ensure the full amount arrives (choose OUR fee sharing if available). Upload your transfer receipt from the checkout confirmation page. Your order will be confirmed after we check the transfer.</p>
      </div>`
    : "";

  return layout({
    heading: `Thank you, ${data.customerName.split(" ")[0] || data.customerName}`,
    intro: data.paymentMethod === "BankTransfer"
      ? `We received order ${data.orderNumber}. Transfer the exact amount below; payment is confirmed after we verify the receipt.`
      : data.paypalEnabled
        ? `We received order ${data.orderNumber}. Complete the PayPal payment to confirm it — this email is your summary.`
        : `We received order ${data.orderNumber}. We will follow up by email with payment instructions.`,
    body: `${itemsTable(data)}${bankDetails}${
      data.customerNote
        ? `<p style="font-size:13px;color:#6f695e;">Your note: ${escapeHtml(data.customerNote)}</p>`
        : ""
    }`,
    footer: `Order ${escapeHtml(data.orderNumber)} · Payment pending · rendivirgo.com`,
  });
};

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

export const renderReplyToCustomerEmail = (message: {
  name: string;
  subject: string;
  reply: string;
  original: string;
}): string =>
  layout({
    heading: "Reply from RENDI VIRGO",
    intro: `Hi ${message.name}, thank you for reaching out about "${message.subject}".`,
    body: `<div style="font-size:14px;line-height:1.6;color:#3d3931;white-space:pre-wrap;">${escapeHtml(message.reply)}</div>
      <hr style="border:none;border-top:1px solid #efeae0;margin:18px 0;" />
      <p style="font-size:12px;color:#8a8477;white-space:pre-wrap;margin:0;">Your message: ${escapeHtml(message.original)}</p>`,
    footer: "RENDI VIRGO · rendivirgo.com",
  });

export const renderOrderShippedEmail = (
  data: OrderEmailData & { carrier?: string | null; trackingNumber?: string | null; trackingUrl?: string | null },
): string =>
  layout({
    heading: "Your order is on its way",
    intro: `Order ${data.orderNumber} has shipped.${data.carrier ? ` Carrier: ${data.carrier}.` : ""}`,
    body: `${itemsTable(data)}${
      data.trackingNumber
        ? `<p style="font-size:14px;color:#3d3931;">Tracking number: <strong>${escapeHtml(data.trackingNumber)}</strong></p>`
        : ""
    }${
      data.trackingUrl
        ? `<p style="margin:6px 0 0;"><a href="${escapeHtml(data.trackingUrl)}">Track your parcel</a></p>`
        : ""
    }`,
    footer: `Order ${escapeHtml(data.orderNumber)} · Shipped · rendivirgo.com`,
  });

export const renderOrderCompletedEmail = (data: OrderEmailData): string =>
  layout({
    heading: "Your order is complete",
    intro: `Order ${data.orderNumber} has been marked complete. Thank you for collecting with us — we would love to hear what you think of your stones.`,
    body: itemsTable(data),
    footer: `Order ${escapeHtml(data.orderNumber)} · Completed · rendivirgo.com`,
  });

export const renderOrderCancelledEmail = (data: OrderEmailData & { reason?: string | null }): string =>
  layout({
    heading: "Your order was cancelled",
    intro: `Order ${data.orderNumber} has been cancelled. If payment was taken, a refund will follow shortly.`,
    body: `${itemsTable(data)}${
      data.reason ? `<p style="font-size:13px;color:#6f695e;">Reason: ${escapeHtml(data.reason)}</p>` : ""
    }`,
    footer: `Order ${escapeHtml(data.orderNumber)} · Cancelled · rendivirgo.com`,
  });

export const renderPasswordResetEmail = (data: { name: string; link: string; expiresMinutes: number }): string =>
  layout({
    heading: "Reset your admin password",
    intro: `Hi ${data.name}, we received a request to reset the RENDI VIRGO admin password. This link expires in ${data.expiresMinutes} minutes and can be used once.`,
    body: `<p style="margin:0 0 8px;"><a href="${escapeHtml(data.link)}" style="display:inline-block;background:#22201c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;">Choose a new password</a></p>
      <p style="font-size:12px;color:#8a8477;word-break:break-all;">${escapeHtml(data.link)}</p>`,
    footer: "If you did not request this, you can ignore this email — your password stays unchanged.",
  });

export type CustomerEmailLanguage = "en" | "id";

type CustomerVerificationEmailData = {
  link: string;
  expiresMinutes: number;
  language?: CustomerEmailLanguage;
};

const customerVerificationCopy = (language: CustomerEmailLanguage, expiresMinutes: number) =>
  language === "id"
    ? {
        preheader: "Satu langkah lagi untuk menyelesaikan akun pelanggan RENDI VIRGO Anda.",
        label: "AKUN PELANGGAN · LANGKAH 1 DARI 2",
        heading: "Verifikasi email Anda",
        intro: "Konfirmasi alamat email ini untuk melanjutkan. Setelah itu, pilih nama dan kata sandi untuk menyelesaikan akun pelanggan Anda.",
        button: "Verifikasi email & lanjutkan",
        expiry: `Tautan aman ini berlaku selama ${expiresMinutes} menit dan hanya dapat digunakan satu kali.`,
        fallback: "Tombol tidak berfungsi?",
        fallbackLink: "Buka tautan verifikasi",
        ignore: "Jika Anda tidak meminta pembuatan akun ini, abaikan email ini.",
        support: "Butuh bantuan? Hubungi tim kami.",
        tagline: "BATU ALAM ASLI INDONESIA",
      }
    : {
        preheader: "One quick step to finish setting up your RENDI VIRGO customer account.",
        label: "CUSTOMER ACCOUNT · STEP 1 OF 2",
        heading: "Verify your email",
        intro: "Confirm this email address to continue. Next, choose your name and password to finish setting up your customer account.",
        button: "Verify email & continue",
        expiry: `This secure link expires in ${expiresMinutes} minutes and can only be used once.`,
        fallback: "Button not working?",
        fallbackLink: "Open the secure setup link",
        ignore: "If you did not request this account, you can safely ignore this email.",
        support: "Need help? Contact our team.",
        tagline: "AUTHENTIC INDONESIAN STONES",
      };

export const renderCustomerVerificationEmail = (data: CustomerVerificationEmailData): string => {
  const language = data.language ?? "en";
  const copy = customerVerificationCopy(language, data.expiresMinutes);
  const origin = new URL(data.link).origin;
  const link = escapeHtml(data.link);
  const logo = escapeHtml(`${origin}/brand/rendi-virgo-primary.png`);
  const contact = escapeHtml(`${origin}/contact`);

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(copy.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f4ef;color:#202a23;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(copy.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f4ef" style="width:100%;border-collapse:collapse;background-color:#f6f4ef;">
      <tr>
        <td align="center" style="padding:32px 16px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;">
            <tr>
              <td align="left" style="padding:0 8px 16px;">
                <img src="${logo}" width="160" alt="RENDI VIRGO" style="display:block;width:160px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td bgcolor="#ffffff" style="padding:32px;border:1px solid #e7e2d8;border-radius:14px;background-color:#ffffff;">
                <p style="margin:0 0 12px;color:#9a7844;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;line-height:1.5;letter-spacing:1.7px;text-transform:uppercase;">${escapeHtml(copy.label)}</p>
                <h1 style="margin:0 0 12px;color:#202a23;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;line-height:1.2;">${escapeHtml(copy.heading)}</h1>
                <p style="margin:0 0 24px;color:#4c554d;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;">${escapeHtml(copy.intro)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                  <tr>
                    <td align="center" bgcolor="#123c2f" style="border:1px solid #123c2f;border-radius:7px;background-color:#123c2f;">
                      <a href="${link}" style="display:inline-block;padding:15px 22px;border-radius:7px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:18px;text-align:center;text-decoration:none;">${escapeHtml(copy.button)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 22px;color:#6f766e;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;">${escapeHtml(copy.expiry)}</p>
                <div style="height:1px;background-color:#ece8df;line-height:1px;font-size:1px;">&nbsp;</div>
                <p style="margin:18px 0 8px;color:#4c554d;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;">${escapeHtml(copy.fallback)} <a href="${link}" style="color:#123c2f;font-weight:700;text-decoration:underline;">${escapeHtml(copy.fallbackLink)}</a>.</p>
                <p style="margin:0;color:#777d74;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;">${escapeHtml(copy.ignore)}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 12px 0;color:#85877f;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;">
                <p style="margin:0 0 5px;letter-spacing:1.2px;">RENDI VIRGO · ${escapeHtml(copy.tagline)}</p>
                <p style="margin:0;"><a href="${contact}" style="color:#536252;text-decoration:underline;">${escapeHtml(copy.support)}</a> &nbsp;·&nbsp; rendivirgo.com</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const renderCustomerVerificationEmailText = (data: CustomerVerificationEmailData): string => {
  const copy = customerVerificationCopy(data.language ?? "en", data.expiresMinutes);
  return `${copy.heading}\n\n${copy.intro}\n\n${copy.button}:\n${data.link}\n\n${copy.expiry}\n\n${copy.ignore}\n\n${copy.support} https://rendivirgo.com/contact\nRENDI VIRGO · ${copy.tagline}`;
};

export const renderCustomerPasswordResetEmail = (data: { name: string; link: string; expiresMinutes: number }): string =>
  layout({
    heading: "Reset your password",
    intro: `Hi ${escapeHtml(data.name.split(" ")[0] || data.name)}, use the link below to choose a new password for your RENDI VIRGO account.`,
    body: `<p style="margin:0 0 8px;"><a href="${escapeHtml(data.link)}" style="display:inline-block;background:#22201c;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;">Reset password</a></p>
      <p style="font-size:12px;color:#8a8477;">This link expires in ${data.expiresMinutes} minutes.</p>
      <p style="font-size:12px;color:#8a8477;word-break:break-all;">${escapeHtml(data.link)}</p>`,
    footer: "If you did not request this, you can safely ignore this email.",
  });
