import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { logJson } from "../utils/logger.js";

interface ComfyUIServiceOptions {
  baseUrl: string;
  workflowPath: string;
  width: number;
  height: number;
  timeoutMs: number;
  outputDir: string;
  publicBaseUrl?: string;
  ttlMinutes: number;
}

interface ComfyUIPromptResponse {
  prompt_id?: string;
}

interface ComfyUIHistoryImage {
  filename: string;
  subfolder: string;
  type: string;
}

const DEFAULT_CLIENT_ID = "bookgame";
const HISTORY_POLL_INTERVAL_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${label} 超时（${timeoutMs}ms）`)), timeoutMs);
  });
  return Promise.race([promise, timeout]);
};

export const createComfyUIImageService = async (
  options: ComfyUIServiceOptions
) => {
  const {
    baseUrl,
    workflowPath,
    width,
    height,
    timeoutMs,
    outputDir,
    publicBaseUrl,
    ttlMinutes
  } = options;

  const workflowRaw = await fs.readFile(workflowPath, "utf8");
  const workflowTemplate = JSON.parse(workflowRaw) as Record<string, any>;

  await fs.mkdir(outputDir, { recursive: true });

  const cleanupOldFiles = async () => {
    if (ttlMinutes <= 0) return;
    const cutoff = Date.now() - ttlMinutes * 60 * 1000;
    try {
      const entries = await fs.readdir(outputDir, { withFileTypes: true });
      await Promise.all(
        entries.map(async (entry) => {
          if (!entry.isFile()) return;
          const full = path.join(outputDir, entry.name);
          const stat = await fs.stat(full);
          if (stat.mtime.getTime() < cutoff) {
            await fs.unlink(full).catch(() => {});
          }
        })
      );
    } catch (error) {
      logJson("warn", "comfy_cleanup_failed", {
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : { message: String(error ?? "unknown") }
      });
    }
  };

  const buildWorkflow = (prompt: string) => {
    const workflow = structuredClone(workflowTemplate);

    // 文本
    if (workflow["45"]?.inputs) {
      workflow["45"].inputs.text = prompt;
    }

    // 宽高
    if (workflow["41"]?.inputs) {
      workflow["41"].inputs.width = width;
      workflow["41"].inputs.height = height;
    }

    // 采样器 seed
    if (workflow["44"]?.inputs) {
      workflow["44"].inputs.seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }

    return workflow;
  };

  const postPrompt = async (workflow: Record<string, any>) => {
    const response = await fetch(`${baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: DEFAULT_CLIENT_ID,
        prompt: workflow
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `ComfyUI /prompt 调用失败：${response.status} ${response.statusText} ${text}`
      );
    }

    const json = (await response.json()) as ComfyUIPromptResponse;
    if (!json.prompt_id) {
      throw new Error("ComfyUI /prompt 未返回 prompt_id。");
    }
    return json.prompt_id;
  };

  const waitForResult = async (promptId: string): Promise<ComfyUIHistoryImage> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const response = await fetch(`${baseUrl}/history/${promptId}`);
      if (response.ok) {
        const json = (await response.json()) as Record<string, any>;
        const outputs = json?.[promptId]?.outputs;
        const image = outputs?.["9"]?.images?.[0] as ComfyUIHistoryImage | undefined;
        if (image?.filename) {
          return image;
        }
      }
      await delay(HISTORY_POLL_INTERVAL_MS);
    }
    throw new Error(`ComfyUI 结果等待超时（prompt_id=${promptId}）。`);
  };

  const downloadImage = async (info: ComfyUIHistoryImage) => {
    const params = new URLSearchParams({
      filename: info.filename,
      subfolder: info.subfolder ?? "",
      type: info.type ?? "output"
    });
    const response = await fetch(`${baseUrl}/view?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `ComfyUI /view 获取图片失败：${response.status} ${response.statusText} ${text}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  };

  const buildPublicUrl = (filename: string) => {
    if (!publicBaseUrl) return `/generated/${filename}`;
    const base = publicBaseUrl.endsWith("/")
      ? publicBaseUrl
      : `${publicBaseUrl}/`;
    return new URL(`generated/${filename}`, base).toString();
  };

  const saveImage = async (buffer: Buffer, requestId?: string) => {
    const safeId = requestId ?? randomUUID();
    const filename = `${safeId}-${Date.now()}.png`;
    const fullPath = path.join(outputDir, filename);
    await fs.writeFile(fullPath, buffer);
    await cleanupOldFiles();
    return { filename, fullPath };
  };

  const generateImage = async (prompt: string, requestId?: string) => {
    const workflow = buildWorkflow(prompt);
    const promptId = await withTimeout(
      postPrompt(workflow),
      timeoutMs,
      "ComfyUI /prompt"
    );
    const imageInfo = await withTimeout(
      waitForResult(promptId),
      timeoutMs,
      "ComfyUI /history"
    );
    const buffer = await withTimeout(
      downloadImage(imageInfo),
      timeoutMs,
      "ComfyUI /view"
    );
    const saved = await saveImage(buffer, requestId);
    logJson("info", "comfy_image_ok", {
      requestId,
      promptId,
      filename: saved.filename
    });
    return buildPublicUrl(saved.filename);
  };

  return {
    generateImage
  };
};
