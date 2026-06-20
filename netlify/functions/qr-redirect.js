const noStoreHeaders = {
  "cache-control": "no-store"
};

const textHeaders = {
  ...noStoreHeaders,
  "content-type": "text/plain; charset=utf-8"
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCode(value) {
  return normalizeText(value).toLowerCase();
}

function buildTextResponse(statusCode, message) {
  return {
    statusCode,
    headers: textHeaders,
    body: message
  };
}

function resolvePathCode(event) {
  const path = normalizeText(event && event.path);

  if (!path) {
    return "";
  }

  const pathWithoutQuery = path.split("?")[0] || "";
  const segments = pathWithoutQuery.split("/").map(normalizeText).filter(Boolean);
  const qrIndex = segments.lastIndexOf("qr");
  const functionIndex = segments.lastIndexOf("qr-redirect");

  if (qrIndex >= 0 && segments[qrIndex + 1]) {
    return normalizeCode(segments[qrIndex + 1]);
  }

  if (functionIndex >= 0 && segments[functionIndex + 1]) {
    return normalizeCode(segments[functionIndex + 1]);
  }

  return "";
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== "object") {
    return "";
  }

  const exact = headers[name];
  const lower = headers[name.toLowerCase()];

  return normalizeText(exact || lower);
}

function buildPublicOrigin(event) {
  const host = getHeader(event.headers, "host").toLowerCase();

  if (!host) {
    return "";
  }

  if (host === "partners.pixkuy.com") {
    return "https://partners.pixkuy.com";
  }

  const forwardedProto = getHeader(event.headers, "x-forwarded-proto");

  if (forwardedProto) {
    return `${forwardedProto}://${host}`;
  }

  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  return `${isLocalHost ? "http" : "https"}://${host}`;
}

function buildResolveUrl(apiBaseUrl, code) {
  const baseUrl = normalizeText(apiBaseUrl).replace(/\/+$/, "");

  return `${baseUrl}/v1/public/qr-redirects/${encodeURIComponent(code)}/resolve`;
}

exports.handler = async function handler(event) {
  if (!event || event.httpMethod !== "GET") {
    return buildTextResponse(405, "Method not allowed");
  }

  const host = getHeader(event.headers, "host").toLowerCase();
  const code = normalizeCode(
    event.queryStringParameters && event.queryStringParameters.code,
  ) || resolvePathCode(event) || (host === "partners.pixkuy.com" ? "partners" : "");

  if (!code) {
    return buildTextResponse(400, "QR code is required");
  }

  const apiBaseUrl = normalizeText(process.env.BOOKING_API_BASE_URL);
  const siteKey = normalizeText(process.env.PIXKUY_PUBLIC_SITE_KEY);
  const publicOrigin = buildPublicOrigin(event);

  if (!apiBaseUrl || !siteKey || !publicOrigin) {
    return buildTextResponse(503, "QR redirect is not configured");
  }

  let response;

  try {
    response = await fetch(buildResolveUrl(apiBaseUrl, code), {
      method: "GET",
      headers: {
        "x-pixkuy-site-key": siteKey,
        Origin: publicOrigin
      }
    });
  } catch (error) {
    return buildTextResponse(503, "QR redirect is temporarily unavailable");
  }

  let payload;

  try {
    payload = await response.json();
  } catch (error) {
    return buildTextResponse(502, "QR redirect response is invalid");
  }

  if (!response.ok || !payload || payload.status !== "ok" || !payload.redirect) {
    const errorCode = payload && payload.code ? payload.code : "QR_REDIRECT_UNAVAILABLE";

    return buildTextResponse(response.status || 502, errorCode);
  }

  const location = normalizeText(payload.redirect.location);

  if (!location) {
    return buildTextResponse(502, "QR redirect target is missing");
  }

  return {
    statusCode: 302,
    headers: {
      ...noStoreHeaders,
      Location: location
    },
    body: ""
  };
};