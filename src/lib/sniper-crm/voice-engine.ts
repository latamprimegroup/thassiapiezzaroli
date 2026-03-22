import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

function runCommand(command: string, args: string[]) {
  return new Promise<{ ok: boolean; error: string }>((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({ ok: false, error: error.message });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, error: code === 0 ? "" : stderr || `exit_code_${code ?? "unknown"}` });
    });
  });
}

function extensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("wav")) {
    return "wav";
  }
  if (normalized.includes("mpeg") || normalized.includes("mp3")) {
    return "mp3";
  }
  if (normalized.includes("ogg")) {
    return "ogg";
  }
  if (normalized.includes("webm")) {
    return "webm";
  }
  return "bin";
}

export async function transcodeVoiceToOpus(input: { buffer: Buffer; mimeType: string }) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sniper-crm-voice-"));
  const inputPath = path.join(tempDir, `input.${extensionFromMimeType(input.mimeType)}`);
  const outputPath = path.join(tempDir, "output.ogg");
  try {
    await writeFile(inputPath, input.buffer);
    const probe = await runCommand("ffmpeg", ["-version"]);
    if (!probe.ok) {
      return {
        ok: false,
        error: `FFmpeg indisponivel no ambiente: ${probe.error || "nao encontrado"}`,
        buffer: Buffer.alloc(0),
      };
    }
    const transcode = await runCommand("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-c:a",
      "libopus",
      "-b:a",
      "32k",
      "-vbr",
      "on",
      outputPath,
    ]);
    if (!transcode.ok) {
      return {
        ok: false,
        error: `Falha na transcodificacao: ${transcode.error}`,
        buffer: Buffer.alloc(0),
      };
    }
    const output = await readFile(outputPath);
    return {
      ok: true,
      error: "",
      buffer: output,
      mimeType: "audio/ogg",
      suggestedFileName: `voice-${Date.now()}.ogg`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro inesperado na transcodificacao.",
      buffer: Buffer.alloc(0),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

