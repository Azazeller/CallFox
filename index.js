import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import FormData from "form-data";

import { TEXT } from "./texts.js";
import {
  mainMenuInline,
  paymentInline,
  hashWaitInline,
  backInline,
} from "./keyboards.js";

dotenv.config();

const app = express();
app.use(express.json());

/* ============================================================
   CONFIG
============================================================ */
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = 399248837; // твой ID, жёстко задан
const BASE_URL = process.env.BASE_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;

const userState = {}; // состояния пользователей

/* ============================================================
   HELPERS: MESSAGES
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

async function editMessage(chatId, messageId, text, markup = null) {
  try {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
    };
    if (markup) payload.reply_markup = markup;
    return await axios.post(`${TELEGRAM_API}/editMessageText`, payload);
  } catch (e) {
    console.log("editMessage:", e.response?.data || e.message);
  }
}

async function answerCallback(callbackId, text = "") {
  try {
    const payload = {
      callback_query_id: callbackId,
    };
    if (text) payload.text = text;
    return await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, payload);
  } catch (e) {
    console.log("answerCallback:", e.response?.data || e.message);
  }
}

async function sendPDF(chatId, filePath, caption = "") {
  try {
    if (!fs.existsSync(filePath)) {
      console.log("sendPDF: file not found", filePath);
      return;
    }
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", fs.createReadStream(filePath));
    if (caption) form.append("caption", caption);

    return await axios.post(`${TELEGRAM_FILE_API}`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (e) {
    console.log("sendPDF:", e.response?.data || e.message);
  }
}

/* ============================================================
   REMINDERS
============================================================ */
function scheduleReminders(uid) {
  // Первое напоминание через 60 минут
  setTimeout(async () => {
    if (!userState[uid]) return;
    if (userState[uid].reminder1Sent) return;
    const lang = userState[uid].lang || "RU";
    const t = TEXT[lang];
    userState[uid].reminder1Sent = true;
    await sendMessage(uid, t.reminder1);
  }, 60 * 60 * 1000);

  // Второе напоминание через 24 часа
  setTimeout(async () => {
    if (!userState[uid]) return;
    if (userState[uid].reminder2Sent) return;
    const lang = userState[uid].lang || "RU";
    const t = TEXT[lang];
    userState[uid].reminder2Sent = true;
    await sendMessage(uid, t.reminder2);
  }, 24 * 60 * 60 * 1000);
}

