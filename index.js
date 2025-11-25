// index.js — manual-pay workflow (USDT TRC20)
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import fs from "fs";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const TRC20_ADDRESS = process.env.TRC20_ADDRESS;
const BASE_URL = process.env.BASE_URL;
const AUTO_CHECK = (process.env.AUTO_CHECK === "true");
const TRON_API_URL = process.env.TRON_API_URL || ""; // e.g. https://apilist.tronscan.org
const TRC20_CONTRACT = process.env.TRC20_CONTRACT_ADDRESS || ""; // required for token event checks

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ORDERS_FILE = "./orders.json";

// --- helpers: load/save orders
function loadOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const raw = fs.readFileSync(ORDERS_FILE, "utf8");
      return JSON.parse(raw || "{}");
    }
    return {};
  } catch (e) {
    console.error("loadOrders err", e);
    return {};
  }
}
function saveOrders(data) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("saveOrders err", e);
  }
}
let orders = loadOrders();

// --- telegram send
async function sendMessage(chatId, text, reply_markup = null) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup,
    });
  } catch (e) {
    console.error("sendMessage err:", e.response?.data || e.message);
  }
}

// --- helper: admin inline buttons
function adminInline(orderId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Подтвердить", callback_data: `admin_confirm:${orderId}` },
        { text: "❌ Отклонить", callback_data: `admin_reject:${orderId}` }
      ]
    ]
  };
}

// --- create order helper
function createOrderObject(userId, tariffLabel, amount) {
  const orderId = `${userId}_${Date.now()}`;
  const uniqueFraction = Math.floor(Math.random() * 90) + 10; // 10..99 cents to make unique
  // For TRC20 use decimals — include fractional USDT (e.g. 15.0X)
  const finalAmount = Number(`${amount}.${uniqueFraction}`);
  return {
    id: orderId,
    userId,
    tariff: tariffLabel,
    amount: finalAmount,
    address: TRC20_ADDRESS,
    status: "pending",
    txid: null,
    createdAt: Date.now()
  };
}

// --- check transaction via TronScan API (simple approach)
// This is optional and depends on TRON_API_URL and contract address specified
async function checkTxOnTron(txid, expectedToAddress, expectedAmount) {
  if (!TRON_API_URL) return { ok: false, reason: "no_tron_api" };
  try {
    // Try Tronscan token transfers endpoint
    // Example: https://apilist.tronscan.org/api/tokentransfers?transaction=TXID
    const url = `${TRON_API_URL}/api/tokentransfers?transaction=${txid}`;
    const r = await axios.get(url, { timeout: 10000 });
    const data = r.data;
    if (!data || !data.data) {
      return { ok: false, reason: "no_data" };
    }
    // find matching transfer to expectedToAddress with expectedAmount (allow small rounding)
    const matches = data.data.filter(item => {
      // item.toAddress may be hex or base58; normalize by lower case
      const toAddr = (item.toAddress || "").toLowerCase();
      const expected = (expectedToAddress || "").toLowerCase();
      // amount field depends on explorer; TRC20 amount usually in smallest unit, so adjust by decimals
      const tokenDecimal = item.tokenDecimal ? Number(item.tokenDecimal) : 6;
      const tokenAmount = item.amount ? Number(item.amount) / Math.pow(10, tokenDecimal) : 0;
      const diff = Math.abs(tokenAmount - expectedAmount);
      return toAddr.includes(expected) && diff < 0.0001;
    });
    if (matches.length > 0) {
      return { ok: true, matches };
    } else {
      return { ok: false, reason: "no_match" };
    }
  } catch (e) {
    console.error("checkTxOnTron error", e.response?.data || e.message);
    return { ok: false, reason: "error", error: e.message };
  }
}

