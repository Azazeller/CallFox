import { TEXT } from "./texts.js";

/* ============================================================
   MAIN MENU INLINE
============================================================ */
export function mainMenuInline(lang) {
  const t = TEXT[lang];

  return {
    inline_keyboard: [
      [
        { text: t.tariffs[0], callback_data: "tariff_0" },
        { text: t.tariffs[1], callback_data: "tariff_1" }
      ],
      [
        { text: t.tariffs[2], callback_data: "tariff_2" },
        { text: t.tariffs[3], callback_data: "tariff_3" }
      ],
      [
        { text: t.about_plans, callback_data: "about_plans" }
      ],
      [
        { text: t.samples, callback_data: "samples" }
      ],
      [
        { text: t.cases, callback_data: "cases" }
      ],
      [
        { text: t.video_tutorial, callback_data: "video_tutorial" }
      ],
      [
        { text: t.contact_operator, callback_data: "contact_operator" }
      ]
    ]
  };
}

/* ============================================================
   PAYMENT INLINE
============================================================ */
export function paymentInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.confirm_payment, callback_data: "confirm_payment" }],
      [{ text: t.contact_operator, callback_data: "contact_operator" }]
    ]
  };
}

/* ============================================================
   HASH WAIT INLINE
============================================================ */
export function hashWaitInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.enter_data_btn, callback_data: "enter_data" }]
    ]
  };
}

/* ============================================================
   BACK INLINE
============================================================ */
export function backInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.back, callback_data: "back_main" }]
    ]
  };
}

/* ============================================================
   BACK INLINE FOR CASES
============================================================ */
export function casesBackInline(lang) {
  const t = TEXT[lang];
  return {
    inline_keyboard: [
      [{ text: t.back, callback_data: "back_main" }]
    ]
  };
}
