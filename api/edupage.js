/**
 * Proxy for a school's *public* aSc EduPage timetable. EduPage sends no CORS headers, so the
 * PWA cannot fetch it directly. Only <school>.edupage.org is ever contacted, and the response is
 * trimmed to what the app needs (no teacher names, no classrooms).
 *
 *   GET /api/edupage?school=pae          -> { defaultTt, timetables: [{ tt_num, text, datefrom, hidden }] }
 *     (hidden = an earlier timetable; still public, used to rebuild the whole grading window)
 *   GET /api/edupage?school=pae&tt=334   -> EduData (see src/core/edupage.ts)
 */

import { request } from "node:https";

/**
 * POST to EduPage over IPv4 only. EduPage (Hetzner) also has an IPv6 address, and Vercel's
 * functions have no IPv6 route: when Node picked it, connections hung until a 10 s timeout.
 */
const postOnce = (school, path, args) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify({ __args: args, __gsh: "00000000" });
    const req = request(
      {
        host: `${school}.edupage.org`,
        path: `/timetable/server/${path}`,
        method: "POST",
        family: 4,
        timeout: 5000,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          if (res.statusCode !== 200) return reject(Object.assign(new Error(`edupage ${res.statusCode}`), { code: `HTTP_${res.statusCode}` }));
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(Object.assign(new Error("bad json"), { code: "BAD_JSON" }));
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "TIMEOUT" })));
    req.on("error", reject);
    req.end(body);
  });

const post = async (school, path, args) => {
  try {
    return await postOnce(school, path, args);
  } catch (e) {
    if (e?.code === "ENOTFOUND") throw e; // no such school: retrying will not help
    return postOnce(school, path, args);
  }
};

const pick = (rows, keys) => (rows || []).map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const school = String(req.query.school || "").toLowerCase();
  const tt = req.query.tt ? String(req.query.tt) : "";
  if (!/^[a-z0-9-]{2,40}$/.test(school) || (tt && !/^\d{1,8}$/.test(tt))) {
    res.status(400).send(JSON.stringify({ error: "bad-request" }));
    return;
  }
  try {
    if (!tt) {
      const now = new Date();
      const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
      let reg = null;
      for (const y of [year, year - 1]) {
        const d = await post(school, "ttviewer.js?__func=getTTViewerData", [null, y]);
        reg = d?.r?.regular;
        if (reg?.timetables?.length) break;
      }
      const timetables = (reg?.timetables || []).map((t) => ({ tt_num: String(t.tt_num), text: String(t.text || ""), datefrom: t.datefrom, hidden: !!t.hidden }));
      if (!timetables.length) {
        res.status(404).send(JSON.stringify({ error: "no-public-timetable" }));
        return;
      }
      res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
      res.status(200).send(JSON.stringify({ defaultTt: reg.default_num || timetables[timetables.length - 1].tt_num, timetables }));
      return;
    }

    const d = await post(school, "regulartt.js?__func=regularttGetData", [null, tt]);
    const tables = Object.fromEntries((d?.r?.dbiAccessorRes?.tables || []).map((t) => [t.id, t.data_rows || []]));
    if (!tables.lessons) {
      res.status(404).send(JSON.stringify({ error: "no-timetable" }));
      return;
    }
    const g = tables.globals?.[0] || {};
    const out = {
      schoolName: String(g.reg_name || g.name || "").split(",")[0].trim(),
      periods: pick(tables.periods, ["id", "period", "short"]),
      classes: pick(tables.classes, ["id", "name"]),
      subjects: pick(tables.subjects, ["id", "name"]),
      groups: pick(tables.groups, ["id", "name", "classid", "entireclass"]),
      divisions: pick(tables.divisions, ["id", "classid", "groupids"]),
      lessons: pick(tables.lessons, ["id", "subjectid", "classids", "groupids", "durationperiods"]),
      cards: pick(tables.cards, ["lessonid", "period", "days", "weeks"]),
    };
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(JSON.stringify(out));
  } catch (e) {
    // The reason (e.g. a timeout or a refused connection) helps tell a school typo from EduPage blocking us.
    const reason = e?.code || e?.cause?.code || e?.name || String(e?.message || "unknown").slice(0, 80);
    res.status(reason === "ENOTFOUND" ? 404 : 502).send(JSON.stringify({ error: reason === "ENOTFOUND" ? "no-public-timetable" : "edupage-unreachable", reason }));
  }
}
