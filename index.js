import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import FormData from "form-data";

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
   SEND TEXT MESSAGE
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
   EDIT MESSAGE (INLINE)
============================================================ */
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

/* ============================================================
   ANSWER CALLBACK QUERY
============================================================ */
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

/* ============================================================
   SEND DOCUMENT (PDF)
============================================================ */
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
   TEXT LOCALIZATION (с тарифами и кнопками)
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
      "Введіть дані за шаблоном:\n\nПІБ:\nТелефон (якщо відомо):\nПосилання на inst/ТГ/FB/інше:",

    order_accepted:
      "Ваше замовлення прийнято! Після підтвердження оплати наші спеціалісти почнуть роботу.",

    unknown: "Команда не розпізнана. Напишіть /start",

    tariffs: ["Міні", "Базовий", "Розширений", "Індивідуальний"],

    about_plans: "Про тарифи",
    samples: "Зразки звітів",
    sending_samples: "Надсилаю PDF-зразки звітів…",
    back: "Назад",

    plans_text: `OSINT MINI — швидка перевірка людини за мінімальною ціною
OSINT MINI — коротка перевірка, що показує найважливіше з відкритих джерел.
Платите тільки за ключову інформацію, без зайвих деталей.
Що ви отримуєте:
👤 1. Базові дані
ПІБ, місто, дата народження (якщо знайдена), номер телефону, email — все, що можна швидко і точно зібрати.
🌐 2. Основні соцмережі
VK, Telegram, Instagram (за наявності), перевірка по нікнеймах і збігах.
🕳️ 3. Перевірка утечок (email і контакти)
Швидкий пошук у відкритих базах утечок. Якщо збіг — вкажемо джерело і рік.
⚠️ 4. Міні-профіль ризику
Коротка оцінка: низький / середній / підвищений.
📝 5. Короткий підсумок
Що знайшли, що збіглося, що можна поглибити в BASE.

OSINT BASE — повний розширений звіт
OSINT BASE — розширений одноразовий звіт з перевіреними даними.
Що входить:
🔍 1. Повні персональні дані
Усі варіанти ПІБ, дата народження, місто, активні контакти, нікнейми, старі анкети.
🌐 2. Повний розбір соцмереж
VK, Telegram, Instagram, Facebook, TikTok — посилання, активність, ймовірність належності.
🕳 3. Перевірка у витоках
Пошук email, телефонів і нікнеймів у великих відкритих базах — з джерелом і роком.
🧩 4. Аналіз цифрових слідів
Архіви, старі профілі, сліди на форумах, оголошення, кеші пошуковиків.
🧷 5. Зв’язки й оточення
До ~10 пов’язаних акаунтів і контактів, що спливають поруч.
⚠️ 6. Ризик-профіль
Оцінка ризику + 2–3 фактори, що впливають.
📝 7. Чіткий підсумок
Що знайдено, що підтверджено, що можна розширити в PRO.

OSINT PRO — глибоке досьє від А до Я
OSINT PRO — повний детальний звіт: соцмережі, витоки, зв’язки, архіви і цифрова історія.
Що ви отримуєте:
📌 1. Повна валідація особистості
Всі варіанти ПІБ, вік, місто, старі анкети, перетини з реєстрами.
📱 2. Розширений розбір телефонів
Історія появи в мережі, прив’язки, старі оголошення, пов’язані контакти.
✉️ 3. Повне досьє по email
Глибока перевірка в утечках, старі реєстрації, знайдені логіни.
🌐 4. Розгорнута аналітика соцмереж
Профілі, активність, альт-акаунти, архіви WebArchive.
🧩 5. Аналіз зв’язків і оточення
Десятки знайдених зв’язків, рівень близькості.
🕳 6. Глибокий digital footprint
Форуми, ігри, старі проєкти, кеші, оголошення, нікнейми.
⚠️ 7. Розширений ризик-профіль
Рівень ризику + ключові фактори.
📝 8. Підсумковий розбір + рекомендації

OSINT INDIVIDUAL — персональне розслідування під задачу
INDIVIDUAL — індивідуальна робота під конкретну мету.
Включає: розслідування під задачу, глибину OSINT, аналіз оточення PRO+, розширений digital footprint, розширений ризик-профіль.
Додатково за запитом: паспортні дані, перетини кордону, майно, банківські сліди, деталізація дзвінків, реєстраційні дані компаній, інше.
Перелік не є вичерпним — допоможемо в складних задачах.`
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
      "Введите данные по шаблону:\n\nФИО:\nТелефон (если известно):\nСсылка на inst/ТГ/FB/другое:",

    order_accepted:
      "Ваш заказ принят! После подтверждения оплаты специалисты приступят к работе.",

    unknown: "Не понял команду. Напишите /start",

    tariffs: ["Мини", "Базовый", "Расширенный", "Индивидуальный"],

    about_plans: "О тарифах",
    samples: "Образцы отчётов",
    sending_samples: "Отправляю PDF-образцы отчётов…",
    back: "Назад",

    plans_text: `OSINT MINI — быстрый пробив по человеку за минимальную цену
OSINT MINI — это короткая проверка, которая показывает самое важное о человеке из открытых источников.
Вы платите только за ключевую информацию, без лишних деталей.
Что именно вы получаете:
👤 1. Базовые данные
ФИО, город, дата рождения (если найдена), номер телефона, email — всё, что можно собрать быстро и точно.
🌐 2. Основные соцсети
VK, Telegram, Instagram (если есть), проверка по никнеймам и совпадениям.
🕳️ 3. Проверка утечек (email и контакты)
Быстрый поиск в открытых базах утечек. Есть совпадение — укажем источник и год.
⚠️ 4. Мини-профиль риска
Краткая оценка: низкий / средний / повышенный.
📝 5. Короткий итог
Что нашли, что совпало, что можно докопать глубже в BASE.

OSINT BASE — полный пробив, где вы платите только за конкретный результат
OSINT BASE — расширенный разовый отчёт, который показывает всё, что реально можно узнать о человеке из открытых источников.
Что вы получаете:
🔍 1. Полные персональные данные
Все найденные ФИО-варианты, дата рождения, город, активные контакты (телефоны, email’ы), никнеймы, старые анкеты.
🌐 2. Полный разбор соцсетей
VK, Telegram, Instagram, Facebook, TikTok — с ссылками, статусом активности, совпадениями и вероятностью принадлежности.
🕳️ 3. Проверка в утечках
Поиск email’ов, телефонов и никнеймов в крупных открытых утечках. Каждая находка — с указанием источника и года.
🧩 4. Анализ цифровых следов
Архивы, старые профили, забытые аккаунты, следы на форумах, объявления, кеши поисковиков.
🧷 5. Связи и окружение
До ~10 связанных аккаунтов и контактов, которые всплывают рядом с объектом.
⚠️ 6. Риск-профиль
Короткая и понятная оценка риска: низкий / средний / высокий.
📝 7. Чёткий итоговый вывод
Что нашли, что подтвердилось, что можно расширить дальше в PRO.

OSINT PRO — полный глубокий пробив по человеку от А до Я
OSINT PRO — это расширенный отчёт, где мы не просто собираем открытые данные, а строим полноценное досье: соцсети, утечки, связи, архивы и всю цифровую историю человека.
Что конкретно вы получаете в OSINT PRO:
📌 1. Полная валидация личности
Все найденные варианты ФИО, возраст, город, старые анкеты, пересечения с публичными реестрами и архивами.
📱 2. Расширенный разбор телефонов
История появления в сети, сервисы, привязки, старые объявления, повторы на форумах, связанные контакты.
✉️ 3. Полное досье по email
Глубокая проверка в утечках, списки сервисов, старые регистрации, найденные логины и хеши.
🌐 4. Развёрнутая аналитика соцсетей
Все профили: активность, комментарии, группы, альт-аккаунты, старые и удалённые публикации, архивы WebArchive.
🧩 5. Анализ связей и окружения
До десятков найденных связей: друзья, контакты, совместные упоминания, цифровое окружение и уровень близости.
🕳 6. Глубокий digital footprint
Форумы, игры, старые проекты, кэши, зеркала, объявления, никнеймы и вся цифровая история.
⚠️ 7. Расширенный риск-профиль
Уровень риска + ключевые факторы: открытость, цифровые привычки, уязвимости, возможные скрытые активности.
📝 8. Итоговый разбор + рекомендации

OSINT INDIVIDUAL — персональное расследование под любую задачу
OSINT INDIVIDUAL — это не стандартный отчёт, а глубокая работа под конкретную цель.
Каждый поиск строится индивидуально, чтобы дать ответ на запрос клиента, а не просто собрать данные.
Входит: расследование под задачу, максимальная глубина OSINT, анализ окружения уровня PRO+, расширенный digital footprint, расширенный риск-профиль.
Дополнительно по запросу: паспортные данные, пересечения границы, зарегистрированное имущество и транспорт, банковские следы, детализация звонков, регистрационные данные компаний и т.д.
Перечень не является исчерпывающим. Готовы помочь в самых сложных задачах.`
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
      "Enter the information using this template:\n\nFull name:\nPhone (optional):\nLink to Instagram/Telegram/Facebook/other:",

    order_accepted:
      "Your request has been accepted! After payment confirmation our specialists will begin work.",

    unknown: "Unknown command. Type /start",

    tariffs: ["MINI", "BASIC", "EXTENDED", "INDIVIDUAL"],

    about_plans: "About plans",
    samples: "Sample reports",
    sending_samples: "Sending sample PDF reports…",
    back: "Back",

    plans_text: `OSINT MINI — quick check at minimal price
OSINT MINI is a short check that reveals the most important public information about a person.
You pay only for key facts, no extra details.
What you get:
👤 1. Basic data
Full name, city, date of birth (if found), phone number, email — everything that can be collected quickly and accurately.
🌐 2. Main social networks
VK, Telegram, Instagram (if present), nickname checks and matches.
🕳️ 3. Leak check (emails and contacts)
Fast search in public breach databases. If there is a match — source and year will be indicated.
⚠️ 4. Mini risk profile
Short assessment: low / medium / elevated.
📝 5. Short summary
What was found, what matched, what can be dug deeper in BASE.

OSINT BASE — full extended report
OSINT BASE is an extended one-time report showing everything realistically discoverable from open sources.
What you receive:
🔍 1. Full personal data
All found name variants, date of birth, city, active contacts (phones, emails), nicknames, old profiles.
🌐 2. Full social media breakdown
VK, Telegram, Instagram, Facebook, TikTok — links, activity status, matches and probability of ownership.
🕳️ 3. Leak checks
Search for emails, phones and nicknames in major public breaches — each hit with source and year.
🧩 4. Digital footprint analysis
Archives, old profiles, forgotten accounts, forum traces, ads, search engine caches.
🧷 5. Connections and environment
Up to ~10 related accounts/contacts that appear near the subject.
⚠️ 6. Risk profile
Short clear risk assessment: low / medium / high.
📝 7. Clear final conclusion
What was found, what was confirmed, what can be expanded in PRO.

OSINT PRO — deep full dossier A to Z
OSINT PRO is a comprehensive report: social networks, leaks, connections, archives and the subject’s digital history.
What you get:
📌 1. Full identity validation
All found name variants, age, city, old profiles, intersections with public registries and archives.
📱 2. Extended phone analysis
History of online appearances, services, bindings, old ads, repeats on forums, linked contacts.
✉️ 3. Full email dossier
Deep leak checks, service lists, old registrations, found logins and hashes.
🌐 4. Advanced social media analytics
All profiles: activity, comments, groups, alt accounts, old/removed posts, WebArchive records.
🧩 5. Connections and environment analysis
Dozens of found connections: friends, contacts, co-mentions, digital environment and proximity level.
🕳 6. Deep digital footprint
Forums, games, old projects, caches, mirrors, ads, nicknames and the full digital history recoverable.
⚠️ 7. Extended risk profile
Risk level + key contributing factors.
📝 8. Final analysis + recommendations

OSINT INDIVIDUAL — tailored investigation for specific tasks
INDIVIDUAL is a custom investigation built to answer the client’s specific question rather than just collect data.
Includes: task-oriented investigation, PRO+ level depth of OSINT, environment analysis, extended digital footprint, extended risk profile.
Additionally on request: passport data, border crossings, registered assets and vehicles, bank traces, call detail, company registration data, etc.
List is not exhaustive — we can assist with the most complex tasks.`
  },
};

