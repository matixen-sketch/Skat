const PORTAL_ID = "62c3f8f5-dca9-4058-918f-d8470a3ff3dd";
const BASE_URL = `https://afgoerelsesdatabasen.dk/api/v1/portals/${PORTAL_ID}`;

function periodeToFromDate(periode) {
  const d = new Date();
  if (periode === "Seneste uge") d.setDate(d.getDate() - 7);
  else if (periode === "Seneste måned") d.setMonth(d.getMonth() - 1);
  else if (periode === "Seneste 3 måneder") d.setMonth(d.getMonth() - 3);
  return d.toISOString().split("T")[0];
}

async function hentDokumentTekst(infoUrl) {
  try {
    const res = await fetch(`https://afgoerelsesdatabasen.dk/${infoUrl}`);
    if (!res.ok) return "";
    const data = await res.json();
    return data.summary || data.abstract || data.bodyText || data.text || data.content || "";
  } catch { return ""; }
}

async function claudeJSON(prompt, maxTokens = 1500) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const raw = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { return null; }
}

async function analyserAfgørelse(afgørelse, tekst) {
  return claudeJSON(`Du er en erfaren dansk skatteretsadvokat. Analyser denne Landsskatteretsafgørelse og returner KUN et JSON-objekt uden markdown.

Journalnummer: ${afgørelse.id}
Dato: ${afgørelse.dato}
${tekst ? `Afgørelsestekst:\n${tekst.slice(0, 3000)}` : "Ingen tekst tilgængelig."}

Returner:
{
  "resumé": "præcist juridisk resumé af faktum og retlige spørgsmål (3-4 sætninger)",
  "afgørelse": "afgørelsens resultat og begrundelse (2-3 sætninger)",
  "praksisvurdering": "betydning for retspraksis (2-3 sætninger)",
  "sagstype": "Stadfæstelse | Medhold | Delvist medhold | Hjemvisning | Nedsættelse | Bindende svar",
  "område": "primært retsområde",
  "lovhenvisninger": ["LL § x", "SL § y"],
  "nøgleord": ["nøgleord1", "nøgleord2"],
  "handlingspunkter": ["råd 1", "råd 2"],
  "relevans": "høj | middel | lav",
  "klientrelevans_spørgsmål": "spørgsmål til advokaten om klientens situation"
}`);
}

async function genererTværgåendeSammendrag(afgørelser) {
  const liste = afgørelser.map((a, i) =>
    `${i + 1}. ${a.id} (${a.dato}): ${a.resumé} Udfald: ${a.sagstype}.`
  ).join("\n");
  return claudeJSON(`Du er skatteadvokat. Analyser disse ${afgørelser.length} afgørelser samlet og returner KUN JSON:

${liste}

{
  "sammendrag": "samlet vurdering af gældende praksis (4-5 sætninger)",
  "tendens": "Skatteyder-venlig | Skattestyrelse-venlig | Blandet",
  "medhold_antal": 0,
  "stadfæstelse_antal": 0,
  "hjemvisning_antal": 0,
  "vigtigste_pointe": "vigtigste praktiske konsekvens (2 sætninger)",
  "fælles_lovhenvisninger": ["§ x"]
}`);
}