/* ============================================================
   WEBHOOK
============================================================ */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;

  /* -------- CALLBACK QUERIES (INLINE BUTTONS) -------- */
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data;
    const chatId = cq.message.chat.id;
    const msgId = cq.message.message_id;
    const uid = chatId;
    const lang = userState[uid]?.lang;

    // Если язык ещё не выбран и callback не про язык — просим /start
    if (!lang && !data.startsWith("lang_")) {
      await answerCallback(cq.id);
      await sendMessage(chatId, "Напишите /start");
      return;
    }

    /* ----- LANGUAGE SELECT INLINE ----- */
    if (data === "lang_UA" || data === "lang_RU" || data === "lang_EN") {
      let selLang = "RU";
      if (data === "lang_UA") selLang = "UA";
      if (data === "lang_EN") selLang = "EN";

      userState[uid] = {
        lang: selLang,
        step: "tariffs",
      };

      if (!userState[uid].remindersScheduled) {
        userState[uid].remindersScheduled = true;
        scheduleReminders(uid);
      }

      const t = TEXT[selLang];

      await answerCallback(cq.id);
      await editMessage(
        chatId,
        msgId,
        `${t.welcome}\n\n${t.choose_tariff}`,
        mainMenuInline(selLang)
      );
      return;
    }

    // From here on язык уже выбран
    const t = TEXT[lang];

    /* ----- MAIN MENU: TARIFFS ----- */
    if (data.startsWith("tariff_")) {
      await answerCallback(cq.id);

      const index = parseInt(data.split("_")[1], 10);
      const tariffName = t.tariffs[index];

      if (index === 3) {
        // INDIVIDUAL — просто текст, без изменения step
        await sendMessage(chatId, t.individual_msg);
        return;
      }

      // MINI / BASE / PRO
      userState[uid] = {
        ...(userState[uid] || {}),
        lang,
        step: "await_hash",
        tariff: tariffName,
      };

      const price = t.prices[index];
      const deadline = t.deadlines[index];

      const text = `${t.pay_address_title}
<code>TDUknnJcPscxS3H9reMnzcFtKK958UAF3b</code>

Стоимость / Price: ${price}
Срок / Time: ${deadline}

${t.after_payment}`;

      await sendMessage(chatId, text, paymentInline(lang));
      return;
    }

    /* ----- SAMPLES: PDF REPORTS ----- */
    if (data === "samples") {
      await answerCallback(cq.id);

      await sendMessage(chatId, t.sending_samples);
      await sendPDF(chatId, "./files/mini.pdf", "OSINT MINI");
      await sendPDF(chatId, "./files/base.pdf", "OSINT BASE");
      await sendPDF(chatId, "./files/pro.pdf", "OSINT PRO");

      // После отправки примеров — новое сообщение с меню, чтобы не ломать структуру
      await sendMessage(chatId, t.choose_tariff, mainMenuInline(lang));
      return;
    }

    /* ----- ABOUT PLANS ----- */
    if (data === "about_plans") {
      userState[uid] = {
        ...(userState[uid] || {}),
        lang,
        step: "about",
      };

      await answerCallback(cq.id);
      await editMessage(
        chatId,
        msgId,
        t.plans_text,
        backInline(lang)
      );
      return;
    }

    /* ----- BACK TO MAIN MENU ----- */
    if (data === "back_main") {
      userState[uid] = {
        ...(userState[uid] || {}),
        lang,
        step: "tariffs",
      };

      await answerCallback(cq.id);
      await editMessage(
        chatId,
        msgId,
        `${t.welcome}\n\n${t.choose_tariff}`,
        mainMenuInline(lang)
      );
      return;
    }

    /* ----- CONFIRM PAYMENT ----- */
    if (data === "confirm_payment") {
      userState[uid] = {
        ...(userState[uid] || {}),
        lang,
        step: "enter_hash",
      };

      await answerCallback(cq.id);
      await sendMessage(chatId, t.enter_hash);
      return;
    }

    /* ----- ENTER DATA BUTTON ----- */
    if (data === "enter_data") {
      userState[uid] = {
        ...(userState[uid] || {}),
        lang,
        step: "typing_form",
      };

      await answerCallback(cq.id);
      await sendMessage(chatId, t.enter_data_text);
      return;
    }

    // Unknown callback
    await answerCallback(cq.id);
    return;
  }

  /* -------- NORMAL MESSAGES (TEXT) -------- */
  if (!update.message) return;

  const msg = update.message;
  const text = msg.text;
  const uid = msg.chat.id;

  // /start — всегда сбрасывает состояние и показывает выбор языка
  if (text === "/start") {
    userState[uid] = { step: "choose_lang" };

    const langSelectInline = {
      inline_keyboard: [
        [
          { text: "Українська", callback_data: "lang_UA" },
          { text: "Русский", callback_data: "lang_RU" },
          { text: "English", callback_data: "lang_EN" },
        ],
      ],
    };

    await sendMessage(uid, TEXT.UA.choose_lang, langSelectInline);
    return;
  }

  const lang = userState[uid]?.lang;

  // Если ещё не выбрали язык — просим /start
  if (!lang) {
    await sendMessage(uid, "Напишите /start");
    return;
  }

  const t = TEXT[lang];

  /* ----- ENTER HASH (TEXT) ----- */
  if (userState[uid]?.step === "enter_hash") {
    userState[uid].tx = text;
    userState[uid].step = "enter_data";

    await sendMessage(uid, t.hash_wait, hashWaitInline(lang));
    return;
  }

  /* ----- USER SENT FORM (TEXT) ----- */
  if (userState[uid]?.step === "typing_form") {
    const tariff = userState[uid].tariff;
    const tx = userState[uid].tx;

    await sendMessage(uid, t.order_accepted);

    const username = msg.from.username
      ? `@${msg.from.username}`
      : `без username`;

    await sendMessage(
      ADMIN_ID,
      `🆕 <b>НОВЫЙ ЗАКАЗ</b>\n\n👤 Username: ${username}\n🆔 ID: ${uid}\n📦 Тариф: ${tariff}\n💸 Хеш: ${tx}\n\n📄 Данные:\n${text}`
    );

    delete userState[uid];
    return;
  }

  /* ----- FALLBACK: ПОВТОРНОЕ МЕНЮ ----- */
  await sendMessage(
    uid,
    `${t.unknown}\n\n${t.choose_tariff}`,
    mainMenuInline(lang)
  );
});

/* ============================================================
   SERVER
============================================================ */
app.listen(3000, () => {
  console.log("Bot running on port 3000 (inline, modular)");
});
