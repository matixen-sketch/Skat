"use client";
import { useState, useCallback } from "react";

const OMRÅDER = [
  "Alle områder", "Indkomstskat", "Selskabsskat", "Moms",
  "Transfer pricing", "Told & afgifter", "Ejendomsvurdering",
];
const PERIODER = ["Seneste uge", "Seneste måned", "Seneste 3 måneder"];

const RELEVANS_CONFIG = {
  høj: { label: "Høj relevans", color: "bg-red-50 text-red-700 border-red-200" },
  middel: { label: "Middel relevans", color: "bg-amber-50 text-amber-700 border-amber-200" },
  lav: { label: "Lav relevans", color: "bg-slate-100 text-slate-500 border-slate-200" },
};
const SAGSTYPE_CONFIG = {
  Stadfæstelse: "bg-slate-100 text-slate-600",
  Medhold: "bg-emerald-100 text-emerald-700",
  "Delvist medhold": "bg-teal-100 text-teal-700",
  Hjemvisning: "bg-blue-100 text-blue-700",
  "Bindende svar": "bg-violet-100 text-violet-700",
};

function SectionTitel({ ikon, tekst }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-slate-400 text-xs">{ikon}</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-sans">{tekst}</span>
    </div>
  );
}

function Section({ titel, ikon, fremhæv, children }) {
  return (
    <div className={fremhæv ? "bg-amber-50 border border-amber-100 rounded-lg px-4 py-3" : ""}>
      <SectionTitel ikon={ikon} tekst={titel} />
      <p className="text-sm text-slate-600 leading-relaxed font-sans">{children}</p>
    </div>
  );
}

function AfgørelseKort({ a, åben, onToggle }) {
  const rel = RELEVANS_CONFIG[a.relevans] || RELEVANS_CONFIG.middel;
  const stc = SAGSTYPE_CONFIG[a.sagstype] || "bg-gray-100 text-gray-600";
  return (
    <div className={`bg-white rounded-xl border transition-all ${åben ? "border-slate-300 shadow-md" : "border-slate-100 hover:border-slate-200 hover:shadow-sm"}`}>
      <button onClick={onToggle} className="w-full text-left px-5 py-4">
        <div className="flex items-start gap-3">
          <div className={`w-1 rounded-full flex-shrink-0 self-stretch min-h-10 ${a.relevans === "høj" ? "bg-red-400" : a.relevans === "middel" ? "bg-amber-300" : "bg-slate-200"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-xs text-slate-400">{a.id}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${stc}`}>{a.sagstype}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${rel.color}`}>{rel.label}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">{a.titel}</p>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-sans">
              <span>{a.instans}</span><span>·</span>
              <span>{a.område}</span><span>·</span>
              <span>{a.dato}</span>
            </div>
          </div>
          <span className={`text-slate-400 text-sm flex-shrink-0 transition-transform ${åben ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>
      {åben && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-50 space-y-4">
          <Section titel="Resumé" ikon="§">{a.resumé}</Section>
          <Section titel="Afgørelse" ikon="⚖">{a.afgørelse}</Section>
          <Section titel="Betydning for praksis" ikon="★" fremhæv>{a.praksisvurdering}</Section>
          <div>
            <SectionTitel ikon="→" tekst="Handlingspunkter for advokaten" />
            <ul className="space-y-1.5 mt-2">
              {a.handlingspunkter?.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 font-sans">
                  <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          {a.url && (
            <a href={a.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:underline font-sans">
              Se afgørelse på info.skat.dk →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const [afgørelser, setAfgørelser] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fejl, setFejl] = useState(null);
  const [åbenId, setÅbenId] = useState(null);
  const [valgtOmråde, setValgtOmråde] = useState("Alle områder");
  const [valgtPeriode, setValgtPeriode] = useState("Seneste måned");
  const [harHentet, setHarHentet] = useState(false);

  const hent = useCallback(async () => {
    setLoading(true); setFejl(null); setÅbenId(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ område: valgtOmråde, periode: valgtPeriode }),
      });
      if (!res.ok) throw new Error("Serverfejl");
      setAfgørelser(await res.json());
      setHarHentet(true);
    } catch (e) {
      setFejl("Kunne ikke hente afgørelser: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [valgtOmråde, valgtPeriode]);

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
            <p className="text-slate-400 text-sm mt-1 font-sans">AI-drevet analyse · Landsskatteretten · Skatterådet · Skatteankestyrelsen</p>
          </div>
          {harHentet && (
            <div className="text-right font-sans">
              <div className="text-slate-500 text-xs">Analyseret</div>
              <div className="text-white text-sm font-semibold">{afgørelser.length} afgørelser</div>
              {højRelevans > 0 && <div className="text-red-400 text-xs mt-0.5">{højRelevans} med høj relevans</div>}
            </div>
          )}
        </div>
      </header>

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Retsområde</label>
            <select value={valgtOmråde} onChange={e => setValgtOmråde(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:border-slate-400 cursor-pointer font-sans">
              {OMRÅDER.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Periode</label>
            <select value={valgtPeriode} onChange={e => setValgtPeriode(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:border-slate-400 cursor-pointer font-sans">
              {PERIODER.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button onClick={hent} disabled={loading}
            className="px-6 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 font-sans"
            style={{ background: loading ? "#64748b" : "#18293d" }}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                Analyserer…
              </span>
            ) : harHentet ? "Opdater" : "Hent afgørelser"}
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-7">
        {!harHentet && !loading && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">⚖️</div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Klar til at hente afgørelser</h2>
            <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed font-sans">
              Vælg retsområde og periode, og klik "Hent afgørelser" for at få en AI-analyseret oversigt med praksisvurderinger.
            </p>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-slate-700 font-medium">Søger og analyserer afgørelser…</p>
              <p className="text-slate-400 text-sm mt-1 font-sans">Henter aktuelle afgørelser fra info.skat.dk</p>
            </div>
          </div>
        )}
        {fejl && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm font-sans">{fejl}</div>}
        {!loading && afgørelser.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500 font-sans">{valgtOmråde} · {valgtPeriode}</p>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-sans">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Høj relevans</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />Middel</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />Lav</span>
              </div>
            </div>
            <div className="space-y-3">
              {afgørelser.map(a => (
                <AfgørelseKort key={a.id} a={a} åben={åbenId === a.id} onToggle={() => setÅbenId(åbenId === a.id ? null : a.id)} />
              ))}
            </div>
            <div className="mt-6 bg-white border border-slate-100 rounded-xl px-5 py-4">
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                <strong className="text-slate-500">Bemærkning:</strong> Analyserne er genereret af AI baseret på søgning på info.skat.dk.
                De erstatter ikke selvstændig juridisk vurdering. Verificér altid afgørelser i{" "}
                <a href="https://afgoerelsesdatabasen.dk" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">afgoerelsesdatabasen.dk</a>.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
