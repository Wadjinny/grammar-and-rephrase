/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Language } from "./types";

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: "English",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    placeholder: "Type or paste your text here to check grammar and rephrase...",
    examples: [
      {
        title: "Subject-Verb & Tense",
        text: "He don't know where to goes yesterday, and he have no plans."
      },
      {
        title: "Spelling & Preposition",
        text: "I am looking forward to see you there on tomorrow, i hope you will came."
      },
      {
        title: "Punctuation & Slang",
        text: "wow this app is super cool right i mean it corrects everything in a sec..."
      }
    ]
  },
  {
    code: "French",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    placeholder: "Saisissez ou collez votre texte ici...",
    examples: [
      {
        title: "Accord & Auxiliaire",
        text: "Elle est allé à la magasin mais c'était fermé, du coup elle a durent rentrer."
      },
      {
        title: "Orthographe & Pluriel",
        text: "Ils ont acheter des nouveaux voiture de sport pour leur enfants."
      }
    ]
  },
  {
    code: "Spanish",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    placeholder: "Escribe o pega tu texto aquí...",
    examples: [
      {
        title: "Conjugación y Concordancia",
        text: "Ayer yo ir a la playa y comí mucho manzanas que estaba muy rico."
      },
      {
        title: "Tildes y Preposiciones",
        text: "La pelicula de terror que vimos en el cine me gusto mucho, fue increible."
      }
    ]
  },
  {
    code: "German",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    placeholder: "Geben Sie Ihren Text hier ein...",
    examples: [
      {
        title: "Verbkonjugation",
        text: "Ich hat gestern ein schönes Buch gelesen, aber es war zu langweilig für mich."
      },
      {
        title: "Artikel & Kasus",
        text: "Wir gehen in den schöne Park mit meinem freund heute Nachmittag."
      }
    ]
  },
  {
    code: "Italian",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    placeholder: "Digita o incolla il tuo testo qui...",
    examples: [
      {
        title: "Ausiliare e Accordi",
        text: "Noi ha andato al ristorante l'altro ieri e abbiamo mangiato una ottima pizza."
      },
      {
        title: "Ortografia",
        text: "Penso che questa sia l'opportunita migliore per noi, non credi?"
      }
    ]
  },
  {
    code: "Portuguese",
    name: "Portuguese",
    nativeName: "Português",
    flag: "🇵🇹",
    placeholder: "Digite ou cole seu texto aqui...",
    examples: [
      {
        title: "Concordância Verbal",
        text: "Eles foi ao parque de manhã e brincou com o cachorros."
      },
      {
        title: "Regência e Crase",
        text: "Eu assisti o filme ontem e fui à casa dela de noite."
      }
    ]
  },
  {
    code: "Arabic",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    placeholder: "اكتب أو الصق نصك هنا للتحقق من القواعد الإملائية والنحوية...",
    examples: [
      {
        title: "تطابق الفعل والفاعل",
        text: "ذهبوا الأولاد إلى المدرسة اليوم ولكن المعلمة لم يكن موجود."
      },
      {
        title: "أخطاء إملائية شائعة",
        text: "لاكن هاذا الامر ليس سهلاً للغاية ارجوا منك المساعدة عاجل."
      }
    ]
  },
  {
    code: "Russian",
    name: "Russian",
    nativeName: "Русский",
    flag: "🇷🇺",
    placeholder: "Введите или вставьте текст для проверки...",
    examples: [
      {
        title: "Согласование падежей",
        text: "Мы пошли в новый магазин с моими хорошими друга вчера вечером."
      }
    ]
  },
  {
    code: "Japanese",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
    placeholder: "ここにテキストを入力してください...",
    examples: [
      {
        title: "てにをは・助詞と時制",
        text: "昨日は友達とご飯を食べに行きました、そして映画をみますた。"
      }
    ]
  },
  {
    code: "Chinese",
    name: "Chinese",
    nativeName: "简体中文",
    flag: "🇨🇳",
    placeholder: "在此输入或粘贴您的文本...",
    examples: [
      {
        title: "语序与搭配",
        text: "昨天我和我的朋友去商店买零食，可是他们已经关门在五点。"
      }
    ]
  }
];
