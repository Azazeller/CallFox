import express from "express";
import axios from "axios";
const app = express();
app.use(express.json());
// Telegram
const TELEGRAM_TOKEN = "8528405495:AAFx4wvUN9MuO868q8JEGjuW-LksfgmKzMY";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const ADMIN_ID = "399248837";
// CryptoCloud
const CC_API = "https://api.cryptocloud.plus/v2/";
const CC_API_KEY = "9a6add0e-68d5-4702-b8c6-c77972dfad72";
const CC_SHOP_ID = "92cKpRVnPwRMyg4pz4xZ5o7a9gcQKjEFdfJS";
// Тарифы
const TARIFFS = {
  MINI: { id: "MINI", title: "MINI", price: 15 },
  BASIC: { id: "BASIC", title: "BASIC", price: 49 },
  EXTENDED: { id: "EXTENDED", title: "EXTENDED", price: 199 },
  INDIVIDUAL: { id: "INDIVIDUAL", title: "INDIVIDUAL", price: 0 }
};
// Telegram отправка сообщения
async function sendMessage(chatId, text, keyboard = null) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
    });
  } catch (err) {
    console.error("Telegram error:", err.response?.data || err);
  }
}
// Создание платежа в CryptoCloud
async function createCryptoInvoice(tariff, userId) {
  try {
    const response = await axios.post(
      `${CC_API}invoice/create`,
      {
        shop_id: CC_SHOP_ID,
        amount: tariff.price,
        currency: "USD",
        order_id: `${tariff.id}_${userId}_${Date.now()}`,
        email: "client@mail.com",
        webhook_url: "https://callfox.onrender.com/cryptocloud-webhook"
      },
      {
        headers: {
          "Authorization": `Token ${CC_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
    return response.data.result.link;
  } catch (err) {
    console.error("CryptoCloud payment error:", err.response?.data || err);
    return null;
  }
}
// Webhook Telegram
app.post("/telegram-webhook", async (req, res) => {
  const update = req.body;
  if (!update.message) return res.sendStatus(200);
  const chatId = update.message.chat.id;
  const text = update.message.text?.trim();
  // /start
  if (text === "/start") {
    await sendMessage(
      chatId,
      `<b>🦊 Выберите тариф OSINT-проверки:</b>
🔹 MINI — $15  
🔹 BASIC — $49  
🔹 EXTENDED — $199  
🔹 INDIVIDUAL — индивидуально`,
      [
        [{ text: "MINI — $15", callback_data: "MINI" }],
        [{ text: "BASIC — $49", callback_data: "BASIC" }],
        [{ text: "EXTENDED — $199", callback_data: "EXTENDED" }],
        [{ text: "INDIVIDUAL", callback_data: "INDIVIDUAL" }]
      ]
    );
    return res.sendStatus(200);
  }
  res.sendStatus(200);
});
// Обработка нажатий кнопок (callback_query)
app.post("/telegram-webhook", async (req, res) => {
  const cb = req.body.callback_query;
  if (!cb) return res.sendStatus(200);
  const chatId = cb.from.id;
  const tariffId = cb.data;
  const tariff = TARIFFS[tariffId];
  if (!tariff) return res.sendStatus(200);
  // INDIVIDUAL — без оплаты
  if (tariffId === "INDIVIDUAL") {
    await sendMessage(chatId, "Свяжитесь с оператором: @CALLFOX");
    await sendMessage(ADMIN_ID, `🟡 INDIVIDUAL запрос от ${chatId}`);
    return res.sendStatus(200);
  }
  // Создание инвойса
  const link = await createCryptoInvoice(tariff, chatId);
  if (!link) {
    await sendMessage(chatId, "Ошибка при создании платежа, попробуйте позже.");
    return res.sendStatus(200);
  }
  await sendMessage(
    chatId,
    `Ваш тариф: <b>${tariff.title}</b>\nЦена: <b>$${tariff.price}</b>\n\nПерейдите по ссылке для оплаты:`,
    [[{ text: "💳 Оплатить", url: link }]]
  );
  await sendMessage(ADMIN_ID, `💰 Пользователь ${chatId} создал заказ ${tariff.title}`);
  res.sendStatus(200);
});
// CryptoCloud webhook
app.post("/cryptocloud-webhook", async (req, res) => {
  const data = req.body;
  console.log("CryptoCloud webhook:", data);
  if (data.status === "paid") {
    const [tariffId, userId] = data.order_id.split("_");
    await sendMessage(userId, "✅ Оплата получена! Мы начали работу над вашим OSINT-отчётом.");
    await sendMessage(ADMIN_ID, `💰 Оплачен тариф ${tariffId} пользователем ${userId}`);
  }
  res.sendStatus(200);
});
// Проверка что сервер жив
app.get("/", (req, res) => {
  res.send("CallFox CryptoCloud bot is running");
});
app.listen(3000, () => console.log("Server running on port 3000"));
