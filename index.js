import express from "express";
import fetch from "node-fetch";
const app = express();
app.use(express.json());
const TOKEN = process.env.TELEGRAM_TOKEN; // твой телеграм бот токен
const API_KEY = process.env.CRYPT_CLOUD_API_KEY;
const MERCHANT_ID = process.env.MERCHANT_ID;
// ID для уведомлений
const ADMIN_ID = "399248837";
app.get("/", (req, res) => {
    res.send("CallFox bot running");
});
/**
 * ---------------------------
 * CRYPTOCLOUD WEBHOOK
 * ---------------------------
 */
app.post("/webhook", async (req, res) => {
    console.log("Webhook:", req.body);
    try {
        // CryptoCloud структура:
        // { event: "payment", data: { status: "paid", order_id: "...", amount: ... } }
        const { event, data } = req.body;
        if (event === "payment" && data.status === "paid") {
            const chatId = data.order_id; // order_id = chat_id
            // сообщение пользователю
            await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Оплата успешно подтверждена! 🔥\nНачинаем работу."
                })
            });
            // уведомление админу
            await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: ADMIN_ID,
                    text: `🔥 Новый заказ!\nЗаказ от chat_id: ${chatId}\nСумма: ${data.amount} ${data.currency}`
                })
            });
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook error:", err);
        res.sendStatus(500);
    }
});
/**
 * ---------------------------
 * TELEGRAM BOT WEBHOOK HANDLER
 * ---------------------------
 */
app.post("/telegram-webhook", async (req, res) => {
    const msg = req.body.message;
    if (!msg) return res.sendStatus(200);
    const chatId = msg.chat.id;
    // отправляем ссылку на оплату
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            text: `Для оплаты перейдите по ссылке:\nhttps://cryptocloud.plus/pay/${MERCHANT_ID}\n\nВаш ID заказа: ${chatId}`
        })
    });
    res.sendStatus(200);
});
app.listen(3000, () => console.log("Server running on port 3000"));