async function hentAlleHits(søgeTekst, criteria) {
  const sider = [1, 2, 3, 4, 5];
  const alleResultater = [];
  await Promise.all(sider.map(async (page) => {
    try {
      const r = await fetch(`${BASE_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldSetName: "SearchResultFields",
          criteria,
          ordering: { descending: true, fieldName: "Relevans" },
          page, skip: (page - 1) * 20,
          slices: false, snippets: true, take: 20,
          query: søgeTekst,
        }),
      });
      const d = await r.json();
      if (Array.isArray(d.Results)) alleResultater.push(...d.Results);
    } catch {}
  }));
  return alleResultater;
}

export async function POST(req) {
  const { handling, periode, søgeTekst, sagstype, valgteIndeks, alleHits } = await req.json();
  const criteria = {};
  if (sagstype && sagstype !== "Alle") criteria.verdict = [sagstype];

  // ── TRIN 1: Hent overblik og grupper ──────────────────────────────
  if (handling === "overblik") {
    const resultater = await hentAlleHits(søgeTekst, criteria);
    if (resultater.length === 0) return Response.json({ grupper: [], hits: [], totalCount: 0 });

    const kandidater = resultater.slice(0, 100).map((r, i) => ({
      i,
      id: r.FullName,
      dato: new Date(r.date_release || r.date_created).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" }),
      år: new Date(r.date_release || r.date_created).getFullYear(),
      snippet: (r.Snippets || []).join(" ").slice(0, 250),
    }));

    const grupper = await claudeJSON(`Du er erfaren dansk skatteadvokat. Søgning: "${søgeTekst}"

Analyser disse ${kandidater.length} afgørelser og gruppér dem i 4-7 juridiske temagrupper baseret på deres indhold.

${kandidater.map(k => `[${k.i}] ${k.id} | ${k.dato} | ${k.snippet}`).join("\n")}

Returner KUN dette JSON:
{
  "grupper": [
    {
      "navn": "Kort beskrivende gruppenavn",
      "beskrivelse": "1-2 sætninger om hvad afgørelserne i gruppen handler om",
      "indeks": [0, 3, 7],
      "årsSpænd": "2012–2024",
      "anbefalede": [0, 3]
    }
  ]
}`, 2000);

    return Response.json({
      grupper: grupper?.grupper || [],
      hits: kandidater,
      totalCount: resultater.length,
      alleRawHits: resultater,
    });
  }

  // ── TRIN 2: Analyser valgte afgørelser ────────────────────────────
  if (handling === "analyser" && Array.isArray(valgteIndeks) && Array.isArray(alleHits)) {
    const valgte = valgteIndeks.map(i => alleHits[i]).filter(Boolean).slice(0, 8);
    if (valgte.length === 0) return Response.json({ afgørelser: [], sammendrag: null });

    const afgørelser = await Promise.all(valgte.map(async (r) => {
      const dato = new Date(r.date_release || r.date_created)
        .toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
      const base = {
        id: r.FullName || r.title,
        dato, titel: r.title || r.FullName,
        instans: "Landsskatteretten", område: "Landsskatteretten",
        sagstype: "Afgørelse", resumé: "", afgørelse: "",
        praksisvurdering: "", lovhenvisninger: [], nøgleord: [],
        handlingspunkter: [], relevans: "middel",
        klientrelevans_spørgsmål: "",
        url: `https://afgoerelsesdatabasen.dk/h/${r.HiveId}/${r.FullName}?showExact=true`,
      };
      const tekst = r.DocumentInfoUrl ? await hentDokumentTekst(r.DocumentInfoUrl) : "";
      const analyse = await analyserAfgørelse(base, tekst);
      if (analyse) Object.assign(base, analyse);
      return base;
    }));

    const sammendrag = afgørelser.length > 1 ? await genererTværgåendeSammendrag(afgørelser) : null;
    return Response.json({ afgørelser, sammendrag });
  }

  // ── DATO-SØGNING (ingen fritekst) ─────────────────────────────────
  const fromDate = periodeToFromDate(periode || "Seneste måned");
  const searchRes = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fieldSetName: "SearchResultFields",
      criteria,
      ordering: { descending: true, fieldName: "date_release" },
      page: 1, skip: 0, slices: false, snippets: false, take: 10,
    }),
  });
  if (!searchRes.ok) return Response.json({ error: "Søgning fejlede" }, { status: 500 });
  const searchData = await searchRes.json();
  const results = Array.isArray(searchData.Results) ? searchData.Results : [];
  const filtered = results.filter(r => {
    const d = r.date_created || r.date_release;
    return d && d >= fromDate;
  }).slice(0, 5);

  if (filtered.length === 0) return Response.json({ afgørelser: [], sammendrag: null });

  const afgørelser = await Promise.all(filtered.map(async (r) => {
    const dato = new Date(r.date_release || r.date_created)
      .toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
    const base = {
      id: r.FullName || r.title, dato, titel: r.title || r.FullName,
      instans: "Landsskatteretten", område: "Landsskatteretten",
      sagstype: "Afgørelse", resumé: "", afgørelse: "",
      praksisvurdering: "", lovhenvisninger: [], nøgleord: [],
      handlingspunkter: [], relevans: "middel", klientrelevans_spørgsmål: "",
      url: `https://afgoerelsesdatabasen.dk/h/${r.HiveId}/${r.FullName}?showExact=true`,
    };
    const tekst = r.DocumentInfoUrl ? await hentDokumentTekst(r.DocumentInfoUrl) : "";
    const analyse = await analyserAfgørelse(base, tekst);
    if (analyse) Object.assign(base, analyse);
    return base;
  }));

  const sammendrag = afgørelser.length > 1 ? await genererTværgåendeSammendrag(afgørelser) : null;
  return Response.json({ afgørelser, sammendrag });
}
