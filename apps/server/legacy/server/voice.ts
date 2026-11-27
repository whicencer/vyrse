import OpenAI, { toFile } from "openai";

// Voice replies: the glasses send raw microphone audio, we turn it into text.
//
// The glasses mic gives PCM: 16 kHz, 16-bit, mono. The transcription API wants a file
// format, and WAV is just that PCM with a 44-byte header in front, so nothing is re-encoded.

const MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe";
const client = process.env.OPENAI_API_KEY ? new OpenAI() : null;

const SAMPLE_RATE = 16000;
// Long dictation isn't the point on glasses (and keeps a stuck mic from costing money).
export const MAX_SECONDS = 30;

function pcmToWav(pcm: Buffer) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // bytes per second
  header.writeUInt16LE(2, 32); // bytes per sample
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export const secondsOf = (pcm: Buffer) => pcm.length / (SAMPLE_RATE * 2);

export async function transcribe(pcm: Buffer): Promise<string> {
  if (!client) throw new Error("OPENAI_API_KEY is not set");
  const file = await toFile(pcmToWav(pcm), "voice.wav", { type: "audio/wav" });
  const result = await client.audio.transcriptions.create({ file, model: MODEL });
  return result.text.trim();
}
