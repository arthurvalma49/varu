import type { Rule } from "./types";

export interface SchoolPreset {
  id: string;
  name: string;
  rule: Rule;
  /** Who it applies to, as the document says. */
  scope: string;
  source?: string;
  verified: boolean;
}

/** Researched Nov 2026 from each school's hindamisjuhend. Rules change yearly: always link the source. */
export const SCHOOLS: SchoolPreset[] = [
  {
    id: "ram",
    name: "Rocca al Mare Kool",
    rule: {
      limit: { num: 1, den: 4 },
      mode: "gte",
      automatic: true,
      consequence: "Kokkuvõttev hinne on MH (mitte hinnatud).",
    },
    scope: "Hindamisjuhend 2026/27 p 3.1, poolaasta hinded",
    verified: false,
  },
  {
    id: "oru",
    name: "Oru Kool",
    rule: {
      limit: { num: 18, den: 100 },
      mode: "gte",
      automatic: false,
      consequence: "Õpetaja võib trimestri hinde panemisel kasutada kokkuvõtvat tööd.",
    },
    scope: "Hindamisjuhend 2025 p 8.6, trimestri hinne",
    source: "https://oru.edu.ee/wp-content/uploads/2025/01/HINDAMISJUHEND-2025.pdf",
    verified: true,
  },
  {
    id: "miina-harma",
    name: "Miina Härma Gümnaasium",
    rule: {
      limit: { num: 1, den: 3 },
      mode: "gte",
      automatic: false,
      consequence: "Õpetaja võib määrata kogu kursust hõlmava töö.",
    },
    scope: "Hindamisjuhend 01.09.2026 §68, gümnaasium (10.–12. kl)",
    source: "https://miinaharma.ee/failid/hindamisjuhend_01_09_2026.pdf",
    verified: true,
  },
  {
    id: "voru",
    name: "Võru Gümnaasium",
    rule: {
      limit: { num: 1, den: 3 },
      mode: "gt",
      automatic: false,
      consequence: "Õpetaja võib muuta kursuse hindamise korraldust.",
    },
    scope: "Hindamise kord p 3.3.4, kursus",
    source: "https://voru.edu.ee/wp-content/uploads/2024/11/Lisa_5_Voru-Gumnaasiumi-opilase-hindamise-tingimused-ja-kord.pdf",
    verified: true,
  },
  {
    id: "emmaste",
    name: "Emmaste Põhikool",
    rule: {
      limit: { num: 40, den: 100 },
      mode: "gte",
      automatic: false,
      consequence: "Õpetaja võib nõuda kogu õppeperioodi arvestuslikku tööd.",
    },
    scope: "Hindamisjuhend okt 2024 p 2.1.9, õppeperiood",
    source: "https://emmaste.edu.ee/sites/emmaste.edu.ee/files/2025-02/hindamisjuhend_okt.2024_0.pdf",
    verified: true,
  },
  {
    id: "tfk",
    name: "Tartu Forseliuse Kool",
    rule: {
      limit: { num: 1, den: 2 },
      mode: "gt",
      automatic: false,
      consequence: "Tervislikel põhjustel puudumisel võib õpetaja jätta trimestri hinde välja panemata.",
    },
    scope: "Hindamisjuhend 2024/25 p 4.5, trimester",
    source: "https://tfk.tartu.ee/wp-content/uploads/2024/ainekavad/TFK%20hindamisjuhend%2024-25.pdf",
    verified: true,
  },
  {
    id: "kadrina",
    name: "Kadrina Keskkool",
    rule: {
      limit: { num: 1, den: 2 },
      mode: "gt",
      automatic: false,
      consequence: "Vabandaval põhjusel puudumisel võib õpetaja jätta kursusehinde välja panemata.",
    },
    scope: "Hindamisjuhend p 9(2)5, gümnaasium",
    source: "https://kadrina-kool.edu.ee/kadrina-new/wp-content/uploads/2024/05/hindamisjuhend_g.pdf",
    verified: true,
  },
];

export const CUSTOM_RULE: Rule = {
  limit: { num: 1, den: 4 },
  mode: "gte",
  automatic: true,
  consequence: "Kokkuvõttev hinne võib jääda panemata.",
};
