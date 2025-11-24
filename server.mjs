
#!/usr/bin/env node
// CallFox — Final production-ready Telegram + CryptoCloud payment handler (A+ release)
// Operator numeric ID for notifications: 399248837 (confirmed by owner)
// Original uploaded source (for reference): /mnt/data/index.js

import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';

const app = express();
app.use(express.json({ limit: '1mb' }));

const BOT_TOKEN = process.env.BOT_TOKEN || '8528405495:AAFx4wvUN9MuO868q8JEGjuW-LksfgmKzMY';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY || '9a6add0e-68d5-4702-b8c6-c77972dfad72';
const CRYPTO_SECRET = process.env.CRYPTO_SECRET || '92cKpRVnPwRMyg4pz4xZ5o7a9gcQKjEFdfJS';
const SHOP_ID = process.env.SHOP_ID || 'j6xvuDOhvyTz6Mir';
const JSON_URL = process.env.JSON_URL || 'https://api.jsonstorage.net/v1/json/04ec06f0-d922-4847-a936-4a5ff3c6f3b2/3997bedf-090d-400d-ade0-083ef8e5ab3d';
const JSON_KEY = process.env.JSON_KEY || '9a6add0e-68d5-4702-b8c6-c77972dfad72';
const OPERATOR_CHAT = process.env.OPERATOR_CHAT || '399248837';

