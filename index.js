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

const WALLET = "TDUknnJcPscxS3H9reMnzcFtKK958UAF3b";

// СОСТОЯНИЯ
const userState = {}; // { userId: { lang, stage, tariff, hash, targetData } }

// ===================== МУЛЬТИЯЗЫЧНЫЙ СЛОВАРЬ =====================

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
    hash_received: "Ваша транзакция отправлена на проверку. Нажмите кнопку «Ввести данные».",

    enter_data_btn: "Ввести данные",
    enter_target_template:
      "Введите данные по объекту проверки:\n\nФИО:\nТелефон (если известно):\nПрофиль (если известно):",

    final_user_msg:
      "Ваш заказ принят! После подтверждения оплаты наши специалисты подготовят и пришлют готовый отчёт.",

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
    hash_received: "Ваша транзакція на перевірці. Натисніть «Ввести дані».",

    enter_data_btn: "Ввести дані",
    enter_target_template:
      "Введіть дані по об'єкту перевірки:\n\nПІБ:\nТелефон (якщо відомо):\nПрофіль (якщо відомо):",

    final_user_msg:
      "Ваше замовлення прийнято! Після підтвердження оплати спеціалісти підготують та надішлють повний звіт.",

    unknown_command: "Не зрозумів. Напишіть /start"
  },

  en: {
    choose_lang: "Choose your language:",
    continue_btn: "Continue",
    langs: { ru: "🇷🇺 Russian", ua: "🇺🇦 Ukrainian", en: "🇬🇧 English" },

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
    hash_received: "Your transaction is being verified. Press “Enter data”.",

    enter_data_btn: "Enter data",
    enter_target_template:
      "Enter target details:\n\nFull name:\nPhone (if known):\nProfile (if known):",

    final_user_msg:
      "Your order is accepted! After payment confirmation our specialists will prepare and send the full report.",

    unknown_command: "Unknown command. Type /start"
  }
};

// Escape text for <code>
function esc(s) {
  return String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Send Telegram message
async function sendMessage(chatId, text, markup = null) {
  try {
    const payload = { chat_id: chatId, text, parse_mode: "HTML" };
    if (markup) payload.reply_markup = markup;
    await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
  } catch (e) {
    console.error("sendMessage error:", e.response?.data || e.message);
  }
}

// Language keyboard
function langKeyboard() {
  return {
    keyboard: [
      [
        { text: "🇷🇺 Русский" },
        { text: "🇺🇦 Українська" },
        { text: "🇬🇧 English" }
      ],
      [{ text: "Продолжить" }, { text: "Продовжити" }, { text: "Continue" }]
    ],
    resize_keyboard: true
  };
}

// Tariff keyboard
function tariffKeyboard(lang) {
  const t = M[lang].tariffs;
  return {
    keyboard: [
      [{ text: t.mini }],
      [{ text: t.basic }],
      [{ text: t.ext }],
      [{ text: t.individual }],
      [{ text: M[lang].contact_operator }]
    ],
    resize_keyboard: true
  };
}

// ===================== ВЕБХУК =====================

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const msg = req.body.message;
  if (!msg) return;

  const userId = msg.chat.id;
  const text = (msg.text || "").trim();

  // Инициализируем состояние
  if (!userState[userId]) userState[userId] = {};

  const state = userState[userId];

  // Если язык ещё не выбран → всегда показываем выбор
  if (!state.lang) {
    if (text === "🇷🇺 Русский") state.lang = "ru";
    else if (text === "🇺🇦 Українська") state.lang = "ua";
    else if (text === "🇬🇧 English") state.lang = "en";

    // Если нажал продолжить → но языка всё ещё нет
    if (
      text === "Продолжить" ||
      text === "Продовжити" ||
      text === "Continue"
    ) {
      if (!state.lang) {
        await sendMessage(userId, "Выберите язык / Оберіть мову / Choose language:", langKeyboard());
        return;
      }
      await sendMessage(userId, M[state.lang].start_prompt, tariffKeyboard(state.lang));
      return;
    }

    // Иначе всегда вернуть меню выбора языка
    await sendMessage(userId, "Выберите язык / Оберіть мову / Choose language:", langKeyboard());
    return;
  }

  const dict = M[state.lang];

  // /start сбрасывает и возвращает к выбору языка
  if (text === "/start") {
    userState[userId] = {};
    await sendMessage(userId, dict.choose_lang, langKeyboard());
    return;
  }

  // Связаться с оператором
  if (text === dict.contact_operator) {
    await sendMessage(userId, dict.operator_text);
    return;
  }

  // Индивидуальный
  if (text === dict.tariffs.individual) {
    await sendMessage(userId, dict.operator_text);
    return;
  }

  // Выбор тарифа
  if (
    text === dict.tariffs.mini ||
    text === dict.tariffs.basic ||
    text === dict.tariffs.ext
  ) {
    state.tariff = text;
    state.stage = "awaiting_hash";

    await sendMessage(
      userId,
      `<b>${dict.pay_address_title}</b>\n<code>${esc(WALLET)}</code>\n\n${dict.after_pay_prompt}`,
      {
        keyboard: [
          [{ text: dict.confirm_payment }],
          [{ text: dict.contact_operator }]
        ],
        resize_keyboard: true
      }
    );

    return;
  }

  // Подтвердить оплату
  if (text === dict.confirm_payment) {
    if (!state.tariff) {
      await sendMessage(userId, dict.start_prompt, tariffKeyboard(state.lang));
      return;
    }

    state.stage = "enter_hash";

    await sendMessage(userId, dict.enter_hash_prompt);
    return;
  }

  // Ввод хеша
  if (state.stage === "enter_hash") {
    state.hash = text;
    state.stage = "awaiting_data";

    await sendMessage(
      userId,
      dict.hash_received,
      {
        keyboard: [
          [{ text: dict.enter_data_btn }],
          [{ text: dict.contact_operator }]
        ],
        resize_keyboard: true
      }
    );

    return;
  }

  // Нажал "Ввести данные"
  if (text === dict.enter_data_btn) {
    if (state.stage !== "awaiting_data") {
      await sendMessage(userId, dict.enter_hash_prompt);
      return;
    }

    state.stage = "enter_target_data";

    await sendMessage(userId, dict.enter_target_template);
    return;
  }

  // Ввод данных
  if (state.stage === "enter_target_data") {
    state.targetData = text;

    // --- Сообщение админу ---
    await sendMessage(
      ADMIN_ID,
      `📝 <b>НОВЫЙ ЗАКАЗ</b>\n\n` +
      `👤 Пользователь: <code>${userId}</code>\n` +
      `📌 Тариф: ${esc(state.tariff)}\n` +
      `🔗 Хеш: <code>${esc(state.hash)}</code>\n\n` +
      `📄 Данные объекта:\n${esc(state.targetData)}`
    );

    // --- Клиенту ---
    await sendMessage(userId, dict.final_user_msg);

    userState[userId] = { lang: state.lang }; // очищаем, но язык оставляем
    return;
  }

  // Нераспознанная команда
  await sendMessage(userId, dict.unknown_command);
});

// 🟢 Health check
app.get("/", (req, res) => res.send("Bot running"));

// 🟢 START
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("Bot started on port", PORT);
});
