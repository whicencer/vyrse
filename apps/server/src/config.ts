import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// The only place that reads process.env. Everything else gets a typed Config.
// The .env file is shared by all apps and lives in the repo root.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });

const schema = z.object({
  WS_PORT: z.coerce.number().int().positive().default(8080),
  BOT_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-6-luna"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-transcribe"),
  BATCH_SILENCE_SEC: z.coerce.number().positive().default(10),
});

export type Config = {
  port: number;
  telegram: { botToken: string };
  openai: { apiKey: string; model: string; transcribeModel: string };
  inbox: { silenceMs: number };
};

export function loadConfig(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment (see .env.example):\n${problems}`);
  }
  const env = parsed.data;
  return {
    port: env.WS_PORT,
    telegram: { botToken: env.BOT_TOKEN },
    openai: { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, transcribeModel: env.OPENAI_TRANSCRIBE_MODEL },
    inbox: { silenceMs: env.BATCH_SILENCE_SEC * 1000 },
  };
}
