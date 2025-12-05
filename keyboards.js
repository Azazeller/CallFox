import { TEXT } from "./texts.js";

export function mainMenuInline(lang) {
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

export function paymentInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.confirm_payment, callback_data: "confirm_payment" }],
      [{ text: t.contact_operator, url: "https://t.me/CALLFOX" }],
    ],
  };
}

export function hashWaitInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.enter_data_btn, callback_data: "enter_data" }],
    ],
  };
}

export function backInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.back, callback_data: "back_main" }],
    ],
  };
}