/* ============================================================
   INLINE KEYBOARDS
============================================================ */
function mainMenuInline(lang) {
  const t = TEXT[lang];
  const tariffs = t.tariffs;
  return {
    inline_keyboard: [
      [
        { text: tariffs[0], callback_data: "tariff_0" },
        { text: tariffs[1], callback_data: "tariff_1" },
      ],
      [
        { text: tariffs[2], callback_data: "tariff_2" },
        { text: tariffs[3], callback_data: "tariff_3" },
      ],
      [{ text: t.samples, callback_data: "samples" }],
      [{ text: t.about_plans, callback_data: "about_plans" }],
      [{ text: t.contact_operator, url: "https://t.me/CALLFOX" }],
    ],
  };
}

function paymentInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.confirm_payment, callback_data: "confirm_payment" }],
      [{ text: t.contact_operator, url: "https://t.me/CALLFOX" }],
    ],
  };
}

function hashWaitInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.enter_data_btn, callback_data: "enter_data" }],
    ],
  };
}

function backInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.back, callback_data: "back_main" }],
    ],
  };
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

    // Пока нет lang — игнорим, предлагаем /start через обычное сообщение
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

      userState[uid] = { lang: selLang, step: "tariffs" };

      await answerCallback(cq.id);
      await editMessage(
        chatId,
        msgId,
        TEXT[selLang].choose_tariff,
        mainMenuInline(selLang)
      );
      return;
    }

    /* From here down we assume lang already known */
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

      await sendMessage(
        chatId,
        `${t.pay_address_title}\n<code>TDUknnJcPscxS3H9reMnzcFtKK958UAF3b</code>\n\n${t.after_payment}`,
        paymentInline(lang)
      );
      return;
    }

    /* ----- SAMPLES: PDF REPORTS ----- */
    if (data === "samples") {
      await answerCallback(cq.id);

      await sendMessage(chatId, t.sending_samples);
      await sendPDF(chatId, "./files/mini.pdf", "OSINT MINI");
      await sendPDF(chatId, "./files/base.pdf", "OSINT BASE");
      await sendPDF(chatId, "./files/pro.pdf", "OSINT PRO");

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
        t.choose_tariff,
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

    await sendMessage(
      uid,
      t.hash_wait,
      hashWaitInline(lang)
    );
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
  console.log("Bot running on port 3000 (inline version)");
});
