const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function buildResponse(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

exports.handler = async function handler(event) {
  if (!event || event.httpMethod !== "GET") {
    return buildResponse(405, {
      ok: false,
      code: "METHOD_NOT_ALLOWED"
    });
  }

  return buildResponse(200, {
    ok: true,
    recaptchaEnterprise: {
      siteKey: normalizeText(process.env.RECAPTCHA_ENTERPRISE_SITE_KEY)
    }
  });
};