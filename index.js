import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();
const app = express();
app.use(bodyParser.json());
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const BOT_API = `https://api.telegram.org/bot${TOKEN}`;
// === ХЭНДЛЕР ТЕЛЕГРАМ ВЕБХУКА ===
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    // если обычное текстовое сообщение
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      if (text === "/start") {
        await sendMessage(
          chatId,
          `Что умеет этот бот?\n\n` +
          `📦 Выберите тариф OSINT-проверки:\n\n` +
          `🔹 MINI — $15\nБыстрая справка: соцсети, ники, упоминания, базовый цифровой след.\n\n` +
          `🔹 BASIC — $49\nРасширенная проверка: соцсети, окружение, репутация.\n\n` +
          `🔹 EXTENDED — $199\nГлубокий OSINT-профиль: связи, окружение, риски, аналитика.\n\n` +
          `🔹 INDIVIDUAL — индивидуально\nПоиск конкретной информации под запрос клиента.`
        );
      }
      // Уведомление админу о новом пользователе
      await sendMessage(
        ADMIN_ID,
        `▶️ Новый пользователь: ${update.message.from.id}\nСообщение: ${text}`
      );
    }
    // если пришёл постбек от CryptoCloud
    if (update.event) {
      await sendMessage(ADMIN_ID, `💳 CryptoCloud event:\n${JSON.stringify(update)}`);
    }
    res.sendStatus(200); // Telegram должен получить OK
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
});
// === КРИПТОКЛАУД ВЕБХУК ===
app.post("/cryptocloud", async (req, res) => {
  try {
    const data = req.body;
    await sendMessage(
      ADMIN_ID,
      `💰 Платёж CryptoCloud:\n${JSON.stringify(data, null, 2)}`
    );
    res.json({ status: "ok" });
  } catch (err) {
    console.error("CryptoCloud error:", err);
    res.sendStatus(500);
  }
});
// === ФУНКЦИЯ ОТПРАВКИ СООБЩЕНИЙ ===
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${BOT_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.error("Telegram sendMessage error:", err.response?.data || err);
  }
}
// === СТАРТ СЕРВЕРА ===
app.get("/", (req, res) => res.send("Bot is running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

