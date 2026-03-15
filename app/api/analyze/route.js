const PORTAL_ID = "62c3f8f5-dca9-4058-918f-d8470a3ff3dd";
const BASE_URL = `https://afgoerelsesdatabasen.dk/api/v1/portals/${PORTAL_ID}`;

// Server-side cache
const hitsCache = new Map();

function rydCache() {
  for (const [k] of hitsCache) {
    if (parseInt(k) < Date.now() - 30 * 60 * 1000) hitsCache.delete(k);
  }
}

function søgeTilTerms(tekst) {
  return tekst
    .trim()
    .replace(/^[""]|[""]$/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

async function søgSide(terms, criteria, page) {
  const res = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fieldSetName: "SearchResultFields",
      criteria: { status: ["Effective"], ...criteria, terms },
      ordering: { fieldName: "Relevans", descending: true },
      page,
      skip: (page - 1) * 15,
      slices: false,
      snippets: true,
      portalColumnHighlights: null,
      take: 15,
    }),
  });
  if (!res.ok) return { resultater: [], totalCount: 0 };
  const data = await res.json();
  return {
    resultater: Array.isArray(data.Results) ? data.Results : [],
    totalCount: data.TotalCount || 0,
  };
}

async function hentSider(søgeTekst, criteria, fraPage, tilPage) {
  const terms = søgeTilTerms(søgeTekst);
  const alleResultater = [];
  let totalCount = 0;
  for (let page = fraPage; page <= tilPage; page++) {
    const { resultater, totalCount: tc } = await søgSide(terms, criteria, page);
    if (tc) totalCount = tc;
    alleResultater.push(...resultater);
    if (resultater.length < 15) break;
  }
  const set = new Set();
  return {
    resultater: alleResultater.filter(r => {
      if (set.has(r.FullName)) return false;
      set.add(r.FullName);
      return true;
    }),
    totalCount,
  };
}

