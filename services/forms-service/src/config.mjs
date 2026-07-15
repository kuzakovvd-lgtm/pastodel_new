const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const ALLOWED_NODE_ENVS = new Set([
  "development",
  "test",
  "staging",
  "production",
]);

export class ConfigError extends Error {
  constructor(code) {
    super(code);
    this.name = "ConfigError";
    this.code = code;
  }
}

const required = (env, name) => {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new ConfigError(`missing_${name.toLowerCase()}`);
  return value;
};

const parseInteger = (env, name, fallback, { min, max }) => {
  const raw = String(env[name] ?? fallback).trim();
  if (!/^\d+$/.test(raw)) {
    throw new ConfigError(`invalid_${name.toLowerCase()}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new ConfigError(`invalid_${name.toLowerCase()}`);
  }
  return value;
};

const parseBoolean = (
  env,
  name,
  fallback,
  invalidCode = `invalid_${name.toLowerCase()}`,
) => {
  const raw = String(env[name] ?? fallback).trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ConfigError(invalidCode);
};

const validateMailbox = (value, code) => {
  if (
    value.length > 254 ||
    !EMAIL_PATTERN.test(value) ||
    /[\r\n\0]/.test(value)
  ) {
    throw new ConfigError(code);
  }
  return value;
};

const validateSmtpHost = (value) => {
  if (
    value.length > 253 ||
    /[\s\r\n\0]/u.test(value) ||
    !/^[a-z0-9.-]+$/iu.test(value) ||
    value.startsWith(".") ||
    value.endsWith(".") ||
    value.includes("..")
  ) {
    throw new ConfigError("invalid_pastodel_smtp_host");
  }
  return value;
};

const validateSmtpCredential = (
  value,
  missingCode,
  invalidCode,
  { trim = true } = {},
) => {
  const normalized = trim ? String(value ?? "").trim() : String(value ?? "");
  if (!normalized) throw new ConfigError(missingCode);
  if (normalized.length > 1024 || /[\r\n\0]/u.test(normalized)) {
    throw new ConfigError(invalidCode);
  }
  return normalized;
};

const parseOrigin = (raw, nodeEnv) => {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError("invalid_pastodel_allowed_origin");
  }
  const protocolAllowed =
    url.protocol === "https:" ||
    (nodeEnv === "test" && url.protocol === "http:");
  if (
    !protocolAllowed ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new ConfigError("invalid_pastodel_allowed_origin");
  }
  return url.origin;
};

export const loadConfig = (env = process.env) => {
  const nodeEnv = required(env, "NODE_ENV").toLowerCase();
  if (!ALLOWED_NODE_ENVS.has(nodeEnv)) {
    throw new ConfigError("invalid_node_env");
  }
  const host = String(env.PASTODEL_FORMS_HOST ?? "127.0.0.1").trim();
  if (host !== "127.0.0.1") {
    throw new ConfigError("invalid_pastodel_forms_host");
  }

  const port = parseInteger(env, "PASTODEL_FORMS_PORT", 8787, {
    min: 1,
    max: 65535,
  });
  const allowedOrigin = parseOrigin(
    required(env, "PASTODEL_ALLOWED_ORIGIN"),
    nodeEnv,
  );
  const delivery = required(env, "PASTODEL_FORMS_DELIVERY").toLowerCase();
  if (!new Set(["mock", "smtp"]).has(delivery)) {
    throw new ConfigError("invalid_pastodel_forms_delivery");
  }
  if (nodeEnv === "production" && delivery === "mock") {
    throw new ConfigError("mock_forbidden_in_production");
  }
  if (nodeEnv === "staging" && delivery === "mock") {
    const allowMockInStaging = parseBoolean(
      env,
      "PASTODEL_FORMS_ALLOW_MOCK_IN_STAGING",
      "false",
      "mock_not_allowed_in_staging",
    );
    if (!allowMockInStaging) {
      throw new ConfigError("mock_not_allowed_in_staging");
    }
  }

  const recipient = validateMailbox(
    required(env, "PASTODEL_FORMS_TO"),
    "invalid_pastodel_forms_to",
  );
  const fromRaw = String(env.PASTODEL_FORMS_FROM ?? "").trim();
  const from = fromRaw
    ? validateMailbox(fromRaw, "invalid_pastodel_forms_from")
    : "";
  const replyToEnabled = parseBoolean(
    env,
    "PASTODEL_FORMS_REPLY_TO_ENABLED",
    "true",
  );

  const bodyLimitBytes = parseInteger(
    env,
    "PASTODEL_FORMS_BODY_LIMIT_BYTES",
    32768,
    { min: 1024, max: 1048576 },
  );
  const requestTimeoutMs = parseInteger(
    env,
    "PASTODEL_FORMS_REQUEST_TIMEOUT_MS",
    15000,
    { min: 1000, max: 60000 },
  );
  const headersTimeoutMs = parseInteger(
    env,
    "PASTODEL_FORMS_HEADERS_TIMEOUT_MS",
    10000,
    { min: 1000, max: 60000 },
  );
  const keepAliveTimeoutMs = parseInteger(
    env,
    "PASTODEL_FORMS_KEEP_ALIVE_TIMEOUT_MS",
    5000,
    { min: 1000, max: 30000 },
  );
  const maxHeadersCount = parseInteger(
    env,
    "PASTODEL_FORMS_MAX_HEADERS_COUNT",
    40,
    { min: 10, max: 200 },
  );
  const maxRequestsPerSocket = parseInteger(
    env,
    "PASTODEL_FORMS_MAX_REQUESTS_PER_SOCKET",
    20,
    { min: 1, max: 1000 },
  );
  const maxInFlight = parseInteger(
    env,
    "PASTODEL_FORMS_MAX_IN_FLIGHT",
    5,
    { min: 1, max: 100 },
  );
  const shutdownTimeoutMs = parseInteger(
    env,
    "PASTODEL_FORMS_SHUTDOWN_TIMEOUT_MS",
    15000,
    { min: 1000, max: 60000 },
  );
  if (headersTimeoutMs > requestTimeoutMs) {
    throw new ConfigError("invalid_http_timeout_relationship");
  }
  const logLevel = String(env.PASTODEL_FORMS_LOG_LEVEL ?? "info")
    .trim()
    .toLowerCase();
  if (!new Set(["debug", "info", "warn", "error"]).has(logLevel)) {
    throw new ConfigError("invalid_pastodel_forms_log_level");
  }

  const smtp = {
    host: String(env.PASTODEL_SMTP_HOST ?? "").trim(),
    port: parseInteger(env, "PASTODEL_SMTP_PORT", 587, {
      min: 1,
      max: 65535,
    }),
    secure: parseBoolean(env, "PASTODEL_SMTP_SECURE", "false"),
    requireTLS: parseBoolean(env, "PASTODEL_SMTP_REQUIRE_TLS", "true"),
    user: String(env.PASTODEL_SMTP_USER ?? "").trim(),
    pass: String(env.PASTODEL_SMTP_PASS ?? ""),
    connectionTimeoutMs: parseInteger(
      env,
      "PASTODEL_SMTP_CONNECTION_TIMEOUT_MS",
      10000,
      { min: 1000, max: 60000 },
    ),
    greetingTimeoutMs: parseInteger(
      env,
      "PASTODEL_SMTP_GREETING_TIMEOUT_MS",
      10000,
      { min: 1000, max: 60000 },
    ),
    socketTimeoutMs: parseInteger(
      env,
      "PASTODEL_SMTP_SOCKET_TIMEOUT_MS",
      15000,
      { min: 1000, max: 120000 },
    ),
    dnsTimeoutMs: parseInteger(env, "PASTODEL_SMTP_DNS_TIMEOUT_MS", 5000, {
      min: 1000,
      max: 60000,
    }),
  };

  if (delivery === "smtp") {
    if (!from) throw new ConfigError("missing_pastodel_forms_from");
    if (!smtp.host) throw new ConfigError("missing_pastodel_smtp_host");
    smtp.host = validateSmtpHost(smtp.host);
    smtp.user = validateSmtpCredential(
      smtp.user,
      "missing_pastodel_smtp_user",
      "invalid_pastodel_smtp_user",
    );
    smtp.pass = validateSmtpCredential(
      smtp.pass,
      "missing_pastodel_smtp_pass",
      "invalid_pastodel_smtp_pass",
      { trim: false },
    );
    const validImplicitTls =
      smtp.port === 465 && smtp.secure && !smtp.requireTLS;
    const validStartTls =
      smtp.port === 587 && !smtp.secure && smtp.requireTLS;
    if (!validImplicitTls && !validStartTls) {
      throw new ConfigError("invalid_smtp_security_policy");
    }
  }

  return Object.freeze({
    nodeEnv,
    host,
    port,
    allowedOrigin,
    delivery,
    recipient,
    from,
    replyToEnabled,
    bodyLimitBytes,
    headersTimeoutMs,
    requestTimeoutMs,
    keepAliveTimeoutMs,
    maxHeadersCount,
    maxRequestsPerSocket,
    maxInFlight,
    shutdownTimeoutMs,
    logLevel,
    smtp: Object.freeze(smtp),
  });
};
