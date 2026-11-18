/**
 * Proxy for a school's *public* aSc EduPage timetable. EduPage sends no CORS headers, so the
 * PWA cannot fetch it directly. Only <school>.edupage.org is ever contacted, and the response is
 * trimmed to what the app needs (no teacher names, no classrooms).
 *
 *   GET /api/edupage?school=pae          -> { defaultTt, timetables: [{ tt_num, text, datefrom, hidden }] }
 *     (hidden = an earlier timetable; still public, used to rebuild the whole grading window)
 *   GET /api/edupage?school=pae&tt=334   -> EduData (see src/core/edupage.ts)
 */

const post = async (school, path, args) => {
  const r = await fetch(`https://${school}.edupage.org/timetable/server/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ __args: args, __gsh: "00000000" }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`edupage ${r.status}`);
  return r.json();
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
  } catch {
    res.status(502).send(JSON.stringify({ error: "edupage-unreachable" }));
  }
}
