"use client";
import { useState, useCallback, useRef } from "react";

const PERIODER = ["Seneste uge", "Seneste måned", "Seneste 3 måneder"];
const SAGSTYPER = ["Alle", "Medhold", "Delvist medhold", "Stadfæstelse", "Hjemvisning", "Nedsættelse", "Bindende svar"];

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
  Nedsættelse: "bg-orange-100 text-orange-700",
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

function KlientModal({ spørgsmål, onClose }) {
  const [svar, setSvar] = useState("");
  const [vurdering, setVurdering] = useState("");
  const [loading, setLoading] = useState(false);

  const vurder = async () => {
    setLoading(true);
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handling: "klientvurdering",
        spørgsmål,
        svar,
      }),
    });
    const data = await res.json();
    setVurdering(data.vurdering || "Kunne ikke vurdere relevans.");
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="font-semibold text-slate-800 mb-1">Klientrelevans</h3>
        <p className="text-sm text-slate-500 font-sans mb-3">{spørgsmål}</p>
        <textarea
          value={svar}
          onChange={e => setSvar(e.target.value)}
          placeholder="Beskriv klientens situation..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-sans outline-none focus:border-slate-400 resize-none h-24 mb-3"
        />
        {vurdering && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-3">
            <p className="text-sm text-slate-700 font-sans">{vurdering}</p>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-sans">Luk</button>
          <button onClick={vurder} disabled={loading || !svar}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 font-sans"
            style={{ background: "#18293d" }}>
            {loading ? "Vurderer…" : "Vurder relevans"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RelateredeModal({ afgørelsesId, søgeTekst, onClose }) {
  const [relaterede, setRelaterede] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handling: "relaterede", søgeTekst }),
    }).then(r => r.json()).then(d => { setRelaterede(d); setLoading(false); });
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
        <h3 className="font-semibold text-slate-800 mb-3">Relaterede afgørelser</h3>
        {loading && <p className="text-sm text-slate-400 font-sans">Søger…</p>}
        {relaterede && relaterede.map(r => (
          <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
            className="block border border-slate-100 rounded-lg px-4 py-3 mb-2 hover:border-slate-300 transition-colors">
            <p className="text-xs font-mono text-slate-400">{r.id}</p>
            <p className="text-sm font-medium text-slate-700 font-sans">{r.titel}</p>
            <p className="text-xs text-slate-400 font-sans mt-0.5">{r.dato}</p>
          </a>
        ))}
        <button onClick={onClose} className="mt-2 text-sm text-slate-500 hover:text-slate-700 font-sans">Luk</button>
      </div>
    </div>
  );
}

