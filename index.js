import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;

const TELEGRAM_URL = `https://api.telegram.org/bot${TOKEN}`;


// ========== SEND MESSAGE ==========
async function sendMessage(chatId, text, markup = null) {
    try {
        const payload = { chat_id: chatId, text };

        if (markup) payload.reply_markup = markup;

        const res = await axios.post(`${TELEGRAM_URL}/sendMessage`, payload);
        return res.data;
    } catch (err) {
        console.log("sendMessage error:", err.response?.data);
    }
}


// ========== CREATE CRYPTOCLOUD INVOICE ==========
async function createInvoice(amount, userId) {
    try {
        const res = await axios.post(
            "https://api.cryptocloud.plus/v2/invoice/create",
            {
                shop_id: CRYPTOCLOUD_SHOP_ID,
                amount: amount,
                order_id: `${userId}_${Date.now()}`,
            },
            {
                headers: {
                    Authorization: CRYPTOCLOUD_API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        return res.data;
    } catch (e) {
        console.log("Invoice error:", e.response?.data);
        return null;
    }
}


// ========== WEBHOOK HANDLER ==========
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    const update = req.body;

    if (!update.message) return;

    const chatId = update.message.chat.id;
    const text = update.message.text || "";

    // Сообщение админу о новом пользователе
    if (chatId !== Number(ADMIN_CHAT_ID)) {
        await sendMessage(
            ADMIN_CHAT_ID,
            `📩 Новый пользователь: ${chatId}\nСообщение: ${text}`
        );
    }


    // КОМАНДА /start
    if (text === "/start") {
        await sendMessage(chatId,
            "Что умеет этот бот?\n\n" +
            "📦 Выберите тариф OSINT-проверки:",
            {
                keyboard: [
                    [{ text: "MINI — $15" }],
                    [{ text: "BASIC — $49" }],
                    [{ text: "EXTENDED — $199" }],
                    [{ text: "INDIVIDUAL — договоримся" }]
                ],
                resize_keyboard: true
            }
        );
        return;
    }

    // TARIFS
    const prices = {
        "MINI — $15": 15,
        "BASIC — $49": 49,
        "EXTENDED — $199": 199,
        "INDIVIDUAL — договоримся": 0
    };

    if (prices[text] !== undefined) {
        const amount = prices[text];

        if (amount === 0) {
            await sendMessage(chatId, "Напишите ваш запрос, и я оценю стоимость 🔍");
            return;
        }

        const invoice = await createInvoice(amount, chatId);

        if (invoice?.status === "success") {
            await sendMessage(
                chatId,
                `💳 Для оплаты перейдите по ссылке:\n${invoice.pay_url}`
            );
        } else {
            await sendMessage(chatId, "Ошибка при создании счета.");
        }

        return;
    }
});


// ========== RUN SERVER ==========
app.listen(process.env.PORT, () => {
    console.log("Server running on port", process.env.PORT);
});
