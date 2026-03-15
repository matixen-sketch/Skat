"use client";
import { useState, useCallback } from "react";

const SAGSTYPER = ["Alle", "Medhold", "Delvist medhold", "Stadfæstelse", "Hjemvisning", "Nedsættelse", "Bindende svar"];
const RELEVANS_CONFIG = {
  høj: { label: "Høj relevans", color: "bg-red-50 text-red-700 border-red-200" },
  middel: { label: "Middel relevans", color: "bg-amber-50 text-amber-700 border-amber-200" },
  lav: { label: "Lav relevans", color: "bg-slate-100 text-slate-500 border-slate-200" },
};
const SAGSTYPE_CONFIG = {
  Stadfæstelse: "bg-slate-100 text-slate-600", Medhold: "bg-emerald-100 text-emerald-700",
  "Delvist medhold": "bg-teal-100 text-teal-700", Hjemvisning: "bg-blue-100 text-blue-700",
  "Bindende svar": "bg-violet-100 text-violet-700", Nedsættelse: "bg-orange-100 text-orange-700",
  Afgørelse: "bg-gray-100 text-gray-600",
};
const TENDENS_CONFIG = {
  "Skatteyder-venlig": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "Skattestyrelse-venlig": "text-red-700 bg-red-50 border-red-200",
  "Blandet": "text-amber-700 bg-amber-50 border-amber-200",
};

function Tag({ children, color = "bg-slate-100 text-slate-600" }) {
  return <span className={`text-xs px-2 py-0.5 rounded font-sans font-medium ${color}`}>{children}</span>;
}
function SectionTitel({ ikon, tekst }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-slate-400 text-xs">{ikon}</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-sans">{tekst}</span>
    </div>
  );
}
function Section({ titel, ikon, fremhæv, children }) {
  if (!children) return null;
  return (
    <div className={fremhæv ? "bg-amber-50 border border-amber-100 rounded-lg px-4 py-3" : ""}>
      <SectionTitel ikon={ikon} tekst={titel} />
      <p className="text-sm text-slate-600 leading-relaxed font-sans">{children}</p>
    </div>
  );
}

