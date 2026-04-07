import { Resend } from "resend";
import { createClient } from "@sanity/client";

const resend = new Resend(process.env.RESEND_API_KEY);

const COUPLE_EMAIL = process.env.COUPLE_EMAIL || "your@email.com";
const WEDDING_DATE = "August 15, 2026";

const sanity = createClient({
  projectId: "al7hyz6y",
  dataset: "production",
  useCdn: false,
  apiVersion: "2024-01-01",
  token: process.env.VITE_SANITY_TOKEN || "",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;

    // Only act on claim creation events
    if (body._type !== "claim") {
      return res.status(200).json({ message: "Not a claim event, skipping" });
    }

    const { guestName, guestEmail, claimType, amount, item } = body;

    // Fetch item name from Sanity — webhook body only has the _ref, not the name
    let itemName = "a gift";
    if (item?._ref) {
      try {
        const registryItem = await sanity.fetch(`*[_id == $id][0]{ name }`, {
          id: item._ref,
        });
        if (registryItem?.name) itemName = registryItem.name;
      } catch (_) {}
    }
    const isContribution = claimType === "contribution";
    const formattedAmount = amount
      ? "₦" + Number(amount).toLocaleString("en-NG")
      : null;

    const emails = [];

    // 1. Email to the GUEST (if they provided an email)
    if (guestEmail) {
      emails.push(
        resend.emails.send({
          from: "Wedding Registry <onboarding@resend.dev>",
          to: guestEmail,
          subject: isContribution
            ? `Your contribution to "${itemName}" is confirmed 🌸`
            : `You've claimed "${itemName}" — thank you! 🎁`,
          html: guestEmailHtml({
            guestName,
            itemName,
            isContribution,
            formattedAmount,
          }),
        }),
      );
    }

    // 2. Email to the COUPLE
    emails.push(
      resend.emails.send({
        from: "Wedding Registry <onboarding@resend.dev>",
        to: COUPLE_EMAIL,
        subject: isContribution
          ? `💰 ${guestName} contributed ${formattedAmount} toward ${itemName}`
          : `🎁 ${guestName} claimed ${itemName}`,
        html: coupleEmailHtml({
          guestName,
          guestEmail,
          itemName,
          isContribution,
          formattedAmount,
        }),
      }),
    );

    await Promise.all(emails);

    return res.status(200).json({ success: true, emailsSent: emails.length });
  } catch (error) {
    console.error("Email notification failed:", error);
    return res.status(500).json({ error: error.message });
  }
}

function guestEmailHtml({
  guestName,
  itemName,
  isContribution,
  formattedAmount,
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Georgia, serif; background: #faf8f5; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.06); }
        .header { background: linear-gradient(135deg, #f2d9d5, #e8d8c0); padding: 40px 32px; text-align: center; }
        .header h1 { font-size: 1.6rem; color: #5a3e36; font-weight: 400; margin: 0 0 4px; letter-spacing: 0.05em; }
        .header p { color: #8b6f66; font-style: italic; margin: 0; font-size: 0.95rem; }
        .body { padding: 36px 32px; }
        .highlight { background: rgba(107,124,82,0.08); border-left: 3px solid #6b7c52; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
        .highlight p { margin: 0; color: #4a5a3a; font-size: 0.95rem; line-height: 1.7; }
        .amount { font-size: 1.4rem; color: #6b7c52; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; }
        .footer { text-align: center; padding: 24px 32px; border-top: 1px solid #f0ebe4; }
        .footer p { color: #b0a090; font-size: 0.78rem; margin: 0; }
        h2 { color: #5a3e36; font-weight: 400; font-size: 1.2rem; margin: 0 0 12px; }
        p { color: #6b5a50; line-height: 1.8; font-size: 0.92rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Semilore & Adeoluwa</h1>
          <p>August 15, 2026 · Wedding Registry</p>
        </div>
        <div class="body">
          <h2>Thank you, ${guestName}! 🌸</h2>
          ${
            isContribution
              ? `
            <p>Your contribution of <span class="amount">${formattedAmount}</span> toward <strong>${itemName}</strong> has been recorded. We are deeply grateful for your generosity.</p>
            <div class="highlight">
              <p>To complete your contribution, please transfer <strong>${formattedAmount}</strong> to the account details provided on the wedding website. Your gift means the world to us.</p>
            </div>
          `
              : `
            <p>You've chosen to gift <strong>${itemName}</strong> — what a thoughtful choice! The couple will be so touched to know you're taking care of this.</p>
            <div class="highlight">
              <p>Please reach out to the couple directly or purchase the item before the big day. Thank you for your love and generosity!</p>
            </div>
          `
          }
          <p>We are counting the days until we celebrate together on <strong>${WEDDING_DATE}</strong>. 🎊</p>
        </div>
        <div class="footer">
          <p>With love · Semilore & Adeoluwa</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function coupleEmailHtml({
  guestName,
  guestEmail,
  itemName,
  isContribution,
  formattedAmount,
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Georgia, serif; background: #faf8f5; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 20px rgba(0,0,0,0.06); }
        .header { background: linear-gradient(135deg, #d4ddc5, #e8d8c0); padding: 32px; text-align: center; }
        .header h1 { font-size: 1.2rem; color: #3a4a2a; font-weight: 400; margin: 0; letter-spacing: 0.05em; }
        .body { padding: 32px; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0ebe4; font-size: 0.88rem; }
        .detail-label { color: #9a8a80; }
        .detail-value { color: #5a3e36; font-weight: 500; }
        .studio-btn { display: inline-block; background: #6b7c52; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-size: 0.85rem; margin-top: 20px; letter-spacing: 0.05em; }
        h2 { color: #3a4a2a; font-weight: 400; font-size: 1.1rem; margin: 0 0 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎁 New Registry ${isContribution ? "Contribution" : "Claim"}</h1>
        </div>
        <div class="body">
          <h2>Someone just ${isContribution ? "contributed to" : "claimed"} a gift!</h2>
          <div class="detail-row"><span class="detail-label">Guest</span><span class="detail-value">${guestName}</span></div>
          <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${guestEmail || "Not provided"}</span></div>
          <div class="detail-row"><span class="detail-label">Gift</span><span class="detail-value">${itemName}</span></div>
          <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${isContribution ? "Contribution" : "Full Claim"}</span></div>
          ${isContribution ? `<div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value">${formattedAmount}</span></div>` : ""}
          <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span></div>
          <a href="https://www.sanity.io/manage/project/al7hyz6y" class="studio-btn">View in Sanity Studio →</a>
        </div>
      </div>
    </body>
    </html>
  `;
}
