t express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const BASE_URL = process.env.BASE_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const userState = {}; // состояния пользователей

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
   TEXT LOCALIZATION
============================================================ */
const TEXT = {
  UA: {
    choose_lang: "Оберіть мову:",
    choose_tariff: "Оберіть тариф:",
    contact_operator: "Зв’язатися з оператором",
    operator_msg: "Оператор: @CALLFOX",

    individual_msg: "Для індивідуального оформлення: @CALLFOX",

    pay_address_title: "💳 <b>Адреса для оплати USDT TRC20:</b>",
    after_payment: "Після оплати натисніть «Підтвердити оплату».",

    confirm_payment: "Підтвердити оплату",
    enter_hash: "Введіть хеш транзакції:",
    hash_wait: "Вашу транзакцію передано на перевірку.\nНатисніть «Ввести дані».",

    enter_data_btn: "Ввести дані",
    enter_data_text:
      "Введіть дані за шаблоном:\n\nПІБ:\nТелефон (якщо відомо):\nПрофіль (якщо відомо):",

    order_accepted:
      "Ваше замовлення прийнято! Після підтвердження оплати наші спеціалісти почнуть роботу.",

    unknown: "Команда не розпізнана. Напишіть /start",

    tariffs: ["Міні", "Базовий", "Розширений", "Індивідуальний"],
  },

  RU: {
    choose_lang: "Выберите язык:",
    choose_tariff: "Выберите тариф:",
    contact_operator: "Связаться с оператором",
    operator_msg: "Оператор: @CALLFOX",

    individual_msg: "Для индивидуального оформления: @CALLFOX",

    pay_address_title: "💳 <b>Адрес для оплаты USDT TRC20:</b>",
    after_payment: "После оплаты нажмите «Подтвердить оплату».",

    confirm_payment: "Подтвердить оплату",
    enter_hash: "Введите хеш транзакции:",
    hash_wait: "Ваша транзакция на проверке.\nНажмите «Ввести данные».",

    enter_data_btn: "Ввести данные",
    enter_data_text:
      "Введите данные по шаблону:\n\nФИО:\nТелефон (если известно):\nПрофиль (если известно):",

    order_accepted:
      "Ваш заказ принят! После подтверждения оплаты специалисты приступят к работе.",

    unknown: "Не понял команду. Напишите /start",

    tariffs: ["Мини", "Базовый", "Расширенный", "Индивидуальный"],
  },

  EN: {
    choose_lang: "Choose your language:",
    choose_tariff: "Choose your plan:",
    contact_operator: "Contact operator",
    operator_msg: "Operator: @CALLFOX",

    individual_msg: "For individual requests contact: @CALLFOX",

    pay_address_title: "💳 <b>Payment address USDT TRC20:</b>",
    after_payment: "After payment click «Confirm payment».",

    confirm_payment: "Confirm payment",
    enter_hash: "Enter the transaction hash:",
    hash_wait: "Your transaction is being verified.\nClick «Enter data».",

    enter_data_btn: "Enter data",
    enter_data_text:
      "Enter the information using this template:\n\nFull name:\nPhone (optional):\nProfile (optional):",

    order_accepted:
      "Your request has been accepted! After payment confirmation our specialists will begin work.",

    unknown: "Unknown command. Type /start",

    tariffs: ["MINI", "BASIC", "EXTENDED", "INDIVIDUAL"],
  },
};

/* ============================================================
   KEYBOARDS
============================================================ */
const langKeyboard = {
  keyboard: [
    [{ text: "Українська" }],
    [{ text: "Русский" }],
    [{ text: "English" }],
  ],
  resize_keyboard: true,
};

function tariffKeyboard(lang) {
  const t = TEXT[lang].tariffs;
  return {
    keyboard: [
      [{ text: t[0] }],
      [{ text: t[1] }],
      [{ text: t[2] }],
      [{ text: t[3] }],
      [{ text: TEXT[lang].contact_operator }],
    ],
    resize_keyboard: true,
  };
}

