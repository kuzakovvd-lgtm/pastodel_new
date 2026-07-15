export const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

export const sendJson = (response, status, body, extraHeaders = {}) => {
  if (response.destroyed || response.writableEnded) return false;
  response.writeHead(status, { ...RESPONSE_HEADERS, ...extraHeaders });
  response.end(JSON.stringify(body));
  return true;
};

export const errorBody = (code, requestId) => ({
  ok: false,
  code,
  requestId,
});

export const successBody = (requestId) => ({
  ok: true,
  status: "accepted",
  requestId,
});
