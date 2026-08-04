import { Router, type IRouter } from "express";
import { db, competitionsTable, racesTable, resultsTable, seasonsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { getAnthropicClient } from "@workspace/integrations-anthropic-ai-server";

const router: IRouter = Router();

const SYSTEM_PROMPT = `És um assistente que escreve notícias/comunicados de imprensa em português sobre os resultados de competições de desportos náuticos, para a Secção de Desportos Náuticos (SDN) de um clube.
Dados os dados estruturados de uma competição e os seus resultados, devolves SEMPRE um JSON válido com a seguinte estrutura exata (sem texto adicional, só JSON):

{
  "headline": "Título curto e apelativo da notícia",
  "body": "Corpo da notícia em texto corrido, com parágrafos separados por \\n\\n"
}

Regras:
- Tom informativo e institucional, mas celebratório quando há bons resultados — como uma notícia real de um site de clube desportivo.
- Destaca os pódios (1º, 2º, 3º lugares) e quaisquer resultados de destaque.
- Refere o nome da competição, local e data.
- Escreve em português de Portugal.
- Não inventes atletas, resultados ou factos que não estejam nos dados fornecidos.
- Se os dados forem escassos, escreve uma notícia mais curta e simples em vez de inventar detalhes.
- Não incluas hashtags nem emojis.
- O corpo deve ter entre 3 a 6 parágrafos.`;

router.post("/competitions/:id/noticia", requireAdmin, async (req, res): Promise<void> => {
  const competitionId = Number(req.params.id);
  if (!Number.isInteger(competitionId)) { res.status(400).json({ error: "id inválido" }); return; }

  const [competition] = await db.select().from(competitionsTable).where(eq(competitionsTable.id, competitionId));
  if (!competition) { res.status(404).json({ error: "Competição não encontrada" }); return; }

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, competition.seasonId));
  const races = await db.select().from(racesTable).where(eq(racesTable.competitionId, competitionId));
  const raceIds = races.map(r => r.id);
  const results = raceIds.length > 0
    ? await db.select().from(resultsTable).where(inArray(resultsTable.raceId, raceIds))
    : [];

  if (results.length === 0) {
    res.status(422).json({ error: "Esta competição ainda não tem resultados registados." });
    return;
  }

  const raceMap = Object.fromEntries(races.map(r => [r.id, r]));
  const resultsSummary = [...results]
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
    .map(r => {
      const race = raceMap[r.raceId];
      const parts = [
        race ? `Prova: ${race.name}` : null,
        race?.category ? `Categoria: ${race.category}` : null,
        r.boatClass ? `Classe: ${r.boatClass}` : null,
        r.escalao ? `Escalão: ${r.escalao}` : null,
        r.athleteNames ? `Atleta(s)/Tripulação: ${r.athleteNames}` : null,
        r.position != null ? `Posição: ${r.position}º` : null,
        r.time ? `Tempo: ${r.time}` : null,
        r.notes ? `Notas: ${r.notes}` : null,
      ].filter(Boolean);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  const competitionSummary = [
    `Nome: ${competition.name}`,
    competition.location ? `Local: ${competition.location}` : null,
    `Data: ${competition.startDate}${competition.endDate && competition.endDate !== competition.startDate ? ` a ${competition.endDate}` : ""}`,
    competition.organizer ? `Organização: ${competition.organizer}` : null,
    season ? `Época: ${season.name}` : null,
  ].filter(Boolean).join("\n");

  let parsed: unknown;
  try {
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Dados da competição:\n${competitionSummary}\n\nResultados:\n${resultsSummary}`,
        },
      ],
    });

    const raw = message.content
      .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
      .map(block => block.text)
      .join("");
    const clean = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    parsed = JSON.parse(clean);
  } catch (err: unknown) {
    console.error("Anthropic noticia error:", err);
    const msg = err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")
      ? err.message
      : "Erro ao gerar a notícia com IA. Tente novamente.";
    res.status(500).json({ error: msg });
    return;
  }

  res.json(parsed);
});

export default router;
