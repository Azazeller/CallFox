import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const BASE_URL = process.env.BASE_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const userState = {}; // храним состояния пользователей

/* ============================================================
   SEND MESSAGE
============================================================ */
async function sendMessage(chatId, text, markup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (markup) payload.reply_markup = markup;

    return await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
  } catch (e) {
    console.log("sendMessage:", e.response?.data || e.message);
  }
}

/* ============================================================
   KEYBOARDS
============================================================ */
const langKeyboard = {
  keyboard: [
    [{ text: "Русский" }],
    [{ text: "Українська" }],
    [{ text: "English" }],
  ],
  resize_keyboard: true,
};

function tariffKeyboard(lang) {
  if (lang === "RU") {
    return {
      keyboard: [
        [{ text: "Мини" }],
        [{ text: "Базовый" }],
        [{ text: "Расширенный" }],
        [{ text: "Индивидуальный" }],
        [{ text: "Связаться с оператором" }],
      ],
      resize_keyboard: true,
    };
  }

  if (lang === "UA") {
    return {
      keyboard: [
        [{ text: "Міні" }],
        [{ text: "Базовий" }],
        [{ text: "Розширений" }],
        [{ text: "Індивідуальний" }],
        [{ text: "Зв’язатися з оператором" }],
      ],
      resize_keyboard: true,
    };
  }

  return {
    keyboard: [
      [{ text: "MINI" }],
      [{ text: "BASIC" }],
      [{ text: "EXTENDED" }],
      [{ text: "INDIVIDUAL" }],
      [{ text: "Contact operator" }],
    ],
    resize_keyboard: true,
  };
}

/* ============================================================
   WEBHOOK HANDLER
============================================================ */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const update = req.body;

  if (!update.message) return;
  const msg = update.message;
  const text = msg.text;
  const uid = msg.chat.id;

  /* ==========================
     NEW USER → SELECT LANGUAGE
  ========================== */
  if (text === "/start") {
    userState[uid] = { step: "choose_lang" };
    await sendMessage(uid, "Выберите язык | Оберіть мову | Choose language:", langKeyboard);
    return;
  }

  /* ==========================
     LANGUAGE SELECTED
  ========================== */
  if (userState[uid]?.step === "choose_lang") {
    if (text === "Русский") userState[uid].lang = "RU";
    else if (text === "Українська") userState[uid].lang = "UA";
    else if (text === "English") userState[uid].lang = "EN";
    else return;

    userState[uid].step = "tariffs";
    await sendMessage(uid, "Выберите тариф:", tariffKeyboard(userState[uid].lang));
    return;
  }

  const lang = userState[uid]?.lang;

  /* ==========================
     CONTACT OPERATOR
  ========================== */
  if (["RU", "UA", "EN"].includes(lang)) {
    if (text === "Связаться с оператором" || text === "Зв’язатися з оператором" || text === "Contact operator") {
      await sendMessage(uid, "Оператор: @CALLFOX");
      return;
    }
  }

  /* ==========================
     INDIVIDUAL
  ========================== */
  if (lang === "RU" && text === "Индивидуальный") {
    await sendMessage(uid, "Для индивидуального оформления: @CALLFOX");
    return;
  }
  if (lang === "UA" && text === "Індивідуальний") {
    await sendMessage(uid, "Для індивідуального оформлення: @CALLFOX");
    return;
  }
  if (lang === "EN" && text === "INDIVIDUAL") {
    await sendMessage(uid, "For individual request contact: @CALLFOX");
    return;
  }

  /* ==========================
     TARIFFS (NON-INDIVIDUAL)
  ========================== */
  const tariffMatch = {
    RU: { "Мини": "MINI", "Базовый": "BASIC", "Расширенный": "EXTENDED" },
    UA: { "Міні": "MINI", "Базовий": "BASIC", "Розширений": "EXTENDED" },
    EN: { "MINI": "MINI", "BASIC": "BASIC", "EXTENDED": "EXTENDED" },
  };

  if (tariffMatch[lang]?.[text]) {
    const tariff = tariffMatch[lang][text];
    userState[uid].tariff = tariff;
    userState[uid].step = "await_hash";

    const wallet = "<code>TDUknnJcPscxS3H9reMnzcFtKK958UAF3b</code>";

    await sendMessage(
      uid,
      `💳 <b>Адрес для оплаты USDT TRC20:</b>\n${wallet}\n\nПосле оплаты нажмите «Подтвердить оплату».`,
      {
        keyboard: [
          [{ text: lang === "RU" ? "Подтвердить оплату" : lang === "UA" ? "Підтвердити оплату" : "Confirm payment" }],
          [{ text: lang === "RU" ? "Связаться с оператором" : lang === "UA" ? "Зв’язатися з оператором" : "Contact operator" }]
        ],
        resize_keyboard: true
      }
    );
    return;
  }

  /* ==========================
     CONFIRM PAYMENT
  ========================== */
  const confirmWords = {
    RU: "Подтвердить оплату",
    UA: "Підтвердити оплату",
    EN: "Confirm payment",
  };

  if (text === confirmWords[lang]) {
    userState[uid].step = "enter_hash";

    await sendMessage(uid, "Введите хеш транзакции:");
    return;
  }

  /* ==========================
     HASH ENTERED
  ========================== */
  if (userState[uid]?.step === "enter_hash") {
    userState[uid].tx = text;
    userState[uid].step = "enter_data";

    await sendMessage(
      uid,
      "Ваша транзакция на проверке.\nНажмите «Ввести данные».",
      {
        keyboard: [
          [{ text: lang === "RU" ? "Ввести данные" : lang === "UA" ? "Ввести дані" : "Enter data" }]
        ],
        resize_keyboard: true
      }
    );

    return;
  }

  /* ==========================
     FORM REQUEST
  ========================== */
  const formWords = {
    RU: "Ввести данные",
    UA: "Ввести дані",
    EN: "Enter data",
  };

  if (text === formWords[lang]) {
    userState[uid].step = "typing_form";

    await sendMessage(uid,
      "Введите данные по шаблону:\n\nФИО:\nТелефон (если известно):\nПрофиль (если известно):"
    );
    return;
  }

  /* ==========================
     FORM SENT
  ========================== */
  if (userState[uid]?.step === "typing_form") {
    const tariff = userState[uid].tariff;
    const tx = userState[uid].tx;

    await sendMessage(uid, "Ваш заказ принят! После подтверждения оплаты наши специалисты начнут работу.");

    await sendMessage(
      ADMIN_ID,
      `🆕 <b>НОВЫЙ ЗАКАЗ</b>\n\n👤 ID: ${uid}\n📦 Тариф: ${tariff}\n💸 Хеш: ${tx}\n\n📄 Данные:\n${text}`
    );

    delete userState[uid];
    return;
  }

  /* ==========================
     DEFAULT
  ========================== */
  await sendMessage(uid, "Не понял команду. Напишите /start");
});

/* ============================================================
   SERVER
============================================================ */
app.listen(3000, () => {
  console.log("Bot running on port 3000");
   });
