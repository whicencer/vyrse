import OpenAI from "openai";
import { config } from "../config";

// One OpenAI client for the whole server.
export const openai = new OpenAI({ apiKey: config.openai.apiKey });

// Asks the model and returns its answer as JSON matching `schema` (structured output).
// `input` goes in as JSON data, never as instructions (prompt-injection guard).
export async function askJson<T>(system: string, input: unknown, schemaName: string, schema: Record<string, unknown>): Promise<T> {
  const response = await openai.responses.create({
    model: config.openai.model,
    reasoning: { effort: "none" },
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(input) },
    ],
    text: { format: { type: "json_schema", name: schemaName, schema, strict: true } },
  });
  return JSON.parse(response.output_text) as T;
}