async function telegramSend(chat_id, text, opts) {
  const body = { chat_id, text, parse_mode: 'Markdown' };
  if (opts && opts.reply_markup) body.reply_markup = opts.reply_markup;
  try { await fetch(`${TELEGRAM_API}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { console.error('telegramSend error', e); }
}

async function appendJson(record) {
  if (!JSON_URL) return;
  try {
    const r = await fetch(JSON_URL, { headers: { 'apiKey': JSON_KEY } });
    let arr = [];
    if (r.ok) { const data = await r.json(); if (Array.isArray(data)) arr = data; else if (data && Object.keys(data).length) arr = [data]; }
    arr.push(record);
    await fetch(JSON_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'apiKey': JSON_KEY }, body: JSON.stringify(arr) });
  } catch (e) { console.error('appendJson error', e); }
}

function verifySignature(secret, payload, sigHex) {
  if (!sigHex) return false;
  try { const h = crypto.createHmac('sha256', secret).update(payload).digest('hex'); return h === sigHex.toLowerCase(); } catch (e) { return false; }
}

// Create invoice via CryptoCloud
async function createInvoice(amount, order_id, description) {
  const body = { shop_id: SHOP_ID, amount, currency: 'USDT', order_id, description };
  const res = await fetch('https://api.cryptocloud.plus/v1/invoice/create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': CRYPTOCLOUD_API_KEY }, body: JSON.stringify(body) });
  return res.json();
}

// Optional verify invoice via API
async function verifyInvoice(invoice_id) {
  try { const res = await fetch(`https://api.cryptocloud.plus/v1/invoice/${invoice_id}`, { method: 'GET', headers: { 'Authorization': CRYPTOCLOUD_API_KEY } }); if (!res.ok) return null; return await res.json(); } catch (e) { return null; }
}

app.get('/', (req, res) => res.send('CallFox API is running.'));

app.post('/telegram-webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const update = req.body;
    if (!update) return;
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = (update.message.text || '').trim();
      if (text === '/start') {
        const keyboard = { inline_keyboard: [[{ text: 'Русский', callback_data: 'lang_ru' }],[{ text: 'Українська', callback_data: 'lang_ua' }],[{ text: 'English', callback_data: 'lang_en' }]] };
        await telegramSend(chatId, 'Выберите язык / Оберіть мову / Choose language', { reply_markup: keyboard });
      } else { await telegramSend(chatId, 'Используйте /start для начала.'); }
    }
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || '';
      const chatId = cb.message && cb.message.chat && cb.message.chat.id;
      if (!chatId) return;
      if (data.startsWith('lang_')) {
        const lang = data.split('_')[1] || 'ru';
        const menuText = lang === 'ua' ? 'Оберіть тариф:' : lang === 'en' ? 'Select a plan:' : 'Выберите тариф:';
        const buttons = { inline_keyboard: [
          [{ text: 'MINI — $15', callback_data: `buy_mini_${lang}` }],
          [{ text: 'STANDARD — $49', callback_data: `buy_standard_${lang}` }],
          [{ text: 'PREMIUM — $149', callback_data: `buy_premium_${lang}` }],
          [{ text: 'INDIVIDUAL — Оператор', url: 'https://t.me/CALLFOX' }]
        ] };
        await telegramSend(chatId, menuText, { reply_markup: buttons });
        return;
      }
      if (data.startsWith('buy_')) {
        const parts = data.split('_');
        const plan = parts[1];
        const lang = parts[2] || 'ru';
        const prices = { mini:15, standard:49, premium:149 };
        const names = { mini:'MINI', standard:'STANDARD', premium:'PREMIUM' };
        const amount = prices[plan] || 15;
        const name = names[plan] || plan.toUpperCase();
        const order_id = `cf_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
        try {
          const inv = await createInvoice(amount, order_id, (lang === 'ua' ? 'Оплата тарифу ' : lang === 'en' ? 'Payment for ' : 'Оплата тарифа ') + name);
          const link = inv && inv.data && (inv.data.link || inv.data.url || inv.data.invoice_url);
          const invoiceId = inv && inv.data && (inv.data.invoice_id || inv.data.id) || null;
          if (link) {
            await appendJson({ mapping: true, invoice_id: invoiceId, invoice_link: link, chat_id: chatId, created_at: new Date().toISOString() });
            await telegramSend(chatId, `${lang === 'en' ? 'Payment link:' : 'Ссылка для оплаты:'} ${link}`);
            await telegramSend(OPERATOR_CHAT, `🆕 Новый заказ (инвойс создан)\nPlan: ${name}\nAmount: ${amount} USDT\nInvoice: ${invoiceId||'N/A'}`);
          } else { await telegramSend(chatId, 'Ошибка создания инвойса.'); }
        } catch (e) { console.error('create invoice error', e); await telegramSend(chatId, 'Ошибка создания инвойса.'); }
      }
    }
  } catch (e) { console.error('telegram handler error', e); }
});

app.post('/cryptocloud', async (req, res) => {
  try {
    const raw = JSON.stringify(req.body || {});
    const sig = (req.headers['x-signature'] || req.headers['signature'] || req.headers['x-cc-signature'] || '').toString();
    const payload = req.body || {};
    if (!payload.shop_id || payload.shop_id !== SHOP_ID) { res.status(400).send('invalid shop'); return; }
    if (!verifySignature(CRYPTO_SECRET, raw, sig)) { await telegramSend(OPERATOR_CHAT, `⚠️ Invalid signature on CryptoCloud webhook. Payload: ${raw}`); res.status(403).send('invalid signature'); return; }
    const status = (payload.status || payload.payment_status || '').toString().toLowerCase();
    const invoiceId = payload.invoice_id || payload.id || null;
    const externalId = payload.external_id || payload.order_id || payload.externalId || null;
    try { const r = await fetch(JSON_URL, { headers: { 'apiKey': JSON_KEY } }); let arr = []; if (r.ok) arr = await r.json(); if (!Array.isArray(arr)) arr = arr? [arr] : []; const exists = arr.find(x => x.invoice_id && (x.invoice_id==invoiceId) && x.processed); if (exists) { res.send('duplicate'); return; } } catch(e) { console.error('dedupe check error', e); }
    if (status === 'paid') { const verified = await verifyInvoice(invoiceId); const record = { invoice_id: invoiceId, order_id: externalId, amount: payload.amount || payload.sum || 0, currency: payload.currency || 'USDT', raw: payload, processed: true, received_at: new Date().toISOString() }; await appendJson(record); await telegramSend(OPERATOR_CHAT, `💸 *Оплата получена*\nOrder: ${externalId||invoiceId}\nAmount: ${record.amount} ${record.currency}\nInvoice: ${invoiceId}`); try { const r2 = await fetch(JSON_URL, { headers: { 'apiKey': JSON_KEY } }); if (r2.ok) { const arr2 = await r2.json(); if (Array.isArray(arr2)) { const mapping = arr2.reverse().find(x => x.invoice_id && x.invoice_id==invoiceId && x.chat_id); if (mapping && mapping.chat_id) { await telegramSend(mapping.chat_id, `✅ Оплата получена. Ваш заказ в обработке. ID: ${externalId||invoiceId}`); } } } } catch (e) { console.error('notify client error', e); } }
    res.send('ok');
  } catch (e) { console.error('cryptocloud handler error', e); res.status(500).send('error'); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CallFox server running on port ${PORT}`));
