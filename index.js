import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// === ENV ===
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const CRYPTOCLOUD_API_KEY = process.env.CRYPTOCLOUD_API_KEY;
const CRYPTOCLOUD_SHOP_ID = process.env.CRYPTOCLOUD_SHOP_ID;
const ADMIN_ID = process.env.ADMIN_ID;

// === TELEGRAM SEND ===
async function sendMessage(chatId, text, keyboard = null) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
        });
    } catch (err) {
        console.error("Telegram sendMessage error:", err?.response?.data || err.message);
    }
}

// === CRYPTOCLOUD: CREATE INVOICE ===
async function createInvoice(amount, tariffName, userId) {
    try {
        const response = await axios.post(
            "https://api.cryptocloud.plus/v1/invoice/create",
            {
                shop_id: CRYPTOCLOUD_SHOP_ID,
                amount,
                currency: "USD",
                order_id: `${userId}_${Date.now()}`,
                description: `OSINT: ${tariffName}`
            },
            {
                headers: {
                    "Authorization": `Token ${CRYPTOCLOUD_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );
        return response.data;
    } catch (err) {
        console.error("Create invoice error:", err?.response?.data || err.message);
        return null;
    }
}

// === TELEGRAM WEBHOOK ===
app.post("/telegram-webhook", async (req, res) => {
    res.sendStatus(200);

    try {
        const body = req.body;

        // === Normal message ===
        if (body.message) {
            const chatId = body.message.chat.id;
            const text = body.message.text;

            if (text === "/start") {
                await sendMessage(chatId, 
                    "<b>Что умеет этот бот?</b>\n" +
                    "📦 Выберите тариф OSINT-проверки:\n\n" +
                    "🔹 MINI — $15\n" +
                    "Быстрая справка: соцсети, ники, упоминания, базовый цифровой след.\n\n" +
                    "🔹 BASIC — $49\n" +
                    "Расширенная проверка: соцсети, окружение, репутация, открытые реестры.\n\n" +
                    "🔹 EXTENDED — $199\n" +
                    "Глубокий OSINT-профайл: связи, риски, даталейки, аналитика.\n\n" +
                    "🔹 INDIVIDUAL — индивидуально\n" +
                    "Поиск конкретной информации любого формата."
                , [
                    [
                        { text: "MINI — $15", callback_data: "buy_mini" }
                    ],
                    [
                        { text: "BASIC — $49", callback_data: "buy_basic" }
                    ],
                    [
                        { text: "EXTENDED — $199", callback_data: "buy_extended" }
                    ],
                    [
                        { text: "INDIVIDUAL — заказать", callback_data: "buy_individual" }
                    ]
                ]);
            }

            return;
        }

        // === Callback button pressed ===
        if (body.callback_query) {
            const chatId = body.callback_query.message.chat.id;
            const data = body.callback_query.data;

            const tariffs = {
                buy_mini:  { price: 15,  name: "MINI" },
                buy_basic: { price: 49,  name: "BASIC" },
                buy_extended: { price: 199, name: "EXTENDED" },
                buy_individual: { price: 0, name: "INDIVIDUAL" }
            };

            if (data === "buy_individual") {
                await sendMessage(chatId, "Напишите ваш запрос, и оператор свяжется с вами.");
                return;
            }

            const tariff = tariffs[data];
            if (!tariff) return;

            const invoice = await createInvoice(tariff.price, tariff.name, chatId);

            if (!invoice || !invoice.pay_url) {
                await sendMessage(chatId, "❌ Ошибка создания платежа. Попробуйте позже.");
                return;
            }

            await sendMessage(
                chatId,
                `Ваш заказ <b>${tariff.name}</b> создан.\n` +
                `Сумма: <b>$${tariff.price}</b>\n\n` +
                `Оплатите по ссылке:\n${invoice.pay_url}`
            );

            await sendMessage(ADMIN_ID, `🔔 Новый заказ: ${tariff.name} ($${tariff.price})\nОт пользователя: ${chatId}`);
        }

    } catch (err) {
        console.error("Telegram webhook error:", err);
    }
});

// === CRYPTOCLOUD WEBHOOK ===
app.post("/webhook", async (req, res) => {
    res.sendStatus(200);

    try {
        const { event, invoice } = req.body;

        if (event === "invoice.paid") {
            const chatId = invoice.order_id.split("_")[0];

            await sendMessage(
                chatId,
                "💳 Платёж успешно получен!\nВаш OSINT-заказ принят в работу."
            );

            await sendMessage(
                ADMIN_ID,
                `💰 Клиент ${chatId} успешно оплатил заказ ${invoice.amount} USD`
            );
        }
    } catch (err) {
        console.error("CryptoCloud webhook error:", err);
    }
});

// === ROOT PAGE ===
app.get("/", (req, res) => {
    res.send("CallFox bot is running");
});

// === START SERVER ===
app.listen(3000, () => console.log("Server running on port 3000"));
