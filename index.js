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
  casesBackInline
} from "./keyboards.js";

dotenv.config();

const app = express();
app.use(express.json());

/* ============================================================
   CONFIG
============================================================ */
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = 399248837;

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;

const userState = {};

/* ============================================================
   HELPERS
============================================================ */
async function sendMessage(chatId, text, markup = null) {
  try {
    const payload = { chat_id: chatId, text, parse_mode: "HTML" };
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
      parse_mode: "HTML"
    };
    if (markup) payload.reply_markup = markup;
    return await axios.post(`${TELEGRAM_API}/editMessageText`, payload);
  } catch (e) {
    console.log("editMessage:", e.response?.data || e.message);
  }
}

async function answerCallback(id) {
  try {
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
      callback_query_id: id
    });
  } catch (e) {
    console.log("answerCallback:", e.response?.data || e.message);
  }
}

async function sendPDF(chatId, filePath, caption = "") {
  try {
    if (!fs.existsSync(filePath)) return;

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", fs.createReadStream(filePath));
    if (caption) form.append("caption", caption);

    return await axios.post(FILE_API, form, {
      headers: form.getHeaders()
    });
  } catch (e) {
    console.log("sendPDF:", e.response?.data || e.message);
  }
}

/* ============================================================
   REMINDERS
============================================================ */
function scheduleReminders(uid) {
  setTimeout(async () => {
    if (!userState[uid]) return;
    if (userState[uid].rem1) return;
    userState[uid].rem1 = true;
    const lang = userState[uid].lang;
    await sendMessage(uid, TEXT[lang].reminder1);
  }, 60 * 60 * 1000);

  setTimeout(async () => {
    if (!userState[uid]) return;
    if (userState[uid].rem2) return;
    userState[uid].rem2 = true;
    const lang = userState[uid].lang;
    await sendMessage(uid, TEXT[lang].reminder2);
  }, 24 * 60 * 60 * 1000);
}

/* ============================================================
   WEBHOOK
============================================================ */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;

  /* ------------------------------------------------------------
     CALLBACK HANDLERS
  ------------------------------------------------------------ */
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data;
    const chatId = cq.message.chat.id;
    const msgId = cq.message.message_id;

    // LANGUAGE SELECT
    if (data.startsWith("lang_")) {
      const lang = data.split("_")[1];
      userState[chatId] = { lang, step: "tariffs" };

      if (!userState[chatId].remScheduled) {
        userState[chatId].remScheduled = true;
        scheduleReminders(chatId);
      }

      const t = TEXT[lang];

      await answerCallback(cq.id);
      await editMessage(
        chatId,
        msgId,
        `${t.welcome}\n\n${t.choose_tariff}`,
        mainMenuInline(lang)
      );
      return;
    }

    // If language not chosen yet
    const lang = userState[chatId]?.lang;
    if (!lang) {
      await answerCallback(cq.id);
      await sendMessage(chatId, "Напишите /start");
      return;
    }
    const t = TEXT[lang];

    /* ----- TARIFFS ----- */
    if (data.startsWith("tariff_")) {
      await answerCallback(cq.id);

      const index = Number(data.split("_")[1]);
      const tariffName = t.tariffs[index];

      if (index === 3) {
        await sendMessage(chatId, t.individual_msg);
        return;
      }

      userState[chatId].tariff = tariffName;
      userState[chatId].step = "await_hash";

      const price = t.prices[index];
      const deadline = t.deadlines[index];

      const payText = `${t.pay_address_title}
<code>TDUknnJcPscxS3H9reMnzcFtKK958UAF3b</code>

${price}, ${deadline}

${t.after_payment}`;

      await sendMessage(chatId, payText, paymentInline(lang));
      return;
    }

    /* ----- SAMPLE REPORTS ----- */
    if (data === "samples") {
      await answerCallback(cq.id);

      await sendMessage(chatId, t.sending_samples);
      await sendPDF(chatId, "./files/mini.pdf", "OSINT MINI");
      await sendPDF(chatId, "./files/base.pdf", "OSINT BASE");
      await sendPDF(chatId, "./files/pro.pdf", "OSINT PRO");

      await sendMessage(chatId, t.choose_tariff, mainMenuInline(lang));
      return;
    }

    /* ----- TYPICAL CASES ----- */
    if (data === "cases") {
      userState[chatId].step = "cases";

      await answerCallback(cq.id);
      await editMessage(chatId, msgId, t.cases_text, casesBackInline(lang));
      return;
    }

    /* ----- ABOUT PLANS ----- */
    if (data === "about_plans") {
      userState[chatId].step = "about";
      await answerCallback(cq.id);

      await editMessage(chatId, msgId, t.plans_text, backInline(lang));
      return;
    }

    /* ----- BACK ----- */
    if (data === "back_main" || data === "cases_back") {
      userState[chatId].step = "tariffs";

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
      userState[chatId].step = "enter_hash";
      await answerCallback(cq.id);
      await sendMessage(chatId, t.enter_hash);
      return;
    }

    /* ----- ENTER DATA BUTTON ----- */
    if (data === "enter_data") {
      userState[chatId].step = "typing_form";
      await answerCallback(cq.id);
      await sendMessage(chatId, t.enter_data_text);
      return;
    }

    await answerCallback(cq.id);
    return;
  }

  /* ------------------------------------------------------------
     STANDARD MESSAGES
  ------------------------------------------------------------ */
  if (update.message) {
    const msg = update.message;
    const text = msg.text;
    const chatId = msg.chat.id;

    if (text === "/start") {
      userState[chatId] = { step: "choose_lang" };

      const selectLang = {
        inline_keyboard: [
          [
            { text: "Українська", callback_data: "lang_UA" },
            { text: "Русский", callback_data: "lang_RU" },
            { text: "English", callback_data: "lang_EN" }
          ]
        ]
      };

      await sendMessage(chatId, "Оберіть мову / Выберите язык / Choose language:", selectLang);
      return;
    }

    const lang = userState[chatId]?.lang;
    if (!lang) {
      await sendMessage(chatId, "Напишите /start");
      return;
    }

    const t = TEXT[lang];

    /* ----- ENTER HASH TEXT ----- */
    if (userState[chatId]?.step === "enter_hash") {
      userState[chatId].tx = text;
      userState[chatId].step = "enter_data";

      await sendMessage(chatId, t.hash_wait, hashWaitInline(lang));
      return;
    }

    /* ----- USER SENT FORM ----- */
    if (userState[chatId]?.step === "typing_form") {
      const tariff = userState[chatId].tariff;
      const tx = userState[chatId].tx;

      await sendMessage(chatId, t.order_accepted);

      const username = msg.from.username ? `@${msg.from.username}` : "без username";

      await sendMessage(
        ADMIN_ID,
        `🆕 <b>НОВЫЙ ЗАКАЗ</b>\n\n👤 Username: ${username}\n🆔 ID: ${chatId}\n📦 Тариф: ${tariff}\n💸 Хеш: ${tx}\n\n📄 Данные:\n${text}`
      );

      delete userState[chatId];
      return;
    }

    /* ----- FALLBACK ----- */
    await sendMessage(
      chatId,
      `${t.unknown}\n\n${t.choose_tariff}`,
      mainMenuInline(lang)
    );
  }
});

/* ============================================================
   SERVER
============================================================ */
app.listen(3000, () => {
  console.log("Bot running on port 3000 (inline OSINT bot)");
});
