const PORTAL_ID = "62c3f8f5-dca9-4058-918f-d8470a3ff3dd";
const BASE_URL = `https://afgoerelsesdatabasen.dk/api/v1/portals/${PORTAL_ID}`;

function periodeToFromDate(periode) {
  const d = new Date();
  if (periode === "Seneste uge") d.setDate(d.getDate() - 7);
  else if (periode === "Seneste måned") d.setMonth(d.getMonth() - 1);
  else if (periode === "Seneste 3 måneder") d.setMonth(d.getMonth() - 3);
  return d.toISOString().split("T")[0];
}

export async function POST(req) {
  const { periode } = await req.json();
  const fromDate = periodeToFromDate(periode);

  // 1. Hent liste over nyeste afgørelser
  const searchRes = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fieldSetName: "SearchResultFields",
      criteria: { status: ["Effective"] },
      ordering: { descending: true, fieldName: "date_release" },
      page: 1,
      skip: 0,
      slices: false,
      snippets: false,
      take: 10,
    }),
  });

  if (!searchRes.ok) {
    return Response.json({ error: "Søgning fejlede" }, { status: 500 });
  }

  const searchData = await searchRes.json();
  const results = Array.isArray(searchData.Results) ? searchData.Results : [];

  // Filtrer på dato
  const filtered = results.filter(r => {
    const d = r.date_created || r.date_release;
    return d && d >= fromDate;
  }).slice(0, 5);

  if (filtered.length === 0) {
    return Response.json([]);
  }

  // 2. Hent detaljer for hver afgørelse
  const afgørelser = await Promise.all(filtered.map(async (r) => {
    const url = `${BASE_URL}/portaldocuments/${r.DocumentPath}`;
    let tekst = "";
    try {
      const docRes = await fetch(`https://afgoerelsesdatabasen.dk/${r.DocumentInfoUrl}`);
      if (docRes.ok) {
        const doc = await docRes.json();
        tekst = doc.summary || doc.abstract || doc.description || "";
      }
    } catch {}

    const dato = new Date(r.date_release || r.date_created);
    const datoStr = dato.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });

    return {
      id: r.FullName || r.title,
      dato: datoStr,
      titel: r.title || r.FullName,
      instans: "Landsskatteretten",
      område: "Landsskatteretten",
      sagstype: r.document_type || "Afgørelse",
      resumé: tekst || "Se afgørelsen direkte på afgoerelsesdatabasen.dk",
      afgørelse: "",
      praksisvurdering: "",
      handlingspunkter: [],
      relevans: "middel",
      url: `https://afgoerelsesdatabasen.dk/dokumenter/${r.DocumentPath}`,
    };
  }));

  return Response.json(afgørelser);
}