// --- handle /start and menu
function tariffKeyboard() {
  return {
    keyboard: [
      [{ text: "MINI — $15" }],
      [{ text: "BASIC — $49" }],
      [{ text: "EXTENDED — $199" }],
      [{ text: "INDIVIDUAL" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

// --- Telegram webhook
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const update = req.body;
  if (!update.message) return;
  const msg = update.message;
  const text = (msg.text || "").trim();
  const userId = msg.chat.id;

  // admin command: list orders
  if (String(userId) === String(ADMIN_ID) && text === "/orders") {
    const all = Object.values(orders);
    let reply = "Заказы:\n";
    all.forEach(o => {
      reply += `\n${o.id} — ${o.tariff} — ${o.amount} — ${o.status}`;
    });
    await sendMessage(ADMIN_ID, reply);
    return;
  }

  if (text === "/start") {
    await sendMessage(userId, "Выберите тариф:", tariffKeyboard());
    return;
  }

  // when user sends /paid <TXID>
  if (text.toLowerCase().startsWith("/paid")) {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      await sendMessage(userId, "Использование: /paid <TXID>");
      return;
    }
    const txid = parts[1].trim();
    // find pending order for user (most recent)
    const userOrders = Object.values(orders).filter(o => o.userId === userId && o.status === "pending");
    if (userOrders.length === 0) {
      await sendMessage(userId, "У вас нет активных заказов. Сначала выберите тариф через /start.");
      return;
    }
    // pick last pending
    const order = userOrders.sort((a,b)=>b.createdAt-a.createdAt)[0];
    order.txid = txid;
    order.status = "checking";
    orders[order.id] = order;
    saveOrders(orders);

    await sendMessage(userId, `TXID получен: ${txid}. Ожидайте подтверждения.`);

    // If AUTO_CHECK enabled, try to verify automatically
    if (AUTO_CHECK) {
      const resCheck = await checkTxOnTron(txid, order.address, order.amount);
      if (resCheck.ok) {
        order.status = "paid";
        saveOrders(orders);
        await sendMessage(userId, "💳 Платёж подтверждён автоматически. Начинаем работу.");
        await sendMessage(ADMIN_ID, `Авто-подтверждён: ${order.id} by ${userId}, tx: ${txid}`);
      } else {
        order.status = "pending_admin";
        saveOrders(orders);
        await sendMessage(ADMIN_ID, `Платёж требует проверки: ${order.id}\nUser: ${userId}\nAmount: ${order.amount}\nTX: ${txid}`, adminInline(order.id));
        await sendMessage(userId, "Платёж получен, ожидается ручная проверка администратора.");
      }
    } else {
      // notify admin with approve/reject inline buttons
      await sendMessage(ADMIN_ID, `Новый платёж для проверки: ${order.id}\nUser: ${userId}\nAmount: ${order.amount}\nTX: ${txid}`, adminInline(order.id));
      await sendMessage(userId, "Платёж получен, ожидайте подтверждения администратора.");
    }
    return;
  }

  // handle tariff selection by text match
  const tariffs = { "MINI — $15": 15, "BASIC — $49": 49, "EXTENDED — $199": 199, "INDIVIDUAL": 99 };
  if (tariffs[text]) {
    const amt = tariffs[text];
    const orderObj = createOrderObject(userId, text, amt);
    orders[orderObj.id] = orderObj;
    saveOrders(orders);

    const msgTxt = `Заказ создан: ${orderObj.id}\nТариф: ${text}\nСумма для оплаты (USDT TRC20): ${orderObj.amount}\nАдрес для оплаты: ${TRC20_ADDRESS}\n\nПосле оплаты пришлите TXID командой:\n/paid <TXID>\n\nВажно: оплатите ровно указанную сумму (включая дробную часть).`;
    await sendMessage(userId, msgTxt);
    await sendMessage(ADMIN_ID, `Новый заказ: ${orderObj.id} от ${userId}, сумма ${orderObj.amount}`);
    return;
  }

  // default
  await sendMessage(userId, "Не распознал команду. Напишите /start");
});

// --- callback for admin buttons
app.post("/callback", async (req, res) => {
  // BotMother-style callback handling not used — Telegram uses callback_query in webhook payload.
  res.sendStatus(200);
});

// handle callback_query via webhook update (we already receive update via /webhook,
// so process update.callback_query inside /webhook route — but simpler: create dedicated endpoint)
app.post("/webhook_callback", async (req, res) => {
  // If your webhook receives callback_query in /webhook, you can process it there.
  res.sendStatus(200);
});

// Note: Many Telegram setups deliver callback_query inside the same /webhook payload.
// We'll add a simple endpoint to process inline button callbacks if called (some setups).
// But primary processing of callback_query should be placed inside /webhook handler above
// — for brevity, we process via separate endpoint below if called.

app.post("/tg-callback-query", async (req, res) => {
  // Expect payload: { data: "admin_confirm:ORDERID", from: { id: ADMIN_ID } }
  res.sendStatus(200);
});

// --- To handle callback_query properly, add processing inside /webhook where update.callback_query exists.
// For clarity, we add small middleware listening to POST /webhook-callback-telegram if your infra posts there.

// --- simple admin REST endpoints to approve/reject (if you prefer manual HTTP)
app.post("/admin/approve", async (req, res) => {
  const { orderId } = req.body;
  const order = orders[orderId];
  if (!order) return res.status(404).json({ ok: false });
  order.status = "paid";
  saveOrders(orders);
  await sendMessage(order.userId, "💳 Платёж подтверждён администратором. Начинаем работу.");
  await sendMessage(ADMIN_ID, `Ручное подтверждение: ${orderId}`);
  return res.json({ ok: true });
});
app.post("/admin/reject", async (req, res) => {
  const { orderId, reason } = req.body;
  const order = orders[orderId];
  if (!order) return res.status(404).json({ ok: false });
  order.status = "rejected";
  saveOrders(orders);
  await sendMessage(order.userId, `Платёж отклонён администратором. Причина: ${reason || "не указана"}`);
  await sendMessage(ADMIN_ID, `Отклонено: ${orderId}`);
  return res.json({ ok: true });
});

// --- Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
