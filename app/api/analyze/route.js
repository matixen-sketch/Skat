export async function POST(req) {
  const { område, periode } = await req.json();

  const datoTekst = new Date().toLocaleDateString("da-DK", {
    day: "numeric", month: "long", year: "numeric",
  });

  const prompt = `Du er en erfaren dansk skatteretsadvokat og juridisk analytiker.
Dags dato er ${datoTekst}.

Brug web search til at finde 5 faktiske, nylige afgørelser fra Skatteankestyrelsen, Landsskatteretten eller Skatterådet.
Søg på: site:info.skat.dk SKM2026 ${område === "Alle områder" ? "skat" : område}

Periode: ${periode}
Område: ${område === "Alle områder" ? "dansk skatteret generelt" : område}

For hver afgørelse skal du returnere et JSON-objekt med disse felter:
- id: sagsnummer fx SKM2026.123.LSR
- dato: dato i format "DD. måned ÅÅÅÅ"
- titel: præcis juridisk beskrivelse af det retlige spørgsmål
- instans: "Landsskatteretten", "Skatterådet" eller "Skatteankestyrelsen"
- område: retsområde
- sagstype: "Stadfæstelse", "Medhold", "Delvist medhold", "Hjemvisning" eller "Bindende svar"
- resumé: præcist juridisk resumé af sagens faktum og retlige spørgsmål (3-4 sætninger)
- afgørelse: afgørelsens resultat og centrale begrundelse (2-3 sætninger)
- praksisvurdering: afgørelsens betydning for retspraksis (2-3 sætninger)
- handlingspunkter: array med 2 konkrete råd til skatteadvokater
- relevans: "høj", "middel" eller "lav"
- url: direkte link til afgørelsen på info.skat.dk hvis fundet

Returnér KUN et JSON-array med op til 5 afgørelsesobjekter. Ingen forklaring, ingen markdown-backticks.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.content) {
    console.error("Anthropic fejl:", JSON.stringify(data));
    return Response.json({ error: "Anthropic API fejl", details: data }, { status: 500 });
  }

  const raw = data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");

  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    return Response.json(JSON.parse(clean));
  } catch {
    console.error("Parse fejl, råt svar:", raw);
    return Response.json({ error: "Parse fejl", raw }, { status: 500 });
  }
}
