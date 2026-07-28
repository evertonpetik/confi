/**
 * transcriptionService.ts
 *
 * Transcreve áudio para texto usando a API da Groq (Whisper large-v3-turbo).
 * Necessário porque a Claude API não aceita áudio como input diretamente.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY as string;

if (!GROQ_API_KEY) {
  console.warn(
    "[transcriptionService] ⚠️ GROQ_API_KEY não configurada. Mensagens de áudio vão falhar."
  );
}

function extensaoPorMimeType(mimeType: string | undefined): string {
  if (!mimeType) return "ogg";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  return "ogg";
}

/**
 * Transcreve um áudio (buffer binário) para texto.
 * @param audio Binário do áudio baixado do WhatsApp
 * @param mimeType MIME type reportado pelo WhatsApp (ex: "audio/ogg; codecs=opus")
 */
export async function transcreverAudio(audio: Buffer, mimeType?: string): Promise<string> {
  const extensao = extensaoPorMimeType(mimeType);

  const form = new FormData();
  form.append("file", new Blob([audio]), `audio.${extensao}`);
  form.append("model", "whisper-large-v3-turbo");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[transcriptionService] Erro na Groq API:", res.status, errText.substring(0, 500));
    throw new Error(`Groq transcription API error: ${res.status}`);
  }

  const data = await res.json();
  return data.text;
}
