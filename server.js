// server.js
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.post("/analyze", async (req, res) => {
  const { område, periode } = req.body;

  const datoTekst = new Date().toLocaleDateString("da-DK", {
    day: "numeric", month: "long", year: "numeric"
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
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const raw = data.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("");

  const clean = raw.replace(/```json|```/g, "").trim();

  try {
    const afgørelser = JSON.parse(clean);
    res.json(afgørelser);
  } catch {
    res.status(500).json({ error: "Kunne ikke parse svar fra AI", raw });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("SKM proxy kører");
});
