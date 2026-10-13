/**
 * Grammar-check eval cases. `fixes` lists text the output must contain (any alternative in a group
 * counts), which also covers abbreviations that must survive; `errors` lists text that must be gone.
 * `clean` texts should come back unchanged; `endsWith` lists acceptable endings of the corrected text.
 */
export type EvalCase = {
  id: string;
  language: string;
  text: string;
  options?: { keepAbbreviations?: boolean; endWithFullStop?: boolean; allowMixedLanguages?: boolean };
  fixes?: string[][];
  errors?: string[];
  clean?: boolean;
  endsWith?: string[];
};

export const CASES: EvalCase[] = [
  {
    id: "en-restaurant",
    language: "English",
    text: "Yesterday me and my freind goes to the new restaurant downtown, it was realy crowded but we finded a table near the window.",
    fixes: [["friend"], ["went"], ["really"], ["found"]],
    errors: ["freind", " goes ", "realy", "finded"],
  },
  {
    id: "en-tense",
    language: "English",
    text: "He don't know where to goes yesterday, and he have no plans.",
    fixes: [["didn't know", "did not know", "doesn't know", "does not know"], ["to go", "he went"], ["had no plans", "has no plans"]],
    errors: ["don't know", "to goes", "have no plans"],
  },
  {
    id: "en-forward",
    language: "English",
    text: "I am looking forward to see you there on tomorrow, i hope you will came.",
    fixes: [["looking forward to seeing"], ["I hope"], ["will come"]],
    errors: ["on tomorrow", "will came"],
  },
  {
    id: "en-homophones",
    language: "English",
    text: "Their going to announce the results tomorow, its going to effect everyone in the department.",
    fixes: [["They're", "They are"], ["tomorrow"], ["it's", "it is", "It's", "It is"], ["affect"]],
    errors: ["Their going", "tomorow", "effect everyone"],
  },
  {
    id: "en-email",
    language: "English",
    text:
      "Dear Mr. Smith, I am writting to inform you that the shipment you ordered last week have been delayed due to a problem at our warehouse. " +
      "The items should arrive no later then Friday. If you has any question, please dont hesitate to contact me directly. Best regards, Anna",
    fixes: [["writing"], ["has been delayed"], ["later than"], ["you have any"], ["don't", "do not"]],
    errors: ["writting", "have been delayed", "later then", "you has", "dont "],
  },
  {
    id: "en-casual",
    language: "English",
    text: "wow this app is super cool right i mean it corrects everything in a sec",
    fixes: [["Wow"], ["I mean"]],
    // Full stop option is off by default, so none may be added at the end
    endsWith: ["sec"],
  },
  {
    id: "en-clean-report",
    language: "English",
    text: "The quarterly report is attached. Please review it before Thursday's meeting and let me know if you have any questions.",
    clean: true,
  },
  {
    id: "en-clean-paris",
    language: "English",
    text: "She has lived in Paris since 2019, and she still loves walking along the Seine in the evening.",
    clean: true,
  },
  {
    id: "fr-marche",
    language: "French",
    text: "Hier, je suis allé au marché et j'ai acheter des pommes. Les pommes était très bonne.",
    fixes: [["j'ai acheté", "j’ai acheté"], ["étaient"], ["très bonnes"]],
    errors: ["acheter des", "était très"],
  },
  {
    id: "fr-clean",
    language: "French",
    text: "Nous avons terminé le projet à temps et le client était satisfait du résultat.",
    clean: true,
  },
  {
    id: "es-agua",
    language: "Spanish",
    text: "Ayer fui a la playa con mis amigos. La agua estaba muy fría pero nos divertimos mucho.",
    fixes: [["El agua"]],
    errors: ["La agua"],
  },
  {
    id: "de-fussball",
    language: "German",
    text: "Ich habe gestern mit meine Freunde Fußball gespielt und wir hat gewonnen.",
    fixes: [["mit meinen Freunden"], ["wir haben gewonnen"]],
    errors: ["meine Freunde", "wir hat"],
  },
  {
    id: "ja-eiga",
    language: "Japanese",
    text: "昨日、私は友達と映画を見に行きます。とても面白いでした。",
    fixes: [["行きました"], ["面白かった"]],
    errors: ["面白いでした"],
  },
  {
    id: "opt-abbrev",
    language: "English",
    text: "Hi Tom, can you pls send me the report asap? The client have approved it, fyi.",
    options: { keepAbbreviations: true },
    fixes: [["has approved"], [" pls "], ["asap"], ["fyi"]],
    errors: ["have approved", "please", "as soon as possible", "for your information"],
  },
  {
    id: "opt-stop",
    language: "English",
    text: "thanks for the update i will review it tomorrow",
    options: { endWithFullStop: true },
    fixes: [["Thanks"], [" I will"]],
    endsWith: ["."],
  },
  {
    id: "opt-no-stop",
    language: "English",
    text: "thanks for the update i will review it tomorrow",
    options: { endWithFullStop: false },
    fixes: [["Thanks"], [" I will"]],
    endsWith: ["tomorrow"],
  },
  {
    id: "opt-stop-question",
    language: "English",
    text: "can you send me the slides before the meeting",
    options: { endWithFullStop: true },
    fixes: [["Can you"]],
    endsWith: ["?"],
  },
  {
    id: "opt-stop-ja",
    language: "Japanese",
    text: "明日の会議の資料を送ってください",
    options: { endWithFullStop: true },
    endsWith: ["。"],
  },
  {
    id: "opt-both",
    language: "English",
    text: "pls review the doc asap, the deadline are friday",
    options: { keepAbbreviations: true, endWithFullStop: true },
    fixes: [["deadline is"], ["Friday"], ["asap"], ["doc"]],
    errors: ["deadline are", "as soon as possible", "document"],
    endsWith: ["."],
  },
  {
    id: "opt-mixed-fr",
    language: "French",
    text: "Je vais envoyer le feedback demain, mais le meeting a été annulé et les slides ne est pas prêtes.",
    options: { allowMixedLanguages: true },
    fixes: [["feedback"], ["meeting"], ["slides"], ["ne sont pas"]],
    errors: ["ne est pas", "retour", "réunion", "diapositives"],
  },
  {
    id: "opt-mixed-en",
    language: "English",
    text: "My abuela always say que la vida es bella, and she were right about it.",
    options: { allowMixedLanguages: true },
    fixes: [["abuela"], ["que la vida es bella"], ["always says"], ["she was right"]],
    errors: ["always say ", "she were", "grandmother", "life is beautiful"],
  },
  {
    id: "opt-mixed-de",
    language: "German",
    text: "Wir haben das Meeting verschoben, weil der Deadline zu knapp war.",
    options: { allowMixedLanguages: true },
    fixes: [["Meeting"], ["die Deadline"]],
    errors: ["der Deadline", "Besprechung", "Frist"],
  },
  {
    // Foreign words that look like misspellings of the main language: the case this option is for
    id: "opt-mixed-lookalike",
    language: "English",
    text: "I need to finish this projet before vendredi because it's très important for the client.",
    options: { allowMixedLanguages: true },
    fixes: [["vendredi"], ["très"]],
    errors: ["Friday", "very important"],
  },
];
