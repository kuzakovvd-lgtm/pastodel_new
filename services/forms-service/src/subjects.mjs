import { FORM_CONTRACTS } from "./contracts.mjs";

const sanitizeSubjectPart = (value, maxLength = 80) =>
  String(value ?? "")
    .normalize("NFC")
    .replace(/[\r\n\u0085\u2028\u2029\0-\x1f\x7f-\x9f]+/gu, " ")
    .replace(/[\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const formatFieldValue = (label, value) => [
  `— ${label}:`,
  ...String(value)
    .split("\n")
    .map((line) => `  | ${line}`),
];

export const buildMailMessage = ({
  formId,
  payload,
  requestId,
  recipient,
  from,
  replyToEnabled,
  now = () => new Date(),
}) => {
  const contract = FORM_CONTRACTS[formId];
  if (!contract) throw new Error("unknown_form_contract");
  const safeRequestId = sanitizeSubjectPart(requestId, 64) || "unknown";

  const context = contract.subjectContext
    .map((fieldName) => sanitizeSubjectPart(payload[fieldName], 40))
    .filter(Boolean)
    .slice(0, 2)
    .join(" — ");
  const subjectContext = context ? ` ${context}` : "";
  const subject = `${contract.subjectPrefix}${subjectContext} [ID: ${safeRequestId}]`.slice(
    0,
    240,
  );

  const dataLines = [];
  for (const [fieldName, definition] of Object.entries(contract.fields)) {
    if (definition.type === "honeypot" || definition.type === "consent") continue;
    const value = payload[fieldName];
    if (value === "" || value === undefined) continue;
    dataLines.push(...formatFieldValue(definition.label, value));
  }

  const text = [
    "Новая заявка PASTODEL",
    "",
    `Тип формы: ${contract.formLabel}`,
    `Дата и время: ${now().toISOString()}`,
    `Request ID: ${safeRequestId}`,
    `Страница: ${contract.page}`,
    "",
    "Данные заявки:",
    ...(dataLines.length > 0 ? dataLines : ["— Нет дополнительных данных"]),
    "",
    "Согласие:",
    "— Подтверждено",
  ].join("\n");

  const message = {
    to: recipient,
    from,
    subject,
    text,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  if (replyToEnabled && payload.email) message.replyTo = payload.email;
  return message;
};
