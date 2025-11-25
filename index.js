import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const BASE_URL = process.env.BASE_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/* ============================================================
   ОПЕРАТИВНОЕ ХРАНЕНИЕ СОСТОЯНИЙ ПОЛЬЗОВАТЕЛЕЙ
============================================================ */
const userState = {}; 
// userState[userId] = { stage: "...", tariff: "...", hash: "..." }

/* ============================================================
   УСТАНОВКА WEBHOOK
============================================================ */
async function setWebhook() {
  try {
    const hookUrl = `${BASE_URL}/webhook`;
    await axios.get(`${TELEGRAM_API}/setWebhook?url=${hookUrl}`);
    console.log("Webhook установлен:", hookUrl);
  } catch (err) {
    console.error("Ошибка установки webhook:", err.response?.data || err.message);
  }
}

/* ============================================================
   ОТПРАВКА СООБЩЕНИЙ
============================================================ */
async function sendMessage(chatId, text, markup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };

    if (markup) payload.reply_markup = markup;

    const res = await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
    return res.data;
  } catch (e) {
    console.log("sendMessage error:", e.response?.data || e.message);
  }
}

/* ============================================================
   КНОПКИ ТАРИФОВ
============================================================ */
function getMainKeyboard() {
  return {
    keyboard: [
      [{ text: "MINI — $15" }],
      [{ text: "BASIC — $49" }],
      [{ text: "EXTENDED — $199" }],
      [{ text: "INDIVIDUAL" }],
      [{ text: "Связаться с оператором" }]
    ],
    resize_keyboard: true
  };
}

/* ============================================================
   TELEGRAM WEBHOOK
============================================================ */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  if (!update.message) return;

  const msg = update.message;
  const text = msg.text?.trim();
  const userId = msg.chat.id;

  /* ——— Связаться с оператором ——— */
  if (text === "Связаться с оператором") {
    await sendMessage(userId, "Оператор: @CALLFOX");
    return;
  }

  /* ——— /start ——— */
  if (text === "/start") {
    userState[userId] = {}; 
    await sendMessage(userId, "Выберите тариф:", getMainKeyboard());
    return;
  }

  /* ——— INDIVIDUAL ——— */
  if (text === "INDIVIDUAL") {
    userState[userId] = {}; 
    await sendMessage(userId, "Для индивидуального тарифа напишите: @CALLFOX");
    return;
  }

  /* ——— ТАРИФЫ ——— */
  const tariffs = {
    "MINI — $15": 15,
    "BASIC — $49": 49,
    "EXTENDED — $199": 199
  };

  if (tariffs[text]) {
    userState[userId] = { stage: "awaiting_hash", tariff: text };

    await sendMessage(
      userId,
      `💳 <b>Адрес для оплаты (USDT TRC20):</b>\n<code>TDUknnJcPscxS3H9reMnzcFtKK958UAF3b</code>\n
После оплаты нажмите кнопку ниже.`,
      {
        keyboard: [
          [{ text: "Подтвердить оплату" }],
          [{ text: "Связаться с оператором" }]
        ],
        resize_keyboard: true
      }
    );

    return;
  }

  /* ——— Нажал "Подтвердить оплату" ——— */
  if (text === "Подтвердить оплату") {
    if (!userState[userId]?.tariff) {
      await sendMessage(userId, "Сначала выберите тариф: /start");
      return;
    }

    userState[userId].stage = "enter_hash";

    await sendMessage(
      userId,
      "Введите хеш транзакции, полученный в вашем криптокошельке:"
    );
    return;
  }

  /* ——— ВВОД ХЕША ——— */
  if (userState[userId]?.stage === "enter_hash") {

    userState[userId].hash = text;
    userState[userId].stage = "awaiting_data";

    await sendMessage(
      userId,
      `Ваш платёж отправлен на предварительную проверку.  
Теперь нажмите кнопку <b>«Ввести данные»</b> и укажите информацию о человеке, по которому требуется провести проверку.`,
      {
        keyboard: [
          [{ text: "Ввести данные" }],
          [{ text: "Связаться с оператором" }]
        ],
        resize_keyboard: true
      }
    );

    return;
  }

  /* ——— НАЖАЛ "Ввести данные" ——— */
  if (text === "Ввести данные") {

    if (userState[userId]?.stage !== "awaiting_data") {
      await sendMessage(userId, "Сначала укажите хеш транзакции.");
      return;
    }

    userState[userId].stage = "enter_target_data";

    await sendMessage(
      userId,
      `Введите данные по объекту проверки в формате:\n\nФИО:\nТелефон (если известно):\nПрофиль (если известно):`
    );
    return;
  }

  /* ——— ВВОД ДАННЫХ ОБЪЕКТА ——— */
  if (userState[userId]?.stage === "enter_target_data") {

    userState[userId].targetData = text;

    const { tariff, hash, targetData } = userState[userId];

    /* ==== Сообщение администратору ==== */
    await sendMessage(
      ADMIN_ID,
      `📝 <b>НОВЫЙ ЗАКАЗ</b>\n
👤 Пользователь: ${userId}\n
📌 Тариф: ${tariff}\n
🔗 Хеш: <code>${hash}</code>\n
📄 Данные объекта:\n${targetData}`
    );

    /* ==== Сообщение пользователю ==== */
    await sendMessage(
      userId,
      `Ваш заказ принят!  
После подтверждения оплаты специалист приступит к обработке и подготовит полный отчёт.`
    );

    userState[userId] = {}; // очищаем состояние

    return;
  }

  /* ——— НЕПОНЯТНАЯ КОМАНДА ——— */
  await sendMessage(userId, "Не понял запрос. Напишите /start");
});

/* ============================================================
   ЗАПУСК СЕРВЕРА
============================================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await setWebhook();
});