async function hentDokumentTekst(hiveId, fullName) {
  try {
    const url = `https://afgoerelsesdatabasen.dk/api/Portals(${PORTAL_ID})/Documents/LocalPrimaryVariant/${hiveId}/${fullName}`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
      .replace(/\s+/g, " ").trim();
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

async function hentOverbliksresumé(r, søgeTekst) {
  const tekst = await hentDokumentTekst(r.HiveId, r.FullName);
  if (!tekst) return (Array.isArray(r.Snippets) ? r.Snippets : []).join(" … ").slice(0, 400);
  const resumé = await claudeJSON(`Du er skatteadvokat. Søgning: "${søgeTekst}"

Læs denne afgørelse og skriv ET kort resumé på 2-3 sætninger der beskriver:
1. Hvad sagen handler om
2. Hvad afgørelsen konkret siger om "${søgeTekst}"
3. Udfaldet (medhold/stadfæstelse/hjemvisning)

Afgørelsestekst:
${tekst.slice(0, 2000)}

Returner KUN dette JSON:
{"resumé": "2-3 sætninger"}`, 300);
  return resumé?.resumé || (Array.isArray(r.Snippets) ? r.Snippets : []).join(" … ").slice(0, 400);
}

async function grupperMedClaude(kandidater, søgeTekst, sagsbeskrivelse) {
  const sagskontekst = sagsbeskrivelse
    ? `\n\nAdvokatens sagsbeskrivelse: "${sagsbeskrivelse}"\nBrug denne til at prioritere afgørelser der er relevante for netop denne sag.`
    : "";
  return claudeJSON(`Du er erfaren dansk skatteadvokat. Søgning: "${søgeTekst}"${sagskontekst}

Analyser disse ${kandidater.length} afgørelser og FRASORTER alle der ikke direkte og specifikt handler om søgningen "${søgeTekst}". Medtag KUN afgørelser hvor resuméet tydeligt viser at afgørelsen omhandler dette emne.

Gruppér de relevante afgørelser i 3-6 juridiske temagrupper.

${kandidater.map(k => `[${k.i}] ${k.id} | ${k.dato} | ${k.snippet}`).join("\n")}

Returner KUN dette JSON:
{
  "grupper": [
    {
      "navn": "Kort gruppenavn",
      "beskrivelse": "1-2 sætninger om hvad afgørelserne handler om",
      "indeks": [0, 3, 7],
      "årsSpænd": "2012–2024",
      "anbefalede": [0, 3],
      "anbefaletBegrundelse": "Disse er anbefalet fordi..."
    }
  ]
}`, 2500);
}

async function analyserAfgørelse(afgørelse, tekst) {
  return claudeJSON(`Du er en erfaren dansk skatteretsadvokat. Analyser denne Landsskatteretsafgørelse og returner KUN et JSON-objekt uden markdown.

Journalnummer: ${afgørelse.id}
Dato: ${afgørelse.dato}
${tekst ? `Afgørelsestekst:\n${tekst.slice(0, 3000)}` : "Ingen tekst tilgængelig."}

{
  "resumé": "præcist juridisk resumé af faktum og retlige spørgsmål (3-4 sætninger)",
  "afgørelse": "afgørelsens resultat og begrundelse (2-3 sætninger)",
  "praksisvurdering": "betydning for retspraksis (2-3 sætninger)",
  "sagstype": "Stadfæstelse | Medhold | Delvist medhold | Hjemvisning | Nedsættelse | Bindende svar",
  "område": "primært retsområde",
  "lovhenvisninger": ["LL § x"],
  "nøgleord": ["nøgleord1"],
  "handlingspunkter": ["råd 1", "råd 2"],
  "relevans": "høj | middel | lav",
  "klientrelevans_spørgsmål": "spørgsmål til advokaten om klientens situation"
}`);
}

async function genererTværgåendeSammendrag(afgørelser) {
  const liste = afgørelser.map((a, i) =>
    `${i + 1}. ${a.id} (${a.dato}): ${a.resumé} Udfald: ${a.sagstype}.`
  ).join("\n");
  return claudeJSON(`Du er skatteadvokat. Analyser disse ${afgørelser.length} afgørelser samlet:

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

function byggKandidater(resultater, startIndeks, søgeTekst) {
  return resultater.map((r, i) => ({
    i: startIndeks + i,
    id: r.FullName,
    dato: new Date(r.date_release || r.date_created).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" }),
    snippet: (Array.isArray(r.Snippets) ? r.Snippets : []).join(" … ").slice(0, 400),
  }));
}

async function byggKandidaterMedTekst(resultater, startIndeks, søgeTekst) {
  const top50 = resultater.slice(0, 50);
  const resten = resultater.slice(50);

  const medTekst = await Promise.all(top50.map(async (r, i) => ({
    i: startIndeks + i,
    id: r.FullName,
    dato: new Date(r.date_release || r.date_created).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" }),
    snippet: await hentOverbliksresumé(r, søgeTekst),
  })));

  const udenTekst = resten.map((r, i) => ({
    i: startIndeks + 50 + i,
    id: r.FullName,
    dato: new Date(r.date_release || r.date_created).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" }),
    snippet: (Array.isArray(r.Snippets) ? r.Snippets : []).join(" … ").slice(0, 400),
  }));

  return [...medTekst, ...udenTekst];
}

export async function POST(req) {
  const body = await req.json();
  const { handling, søgeTekst, sagstype, sagsbeskrivelse, valgteIndeks, cacheId } = body;
  const criteria = sagstype && sagstype !== "Alle" ? { verdict: [sagstype] } : {};

  // ── RELATEREDE ────────────────────────────────────────────────────
  if (handling === "relaterede" && søgeTekst) {
    const { resultater } = await hentSider(søgeTekst, {}, 1, 1);
    return Response.json(resultater.slice(0, 6).map(r => ({
      id: r.FullName,
      titel: r.title,
      dato: new Date(r.date_release || r.date_created).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" }),
      url: `https://afgoerelsesdatabasen.dk/h/${r.HiveId}/${r.FullName}?showExact=true`,
    })));
  }

  // ── OVERBLIK ─────────────────────────────────────────────────────
  if (handling === "overblik" && (søgeTekst || sagsbeskrivelse)) {
    const { resultater, totalCount } = await hentSider(søgeTekst || sagsbeskrivelse, criteria, 1, 10);
    console.log(`Overblik: ${resultater.length} afgørelser, total: ${totalCount}`);

    if (resultater.length === 0) {
      return Response.json({ grupper: [], hits: [], totalCount: 0, databaseTotal: 0, cacheId: null, harFlere: false });
    }

    const kandidater = await byggKandidaterMedTekst(resultater, 0, søgeTekst || sagsbeskrivelse);
    const grupper = await grupperMedClaude(kandidater, søgeTekst || sagsbeskrivelse, sagsbeskrivelse);

    rydCache();
    const nyCacheId = Date.now().toString();
    hitsCache.set(nyCacheId, { resultater, søgeTekst: søgeTekst || sagsbeskrivelse, criteria, sideSidst: 10 });

    return Response.json({
      grupper: grupper?.grupper || [],
      hits: kandidater,
      totalCount: resultater.length,
      databaseTotal: totalCount,
      cacheId: nyCacheId,
      harFlere: totalCount > resultater.length,
    });
  }

  // ── HENT FLERE ────────────────────────────────────────────────────
  if (handling === "hentFlere" && cacheId) {
    const cached = hitsCache.get(cacheId);
    if (!cached) return Response.json({ error: "Cache udløbet — søg igen" }, { status: 400 });

    const { resultater: eksisterende, søgeTekst: st, criteria: cr, sideSidst } = cached;
    const { resultater: nye, totalCount } = await hentSider(st, cr, sideSidst + 1, sideSidst + 10);

    const eksisterendeIds = new Set(eksisterende.map(r => r.FullName));
    const unikkeNye = nye.filter(r => !eksisterendeIds.has(r.FullName));
    const alleResultater = [...eksisterende, ...unikkeNye];

    const nyeKandidater = await byggKandidaterMedTekst(unikkeNye, eksisterende.length, st);
    const grupper = nyeKandidater.length > 0 ? await grupperMedClaude(nyeKandidater, st, sagsbeskrivelse) : { grupper: [] };

    hitsCache.set(cacheId, { resultater: alleResultater, søgeTekst: st, criteria: cr, sideSidst: sideSidst + 10 });

    return Response.json({
      grupper: grupper?.grupper || [],
      hits: nyeKandidater,
      nyeCount: unikkeNye.length,
      totalCount: alleResultater.length,
      databaseTotal: totalCount,
      harFlere: totalCount > alleResultater.length,
    });
  }

  // ── HENT ALLE ─────────────────────────────────────────────────────
  if (handling === "hentAlle" && cacheId) {
    const cached = hitsCache.get(cacheId);
    if (!cached) return Response.json({ error: "Cache udløbet — søg igen" }, { status: 400 });

    const { resultater: eksisterende, søgeTekst: st, criteria: cr, sideSidst } = cached;
    const { resultater: nye, totalCount } = await hentSider(st, cr, sideSidst + 1, 999);

    const eksisterendeIds = new Set(eksisterende.map(r => r.FullName));
    const unikkeNye = nye.filter(r => !eksisterendeIds.has(r.FullName));
    const alleResultater = [...eksisterende, ...unikkeNye];

    const nyeKandidater = await byggKandidaterMedTekst(unikkeNye, eksisterende.length, st);
    const grupper = nyeKandidater.length > 0 ? await grupperMedClaude(nyeKandidater, st, sagsbeskrivelse) : { grupper: [] };

    hitsCache.set(cacheId, { resultater: alleResultater, søgeTekst: st, criteria: cr, sideSidst: 999 });

    return Response.json({
      grupper: grupper?.grupper || [],
      hits: nyeKandidater,
      nyeCount: unikkeNye.length,
      totalCount: alleResultater.length,
      databaseTotal: totalCount,
      harFlere: false,
    });
  }

  // ── ANALYSER VALGTE ───────────────────────────────────────────────
  if (handling === "analyser" && Array.isArray(valgteIndeks)) {
    const cached = hitsCache.get(cacheId);
    const cachedHits = cached?.resultater || [];
    const valgte = valgteIndeks.map(i => cachedHits[i]).filter(Boolean).slice(0, 15);
    if (valgte.length === 0) return Response.json({ afgørelser: [], sammendrag: null });

    const afgørelser = await Promise.all(valgte.map(async (r) => {
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
      const tekst = r.HiveId && r.FullName ? await hentDokumentTekst(r.HiveId, r.FullName) : "";
      const analyse = await analyserAfgørelse(base, tekst);
      if (analyse) Object.assign(base, analyse);
      return base;
    }));

    const sammendrag = afgørelser.length > 1 ? await genererTværgåendeSammendrag(afgørelser) : null;
    return Response.json({ afgørelser, sammendrag });
  }

  // ── NYESTE AFGØRELSER (ingen søgning) ────────────────────────────
  const searchRes = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fieldSetName: "SearchResultFields",
      criteria: { status: ["Effective"], ...criteria },
      ordering: { descending: true, fieldName: "date_release" },
      page: 1, skip: 0, slices: false, snippets: false,
      portalColumnHighlights: null, take: 10,
    }),
  });
  if (!searchRes.ok) return Response.json({ error: "Søgning fejlede" }, { status: 500 });
  const searchData = await searchRes.json();
  const results = (Array.isArray(searchData.Results) ? searchData.Results : []).slice(0, 5);
  if (results.length === 0) return Response.json({ afgørelser: [], sammendrag: null });

  const afgørelser = await Promise.all(results.map(async (r) => {
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
    const tekst = r.HiveId && r.FullName ? await hentDokumentTekst(r.HiveId, r.FullName) : "";
    const analyse = await analyserAfgørelse(base, tekst);
    if (analyse) Object.assign(base, analyse);
    return base;
  }));

  const sammendrag = afgørelser.length > 1 ? await genererTværgåendeSammendrag(afgørelser) : null;
  return Response.json({ afgørelser, sammendrag });
}
