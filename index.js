import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------
// CONFIG
// ----------------------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;
const CRYPTOCLOUD_WEBHOOK_SECRET = process.env.CRYPTOCLOUD_WEBHOOK_SECRET;

const SERVER_URL = process.env.WEBHOOK_URL.replace("/webhook", "");

// ----------------------------
// SEND MESSAGE
// ----------------------------
async function sendMessage(chatId, text, keyboard = null) {
    try {
        await axios.post(`${TG}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            reply_markup: keyboard
        });
    } catch (err) {
        console.log("sendMessage error:", err.response?.data || err.message);
    }
}

// ----------------------------
// TARIFFS
// ----------------------------
const tariffs = {
    mini: { amount: 15, label: "MINI" },
    basic: { amount: 49, label: "BASIC" },
    extended: { amount: 199, label: "EXTENDED" },
};

// ----------------------------
// CREATE INVOICE IN CRYPTOCLOUD
// ----------------------------
async function createInvoice(amount, orderId) {
    try {
        const res = await axios.post(
            "https://api.cryptocloud.plus/v2/invoice/create",
            {
                shop_id: CRYPTOCLOUD_SHOP_ID,
                amount: amount,
                currency: "USD",
                order_id: orderId,
                webhook_url: `${SERVER_URL}/cryptocloud`,
            },
            {
                headers: {
                    Authorization: `Token ${CRYPTOCLOUD_API_KEY}`,
                },
            }
        );

        return res.data.data.pay_url;
    } catch (err) {
        console.log("Invoice error:", err.response?.data || err.message);
        return null;
    }
}

// ----------------------------
// TELEGRAM WEBHOOK
// ----------------------------
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    const update = req.body;

    // TEXT MESSAGE
    if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;

        // START
        if (text === "/start") {
            return sendMessage(
                chatId,
                `<b>Выберите тариф OSINT-проверки:</b>`,
                {
                    inline_keyboard: [
                        [{ text: "💳 MINI — $15", callback_data: "pay_mini" }],
                        [{ text: "💳 BASIC — $49", callback_data: "pay_basic" }],
                        [{ text: "💳 EXTENDED — $199", callback_data: "pay_extended" }],
                        [{ text: "💬 INDIVIDUAL", url: "https://t.me/CALLFOX" }],
                    ]
                }
            );
        }

        return;
    }

    // BUTTON CLICK
    if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;

        if (data.startsWith("pay_")) {
            const key = data.replace("pay_", "");
            const tariff = tariffs[key];

            const orderId = "ORDER_" + Date.now();
            const payUrl = await createInvoice(tariff.amount, orderId);

            if (!payUrl) {
                return sendMessage(chatId, "❌ Ошибка сервера. Попробуйте позже.");
            }

            await sendMessage(
                chatId,
                `💳 <b>${tariff.label} — $${tariff.amount}</b>\n\nПерейдите по ссылке для оплаты:\n${payUrl}`
            );

            await sendMessage(
                ADMIN_ID,
                `🆕 <b>Заказ:</b>\nТариф: ${tariff.label}\nПользователь: ${chatId}\nOrderID: ${orderId}`
            );
        }
    }
});

// ----------------------------
// CRYPTOCLOUD WEBHOOK
// ----------------------------
app.post("/cryptocloud", async (req, res) => {
    res.sendStatus(200);

    const payload = req.body;

    if (!payload.event) return;

    // Проверка секрета (рекомендуется CryptoCloud)
    if (CRYPTOCLOUD_WEBHOOK_SECRET && payload.secret !== CRYPTOCLOUD_WEBHOOK_SECRET) {
        console.log("⚠️ Wrong secret, request ignored");
        return;
    }

    if (payload.event === "invoice_paid") {
        await sendMessage(
            ADMIN_ID,
            `💰 <b>Оплата получена!</b>\nOrderID: ${payload.order_id}\nAmount: ${payload.amount} USD`
        );
    }
});

// ----------------------------
// ROOT PAGE
// ----------------------------
app.get("/", (req, res) => {
    res.send("CallFox bot is running with CryptoCloud payments.");
});

// ----------------------------
// START SERVER
// ----------------------------
app.listen(3000, () => {
    console.log("Server started on port 3000");
});
