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

async function claudeJSON(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
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
  "praksisvurdering": "betydning for retspraksis – praksisændring, præjudikat eller bekræftelse (2-3 sætninger)",
  "sagstype": "Stadfæstelse | Medhold | Delvist medhold | Hjemvisning | Nedsættelse | Bindende svar",
  "område": "primært retsområde fx Indkomstskat, Moms, Transfer pricing, Ejendomsvurdering osv.",
  "lovhenvisninger": ["LL § 8 y", "SL § 4"],
  "nøgleord": ["fri bil", "personalegode", "arbejdsgiver"],
  "handlingspunkter": ["konkret råd 1", "konkret råd 2"],
  "relevans": "høj | middel | lav",
  "klientrelevans_spørgsmål": "Et spørgsmål advokaten kan stille klienten for at vurdere om afgørelsen er relevant"
}`);
}

async function genererTværgåendeSammendrag(afgørelser) {
  const liste = afgørelser.map((a, i) =>
    `${i + 1}. ${a.id} (${a.dato}): ${a.resumé} Udfald: ${a.sagstype}.`
  ).join("\n");

  return claudeJSON(`Du er skatteadvokat. Analyser disse ${afgørelser.length} Landsskatteretsafgørelser samlet og returner KUN JSON uden markdown:

${liste}

Returner:
{
  "sammendrag": "samlet vurdering af hvad afgørelserne tilsammen siger om gældende praksis (4-5 sætninger)",
  "tendens": "Skatteyder-venlig | Skattestyrelse-venlig | Blandet",
  "medhold_antal": <tal>,
  "stadfæstelse_antal": <tal>,
  "hjemvisning_antal": <tal>,
  "vigtigste_pointe": "den vigtigste praktiske konsekvens for skatteadvokater (2 sætninger)",
  "fælles_lovhenvisninger": ["de paragraffer der går igen på tværs"]
}`);
}

export async function POST(req) {
  const { periode, søgeTekst, sagstype, handling } = await req.json();

  // Relaterede afgørelser
  if (handling === "relaterede" && søgeTekst) {
    const res = await fetch(`${BASE_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fieldSetName: "SearchResultFields",
        criteria: {},
        ordering: { descending: true, fieldName: "date_release" },
        page: 1, skip: 0, slices: false, snippets: false, take: 8,
        query: søgeTekst,
      }),
    });
    const data = await res.json();
    const results = Array.isArray(data.Results) ? data.Results.slice(0, 6) : [];
    return Response.json(results.map(r => ({
      id: r.FullName,
      titel: r.title,
      dato: new Date(r.date_release || r.date_created).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" }),
      url: `https://afgoerelsesdatabasen.dk/h/${r.HiveId}/${r.FullName}?showExact=true`,
    })));
  }

  const fromDate = periodeToFromDate(periode || "Seneste måned");
  const criteria = {};
  if (sagstype && sagstype !== "Alle") criteria.verdict = [sagstype];

  const searchBody = {
    fieldSetName: "SearchResultFields",
    criteria,
    ordering: { descending: true, fieldName: "date_release" },
    page: 1, skip: 0, slices: false, snippets: !!søgeTekst, take: 10,
  };
  if (søgeTekst) searchBody.query = søgeTekst;

  const searchRes = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(searchBody),
  });
  if (!searchRes.ok) return Response.json({ error: "Søgning fejlede" }, { status: 500 });

  const searchData = await searchRes.json();
  const results = Array.isArray(searchData.Results) ? searchData.Results : [];

  const filtered = søgeTekst
    ? results.slice(0, 5)
    : results.filter(r => {
        const d = r.date_created || r.date_release;
        return d && d >= fromDate;
      }).slice(0, 5);

  if (filtered.length === 0) return Response.json({ afgørelser: [], sammendrag: null });

  const afgørelser = await Promise.all(filtered.map(async (r) => {
    const dato = new Date(r.date_release || r.date_created)
      .toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
    const base = {
      id: r.FullName || r.title,
      dato,
      titel: r.title || r.FullName,
      instans: "Landsskatteretten",
      område: "Landsskatteretten",
      sagstype: "Afgørelse",
      resumé: "", afgørelse: "", praksisvurdering: "",
      lovhenvisninger: [], nøgleord: [], handlingspunkter: [],
      relevans: "middel",
      klientrelevans_spørgsmål: "",
      url: `https://afgoerelsesdatabasen.dk/h/${r.HiveId}/${r.FullName}?showExact=true`,
      hiveId: r.HiveId,
      fullName: r.FullName,
    };
    const tekst = r.DocumentInfoUrl ? await hentDokumentTekst(r.DocumentInfoUrl) : "";
    const analyse = await analyserAfgørelse(base, tekst);
    if (analyse) Object.assign(base, analyse);
    return base;
  }));

  // Tværgående sammendrag
  const sammendrag = afgørelser.length > 1 ? await genererTværgåendeSammendrag(afgørelser) : null;

  return Response.json({ afgørelser, sammendrag });
}
