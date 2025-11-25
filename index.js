import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const BASE_URL = process.env.BASE_URL || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Оперативное хранение состояний
const userState = {}; // userState[userId] = { lang, stage, tariff, hash, targetData }

// Тарифный адрес (один для всех тарифов)
const WALLET = "TDUknnJcPscxS3H9reMnzcFtKK958UAF3b";

// ========== Мультиязычный словарь ==========
const M = {
  ru: {
    choose_lang: "Выберите язык:",
    continue_btn: "Продолжить",
    langs: { ru: "🇷🇺 Русский", ua: "🇺🇦 Українська", en: "🇬🇧 English" },
    tariffs: {
      mini: "Мини — $15",
      basic: "Базовый — $49",
      ext: "Расширенный — $199",
      individual: "Индивидуальный"
    },
    start_prompt: "Выберите тариф:",
    contact_operator: "Связаться с оператором",
    operator_text: "Оператор: @CALLFOX",
    pay_address_title: "Адрес для оплаты (USDT TRC20):",
    after_pay_prompt: "После оплаты нажмите кнопку ниже.",
    confirm_payment: "Подтвердить оплату",
    enter_hash_prompt: "Введите хеш транзакции, который вы получили в кошельке:",
    hash_received: "Ваша транзакция на проверке. Нажмите кнопку «Ввести данные».",
    enter_data_btn: "Ввести данные",
    enter_target_template: "Введите данные по объекту проверки в формате:\n\nФИО:\nТелефон (если известно):\nПрофиль (если известно):",
    final_user_msg: "Ваш заказ принят! После подтверждения оплаты наши специалисты подготовят и пришлют полный отчёт.",
    unknown_command: "Не понял запрос. Напишите /start"
  },
  ua: {
    choose_lang: "Оберіть мову:",
    continue_btn: "Продовжити",
    langs: { ru: "🇷🇺 Русский", ua: "🇺🇦 Українська", en: "🇬🇧 English" },
    tariffs: {
      mini: "Міні — $15",
      basic: "Базовий — $49",
      ext: "Розширений — $199",
      individual: "Індивідуальний"
    },
    start_prompt: "Оберіть тариф:",
    contact_operator: "Зв'язатися з оператором",
    operator_text: "Оператор: @CALLFOX",
    pay_address_title: "Адреса для оплати (USDT TRC20):",
    after_pay_prompt: "Після оплати натисніть кнопку нижче.",
    confirm_payment: "Підтвердити оплату",
    enter_hash_prompt: "Введіть хеш транзакції, який ви отримали у гаманці:",
    hash_received: "Ваша транзакція на перевірці. Натисніть кнопку «Ввести дані».",
    enter_data_btn: "Ввести дані",
    enter_target_template: "Введіть дані по об'єкту перевірки у форматі:\n\nПІБ:\nТелефон (якщо відомо):\nПрофіль (якщо відомо):",
    final_user_msg: "Ваше замовлення прийнято! Після підтвердження оплати наші спеціалісти підготують і надішлють повний звіт.",
    unknown_command: "Не зрозумів запит. Напишіть /start"
  },
  en: {
    choose_lang: "Choose language:",
    continue_btn: "Continue",
    langs: { ru: "🇷🇺 Русский", ua: "🇺🇦 Українська", en: "🇬🇧 English" },
    tariffs: {
      mini: "MINI — $15",
      basic: "BASIC — $49",
      ext: "EXTENDED — $199",
      individual: "INDIVIDUAL"
    },
    start_prompt: "Choose a tariff:",
    contact_operator: "Contact operator",
    operator_text: "Operator: @CALLFOX",
    pay_address_title: "Payment address (USDT TRC20):",
    after_pay_prompt: "After payment press the button below.",
    confirm_payment: "Confirm payment",
    enter_hash_prompt: "Enter the transaction hash from your wallet:",
    hash_received: "Your transaction is under review. Press «Enter data» to provide details.",
    enter_data_btn: "Enter data",
    enter_target_template: "Enter target info in the format:\n\nFull name:\nPhone (if known):\nProfile (if known):",
    final_user_msg: "Your order is accepted! After payment confirmation our specialists will prepare and send a full report.",
    unknown_command: "I don't understand. Type /start"
  }
};

