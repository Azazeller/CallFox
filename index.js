import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
const app = express();
app.use(express.json());
app.use(bodyParser.json());
// ==== 🔐 CONFIG ====
const BOT_TOKEN = "8528405495:AAFx4wvUN9MuO868q8JEGjuW-LksfgmKzMY";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = 399248837;
const CRYPTOCLOUD_API_KEY = "9a6add0e-68d5-4702-b8c6-c77972dfad72";
// ==== ТАРИФЫ ====
const TARIFFS = {
    MINI: { price: 15, name: "MINI — $15" },
    BASIC: { price: 49, name: "BASIC — $49" },
    EXTENDED: { price: 199, name: "EXTENDED — $199" },
    INDIVIDUAL: { price: 0, name: "INDIVIDUAL — индивидуально" }
};
// ========== 🔔 ОТПРАВКА СООБЩЕНИЯ ==========
async function sendMessage(chatId, text, keyboard = null) {
    return axios.post(`${API}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard
    }).catch(e => console.log("Telegram sendMessage error:", e.response?.data));
}
// ========== 🔗 Создание платежа ==========
async function createInvoice(amount, tariffName) {
    const response = await axios.post(
        "https://api.cryptocloud.plus/v1/invoice/create",
        {
            amount,
            currency: "USD",
            lifetime: 7200,
            description: tariffName
        },
        {
            headers: { Authorization: CRYPTOCLOUD_API_KEY }
        }
    );
    return response.data?.result;
}
// ========== 🟢 Telegram Webhook ==========
app.post("/webhook", async (req, res) => {
    const update = req.body;
    try {
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            if (text === "/start") {
                return sendMessage(
                    chatId,
                    "Что умеет этот бот?\n\n" +
                    "📦 Выберите тариф OSINT-проверки:\n\n" +
                    "🔹 MINI — $15\nБыстрая справка: соцсети, ники, упоминания, цифровой след.\n\n" +
                    "🔹 BASIC — $49\nРасширенная проверка: соцсети, окружение, репутация.\n\n" +
                    "🔹 EXTENDED — $199\nГлубокий OSINT-профиль: связи, риски, аналитика.\n\n" +
                    "🔹 INDIVIDUAL — индивидуально\nПоиск конкретной информации под запрос.\n\n" +
                    "Выберите тариф:",
                    {
                        inline_keyboard: [
                            [{ text: "MINI — $15", callback_data: "buy_MINI" }],
                            [{ text: "BASIC — $49", callback_data: "buy_BASIC" }],
                            [{ text: "EXTENDED — $199", callback_data: "buy_EXT" }],
                            [{ text: "INDIVIDUAL — договоримся", callback_data: "buy_IND" }],
                        ]
                    }
                );
            }
        }
        // ==== Inline кнопки ====
        if (update.callback_query) {
            const chatId = update.callback_query.message.chat.id;
            const query = update.callback_query.data;
            if (query.startsWith("buy_")) {
                const code = query.replace("buy_", "");
                let tariff;
                if (code === "MINI") tariff = TARIFFS.MINI;
                else if (code === "BASIC") tariff = TARIFFS.BASIC;
                else if (code === "EXT") tariff = TARIFFS.EXTENDED;
                else if (code === "IND") {
                    return sendMessage(
                        chatId,
                        "Напишите ваш запрос, и мы обсудим индивидуальную стоимость."
                    );
                }
                const invoice = await createInvoice(tariff.price, tariff.name);
                await sendMessage(
                    chatId,
                    `Ваш счёт готов:\n\n<b>${tariff.name}</b>\n\nОплатить: ${invoice.pay_url}`
                );
                await sendMessage(
                    ADMIN_ID,
                    `🧾 Новый заказ!\n\nПользователь: <code>${chatId}</code>\nТариф: ${tariff.name}\n\nСсылка на оплату:\n${invoice.pay_url}`
                );
            }
        }
        res.sendStatus(200);
    } catch (e) {
        console.log("Webhook error:", e.response?.data || e.message);
        res.sendStatus(500);
    }
});
// ========== 🟣 CryptoCloud webhook ==========
app.post("/cryptocloud", async (req, res) => {
    const event = req.body;
    try {
        if (event.status === "paid") {
            const amount = event.amount_usd;
            await sendMessage(
                ADMIN_ID,
                `💰 Платёж получен!\nСумма: ${amount}$\nID: ${event.invoice_id}`
            );
            await sendMessage(
                event.payload?.chat_id,
                "🎉 Платёж получен!\nМы начинаем работу по вашему запросу."
            );
        }
    } catch (err) {
        console.log("CryptoCloud error:", err.message);
    }
    res.sendStatus(200);
});
// ========== 🌐 Проверка сервера ==========
app.get("/", (req, res) => res.send("CallFox bot is running"));
// ========== 🚀 Запуск ==========
app.listen(3000, () => console.log("Server running on port 3000"));