// ── Overblik panel ────────────────────────────────────────────────────
function OverblikPanel({ overblik, onAnalyser, onHentFlere, onHentAlle, loadingFlere, loadingAlle }) {
  const [valgte, setValgte] = useState(() => {
    const init = {};
    (overblik.grupper || []).forEach(g => (g.anbefalede || []).forEach(i => { init[i] = true; }));
    return init;
  });

  const toggleIndeks = i => setValgte(v => ({ ...v, [i]: !v[i] }));
  const toggleGruppe = (g, til) => {
    const ny = { ...valgte };
    g.indeks.forEach(i => { ny[i] = til; });
    setValgte(ny);
  };

  const antalValgte = Object.values(valgte).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Fandt {overblik.totalCount} afgørelser — vælg hvad der skal analyseres
            </p>
            {overblik.databaseTotal > overblik.totalCount && (
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Databasen indeholder i alt {overblik.databaseTotal} afgørelser for denne søgning
              </p>
            )}
          </div>
          <span className="text-xs text-slate-400 font-sans whitespace-nowrap">{antalValgte} valgt</span>
        </div>
        <p className="text-xs text-slate-400 font-sans mb-3">
          AI har grupperet resultaterne nedenfor. Vælg grupper eller enkeltafgørelser og klik Analyser.
        </p>
        {overblik.harFlere && (
          <div className="flex flex-wrap gap-2">
            <button onClick={onHentFlere} disabled={loadingFlere || loadingAlle}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 font-sans disabled:opacity-50 flex items-center gap-1.5 transition-colors">
              {loadingFlere
                ? <><span className="w-3 h-3 border border-slate-300 border-t-slate-600 rounded-full animate-spin" />Henter…</>
                : "＋ Hent næste 150 afgørelser"}
            </button>
            <button onClick={onHentAlle} disabled={loadingFlere || loadingAlle}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 font-sans disabled:opacity-50 flex items-center gap-1.5 transition-colors">
              {loadingAlle
                ? <><span className="w-3 h-3 border border-amber-300 border-t-amber-600 rounded-full animate-spin" />Henter alle…</>
                : `⬇ Søg i alle ${overblik.databaseTotal} afgørelser`}
            </button>
          </div>
        )}
      </div>

      {overblik.grupper.map((g, gi) => {
        const alleValgt = g.indeks.every(i => valgte[i]);
        const nogleValgt = g.indeks.some(i => valgte[i]);
        return (
          <div key={gi} className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-5 py-3 flex items-start gap-3 border-b border-slate-50">
              <input type="checkbox" checked={alleValgt}
                ref={el => { if (el) el.indeterminate = !alleValgt && nogleValgt; }}
                onChange={e => toggleGruppe(g, e.target.checked)}
                className="mt-0.5 cursor-pointer" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{g.navn}</span>
                  <Tag color="bg-slate-100 text-slate-500">{g.indeks.length} afgørelser</Tag>
                  {g.årsSpænd && <Tag color="bg-slate-50 text-slate-400">{g.årsSpænd}</Tag>}
                </div>
                <p className="text-xs text-slate-500 font-sans mt-0.5">{g.beskrivelse}</p>
                {g.anbefaletBegrundelse && (
                  <p className="text-xs text-amber-600 font-sans mt-1.5 flex items-start gap-1">
                    <span>★</span><span>{g.anbefaletBegrundelse}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {g.indeks.map(i => {
                const hit = overblik.hits[i];
                if (!hit) return null;
                const anbefalet = g.anbefalede?.includes(i);
                return (
                  <label key={i} className={`flex items-start gap-3 px-5 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${valgte[i] ? "bg-amber-50/40" : ""}`}>
                    <input type="checkbox" checked={!!valgte[i]} onChange={() => toggleIndeks(i)} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-slate-400">{hit.id}</span>
                        <span className="text-xs text-slate-400 font-sans">{hit.dato}</span>
                        {anbefalet && <Tag color="bg-amber-100 text-amber-600">★ Anbefalet</Tag>}
                      </div>
                      {hit.snippet && (
                        <p
                          className="text-xs text-slate-600 font-sans leading-relaxed line-clamp-3"
                          dangerouslySetInnerHTML={{
                            __html: hit.snippet
                              .replace(/<em>/g, '<mark class="bg-amber-100 text-amber-800 rounded px-0.5 not-italic font-medium">')
                              .replace(/<\/em>/g, '</mark>')
                          }}
                        />
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <button onClick={() => onAnalyser(Object.keys(valgte).filter(k => valgte[k]).map(Number))}
        disabled={antalValgte === 0}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 font-sans"
        style={{ background: antalValgte === 0 ? "#64748b" : "#18293d" }}>
        Analyser {antalValgte} valgte afgørelser
      </button>
    </div>
  );
}

// ── Klient modal ──────────────────────────────────────────────────────
function KlientModal({ spørgsmål, onClose }) {
  const [svar, setSvar] = useState("");
  const [vurdering, setVurdering] = useState("");
  const [loading, setLoading] = useState(false);
  const vurder = async () => {
    setLoading(true);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handling: "klientvurdering", spørgsmål, svar }),
    });
    const data = await res.json();
    setVurdering(data.vurdering || "Kunne ikke vurdere.");
    setLoading(false);
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="font-semibold text-slate-800 mb-1">Klientrelevans</h3>
        <p className="text-sm text-slate-500 font-sans mb-3">{spørgsmål}</p>
        <textarea value={svar} onChange={e => setSvar(e.target.value)}
          placeholder="Beskriv klientens situation..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-sans outline-none focus:border-slate-400 resize-none h-24 mb-3" />
        {vurdering && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-3">
            <p className="text-sm text-slate-700 font-sans">{vurdering}</p>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 font-sans">Luk</button>
          <button onClick={vurder} disabled={loading || !svar}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 font-sans"
            style={{ background: "#18293d" }}>
            {loading ? "Vurderer…" : "Vurder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Relaterede modal ──────────────────────────────────────────────────
function RelateredeModal({ nøgleord, onClose }) {
  const [data, setData] = useState(null);
  useState(() => {
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handling: "relaterede", søgeTekst: nøgleord?.slice(0, 2).join(" ") }),
    }).then(r => r.json()).then(setData);
  }, []);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-3">Relaterede afgørelser</h3>
        {!data && <p className="text-sm text-slate-400 font-sans">Søger…</p>}
        {data?.map(r => (
          <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
            className="block border border-slate-100 rounded-lg px-4 py-3 mb-2 hover:border-slate-300 transition-colors">
            <p className="text-xs font-mono text-slate-400">{r.id}</p>
            <p className="text-sm font-medium text-slate-700 font-sans">{r.titel}</p>
            <p className="text-xs text-slate-400 font-sans mt-0.5">{r.dato}</p>
          </a>
        ))}
        <button onClick={onClose} className="mt-2 text-sm text-slate-500 font-sans">Luk</button>
      </div>
    </div>
  );
}

// ── Afgørelse kort ────────────────────────────────────────────────────
function AfgørelseKort({ a, åben, onToggle, onGemToggle, gemt, noter, onNoterChange }) {
  const rel = RELEVANS_CONFIG[a.relevans] || RELEVANS_CONFIG.middel;
  const stc = SAGSTYPE_CONFIG[a.sagstype] || "bg-gray-100 text-gray-600";
  const [visKlient, setVisKlient] = useState(false);
  const [visRelaterede, setVisRelaterede] = useState(false);
  const [visNoter, setVisNoter] = useState(false);

  const eksporter = () => {
    const tekst = [
      `AFGØRELSE: ${a.id}`, `Dato: ${a.dato} | Udfald: ${a.sagstype} | Område: ${a.område}`, "",
      `RESUMÉ`, a.resumé, "", `AFGØRELSE`, a.afgørelse, "",
      `BETYDNING FOR PRAKSIS`, a.praksisvurdering, "",
      `LOVHENVISNINGER: ${a.lovhenvisninger?.join(", ") || "–"}`, "",
      `HANDLINGSPUNKTER`, ...(a.handlingspunkter?.map((h, i) => `${i + 1}. ${h}`) || []),
      "", noter ? `NOTER\n${noter}` : "", "", `LINK: ${a.url}`,
    ].join("\n");
    const blob = new Blob([tekst], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = `${a.id}.txt`; el.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {visKlient && <KlientModal spørgsmål={a.klientrelevans_spørgsmål} onClose={() => setVisKlient(false)} />}
      {visRelaterede && <RelateredeModal nøgleord={a.nøgleord} onClose={() => setVisRelaterede(false)} />}
      <div className={`bg-white rounded-xl border transition-all ${åben ? "border-slate-300 shadow-md" : "border-slate-100 hover:border-slate-200 hover:shadow-sm"} ${gemt ? "ring-2 ring-amber-200" : ""}`}>
        <button onClick={onToggle} className="w-full text-left px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={`w-1 rounded-full flex-shrink-0 self-stretch min-h-10 ${a.relevans === "høj" ? "bg-red-400" : a.relevans === "middel" ? "bg-amber-300" : "bg-slate-200"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-mono text-xs text-slate-400">{a.id}</span>
                <Tag color={stc}>{a.sagstype}</Tag>
                <Tag color={rel.color}>{rel.label}</Tag>
                {gemt && <Tag color="bg-amber-100 text-amber-700">★ Gemt</Tag>}
              </div>
              <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">{a.titel}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-sans flex-wrap">
                <span>{a.instans}</span><span>·</span><span>{a.område}</span><span>·</span><span>{a.dato}</span>
              </div>
              {a.lovhenvisninger?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {a.lovhenvisninger.map(l => <Tag key={l} color="bg-blue-50 text-blue-600">{l}</Tag>)}
                </div>
              )}
            </div>
            <span className={`text-slate-400 text-sm flex-shrink-0 transition-transform ${åben ? "rotate-180" : ""}`}>▾</span>
          </div>
        </button>
        {åben && (
          <div className="px-5 pb-5 pt-1 border-t border-slate-50 space-y-4">
            <Section titel="Resumé" ikon="§">{a.resumé}</Section>
            <Section titel="Afgørelse" ikon="⚖">{a.afgørelse}</Section>
            <Section titel="Betydning for praksis" ikon="★" fremhæv>{a.praksisvurdering}</Section>
            {a.nøgleord?.length > 0 && (
              <div>
                <SectionTitel ikon="🏷" tekst="Nøgleord" />
                <div className="flex flex-wrap gap-1 mt-1">
                  {a.nøgleord.map(n => <Tag key={n} color="bg-slate-100 text-slate-500">{n}</Tag>)}
                </div>
              </div>
            )}
            {a.handlingspunkter?.length > 0 && (
              <div>
                <SectionTitel ikon="→" tekst="Handlingspunkter for advokaten" />
                <ul className="space-y-1.5 mt-2">
                  {a.handlingspunkter.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 font-sans">
                      <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">{i + 1}.</span><span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <button onClick={() => setVisNoter(!visNoter)} className="text-xs text-slate-400 hover:text-slate-600 font-sans flex items-center gap-1">
                ✏️ {visNoter ? "Skjul noter" : noter ? "Se/rediger noter" : "Tilføj noter"}
              </button>
              {visNoter && (
                <textarea value={noter || ""} onChange={e => onNoterChange(a.id, e.target.value)}
                  placeholder="Skriv dine noter her..."
                  className="w-full mt-2 border border-slate-200 rounded-lg px-3 py-2 text-sm font-sans outline-none focus:border-slate-400 resize-none h-20" />
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 font-sans transition-colors">
                  Se på afgoerelsesdatabasen.dk →
                </a>
              )}
              <button onClick={() => setVisRelaterede(true)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 font-sans transition-colors">🔗 Relaterede</button>
              {a.klientrelevans_spørgsmål && (
                <button onClick={() => setVisKlient(true)} className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:border-blue-400 font-sans transition-colors">👤 Klientrelevans</button>
              )}
              <button onClick={onGemToggle}
                className={`text-xs px-3 py-1.5 rounded-lg border font-sans transition-colors ${gemt ? "border-amber-300 text-amber-600 bg-amber-50" : "border-slate-200 text-slate-600 hover:border-amber-300"}`}>
                {gemt ? "★ Gemt" : "☆ Gem"}
              </button>
              <button onClick={eksporter} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 font-sans transition-colors">↓ Eksporter</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Sammendrag panel ──────────────────────────────────────────────────
function SammendragPanel({ s }) {
  if (!s) return null;
  const tc = TENDENS_CONFIG[s.tendens] || "text-slate-600 bg-slate-50 border-slate-200";
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-sans">⚡ Tværgående sammendrag</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${tc}`}>{s.tendens}</span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed font-sans">{s.sammendrag}</p>
      <div className="flex gap-4 text-xs font-sans">
        <span className="text-emerald-600 font-semibold">✓ Medhold: {s.medhold_antal}</span>
        <span className="text-slate-500">≈ Stadfæstelse: {s.stadfæstelse_antal}</span>
        <span className="text-blue-600">↩ Hjemvisning: {s.hjemvisning_antal}</span>
      </div>
      {s.vigtigste_pointe && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide font-sans mb-1">Vigtigste pointe</p>
          <p className="text-sm text-slate-700 font-sans">{s.vigtigste_pointe}</p>
        </div>
      )}
      {s.fælles_lovhenvisninger?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {s.fælles_lovhenvisninger.map(l => <Tag key={l} color="bg-blue-50 text-blue-600">{l}</Tag>)}
        </div>
      )}
    </div>
  );
}

// ── Hoved-app ─────────────────────────────────────────────────────────
export default function Page() {
  const [trin, setTrin] = useState("start");
  const [overblik, setOverblik] = useState(null);
  const [cacheId, setCacheId] = useState(null);
  const [afgørelser, setAfgørelser] = useState([]);
  const [sammendrag, setSammendrag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFlere, setLoadingFlere] = useState(false);
  const [loadingAlle, setLoadingAlle] = useState(false);
  const [loadingTekst, setLoadingTekst] = useState("");
  const [fejl, setFejl] = useState(null);
  const [åbenId, setÅbenId] = useState(null);
  const [søgeTekst, setSøgeTekst] = useState("");
  const [sagsbeskrivelse, setSagsbeskrivelse] = useState("");
  const [valgtSagstype, setValgtSagstype] = useState("Alle");
  const [gemte, setGemte] = useState({});
  const [noter, setNoter] = useState({});
  const [visKunGemte, setVisKunGemte] = useState(false);

  const søg = useCallback(async () => {
    setFejl(null); setLoading(true); setTrin("start");
    if (søgeTekst || sagsbeskrivelse) {
      setLoadingTekst("Søger i afgørelsesdatabasen…");
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handling: "overblik", søgeTekst, sagsbeskrivelse, sagstype: valgtSagstype }),
        });
        const data = await res.json();
        setOverblik(data);
        setCacheId(data.cacheId);
        setTrin("overblik");
      } catch (e) { setFejl("Søgning fejlede: " + e.message); }
    } else {
      setLoadingTekst("Henter nyeste afgørelser…");
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sagstype: valgtSagstype }),
        });
        const data = await res.json();
        setAfgørelser(data.afgørelser || []);
        setSammendrag(data.sammendrag || null);
        setTrin("resultater");
      } catch (e) { setFejl("Hentning fejlede: " + e.message); }
    }
    setLoading(false);
  }, [søgeTekst, sagsbeskrivelse, valgtSagstype]);

  const analyser = useCallback(async (valgteIndeks) => {
    setLoading(true);
    setLoadingTekst(`Henter og analyserer ${valgteIndeks.length} afgørelser…`);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handling: "analyser", valgteIndeks, cacheId }),
      });
      if (!res.ok) throw new Error("Serverfejl");
      const data = await res.json();
      setAfgørelser(data.afgørelser || []);
      setSammendrag(data.sammendrag || null);
      setTrin("resultater");
    } catch (e) { setFejl("Analyse fejlede: " + e.message); }
    setLoading(false);
  }, [cacheId]);

  const hentFlere = useCallback(async () => {
    setLoadingFlere(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handling: "hentFlere", cacheId, søgeTekst, sagsbeskrivelse }),
      });
      const data = await res.json();
      setOverblik(prev => ({
        ...prev,
        grupper: [...(prev.grupper || []), ...(data.grupper || [])],
        hits: [...(prev.hits || []), ...(data.hits || [])],
        totalCount: data.totalCount,
        databaseTotal: data.databaseTotal,
        harFlere: data.harFlere,
      }));
    } catch (e) { setFejl("Kunne ikke hente flere: " + e.message); }
    setLoadingFlere(false);
  }, [cacheId, søgeTekst, sagsbeskrivelse]);

  const hentAlle = useCallback(async () => {
    setLoadingAlle(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handling: "hentAlle", cacheId, søgeTekst, sagsbeskrivelse }),
      });
      const data = await res.json();
      setOverblik(prev => ({
        ...prev,
        grupper: [...(prev.grupper || []), ...(data.grupper || [])],
        hits: [...(prev.hits || []), ...(data.hits || [])],
        totalCount: data.totalCount,
        databaseTotal: data.databaseTotal,
        harFlere: false,
      }));
    } catch (e) { setFejl("Kunne ikke hente alle: " + e.message); }
    setLoadingAlle(false);
  }, [cacheId, søgeTekst, sagsbeskrivelse]);

  const nulstil = () => { setTrin("start"); setOverblik(null); setAfgørelser([]); setSammendrag(null); setFejl(null); setCacheId(null); };
  const toggleGem = id => setGemte(g => ({ ...g, [id]: !g[id] }));
  const updateNote = (id, t) => setNoter(n => ({ ...n, [id]: t }));
  const visteListe = visKunGemte ? afgørelser.filter(a => gemte[a.id]) : afgørelser;
  const antalGemte = Object.values(gemte).filter(Boolean).length;
  const højRelevans = afgørelser.filter(a => a.relevans === "høj").length;

  return (
    <div className="min-h-screen bg-[#f5f4f0] font-serif">
      <header className="bg-[#18293d]">
        <div className="max-w-3xl mx-auto px-6 py-7 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-0.5 h-7 bg-amber-400 rounded-full" />
              <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest font-sans">Skatteretlig Overvågning</span>
            </div>
            <h1 className="text-white text-3xl font-bold tracking-tight">Afgørelsesmonitor</h1>
            <p className="text-slate-400 text-sm mt-1 font-sans">AI-drevet analyse · Afgørelsesdatabasen for Landsskatteretten</p>
          </div>
          {trin === "resultater" && (
            <div className="text-right font-sans space-y-0.5">
              <div className="text-white text-sm font-semibold">{afgørelser.length} afgørelser</div>
              {højRelevans > 0 && <div className="text-red-400 text-xs">{højRelevans} høj relevans</div>}
              {antalGemte > 0 && <div className="text-amber-400 text-xs">★ {antalGemte} gemt</div>}
            </div>
          )}
        </div>
      </header>

      {/* Søgebar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                Søg på emne eller lovbestemmelse
              </label>
              <input type="text" value={søgeTekst} onChange={e => setSøgeTekst(e.target.value)}
                onKeyDown={e => e.key === "Enter" && søg()}
                placeholder='fx "ligningslovens § 8 y", "fri bil", "transfer pricing"'
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 font-sans" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">
                Beskriv din konkrete sag{" "}
                <span className="text-slate-400 normal-case font-normal">(valgfrit — bruges til at finde de mest relevante afgørelser)</span>
              </label>
              <textarea value={sagsbeskrivelse} onChange={e => setSagsbeskrivelse(e.target.value)}
                placeholder="fx: Min klient er selvstændig konsulent der ønsker at fradrage udgifter til hjemmekontor. Skattestyrelsen har nægtet fradrag med henvisning til at arbejdet primært udføres hos klienterne..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 font-sans resize-none h-20" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Udfald</label>
              <select value={valgtSagstype} onChange={e => setValgtSagstype(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none cursor-pointer font-sans">
                {SAGSTYPER.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={søg} disabled={loading}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 font-sans mt-5"
              style={{ background: loading ? "#64748b" : "#18293d" }}>
              {loading
                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Søger…</span>
                : "Søg"}
            </button>
            {trin !== "start" && (
              <button onClick={nulstil} className="px-4 py-2 rounded-lg text-sm text-slate-500 border border-slate-200 hover:border-slate-400 font-sans mt-5">
                ↺ Ny søgning
              </button>
            )}
            {antalGemte > 0 && trin === "resultater" && (
              <button onClick={() => setVisKunGemte(v => !v)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border font-sans mt-5 ${visKunGemte ? "bg-amber-100 border-amber-300 text-amber-700" : "border-slate-200 text-slate-600"}`}>
                ★ {visKunGemte ? "Vis alle" : `Gemte (${antalGemte})`}
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-7">
        {/* Start */}
        {trin === "start" && !loading && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">⚖️</div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Klar til at søge</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed font-sans">
              Søg på emner eller lovbestemmelser, beskriv din konkrete sag for bedre resultater, eller klik Søg uden tekst for de nyeste afgørelser.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-slate-700 font-medium">{loadingTekst}</p>
              <p className="text-slate-400 text-sm mt-1 font-sans">Dette kan tage op til 30 sekunder</p>
            </div>
          </div>
        )}

        {/* Fejl */}
        {fejl && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm font-sans mb-4">{fejl}</div>}

        {/* Trin 1: Overblik */}
        {!loading && trin === "overblik" && overblik && (
          <OverblikPanel
            overblik={overblik}
            onAnalyser={analyser}
            onHentFlere={hentFlere}
            onHentAlle={hentAlle}
            loadingFlere={loadingFlere}
            loadingAlle={loadingAlle}
          />
        )}

        {/* Trin 2: Resultater */}
        {!loading && trin === "resultater" && (
          <>
            {afgørelser.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-slate-600 font-medium">Ingen afgørelser fundet</p>
                <p className="text-slate-400 text-sm mt-1 font-sans">Prøv en anden søgning</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-slate-500 font-sans">
                    {søgeTekst ? `"${søgeTekst}"` : "Nyeste afgørelser"}
                    {valgtSagstype !== "Alle" && ` · ${valgtSagstype}`}
                    {visKunGemte && " · Gemte"}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-sans">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Høj</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />Middel</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />Lav</span>
                  </div>
                </div>
                <SammendragPanel s={sammendrag} />
                <div className="space-y-3">
                  {visteListe.map(a => (
                    <AfgørelseKort key={a.id} a={a} åben={åbenId === a.id}
                      onToggle={() => setÅbenId(åbenId === a.id ? null : a.id)}
                      onGemToggle={() => toggleGem(a.id)} gemt={!!gemte[a.id]}
                      noter={noter[a.id]} onNoterChange={updateNote} />
                  ))}
                </div>
                {søgeTekst && (
                  <button onClick={() => setTrin("overblik")}
                    className="mt-4 w-full py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:border-slate-400 font-sans transition-colors">
                    ← Tilbage til overblik og vælg flere afgørelser
                  </button>
                )}
                <div className="mt-6 bg-white border border-slate-100 rounded-xl px-5 py-4">
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    <strong className="text-slate-500">Bemærkning:</strong> AI-analyserne er baseret på afgørelsernes indhold fra Afgørelsesdatabasen for Landsskatteretten og erstatter ikke selvstændig juridisk vurdering. Verificér altid på{" "}
                    <a href="https://afgoerelsesdatabasen.dk" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">afgoerelsesdatabasen.dk</a>.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
