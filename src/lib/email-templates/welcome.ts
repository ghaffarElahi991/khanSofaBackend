export function welcomeEmail(siteUrl: string) {
  const origin = new URL(siteUrl).origin;
  if (!/^https?:\/\//.test(origin)) throw new Error("Invalid website URL");
  const shopUrl = `${origin}/shop`;
  const imageUrl = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=85";
  return {
    subject: "Welcome to Khan Sofa — make yourself at home",
    text: `Thank you for subscribing to Khan Sofa.\n\nExplore considered sofas, chairs, tables, beds, and storage made for comfortable everyday living.\n\nDiscover the collection: ${shopUrl}\n\nWarmly,\nKhan Sofa\n\nYou received this welcome email because your address was entered in the subscription form at ${origin}. If this wasn't you, you can ignore this message.`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Welcome to Khan Sofa</title></head>
<body style="margin:0;padding:0;background-color:#e7e2d7;color:#203128;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Thank you for subscribing. Discover furniture made for thoughtful living.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e7e2d7;"><tr><td align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#faf8f1;">
<tr><td align="center" style="padding:32px 24px 26px;border-top:4px solid #a66a43;">
<a href="${origin}" style="font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:4px;color:#203128;text-decoration:none;">KHAN SOFA</a>
<p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;color:#a66a43;">FURNITURE FOR THOUGHTFUL LIVING</p>
</td></tr>
<tr><td><a href="${shopUrl}" style="text-decoration:none;"><img src="${imageUrl}" width="600" alt="A warm contemporary living room" border="0" style="display:block;width:100%;max-width:600px;height:auto;color:#526b5a;font-family:Arial,sans-serif;font-size:14px;"></a></td></tr>
<tr><td align="center" style="padding:36px 28px 16px;">
<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#a66a43;">MAKE YOURSELF AT HOME</p>
<h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.2;font-weight:normal;color:#526b5a;">A warm welcome<br>to Khan Sofa.</h1>
<p style="margin:22px 0 0;font-family:Arial,sans-serif;font-size:16px;line-height:1.8;color:#59434c;">Thank you for subscribing. We're so happy you're here.</p>
<p style="margin:12px 0 24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#526056;">Explore honest materials, lasting comfort, and considered pieces for every room.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#526b5a" style="border-radius:3px;mso-padding-alt:16px 28px;"><a href="${shopUrl}" style="display:inline-block;padding:16px 28px;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-decoration:none;">DISCOVER THE COLLECTION</a></td></tr></table>
</td></tr>
<tr><td style="padding:24px 28px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ead7de;border-bottom:1px solid #ead7de;"><tr><td align="center" style="padding:22px 8px;">
<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.5;color:#526b5a;">A home that feels entirely your own.</p>
<p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:12px;line-height:1.8;letter-spacing:1px;color:#a66a43;">LIVING &nbsp;·&nbsp; DINING &nbsp;·&nbsp; BEDROOM &nbsp;·&nbsp; OUTDOOR</p>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:0 28px 34px;"><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.6;color:#526056;">Warmly,<br><span style="color:#526b5a;font-size:24px;">Khan Sofa</span></p></td></tr>
<tr><td align="center" style="padding:24px;background-color:#f4e9ed;font-family:Arial,sans-serif;font-size:11px;line-height:1.8;color:#725965;">
<p style="margin:0 0 8px;"><a href="${origin}" style="color:#526056;text-decoration:underline;">Visit Khan Sofa</a></p>
<p style="margin:0;">You received this welcome email because your address was entered in our subscription form. If this wasn't you, you can ignore this message.</p>
<p style="margin:12px 0 0;">&copy; ${new Date().getFullYear()} Khan Sofa</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}
