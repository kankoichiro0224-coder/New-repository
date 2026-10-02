"use strict";
const WEATHER = [
  { max: 20, icon: "☀️", label: "快晴(楽観)" },
  { max: 40, icon: "🌤️", label: "晴れ" },
  { max: 60, icon: "☁️", label: "曇り" },
  { max: 80, icon: "🌧️", label: "雨(警戒)" },
  { max: 101, icon: "⛈️", label: "嵐(パニック)" },
];
const BAND = ["#ffe066", "#ffec99", "#dee2e6", "#a5d8ff", "#845ef7"];
const $ = (id) => document.getElementById(id);
const weatherOf = (f) => WEATHER.find((w) => f < w.max);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** Merge the two series on date; compute composite fear (0-100, high = fearful). */
function merge(data) {
  const fg = new Map(data.fear_greed.map((r) => [r.date, r.score]));
  const vis = data.nikkei_vi.map((r) => r.close);
  const rows = [];
  data.nikkei_vi.forEach((r, i) => {
    if (!fg.has(r.date)) return;
    const hist = vis.slice(0, i + 1);
    const pct = (100 * hist.filter((v) => v <= r.close).length) / hist.length;
    rows.push({ date: r.date, vi: r.close, fg: fg.get(r.date), fear: (pct + (100 - fg.get(r.date))) / 2 });
  });
  return rows;
}

function line(rows, key, x, y) {
  return rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join("");
}

function chart(el, rows, series, opts = {}) {
  const W = 960, H = 320, m = { l: 44, r: 44, t: 10, b: 24 };
  const x = (i) => m.l + (i / (rows.length - 1)) * (W - m.l - m.r);
  const mk = (key, lo, hi) => (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  const ext = (k) => [Math.min(...rows.map((r) => r[k])), Math.max(...rows.map((r) => r[k]))];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  if (opts.bands) {
    const y = mk("fear", 0, 100);
    BAND.forEach((c, i) => (s += `<rect x="${m.l}" y="${y((i + 1) * 20)}" width="${W - m.l - m.r}" height="${y(i * 20) - y((i + 1) * 20)}" fill="${c}" opacity=".35"/>`));
  }
  series.forEach((se, n) => {
    const [a, b] = se.range || ext(se.key);
    const y = mk(se.key, a, b);
    for (let t = 0; t <= 4; t++) {
      const v = a + ((b - a) * t) / 4, yy = y(v);
      if (n === 0) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" stroke="${css("--line")}"/>`;
      s += `<text x="${n ? W - m.r + 4 : m.l - 6}" y="${yy + 4}" text-anchor="${n ? "start" : "end"}">${v.toFixed(0)}</text>`;
    }
    s += `<path d="${line(rows, se.key, x, y)}" fill="none" stroke="${css(se.color)}" stroke-width="2"/>`;
  });
  [0, Math.floor(rows.length / 2), rows.length - 1].forEach((i) => (s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i ? (i === rows.length - 1 ? "end" : "middle") : "start"}">${rows[i].date}</text>`));
  s += `<line id="cur" y1="${m.t}" y2="${H - m.b}" stroke="${css("--muted")}" visibility="hidden"/></svg><div class="muted tip"> </div>`;
  el.innerHTML = s;
  const svg = el.querySelector("svg"), cur = el.querySelector("#cur"), tip = el.querySelector(".tip");
  svg.addEventListener("pointermove", (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (rows.length - 1))));
    cur.setAttribute("x1", x(i)); cur.setAttribute("x2", x(i)); cur.setAttribute("visibility", "visible");
    const d = rows[i];
    tip.textContent = `${d.date}  日経VI ${d.vi.toFixed(2)} / F&G ${d.fg.toFixed(1)} / 恐怖度 ${d.fear.toFixed(0)}`;
  });
}

function delta(a, b, digits = 1) {
  const d = a - b;
  return `前日比 ${d >= 0 ? "+" : ""}${d.toFixed(digits)}`;
}

async function main() {
  let data;
  try {
    const res = await fetch("data/latest.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch (e) {
    $("meta").textContent = "データを読み込めませんでした。fetcher/fetch_data.py を実行してください。";
    return;
  }
  const rows = merge(data);
  if (rows.length < 2) { $("meta").textContent = "表示できるデータが足りません。"; return; }
  const last = rows.at(-1), prev = rows.at(-2), w = weatherOf(last.fear);
  $("meta").textContent = `最終データ日: ${last.date} / 取得: ${data.generated_at}`;
  if (data.mode === "sample") { $("banner").hidden = false; $("banner").textContent = "⚠ これは合成のサンプルデータです(実際の相場ではありません)。"; }
  $("icon").textContent = w.icon; $("wlabel").textContent = w.label;
  $("wsub").textContent = `VI ${last.vi.toFixed(1)} / F&G ${last.fg.toFixed(0)}`;
  $("vi").textContent = last.vi.toFixed(2); $("vid").textContent = delta(last.vi, prev.vi, 2);
  $("fg").textContent = last.fg.toFixed(1); $("fgd").textContent = delta(last.fg, prev.fg);
  $("fear").textContent = last.fear.toFixed(0);
  const draw = () => {
    chart($("chart"), rows, [{ key: "vi", color: "--vi" }, { key: "fg", color: "--gd", range: [0, 100] }]);
    chart($("chart2"), rows, [{ key: "fear", color: "--fg", range: [0, 100] }], { bands: true });
  };
  draw();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
}
main();
