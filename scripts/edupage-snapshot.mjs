/**
 * Save a school's public EduPage timetables as static files the app can read without a live fetch.
 * EduPage often refuses connections from cloud servers (Vercel), but accepts ordinary machines.
 *
 *   node scripts/edupage-snapshot.mjs ramkool
 *
 * Writes public/edupage/<school>/index.json (the list, plus when it was taken) and one
 * <tt_num>.json per timetable of the current school year. Re-run when the school publishes a
 * new period, then commit and deploy.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import handler from "../api/edupage.js";

const school = process.argv[2];
if (!school) throw new Error("usage: node scripts/edupage-snapshot.mjs <school>");

const call = (query) =>
  new Promise((resolve, reject) => {
    const res = {
      setHeader() {},
      status(c) {
        this.code = c;
        return this;
      },
      send(b) {
        const body = JSON.parse(b);
        this.code === 200 ? resolve(body) : reject(new Error(`${JSON.stringify(query)} -> ${this.code} ${b}`));
      },
    };
    handler({ query }, res);
  });

const list = await call({ school });
const now = new Date();
const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
const thisYear = list.timetables.filter((t) => (t.datefrom ?? "") >= `${y}-08-01` || t.tt_num === list.defaultTt);
const dir = new URL(`../public/edupage/${school}/`, import.meta.url);
mkdirSync(dir, { recursive: true });
for (const t of thisYear) {
  const data = await call({ school, tt: t.tt_num });
  writeFileSync(new URL(`${t.tt_num}.json`, dir), JSON.stringify(data));
  console.log(`${school} ${t.tt_num} ${t.text}: ${data.classes.length} classes`);
}
writeFileSync(new URL("index.json", dir), JSON.stringify({ ...list, timetables: thisYear, snapshot: now.toISOString().slice(0, 10) }));
console.log(`saved ${thisYear.length} timetables to public/edupage/${school}/`);
