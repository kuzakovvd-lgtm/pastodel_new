import { loadConfig } from "./config.mjs";
import { createSmtpDelivery } from "./delivery/smtp.mjs";

let delivery;
try {
  const config = loadConfig();
  if (config.delivery !== "smtp") throw new Error("smtp_mode_required");
  delivery = createSmtpDelivery(config);
  await delivery.verify();
  process.stdout.write(
    `${JSON.stringify({ ok: true, service: "pastodel-forms", check: "smtp_verify" })}\n`,
  );
} catch (error) {
  const candidate = String(error?.code ?? "");
  const code = /^(missing_|invalid_|mock_delivery_|smtp_)/u.test(candidate)
    ? candidate.slice(0, 80)
    : "smtp_verify_failed";
  process.stderr.write(
    `${JSON.stringify({ ok: false, service: "pastodel-forms", check: "smtp_verify", code })}\n`,
  );
  process.exitCode = 1;
} finally {
  await delivery?.close?.();
}
