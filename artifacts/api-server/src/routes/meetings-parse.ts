import { Router, type IRouter } from "express";
import multer from "multer";
import { requireAdmin } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";

// Use internal path to avoid pdf-parse running its test suite on import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require("mammoth");

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const SYSTEM_PROMPT = `És um assistente que extrai informação estruturada de atas de reunião em português.
Dado o texto de uma ata, devolves SEMPRE um JSON válido com a seguinte estrutura exata (sem texto adicional, só JSON):

{
  "date": "YYYY-MM-DD",
  "attendees": "Nome1, Nome2, Nome3",
  "agendaItems": [
    { "text": "descrição do ponto", "pending": false }
  ],
  "sections": [
    {
      "title": "Título do tópico",
      "items": ["nota 1", "nota 2"]
    }
  ],
  "notes": "observações gerais ou null"
}

Regras:
- "date": data da reunião no formato YYYY-MM-DD. Se não encontrares, usa null.
- "attendees": nomes dos presentes separados por vírgula.
- "agendaItems": lista de pontos da agenda. pending=false para "assuntos para abordar", pending=true para "assuntos pendentes".
- "sections": tópicos debatidos na reunião com as notas de cada um. Cada item da lista "items" deve ser uma frase/nota completa.
- "notes": qualquer observação geral que não encaixe noutros campos, ou null.
- Não inventes informação que não esteja no texto.
- Se um campo não tiver informação, usa array vazio [] ou null conforme o tipo.`;

async function extractText(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  const ext = originalname.toLowerCase();

  if (mimetype === "application/pdf" || ext.endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword" ||
    ext.endsWith(".docx") ||
    ext.endsWith(".doc")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimetype === "text/plain" || ext.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  throw new Error("Formato não suportado. Use PDF, Word (.docx) ou texto simples.");
}

router.post(
  "/meetings/parse-file",
  requireAdmin,
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "Nenhum ficheiro enviado." });
      return;
    }

    let text: string;
    try {
      text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao ler ficheiro";
      res.status(422).json({ error: msg });
      return;
    }

    if (!text.trim()) {
      res.status(422).json({ error: "O ficheiro não contém texto legível." });
      return;
    }

    let parsed: unknown;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.6-luna",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Texto da ata:\n\n${text.slice(0, 12000)}` },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      // Strip markdown code fences if present
      const clean = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
      parsed = JSON.parse(clean);
    } catch (err: unknown) {
      console.error("OpenAI parse error:", err);
      res.status(500).json({ error: "Erro ao interpretar o ficheiro com IA. Tente novamente." });
      return;
    }

    res.json(parsed);
  }
);

export default router;