/* ============================================================
   WEBHOOK
============================================================ */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  if (!update.message) return;

  const msg = update.message;
  const text = msg.text;
  const uid = msg.chat.id;

  /* ——— START ——— */
  if (text === "/start") {
    userState[uid] = { step: "choose_lang" };
    await sendMessage(uid, TEXT.UA.choose_lang, langKeyboard);
    return;
  }

  /* ——— LANGUAGE SELECT ——— */
  if (userState[uid]?.step === "choose_lang") {
    if (text === "Українська") userState[uid].lang = "UA";
    else if (text === "Русский") userState[uid].lang = "RU";
    else if (text === "English") userState[uid].lang = "EN";
    else return;

    const lang = userState[uid].lang;
    userState[uid].step = "tariffs";

    await sendMessage(uid, TEXT[lang].choose_tariff, tariffKeyboard(lang));
    return;
  }

  const lang = userState[uid]?.lang;
  if (!lang) return await sendMessage(uid, "Напишите /start");

  /* ——— CONTACT OPERATOR ——— */
  if (text === TEXT[lang].contact_operator) {
    await sendMessage(uid, TEXT[lang].operator_msg);
    return;
  }

  /* ——— INDIVIDUAL ——— */
  if (text === TEXT[lang].tariffs[3]) {
    await sendMessage(uid, TEXT[lang].individual_msg);
    return;
  }

  /* ——— TARIFF SELECT ——— */
  const t = TEXT[lang].tariffs;

  if (t.includes(text) && text !== t[3]) {
    userState[uid].tariff = text;
    userState[uid].step = "await_hash";

    await sendMessage(
      uid,
      `${TEXT[lang].pay_address_title}\n<code>TDUknnJcPscxS3H9reMnzcFtKK958UAF3b</code>\n\n${TEXT[lang].after_payment}`,
      {
        keyboard: [
          [{ text: TEXT[lang].confirm_payment }],
          [{ text: TEXT[lang].contact_operator }],
        ],
        resize_keyboard: true,
      }
    );
    return;
  }

  /* ——— CONFIRM PAYMENT ——— */
  if (text === TEXT[lang].confirm_payment) {
    userState[uid].step = "enter_hash";
    await sendMessage(uid, TEXT[lang].enter_hash);
    return;
  }

  /* ——— HASH ENTERED ——— */
  if (userState[uid]?.step === "enter_hash") {
    userState[uid].tx = text;
    userState[uid].step = "enter_data";

    await sendMessage(
      uid,
      TEXT[lang].hash_wait,
      {
        keyboard: [
          [{ text: TEXT[lang].enter_data_btn }],
        ],
        resize_keyboard: true,
      }
    );

    return;
  }

  /* ——— ENTER DATA BUTTON ——— */
  if (text === TEXT[lang].enter_data_btn) {
    userState[uid].step = "typing_form";
    await sendMessage(uid, TEXT[lang].enter_data_text);
    return;
  }

  /* ——— USER SENT FORM ——— */
  if (userState[uid]?.step === "typing_form") {
    const tariff = userState[uid].tariff;
    const tx = userState[uid].tx;

    await sendMessage(uid, TEXT[lang].order_accepted);

    await sendMessage(
      ADMIN_ID,
      `🆕 <b>НОВЫЙ ЗАКАЗ</b>\n\n👤 ID: ${uid}\n📦 Тариф: ${tariff}\n💸 Хеш: ${tx}\n\n📄 Данные:\n${text}`
    );

    delete userState[uid];
    return;
  }

  /* ——— FALLBACK ——— */
  await sendMessage(uid, TEXT[lang].unknown);
});

/* ============================================================
   SERVER
============================================================ */
app.listen(3000, () => {
  console.log("Bot running on port 3000");
});
