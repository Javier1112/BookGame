import type {
  GameHistoryEntry,
  GameTurnRequest,
  GameTurnResponse
} from "../../shared/game.js";
import { logJson } from "../utils/logger.js";

const ZHIPU_CHAT_COMPLETIONS_URL =
  "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const IMAGE_GENERATIONS_URL =
  "https://open.bigmodel.cn/api/paas/v4/images/generations";

const STORY_MODEL = process.env.ZHIPU_STORY_MODEL ?? "glm-4.6v-flash";
const TOTAL_ROUNDS = 5;
const STORY_TIMEOUT_MS = Number(process.env.ZHIPU_STORY_TIMEOUT_MS ?? 120000);
const STORY_TEMPERATURE = Math.min(
  1,
  Math.max(0.1, Number(process.env.ZHIPU_TEMPERATURE ?? 0.7))
);
const IMAGE_MODEL = process.env.ZHIPU_IMAGE_MODEL ?? "cogview-3-flash";
const IMAGE_SIZE = process.env.ZHIPU_IMAGE_SIZE ?? "896x672";
const IMAGE_TIMEOUT_MS = Number(process.env.ZHIPU_IMAGE_TIMEOUT_MS ?? 120000);
const IMAGE_WATERMARK_ENABLED =
  (process.env.ZHIPU_IMAGE_WATERMARK_ENABLED ?? "false").toLowerCase() === "true";
const IMAGE_CONTENT_FILTER_LEVEL = Number(
  process.env.ZHIPU_IMAGE_CONTENT_FILTER_LEVEL ?? 3
);
const MAX_CONCURRENT_REQUESTS = Math.max(
  1,
  Number(process.env.ZHIPU_MAX_CONCURRENT ?? 2)
);
const RETRY_BACKOFF_MS = [1000, 2000, 4000];
const IMAGE_STYLE_PREFIX =
  "8位复古的像素艺术，SNES时代风格，边缘锐利无抗锯齿，标志性的有限色彩效果，复古游戏画面，";

interface ZhipuStoryResponse {
  character_name: string;
  scene_description: string;
  options: { label: "A" | "B" | "C"; text: string }[];
  image_prompt: string;
  is_game_over: boolean;
}

const stringifyHistory = (history: GameHistoryEntry[]) => {
  if (!history.length) return "无";

  return history
    .map((entry) => {
      const round = Number.isFinite(entry.round) ? entry.round + 1 : "?";
      const label = entry.label || "?";
      const text = entry.text?.trim() ? entry.text.trim() : "（无）";
      return `第${round}回合｜选择：${label}｜结果：${text}`;
    })
    .join("；");
};

const normalizeOptionLabel = (label: string, index: number): "A" | "B" | "C" => {
  const normalized = label.trim().toUpperCase();
  const match = normalized.match(/[ABC]/);
  if (match?.[0] === "A" || match?.[0] === "B" || match?.[0] === "C") {
    return match[0];
  }

  const digit = normalized.match(/[123]/)?.[0];
  if (digit === "1") return "A";
  if (digit === "2") return "B";
  if (digit === "3") return "C";

  return (["A", "B", "C"][index] ?? "A") as "A" | "B" | "C";
};

const fallbackOptions = (): ZhipuStoryResponse["options"] => [
  { label: "A", text: "先观察周围，寻找线索。" },
  { label: "B", text: "与附近的人交谈，试探信息。" },
  { label: "C", text: "沿着直觉前进，看看会遇到什么。" }
];

const extractOptions = (
  raw: unknown,
  isGameOver: boolean
): ZhipuStoryResponse["options"] => {
  if (isGameOver) return [];

  const rawOptions = Array.isArray(raw) ? raw : [];
  const extracted = rawOptions
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          label: (["A", "B", "C"][index] ?? "A") as "A" | "B" | "C",
          text: item
        };
      }

      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.trim() : "";
      if (!text) return null;
      const labelRaw = typeof record.label === "string" ? record.label : "";
      return { label: normalizeOptionLabel(labelRaw, index), text };
    })
    .filter(
      (value): value is { label: "A" | "B" | "C"; text: string } =>
        value !== null
    )
    .slice(0, 3);

  const normalized = extracted.map((option, index) => ({
    label: (["A", "B", "C"][index] ?? "A") as "A" | "B" | "C",
    text: option.text
  }));

  if (normalized.length === 3) return normalized;
  return fallbackOptions();
};

