export interface ServerConfig {
  zhipuTextApiKey: string;
  imageApiKey: string;
  port: number;
  allowedOrigins: Array<string | RegExp>;
}

const originToMatcher = (origin: string): string | RegExp => {
  const trimmed = origin.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "http://localhost") {
    return /^http:\/\/localhost:\d+$/;
  }

  if (lower === "https://localhost") {
    return /^https:\/\/localhost:\d+$/;
  }

  if (lower === "http://127.0.0.1") {
    return /^http:\/\/127\.0\.0\.1:\d+$/;
  }

  if (lower === "https://127.0.0.1") {
    return /^https:\/\/127\.0\.0\.1:\d+$/;
  }

  return trimmed;
};

const parseOrigins = (value: string | undefined): Array<string | RegExp> => {
  if (!value) return [];

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(originToMatcher);
};

export const createServerConfig = (): ServerConfig => {
  const zhipuTextApiKey = process.env.ZHIPU_TEXT_API_KEY ?? "";
  const imageApiKey =
    process.env.ZHIPU_IMAGE_API_KEY ??
    process.env.ZHIPU_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.API_KEY ??
    "";

  if (!zhipuTextApiKey || !imageApiKey) {
    throw new Error(
      "API Key 未配置。请设置 ZHIPU_TEXT_API_KEY 与 ZHIPU_IMAGE_API_KEY。"
    );
  }

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 8788);
  const allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);

  return {
    zhipuTextApiKey,
    imageApiKey,
    port: Number.isNaN(port) ? 8788 : port,
    allowedOrigins
  };
};