function AfgørelseKort({ a, åben, onToggle, onGemToggle, gemt, noter, onNoterChange }) {
  const rel = RELEVANS_CONFIG[a.relevans] || RELEVANS_CONFIG.middel;
  const stc = SAGSTYPE_CONFIG[a.sagstype] || "bg-gray-100 text-gray-600";
  const [visKlient, setVisKlient] = useState(false);
  const [visRelaterede, setVisRelaterede] = useState(false);
  const [visNoter, setVisNoter] = useState(false);

  const eksporter = () => {
    const tekst = [
      `AFGØRELSE: ${a.id}`,
      `Dato: ${a.dato} | Instans: ${a.instans} | Udfald: ${a.sagstype}`,
      `Område: ${a.område}`,
      ``,
      `RESUMÉ`,
      a.resumé,
      ``,
      `AFGØRELSE`,
      a.afgørelse,
      ``,
      `BETYDNING FOR PRAKSIS`,
      a.praksisvurdering,
      ``,
      `LOVHENVISNINGER: ${a.lovhenvisninger?.join(", ") || "–"}`,
      ``,
      `HANDLINGSPUNKTER`,
      ...(a.handlingspunkter?.map((h, i) => `${i + 1}. ${h}`) || []),
      ``,
      noter ? `NOTER\n${noter}` : "",
      ``,
      `LINK: ${a.url}`,
    ].filter(l => l !== undefined).join("\n");

    const blob = new Blob([tekst], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url; a2.download = `${a.id}.txt`; a2.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {visKlient && <KlientModal spørgsmål={a.klientrelevans_spørgsmål} onClose={() => setVisKlient(false)} />}
      {visRelaterede && <RelateredeModal afgørelsesId={a.id} søgeTekst={a.nøgleord?.slice(0,2).join(" ")} onClose={() => setVisRelaterede(false)} />}
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
                <span>{a.instans}</span><span>·</span>
                <span>{a.område}</span><span>·</span>
                <span>{a.dato}</span>
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
                      <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Noter */}
            <div>
              <button onClick={() => setVisNoter(!visNoter)}
                className="text-xs text-slate-400 hover:text-slate-600 font-sans flex items-center gap-1">
                ✏️ {visNoter ? "Skjul noter" : noter ? "Se/rediger noter" : "Tilføj noter"}
              </button>
              {visNoter && (
                <textarea
                  value={noter || ""}
                  onChange={e => onNoterChange(a.id, e.target.value)}
                  placeholder="Skriv dine noter her..."
                  className="w-full mt-2 border border-slate-200 rounded-lg px-3 py-2 text-sm font-sans outline-none focus:border-slate-400 resize-none h-20"
                />
              )}
            </div>

            {/* Handlingsknapper */}
            <div className="flex flex-wrap gap-2 pt-1">
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 font-sans transition-colors">
                  Se på afgoerelsesdatabasen.dk →
                </a>
              )}
              <button onClick={() => setVisRelaterede(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 font-sans transition-colors">
                🔗 Relaterede
              </button>
              {a.klientrelevans_spørgsmål && (
                <button onClick={() => setVisKlient(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:border-blue-400 font-sans transition-colors">
                  👤 Klientrelevans
                </button>
              )}
              <button onClick={onGemToggle}
                className={`text-xs px-3 py-1.5 rounded-lg border font-sans transition-colors ${gemt ? "border-amber-300 text-amber-600 bg-amber-50" : "border-slate-200 text-slate-600 hover:border-amber-300"}`}>
                {gemt ? "★ Gemt" : "☆ Gem"}
              </button>
              <button onClick={eksporter}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 font-sans transition-colors">
                ↓ Eksporter
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SammendragPanel({ s }) {
  if (!s) return null;
  const tendensColor = TENDENS_CONFIG[s.tendens] || "text-slate-600 bg-slate-50 border-slate-200";
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-sans">⚡ Tværgående sammendrag</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${tendensColor}`}>{s.tendens}</span>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed font-sans">{s.sammendrag}</p>
      <div className="flex gap-4 text-xs font-sans text-slate-500">
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

export default function Page() {
  const [afgørelser, setAfgørelser] = useState([]);
  const [sammendrag, setSammendrag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fejl, setFejl] = useState(null);
  const [åbenId, setÅbenId] = useState(null);
  const [søgeTekst, setSøgeTekst] = useState("");
  const [valgtPeriode, setValgtPeriode] = useState("Seneste måned");
  const [valgtSagstype, setValgtSagstype] = useState("Alle");
  const [harHentet, setHarHentet] = useState(false);
  const [gemte, setGemte] = useState({});
  const [noter, setNoter] = useState({});
  const [visKunGemte, setVisKunGemte] = useState(false);

  const hent = useCallback(async () => {
    setLoading(true); setFejl(null); setÅbenId(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode: valgtPeriode, søgeTekst, sagstype: valgtSagstype }),
      });
      if (!res.ok) throw new Error("Serverfejl");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAfgørelser(data.afgørelser || []);
      setSammendrag(data.sammendrag || null);
      setHarHentet(true);
    } catch (e) {
      setFejl("Kunne ikke hente afgørelser: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [valgtPeriode, søgeTekst, valgtSagstype]);

  const toggleGem = id => setGemte(g => ({ ...g, [id]: !g[id] }));
  const updateNote = (id, tekst) => setNoter(n => ({ ...n, [id]: tekst }));

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
          {harHentet && (
            <div className="text-right font-sans space-y-0.5">
              <div className="text-white text-sm font-semibold">{afgørelser.length} afgørelser</div>
              {højRelevans > 0 && <div className="text-red-400 text-xs">{højRelevans} høj relevans</div>}
              {antalGemte > 0 && <div className="text-amber-400 text-xs">★ {antalGemte} gemt</div>}
            </div>
          )}
        </div>
      </header>

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Søg i afgørelser</label>
            <input
              type="text"
              value={søgeTekst}
              onChange={e => setSøgeTekst(e.target.value)}
              onKeyDown={e => e.key === "Enter" && hent()}
              placeholder='fx "ligningslovens § 8 y", "fri bil", "transfer pricing"'
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 font-sans"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Periode</label>
              <select value={valgtPeriode} onChange={e => setValgtPeriode(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:border-slate-400 cursor-pointer font-sans">
                {PERIODER.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 font-sans">Udfald</label>
              <select value={valgtSagstype} onChange={e => setValgtSagstype(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:border-slate-400 cursor-pointer font-sans">
                {SAGSTYPER.map(s => <option key={s}>{s}</option>)}
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
            {antalGemte > 0 && (
              <button onClick={() => setVisKunGemte(v => !v)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors font-sans border ${visKunGemte ? "bg-amber-100 border-amber-300 text-amber-700" : "border-slate-200 text-slate-600 hover:border-amber-300"}`}>
                ★ {visKunGemte ? "Vis alle" : `Gemte (${antalGemte})`}
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-7">
        {!harHentet && !loading && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">⚖️</div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Klar til at hente afgørelser</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed font-sans">
              Søg på ord, lovbestemmelser eller paragraffer — eller hent de nyeste afgørelser filtreret på periode og udfald.
            </p>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-slate-700 font-medium">Henter og analyserer afgørelser…</p>
              <p className="text-slate-400 text-sm mt-1 font-sans">AI gennemgår afgørelserne og udarbejder analyser</p>
            </div>
          </div>
        )}
        {fejl && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm font-sans">{fejl}</div>}

        {!loading && harHentet && afgørelser.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-600 font-medium">Ingen afgørelser fundet</p>
            <p className="text-slate-400 text-sm mt-1 font-sans">Prøv en anden periode eller søgeterm</p>
          </div>
        )}

        {!loading && afgørelser.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500 font-sans">
                {søgeTekst ? `"${søgeTekst}"` : valgtPeriode}
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
                <AfgørelseKort
                  key={a.id} a={a}
                  åben={åbenId === a.id}
                  onToggle={() => setÅbenId(åbenId === a.id ? null : a.id)}
                  onGemToggle={() => toggleGem(a.id)}
                  gemt={!!gemte[a.id]}
                  noter={noter[a.id]}
                  onNoterChange={updateNote}
                />
              ))}
            </div>

            <div className="mt-6 bg-white border border-slate-100 rounded-xl px-5 py-4">
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                <strong className="text-slate-500">Bemærkning:</strong> AI-analyserne er baseret på afgørelsernes indhold fra Afgørelsesdatabasen for Landsskatteretten og erstatter ikke selvstændig juridisk vurdering. Verificér altid på{" "}
                <a href="https://afgoerelsesdatabasen.dk" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">afgoerelsesdatabasen.dk</a>.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