const validateStoryResponse = (data: unknown): ZhipuStoryResponse => {
  if (!data || typeof data !== "object") {
    throw new Error("故事响应格式异常：不是对象。");
  }

  const obj = data as Record<string, unknown>;
  const character = typeof obj.character_name === "string" ? obj.character_name : "";
  const scene = typeof obj.scene_description === "string" ? obj.scene_description : "";
  const imagePrompt = typeof obj.image_prompt === "string" ? obj.image_prompt : "";
  const isGameOver =
    typeof obj.is_game_over === "boolean" ? obj.is_game_over : false;

  if (!character || !scene || !imagePrompt) {
    throw new Error("故事响应缺少必需字段。");
  }

  return {
    character_name: character,
    scene_description: scene,
    image_prompt: imagePrompt,
    is_game_over: isGameOver,
    options: extractOptions(obj.options, isGameOver)
  };
};

const applyImageStyle = (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed) return IMAGE_STYLE_PREFIX.trim();
  if (trimmed.toLowerCase().startsWith(IMAGE_STYLE_PREFIX.toLowerCase())) {
    return trimmed;
  }
  return `${IMAGE_STYLE_PREFIX}${trimmed}`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createLimiter = (limit: number) => {
  let active = 0;
  const queue: Array<() => void> = [];

  const acquire = async () => {
    if (active < limit) {
      active += 1;
      return;
    }

    await new Promise<void>((resolve) => queue.push(resolve));
    active += 1;
  };

  const release = () => {
    active = Math.max(0, active - 1);
    const next = queue.shift();
    if (next) next();
  };

  const run = async <T>(task: () => Promise<T>) => {
    await acquire();
    try {
      return await task();
    } finally {
      release();
    }
  };

  return { run };
};

