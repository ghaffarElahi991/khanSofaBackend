export type PaidOrder = {
  orderNumber: string;
  trackingToken?: string;
  customerName: string;
  customerEmail: string;
  total: { toString(): string } | number;
  items: Array<{
    quantity: number;
    price: { toString(): string } | number;
    product: { name: string; primaryImageUrl?: string | null };
  }>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function paymentEmail(order: PaidOrder, siteUrl: string) {
  const origin = new URL(siteUrl).origin;
  if (!/^https?:\/\//.test(origin)) throw new Error("Invalid website URL");
  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const trackingUrl = order.trackingToken ? `${origin}/track/${encodeURIComponent(order.trackingToken)}` : null;
  const total = money(Number(order.total));
  const productImage = (item: PaidOrder["items"][number]) => {
    if (!item.product.primaryImageUrl?.trim()) return "";
    try {
      const url = new URL(item.product.primaryImageUrl, origin);
      if (!["https:", "http:"].includes(url.protocol)) return "";
      return `<img src="${escapeHtml(url.href)}" alt="${escapeHtml(item.product.name)}" width="96" border="0" style="display:block;width:96px;max-width:100%;height:auto;margin-bottom:12px;border:1px solid #ead7de;border-radius:6px;background-color:#f4e9ed;">`;
    } catch {
      return "";
    }
  };
  const rows = order.items.map(item => `<tr>
    <td style="padding:18px 0;border-bottom:1px solid #ead7de;vertical-align:top;overflow-wrap:anywhere;">
      ${productImage(item)}
      <p style="margin:0;font-size:15px;line-height:1.5;color:#2d1720;">${escapeHtml(item.product.name)}</p>
      <p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:#725965;">Qty ${item.quantity} &nbsp;&middot;&nbsp; ${money(Number(item.price))} each</p>
    </td>
    <td align="right" style="padding:18px 0 18px 12px;border-bottom:1px solid #ead7de;vertical-align:top;font-size:15px;white-space:nowrap;color:#2d1720;">${money(Number(item.price) * item.quantity)}</td>
  </tr>`).join("");
  return {
    subject: `Payment confirmed — ${order.orderNumber}`,
    text: `Hi ${order.customerName},\n\nThank you for shopping with Khan Sofa. Your payment for order ${order.orderNumber} has been confirmed.\n\n${order.items.map(item => `${item.quantity} × ${item.product.name} — ${money(Number(item.price))} each; ${money(Number(item.price) * item.quantity)} total`).join("\n")}\n\nTotal paid: ${total}\n\nWe'll email you your tracking ID shortly so you can follow your order's journey.${trackingUrl ? `\n\nTrack your order: ${trackingUrl}` : ""}\n\nWarmly,\nKhan Sofa\n${origin}`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Payment confirmed</title></head>
<body style="margin:0;padding:0;background-color:#e7e2d7;color:#203128;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Your payment is confirmed. Thank you for choosing Khan Sofa.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e7e2d7;"><tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#fffaf7;">
<tr><td align="center" style="padding:32px 24px;border-top:4px solid #d6b58a;border-bottom:1px solid #ead7de;">
<a href="${origin}" style="font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:4px;color:#203128;text-decoration:none;">KHAN SOFA</a>
<p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#a66a43;">FURNITURE FOR THOUGHTFUL LIVING</p>
</td></tr>
<tr><td align="center" style="padding:34px 24px 28px;background-color:#f4e9ed;">
<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#a66a43;">YOUR SPACE IS TAKING SHAPE</p>
<h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:36px;line-height:1.2;color:#9b4965;">Payment confirmed</h1>
<p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;color:#725965;overflow-wrap:anywhere;">ORDER ${escapeHtml(order.orderNumber)}</p>
</td></tr>
<tr><td style="padding:28px 24px 12px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#59434c;">
<p style="margin:0 0 12px;">Hi ${escapeHtml(order.customerName)},</p>
<p style="margin:0;">Thank you for choosing Khan Sofa. Your payment has been received, and our team will coordinate the next delivery steps with care.</p>
</td></tr>
<tr><td style="padding:16px 24px 28px;font-family:Arial,sans-serif;">
<h2 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:normal;color:#526b5a;">Your furniture</h2>
<table width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;border-top:1px solid #d6b58a;">
<thead><tr><th scope="col" align="left" style="width:65%;padding:12px 0;border-bottom:1px solid #ead7de;font-size:10px;letter-spacing:2px;font-weight:normal;color:#725965;">ITEM</th><th scope="col" align="right" style="padding:12px 0;border-bottom:1px solid #ead7de;font-size:10px;letter-spacing:2px;font-weight:normal;color:#725965;">AMOUNT</th></tr></thead>
<tbody>${rows}</tbody></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;background-color:#f4e9ed;"><tr><td style="padding:20px 14px;font-size:14px;color:#59434c;">Total paid</td><td align="right" style="padding:20px 14px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#9b4965;">${total}</td></tr></table>
</td></tr>
<tr><td style="padding:0 24px 28px;font-family:Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="border-left:3px solid #d6b58a;padding:4px 0 4px 16px;">
<h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:normal;color:#9b4965;">What happens next?</h2>
<p style="margin:0;font-size:14px;line-height:1.8;color:#59434c;">We'll email you your tracking ID shortly so you can follow your order's journey. Keep this email as your payment confirmation.</p>
${trackingUrl ? `<p style="margin:18px 0 0;"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:14px 24px;background:#9b4965;color:white;text-decoration:none;font-size:13px;">TRACK YOUR ORDER</a></p><p style="font-size:12px;line-height:1.7;color:#725965;">Your tracking page will show Preparing your order until your courier tracking details are added.</p>` : ""}
</td></tr></table></td></tr>
<tr><td align="center" style="padding:0 24px 32px;">
<p style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.6;color:#526056;">Warmly,<br><span style="font-size:24px;color:#526b5a;">Khan Sofa</span></p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#526b5a" style="border-radius:3px;mso-padding-alt:15px 26px;"><a href="${origin}/shop" style="display:inline-block;padding:15px 26px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-decoration:none;">EXPLORE KHAN SOFA</a></td></tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 24px;background-color:#e7e2d7;font-family:Arial,sans-serif;font-size:11px;line-height:1.8;color:#526056;">This email confirms your payment to Khan Sofa.<br>&copy; ${new Date().getFullYear()} Khan Sofa &nbsp;&middot;&nbsp; <a href="${origin}" style="color:#526056;">Visit our store</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}
