import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Telegram API URL
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Логируем загрузку
console.log("Bot is starting…");

// -------------------------
// УСТАНОВКА WEBHOOK
// -------------------------
async function setWebhook() {
    try {
        const url = `${TG}/setWebhook?url=${WEBHOOK_URL}`;
        const res = await axios.get(url);
        console.log("Webhook set result:", res.data);
    } catch (err) {
        console.error("Webhook error:", err.response?.data || err.message);
    }
}

setWebhook();

// -------------------------
// ОТПРАВКА СООБЩЕНИЯ
// -------------------------
async function sendMessage(chatId, text) {
    try {
        await axios.post(`${TG}/sendMessage`, {
            chat_id: chatId,
            text: text
        });
    } catch (err) {
        console.error("sendMessage error:", err.response?.data || err.message);
    }
}

// -------------------------
// ОСНОВНОЙ WEBHOOK
// -------------------------
app.post("/webhook", async (req, res) => {
    res.sendStatus(200); // Telegram должен получить 200 OK сразу

    if (!req.body.message) return;

    const msg = req.body.message;
    const chatId = msg.chat.id;
    const text = msg.text || "";

    // Отправляем админу уведомление о новом сообщении
    await sendMessage(
        ADMIN_ID,
        `📩 Новый пользователь: ${chatId}\nСообщение: ${text}`
    );

    // Обработка команд
    if (text === "/start") {
        await sendMessage(
            chatId,
            `Выберите тариф OSINT-проверки:

🔹 MINI — $15
Быстрая справка: соцсети, ники, упоминания, базовый цифровой след.

🔹 BASIC — $49
Расширенная проверка: соцсети, окружение, репутация, открытые реестры.

🔹 EXTENDED — $199
Глубокий OSINT-профиль: связи, окружение, риски, даталейки, аналитика.

🔹 INDIVIDUAL — индивидуально
Поиск информации под ваш запрос.

Чтобы оформить заказ — напишите нужный тариф.`
        );
        return;
    }

    // Ответ пользователю (чтобы бот не молчал)
    await sendMessage(chatId, "Ваше сообщение получено. Ожидайте ответа.");
});

// -------------------------
// СТАРТ СЕРВЕРА
// -------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
