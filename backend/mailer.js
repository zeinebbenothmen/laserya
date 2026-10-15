/**
 * mailer.js — Envoi de l'email de confirmation de commande (avec le CODE de suivi).
 *
 * Configuration par variables d'environnement (sinon l'envoi est ignoré proprement,
 * le code reste affiché sur la page de confirmation) :
 *   SMTP_HOST, SMTP_PORT (587/465), SMTP_USER, SMTP_PASS, SMTP_SECURE (true/false)
 *   MAIL_FROM   ex. "Laserya.tn <commandes@laserya.fr>"
 *   SITE_URL    ex. https://laserya.fr  (pour le lien de suivi ; défaut localhost)
 */
const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  // Non configuré (ou mot de passe encore en placeholder) → on n'envoie pas
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || /COLLEZ/i.test(SMTP_PASS)) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

const fmt = (n) => `${(Number(n) || 0).toFixed(3)} TND`;

function buildHtml(order, code, trackUrl) {
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map(i =>
    `<tr><td style="padding:6px 0;color:#cbd5e1">${escapeHtml(i.name)} × ${i.quantity}</td>
     <td style="padding:6px 0;text-align:right;color:#e2e8f0">${fmt(i.price * i.quantity)}</td></tr>`
  ).join('');
  return `
  <div style="background:#070A0F;padding:32px 0;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#101419;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden">
      <div style="padding:28px 32px;border-bottom:1px solid rgba(255,255,255,.08)">
        <span style="font-size:22px;font-weight:800;color:#a8e8ff">Laserya.tn</span>
      </div>
      <div style="padding:32px">
        <h1 style="color:#fff;font-size:22px;margin:0 0 8px">Merci pour votre commande ! 🎉</h1>
        <p style="color:#94a3b8;margin:0 0 24px">Bonjour ${escapeHtml(order.customer_name || '')}, votre commande est bien reçue.</p>

        <div style="background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.25);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <p style="color:#7dd3fc;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px">Votre code de suivi</p>
          <p style="color:#a8e8ff;font-size:30px;font-weight:800;letter-spacing:3px;margin:0">${code}</p>
        </div>

        <p style="color:#cbd5e1;margin:0 0 20px">Suivez l'état de votre commande à tout moment avec ce code :</p>
        <p style="text-align:center;margin:0 0 28px">
          <a href="${trackUrl}" style="display:inline-block;background:#a8e8ff;color:#003642;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px">Suivre ma commande</a>
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px">
          ${rows}
          <tr><td style="padding:12px 0 0;color:#fff;font-weight:700;border-top:1px solid rgba(255,255,255,.08)">Total</td>
              <td style="padding:12px 0 0;text-align:right;color:#a8e8ff;font-weight:800;border-top:1px solid rgba(255,255,255,.08)">${fmt(order.total)}</td></tr>
        </table>

        <p style="color:#64748b;font-size:12px;margin:24px 0 0">Paiement à la livraison · Livraison gratuite partout en Tunisie.</p>
      </div>
    </div>
    <p style="text-align:center;color:#475569;font-size:11px;margin-top:16px">Laserya.tn — Gravure laser & impression 3D</p>
  </div>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Envoie l'email de confirmation. Ne lève jamais : renvoie { sent, reason }.
async function sendOrderEmail(order) {
  try {
    const to = (order.customer_email || '').trim();
    const code = (order.id || '').slice(0, 8).toUpperCase();
    const site = process.env.SITE_URL || 'http://localhost:3001';
    const trackUrl = `${site}/pages/my-orders.html?id=${code}`;

    if (!to) return { sent: false, reason: 'no-email' };
    const t = getTransporter();
    if (!t) { console.warn(`✉️  SMTP non configuré — email non envoyé (commande ${code})`); return { sent: false, reason: 'not-configured' }; }

    await t.sendMail({
      from: process.env.MAIL_FROM || `"Laserya.tn" <${process.env.SMTP_USER}>`,
      to,
      subject: `Commande Laserya #${code} confirmée — votre code de suivi`,
      html: buildHtml(order, code, trackUrl),
    });
    console.log(`✉️  Email de confirmation envoyé à ${to} (commande ${code})`);
    return { sent: true };
  } catch (e) {
    console.error('✉️  Échec envoi email:', e.message);
    return { sent: false, reason: e.message };
  }
}

module.exports = { sendOrderEmail };
