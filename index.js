import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const BASE_URL = process.env.BASE_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/* ============================================================
   УСТАНОВКА WEBHOOK
============================================================ */
async function setWebhook() {
  try {
    const hookUrl = `${BASE_URL}/webhook`;
    await axios.get(`${TELEGRAM_API}/setWebhook?url=${hookUrl}`);
    console.log("Webhook установлен:", hookUrl);
  } catch (err) {
    console.error("Ошибка установки webhook:", err.response?.data || err.message);
  }
}

/* ============================================================
   ОТПРАВКА СООБЩЕНИЙ
============================================================ */
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

/* ============================================================
   КНОПКИ ТАРИФОВ
============================================================ */
function getMainKeyboard() {
  return {
    keyboard: [
      [{ text: "MINI — $15" }],
      [{ text: "BASIC — $49" }],
      [{ text: "EXTENDED — $199" }],
      [{ text: "INDIVIDUAL" }],
      [{ text: "Связаться с оператором" }]
    ],
    resize_keyboard: true
  };
}

/* ============================================================
   TELEGRAM WEBHOOK
============================================================ */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  if (!update.message) return;

  const msg = update.message;
  const text = msg.text;
  const userId = msg.chat.id;

  /* ——— Уведомление администратора ——— */
  await sendMessage(
    ADMIN_ID,
    `📩 <b>Сообщение от пользователя:</b>\nID: ${userId}\nТекст: ${text}`
  );

  /* ——— /start ——— */
  if (text === "/start") {
    await sendMessage(userId, "Выберите тариф:", getMainKeyboard());
    return;
  }

  /* ——— Связаться с оператором ——— */
  if (text === "Связаться с оператором") {
    await sendMessage(userId, "Оператор: @CALLFOX");
    return;
  }

  /* ——— INDIVIDUAL ——— */
  if (text === "INDIVIDUAL") {
    await sendMessage(userId, "Для индивидуального тарифа напишите: @CALLFOX");
    return;
  }

  /* ——— ТАРИФЫ ——— */
  const tariffs = {
    "MINI — $15": { price: 15 },
    "BASIC — $49": { price: 49 },
    "EXTENDED — $199": { price: 199 }
  };

  if (tariffs[text]) {
    await sendMessage(
      userId,
      `💳 <b>Адрес для оплаты (USDT TRC20):</b>\n<code>TDUknnJcPscxS3H9reMnzcFtKK958UAF3b</code>\n\nПосле оплаты нажмите кнопку ниже.`,
      {
        keyboard: [
          [{ text: "Подтвердить оплату" }],
          [{ text: "Связаться с оператором" }]
        ],
        resize_keyboard: true
      }
    );

    return;
  }

  /* ——— ПОДТВЕРЖДЕНИЕ ОПЛАТЫ ——— */
  if (text === "Подтвердить оплату") {
    await sendMessage(userId, "Введите хеш транзакции:");
    return;
  }

  /* ——— ОБРАБОТКА ХЕША ——— */
  if (text.length >= 10 && text.match(/[A-Za-z0-9]/)) {
    await sendMessage(userId, "Ваш хеш отправлен на проверку. Ожидайте.");

    await sendMessage(
      ADMIN_ID,
      `💰 <b>НОВАЯ ОПЛАТА</b>\nПользователь: ${userId}\nХеш: <code>${text}</code>`
    );
    return;
  }

  /* ——— НЕИЗВЕСТНАЯ КОМАНДА ——— */
  await sendMessage(userId, "Не понял запрос. Напишите /start");
});

/* ============================================================
   ЗАПУСК СЕРВЕРА
============================================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await setWebhook();
});
