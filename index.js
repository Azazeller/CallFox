import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

const CRYPTOCLOUD_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP = process.env.CRYPTOCLOUD_SHOP_ID;

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/* ─────────────────────────────────────────────── */
async function setWebhook() {
  try {
    await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
    console.log("Webhook установлен:", WEBHOOK_URL);
  } catch (err) {
    console.error("Ошибка установки webhook:", err.response?.data || err.message);
  }
}

/* ─────────────────────────────────────────────── */
async function sendMessage(chatId, text, markup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };

    if (markup) payload.reply_markup = markup;

    const res = await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
    return res.data;
  } catch (e) {
    console.log("sendMessage error:", e.response?.data || e.message);
  }
}

/* ─────────────────────────────────────────────── */
function getTariffKeyboard() {
  return {
    keyboard: [
      [{ text: "MINI — $15" }],
      [{ text: "BASIC — $49" }],
      [{ text: "EXTENDED — $199" }],
      [{ text: "INDIVIDUAL" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

/* ─────────────────────────────────────────────── */
async function createCryptoInvoice(amount, orderId) {
  try {
    const response = await axios.post(
      "https://api.cryptocloud.plus/v2/invoice/create",
      {
        shop_id: CRYPTOCLOUD_SHOP,
        amount: amount,
        currency: "USD",
        order_id: orderId,
      },
      {
        headers: {
          Authorization: `Bearer ${CRYPTOCLOUD_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (err) {
    console.error("Invoice error:", err.response?.data || err.message);
    return null;
  }
}

/* ─────────────────────────────────────────────── */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  if (!update.message) return;

  const msg = update.message;
  const text = msg.text;
  const userId = msg.chat.id;

  await sendMessage(
    ADMIN_ID,
    `📩 <b>Новый пользователь:</b> ${userId}\nСообщение: ${text}`
  );

  if (text === "/start") {
    await sendMessage(
      userId,
      "Выберите тариф OSINT-проверки:",
      getTariffKeyboard()
    );
    return;
  }

  const tariffs = {
    "MINI — $15": 15,
    "BASIC — $49": 49,
    "EXTENDED — $199": 199,
    "INDIVIDUAL": 99,
  };

  if (tariffs[text]) {
    const price = tariffs[text];
    const orderId = `${userId}_${Date.now()}`;

    const invoice = await createCryptoInvoice(price, orderId);

    if (!invoice?.result?.url) {
      await sendMessage(userId, "Ошибка создания платежа. Попробуйте позже.");
      return;
    }

    await sendMessage(
      userId,
      `Ваш заказ создан.\n\n💵 Сумма: <b>${price}$</b>\n\nПерейдите к оплате:\n${invoice.result.url}`
    );

    await sendMessage(
      ADMIN_ID,
      `🧾 Новый заказ:\nПользователь: ${userId}\nТариф: ${text}\nСумма: ${price}$`
    );

    return;
  }

  await sendMessage(userId, "Не понял команду. Напишите /start");
});

/* ─────────────────────────────────────────────── */
app.post("/cryptocloud", async (req, res) => {
  res.sendStatus(200);

  const data = req.body;

  if (data.status === "paid") {
    const orderId = data.order_id;
    const paidUser = orderId.split("_")[0];

    await sendMessage(paidUser, "💳 Ваш платёж получен! Мы начинаем работу.");
    await sendMessage(ADMIN_ID, `💰 Оплата получена!\nOrderID: ${orderId}`);
  }
});

/* ─────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await setWebhook();
});