// Helper: safe escape for HTML code blocks (we'll use <code> where appropriate)
function escapeForCode(s) {
  if (!s && s !== 0) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Send message utility (accepts reply_markup object)
async function sendMessage(chatId, text, reply_markup = null) {
  try {
    const payload = { chat_id: chatId, text, parse_mode: "HTML" };
    if (reply_markup) payload.reply_markup = reply_markup;
    await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
  } catch (e) {
    console.error("sendMessage error:", e.response?.data || e.message);
  }
}

// Build language selection keyboard
function langKeyboard(lang) {
  const dict = M[lang] || M.en;
  return {
    keyboard: [
      [{ text: dict.langs.ru }, { text: dict.langs.ua }, { text: dict.langs.en }],
      [{ text: dict.continue_btn }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
}

// Build main tariff keyboard in a given language
function tariffKeyboard(lang) {
  const dict = M[lang] || M.en;
  return {
    keyboard: [
      [{ text: dict.tariffs.mini }],
      [{ text: dict.tariffs.basic }],
      [{ text: dict.tariffs.ext }],
      [{ text: dict.tariffs.individual }],
      [{ text: dict.contact_operator }]
    ],
    resize_keyboard: true
  };
}

// Set webhook (optional)
async function setWebhook() {
  if (!BASE_URL) {
    console.log("BASE_URL not set, skipping webhook set");
    return;
  }
  try {
    const hookUrl = `${BASE_URL}/webhook`;
    await axios.get(`${TELEGRAM_API}/setWebhook?url=${encodeURIComponent(hookUrl)}`);
    console.log("Webhook set:", hookUrl);
  } catch (err) {
    console.error("setWebhook error:", err.response?.data || err.message);
  }
}

// Determine initial language: try from telegram language_code, otherwise undefined
function detectLangFromUpdate(update) {
  try {
    const code = update.message?.from?.language_code || update.from?.language_code;
    if (!code) return undefined;
    if (code.startsWith("uk")) return "ua";
    if (code.startsWith("ru")) return "ru";
    if (code.startsWith("en")) return "en";
    return undefined;
  } catch (e) {
    return undefined;
  }
}

// Main webhook
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const update = req.body;
  if (!update) return;

  // Message handler
  if (update.message) {
    const msg = update.message;
    const userId = msg.chat.id;
    const textRaw = (msg.text || "").trim();

    // Initialize state if not exist
    if (!userState[userId]) userState[userId] = {};

    // If userState has no lang yet, try detect
    if (!userState[userId].lang) {
      const guessed = detectLangFromUpdate(update);
      if (guessed) {
        userState[userId].lang = guessed;
      }
    }

    // If no lang determined, show lang keyboard
    if (!userState[userId].lang) {
      // Show language selection
      await sendMessage(userId, M.en.choose_lang + "\n\n" + "Виберіть мову / Choose language", langKeyboard("en"));
      return;
    }

    const lang = userState[userId].lang;
    const dict = M[lang];

    // Handle explicit language button presses (they come as full text, detect them)
    if (textRaw === M.ru.langs.ru || textRaw === M.ua.langs.ru || textRaw === M.en.langs.ru) {
      userState[userId].lang = "ru";
      await sendMessage(userId, M.ru.choose_lang, langKeyboard("ru"));
      return;
    }
    if (textRaw === M.ru.langs.ua || textRaw === M.ua.langs.ua || textRaw === M.en.langs.ua) {
      userState[userId].lang = "ua";
      await sendMessage(userId, M.ua.choose_lang, langKeyboard("ua"));
      return;
    }
    if (textRaw === M.ru.langs.en || textRaw === M.ua.langs.en || textRaw === M.en.langs.en) {
      userState[userId].lang = "en";
      await sendMessage(userId, M.en.choose_lang, langKeyboard("en"));
      return;
    }
    // Continue button after lang selection
    if (textRaw === dict.continue_btn) {
      // show tariffs
      await sendMessage(userId, dict.start_prompt, tariffKeyboard(userState[userId].lang));
      return;
    }

    // /start always resets and shows tariffs (use user's lang if available)
    if (textRaw === "/start") {
      userState[userId] = { lang: userState[userId].lang || "en" };
      await sendMessage(userId, M[userState[userId].lang].start_prompt, tariffKeyboard(userState[userId].lang));
      return;
    }

    // Contact operator
    if (textRaw === dict.contact_operator) {
      await sendMessage(userId, dict.operator_text);
      return;
    }

    // Individual tariff
    if (textRaw === dict.tariffs.individual) {
      await sendMessage(userId, dict.operator_text);
      return;
    }

    // Tariff selection (mini/basic/ext)
    if (textRaw === dict.tariffs.mini || textRaw === dict.tariffs.basic || textRaw === dict.tariffs.ext) {
      // set state
      userState[userId].tariff = textRaw;
      userState[userId].stage = "awaiting_hash";
      // send pay instructions
      const walletEsc = escapeForCode(WALLET);
      const replyKeyboard = {
        keyboard: [
          [{ text: dict.confirm_payment }],
          [{ text: dict.contact_operator }]
        ],
        resize_keyboard: true
      };
      await sendMessage(userId, `<b>${dict.pay_address_title}</b>\n<code>${walletEsc}</code>\n\n${dict.after_pay_prompt}`, replyKeyboard);
      return;
    }

    // User pressed confirm payment button
    if (textRaw === dict.confirm_payment) {
      if (!userState[userId]?.tariff) {
        await sendMessage(userId, dict.start_prompt, tariffKeyboard(userState[userId].lang));
        return;
      }
      userState[userId].stage = "enter_hash";
      await sendMessage(userId, dict.enter_hash_prompt);
      return;
    }

    // User entering hash
    if (userState[userId]?.stage === "enter_hash") {
      // basic validation
      const hash = textRaw;
      userState[userId].hash = hash;
      userState[userId].stage = "awaiting_data";
      const replyKeyboard = {
        keyboard: [
          [{ text: dict.enter_data_btn }],
          [{ text: dict.contact_operator }]
        ],
        resize_keyboard: true
      };
      await sendMessage(userId, dict.hash_received, replyKeyboard);
      return;
    }

    // User presses "Enter data"
    if (textRaw === dict.enter_data_btn) {
      if (userState[userId]?.stage !== "awaiting_data") {
        await sendMessage(userId, dict.enter_hash_prompt);
        return;
      }
      userState[userId].stage = "enter_target_data";
      await sendMessage(userId, dict.enter_target_template);
      return;
    }

    // User sends target data (free text)
    if (userState[userId]?.stage === "enter_target_data") {
      userState[userId].targetData = textRaw;
      // build admin message — only final message with all data
      const adminMsg =
        `📝 <b>НОВЫЙ ЗАПРОС</b>\n\n` +
        `👤 Пользователь: <code>${userId}</code>\n` +
        `📌 Тариф: ${escapeForCode(userState[userId].tariff || "")}\n` +
        `🔗 Хеш: <code>${escapeForCode(userState[userId].hash || "")}</code>\n\n` +
        `📄 Данные объекта:\n${escapeForCode(userState[userId].targetData || "")}`;

      // send to admin
      await sendMessage(ADMIN_ID, adminMsg);

      // notify user with commercial message
      await sendMessage(userId, dict.final_user_msg);

      // clear state
      userState[userId] = { lang: userState[userId].lang || "en" };
      return;
    }

    // If none matched
    await sendMessage(userId, M[userState[userId].lang || "en"].unknown_command);
    return;
  } // end message handler
});

// Simple root
app.get("/", (req, res) => res.send("CallFox bot up"));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("Server started on port", PORT);
  await setWebhook();
});
