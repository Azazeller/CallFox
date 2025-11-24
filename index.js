 import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================
// CONFIG
// ============================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // 399248837
const CRYPTO_SECRET = process.env.CRYPTO_SECRET; // from CryptoCloud
const SERVER_URL = process.env.SERVER_URL; // https://callfox.onrender.com

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ============================
// TELEGRAM SEND MESSAGE
// ============================
async function sendMessage(chatId, text, keyboard = null) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            reply_markup: keyboard
        });
    } catch (err) {
        console.log("Telegram sendMessage error:", err.response?.data || err.message);
    }
}

// ============================
// START MESSAGE
// ============================
async function sendStartMessage(chatId) {
    const text = `
<b>Что умеет этот бот?</b>

📦 Выберите тариф OSINT-проверки:

🔹 <b>MINI — $15</b>
Быстрая справка: соцсети, ники, упоминания, базовый цифровой след.

🔹 <b>BASIC — $49</b>
Расширенная проверка: соцсети, окружение, репутация, открытые реестры.

🔹 <b>EXTENDED — $199</b>
Глубокий OSINT-профиль: связи, окружение, риски, дата-лейки, аналитика.

🔹 <b>INDIVIDUAL — индивидуально</b>
Поиск конкретной информации под запрос клиента, любого формата.

🛒 Вы можете сразу оформить заказ через раздел «Корзина»
    `;

    const keyboard = {
        inline_keyboard: [
            [{ text: "💳 MINI — $15", callback_data: "pay_mini" }],
            [{ text: "💳 BASIC — $49", callback_data: "pay_basic" }],
            [{ text: "💳 EXTENDED — $199", callback_data: "pay_extended" }],
            [{ text: "💳 INDIVIDUAL — договорная", callback_data: "pay_individual" }]
        ]
    };

    await sendMessage(chatId, text, keyboard);
}

// ============================
// TELEGRAM WEBHOOK
// ============================
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    try {
        const body = req.body;

        // TEXT MESSAGE
        if (body.message) {
            const chatId = body.message.chat.id;
            const text = body.message.text;

            if (text === "/start") {
                return sendStartMessage(chatId);
            }

            return;
        }

        // BUTTON PRESS (callback)
        if (body.callback_query) {
            const chatId = body.callback_query.message.chat.id;
            const data = body.callback_query.data;

            // PRICE MAP
            const prices = {
                pay_mini: 15,
                pay_basic: 49,
                pay_extended: 199,
                pay_individual: 0
            };

            const amount = prices[data];

            if (amount === 0) {
                sendMessage(chatId, "💬 Напишите ваш запрос, и мы рассчитаем стоимость индивидуально.");
                return;
            }

            // Create CryptoCloud invoice
            const invoice = await axios.post(
                "https://api.cryptocloud.plus/v2/invoice/create",
                {
                    shop_id: process.env.CRYPTO_SHOP_ID,
                    amount,
                    currency: "USD",
                    order_id: "ORDER" + Date.now(),
                    email: "none",
                    webhook_url: `${SERVER_URL}/cryptocloud`
                },
                {
                    headers: { Authorization: `Token ${CRYPTO_SECRET}` }
                }
            );

            const payUrl = invoice.data?.data?.pay_url;

            await sendMessage(chatId, `💳 <b>Ваш счёт на оплату:</b>\n${payUrl}`);
        }
    } catch (err) {
        console.log("Webhook error:", err);
    }
});

// ============================
// CRYPTOCLOUD WEBHOOK
// ============================
app.post("/cryptocloud", async (req, res) => {
    res.sendStatus(200);

    try {
        const data = req.body;

        // Important: CryptoCloud sends event: "invoice_paid"
        if (data.event === "invoice_paid") {
            await sendMessage(
                ADMIN_CHAT_ID,
                `💰 Оплата получена!\nOrder: ${data.order_id}\nAmount: ${data.amount} USD`
            );
        }
    } catch (e) {
        console.log("CryptoCloud webhook error:", e);
    }
});

// ============================
// ROOT
// ============================
app.get("/", (req, res) => {
    res.send("CallFox bot is running.");
});

// ============================
// SERVER
// ============================
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
