 import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// ---- CONFIG ----
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const BOT_API = `https://api.telegram.org/bot${TOKEN}`;

// ---- TELEGRAM WEBHOOK ----
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;

    // обычное сообщение
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text === "/start") {
        await sendMessage(
          chatId,
          `Что умеет этот бот?\n\n` +
          `📦 Выберите тариф OSINT-проверки:\n\n` +
          `🔹 MINI — $15\nБыстрая справка: соцсети, ники, упоминания.\n\n` +
          `🔹 BASIC — $49\nРасширенная проверка: соцсети, окружение, репутация.\n\n` +
          `🔹 EXTENDED — $199\nГлубокий OSINT-профиль.\n\n` +
          `🔹 INDIVIDUAL — индивидуально\nЛюбой формат OSINT-заказа.`
        );
      }

      // уведомление админу
      await sendMessage(
        ADMIN_ID,
        `▶️ Новый пользователь: ${update.message.from.id}\nСообщение: ${text}`
      );
    }

    // CryptoCloud event через Telegram webhook (если придёт)
    if (update.event) {
      await sendMessage(
        ADMIN_ID,
        `💳 CryptoCloud event:\n${JSON.stringify(update, null, 2)}`
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
});

// ---- CRYPTOCLOUD WEBHOOK ----
app.post("/cryptocloud", async (req, res) => {
  try {
    await sendMessage(
      ADMIN_ID,
      `💰 Платёж CryptoCloud:\n${JSON.stringify(req.body, null, 2)}`
    );

    res.json({ status: "ok" });
  } catch (e) {
    console.error("CryptoCloud error:", e);
    res.sendStatus(500);
  }
});

// ---- SEND MESSAGE ----
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${BOT_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    });
  } catch (e) {
    console.error("Telegram error:", e.response?.data || e);
  }
}

// ---- ROOT ----
app.get("/", (req, res) => res.send("Bot is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