export const createZhipuGameService = (
  textApiKey: string,
  imageApiKey: string
) => {
  const textToken = textApiKey.trim().replace(/^Bearer\s+/i, "");
  const imageToken = imageApiKey.trim().replace(/^Bearer\s+/i, "");
  const textHeaders = {
    Authorization: `Bearer ${textToken}`,
    "Content-Type": "application/json"
  };
  const imageHeaders = {
    Authorization: `Bearer ${imageToken}`,
    "Content-Type": "application/json"
  };
  const limiter = createLimiter(MAX_CONCURRENT_REQUESTS);
  const truncate = (value: string, max = 400) =>
    value.length > max ? `${value.slice(0, max)}...` : value;

  const normalizeMessageContent = (content: unknown): string | null => {
    if (typeof content === "string") {
      const trimmed = content.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(content)) {
      const texts = content
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          if (record.type === "text" && typeof record.text === "string") {
            return record.text;
          }
          if (typeof record.text === "string") {
            return record.text;
          }
          return null;
        })
        .filter((value): value is string => Boolean(value && value.trim()));

      const joined = texts.join("");
      return joined.trim().length > 0 ? joined.trim() : null;
    }

    return null;
  };

  const extractJsonObject = (raw: string): string | null => {
    let inString = false;
    let escaped = false;
    let depth = 0;
    let start = -1;

    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") {
        if (depth === 0) start = i;
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          return raw.slice(start, i + 1);
        }
      }
    }

    return null;
  };

  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeoutMs: number,
    label: string
  ) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown");
      throw new Error(
        `${label} 请求失败或超时（timeoutMs=${timeoutMs}）：${message}`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const fetchWithRetry = async (
    request: () => Promise<Response>,
    label: string,
    requestId?: string,
    upstreamRequestId?: string
  ) => {
    for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
      const response = await limiter.run(request);
      const text = await response.text();
      if (response.status !== 429 || attempt === RETRY_BACKOFF_MS.length) {
        return { response, text };
      }

      const retryInMs = RETRY_BACKOFF_MS[attempt];
      logJson("warn", "provider_rate_limited", {
        requestId,
        upstreamRequestId,
        label,
        attempt: attempt + 1,
        retryInMs,
        status: response.status,
        body: truncate(text)
      });
      await sleep(retryInMs);
    }

    throw new Error(`${label} 请求重试失败。`);
  };

  const extractContentFilterLevels = (raw: unknown): number[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const level = (item as Record<string, unknown>).level;
        const value = Number(level);
        return Number.isFinite(value) ? value : null;
      })
      .filter((value): value is number => value !== null);
  };

  const callChatJsonObject = async (
    system: string,
    user: string,
    attempt: number = 1,
    requestId?: string
  ) => {
    const upstreamRequestId = globalThis.crypto?.randomUUID?.();
    const startedAt = Date.now();
    const body = JSON.stringify({
      model: STORY_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      thinking: { type: "disabled" },
      stream: false,
      temperature: STORY_TEMPERATURE,
      max_tokens: 2048,
      user_id: requestId ?? upstreamRequestId
    });
    const { response, text } = await fetchWithRetry(
      () =>
        fetchWithTimeout(
          ZHIPU_CHAT_COMPLETIONS_URL,
          {
            method: "POST",
            headers: textHeaders,
            body
          },
          STORY_TIMEOUT_MS,
          "智谱对话"
        ),
      "智谱对话",
      requestId,
      upstreamRequestId
    );

    if (!response.ok) {
      logJson("warn", "zhipu_chat_failed", {
        requestId,
        upstreamRequestId,
        status: response.status,
        statusText: response.statusText,
        body: truncate(text)
      });
      throw new Error(
        `智谱对话接口调用失败：${response.status} ${response.statusText} ${text}`
      );
    }

    const json = JSON.parse(text) as Record<string, any>;
    const choice = json.choices?.[0];
    const finishReason = choice?.finish_reason as string | undefined;
    logJson("info", "zhipu_chat_ok", {
      requestId,
      upstreamRequestId,
      ms: Date.now() - startedAt,
      finishReason: finishReason ?? "unknown",
      attempt
    });

    if (finishReason === "sensitive") {
      throw new Error("内容被安全策略拦截（finish_reason=sensitive）。");
    }

    const normalized = normalizeMessageContent(choice?.message?.content);

    if (!normalized) {
      const hasToolCalls = Array.isArray(choice?.message?.tool_calls);
      if (attempt < 2) {
        const hardenedSystem = `${system}\n\nIMPORTANT: Do not call any tools. Reply with a single JSON object only.`;
        return callChatJsonObject(hardenedSystem, user, attempt + 1, requestId);
      }

      throw new Error(
        `智谱对话返回 content 为空或格式异常（attempt=${attempt}, finish_reason=${
          finishReason ?? "unknown"
        }, tool_calls=${hasToolCalls ? "present" : "none"}）。`
      );
    }

    const extracted = extractJsonObject(normalized);
    if (!extracted) {
      if (attempt < 2) {
        const hardenedSystem = `${system}\n\nIMPORTANT: Reply with ONLY a JSON object, no extra text.`;
        return callChatJsonObject(hardenedSystem, user, attempt + 1, requestId);
      }
      throw new Error("智谱对话返回内容未包含可解析的 JSON 对象。");
    }

    return {
      content: extracted,
      finishReason
    };
  };

  const buildUserPrompt = (payload: GameTurnRequest) => {
    const isFirstTurn = payload.round === 0;
    const isFinalTurn = payload.round >= TOTAL_ROUNDS - 1;

    if (isFirstTurn) {
      return `请根据书籍《${payload.bookTitle}》开启一场角色扮演且沉浸式的互动故事。现在是第 1 回合（共 ${TOTAL_ROUNDS} 回合）。请设定主角，并描写开场场景。`;
    }

    return `我们正在进行一场基于《${payload.bookTitle}》的互动故事游戏。现在是第 ${
      payload.round + 1
    } 回合（共 ${TOTAL_ROUNDS} 回合）。用户选择了：“${
      payload.choice ?? "未选择"
    }”。请继续推进剧情。历史：${stringifyHistory(payload.history)}。${
      isFinalTurn
        ? "这是最后一回合：请以巨大的悬念/危机收束（巨大反转或迫在眉睫的危机），但不要给出最终结局。"
        : ""
    }`;
  };

  const fetchStory = async (
    payload: GameTurnRequest,
    requestId?: string
  ): Promise<ZhipuStoryResponse> => {
    const system = `你是“SHNU Playbrary”的游戏主持人（Game Master）。
规则：
1）游戏总共且必须严格为 ${TOTAL_ROUNDS} 回合。
2）叙事与文风要尽量贴近原书作者的文学风格（故事输出为中文）。
3）第 ${TOTAL_ROUNDS} 回合必须以“巨大的悬念/危机”结束。
4）character_name 一旦确立，后续回合必须保持一致；若因剧情需要更名/身份揭露，必须在 scene_description 中说明原因与变化。
5）scene_description 末尾要自然引出抉择点（危机/诱因/信息差），为 A/B/C 提供动机。
6）options 必须为 3 个互斥且可执行的具体动作，使用动词开头，每条不超过 15 字；禁止“继续/随便/不知道/以上都行/随机/跳过”等空泛选项出现；避免信息重复。
7）你必须且只能输出一个 JSON 对象（不要 markdown、不要多余说明、不要代码块）。
8）JSON 对象必须且只能包含以下键（严格一致），并且键顺序必须为：
   - image_prompt: string（允许中文；只写画面视觉元素（人物/场景/动作/构图/光影/风格）；不写规则/限制/否定提示词，如“不要/禁止/无文字/不包含”等）
   - character_name: string（中文）
   - scene_description: string（中文）
   - options: 长度为 3 的数组，每项为 {label: 'A'|'B'|'C', text: string（中文）}；如果 is_game_over=true 则可以返回 []
   - is_game_over: boolean
9）不得包含任何其它键。`;

    const user = buildUserPrompt(payload);

    const storyStartedAt = Date.now();
    const first = await callChatJsonObject(system, user, 1, requestId);

    const tryParse = (raw: string) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    };

    const parsed1 = tryParse(first.content);

    try {
      return validateStoryResponse(parsed1);
    } catch {
      logJson("warn", "zhipu_story_repair_start", {
        requestId,
        ms: Date.now() - storyStartedAt
      });
      const repairSystem = `你是一个严格的 JSON 结构转换器。
你必须且只能返回一个 JSON 对象，并且键名必须严格为：image_prompt、character_name、scene_description、options、is_game_over（顺序必须保持一致）。
不得有任何其它键；不要 markdown；不要多余文字。
scene_description 末尾要自然引出抉择点（危机/诱因/信息差），为 A/B/C 提供动机。
options 必须为 3 个互斥且可执行的具体动作，使用动词开头，每条不超过 15 字；禁止“继续/随便/不知道/以上都行/随机/跳过”等空泛选项；除非 is_game_over=true，此时 options 可以为 []。
如果输入缺少 options 或 options 不合法，请根据场景内容补全并生成 3 个合理选项。
image_prompt 允许中文，包含视觉描述；`;

      const repairUser = `请将下面内容转换为符合要求的 JSON 结构。\n\n内容：\n${first.content}`;
      const second = await callChatJsonObject(repairSystem, repairUser, 1, requestId);
      const parsed2 = tryParse(second.content);
      logJson("info", "zhipu_story_repair_done", {
        requestId,
        ms: Date.now() - storyStartedAt
      });
      return validateStoryResponse(parsed2);
    }
  };

  const fetchImageUrl = async (
    prompt: string,
    requestId?: string
  ): Promise<string> => {
    const upstreamRequestId = globalThis.crypto?.randomUUID?.();
    const startedAt = Date.now();
    const { response, text } = await fetchWithRetry(
      () =>
        fetchWithTimeout(
          IMAGE_GENERATIONS_URL,
          {
            method: "POST",
            headers: imageHeaders,
            body: JSON.stringify({
              model: IMAGE_MODEL,
              prompt,
              size: IMAGE_SIZE,
              watermark_enabled: IMAGE_WATERMARK_ENABLED,
              user_id: requestId
            })
          },
          IMAGE_TIMEOUT_MS,
          "智谱图像生成"
        ),
      "智谱图像生成",
      requestId,
      upstreamRequestId
    );
    if (!response.ok) {
      logJson("warn", "zhipu_image_failed", {
        requestId,
        upstreamRequestId,
        status: response.status,
        statusText: response.statusText,
        body: truncate(text)
      });
      throw new Error(
        `智谱图像生成接口调用失败：${response.status} ${response.statusText} ${text}`
      );
    }

    const json = JSON.parse(text) as Record<string, any>;
    const url = json?.data?.[0]?.url;
    if (!url || typeof url !== "string") {
      throw new Error("智谱图像生成未返回可用的图片 URL。");
    }

    const levels = extractContentFilterLevels(json?.content_filter);
    if (
      levels.length > 0 &&
      levels.some((level) => level < IMAGE_CONTENT_FILTER_LEVEL)
    ) {
      logJson("warn", "zhipu_image_content_filtered", {
        requestId,
        upstreamRequestId,
        levels,
        requiredLevel: IMAGE_CONTENT_FILTER_LEVEL
      });
      throw new Error(
        `图像内容安全等级不满足要求（level < ${IMAGE_CONTENT_FILTER_LEVEL}）。`
      );
    }

    logJson("info", "zhipu_image_ok", {
      requestId,
      upstreamRequestId,
      ms: Date.now() - startedAt,
      model: IMAGE_MODEL,
      size: IMAGE_SIZE,
      watermarkEnabled: IMAGE_WATERMARK_ENABLED
    });

    return url;
  };

  const generateTurn = async (
    payload: GameTurnRequest,
    requestId?: string
  ): Promise<GameTurnResponse> => {
    const turnStartedAt = Date.now();
    const story = await fetchStory(payload, requestId);
    logJson("info", "zhipu_story_total", {
      requestId,
      ms: Date.now() - turnStartedAt
    });
    const styledPrompt = applyImageStyle(story.image_prompt);
    const imageUrl = await fetchImageUrl(styledPrompt, requestId);
    logJson("info", "zhipu_turn_total", {
      requestId,
      ms: Date.now() - turnStartedAt,
      placeholder: false
    });

    return {
      characterName: story.character_name,
      sceneDescription: story.scene_description,
      options: story.options,
      imagePrompt: styledPrompt,
      imageUrl,
      isGameOver: story.is_game_over
    };
  };

  return {
    generateTurn
  };
};
