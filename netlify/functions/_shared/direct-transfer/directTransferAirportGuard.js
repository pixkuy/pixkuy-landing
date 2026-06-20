const CATALOGUED_AIRPORT_CODES = new Set(["MEX", "NLU", "TLC", "PBC", "QRO"]);

const CATALOGUED_AIRPORT_KEYWORDS = [
  "aeropuerto internacional de la ciudad de mexico",
  "aeropuerto internacional de la ciudad de méxico",
  "benito juarez international airport",
  "benito juárez international airport",
  "aicm",
  "aeropuerto internacional felipe angeles",
  "aeropuerto internacional felipe ángeles",
  "felipe angeles international airport",
  "felipe ángeles international airport",
  "aifa",
  "aeropuerto internacional de toluca",
  "toluca international airport",
  "licenciado adolfo lopez mateos international airport",
  "licenciado adolfo lópez mateos international airport",
  "aeropuerto internacional de puebla",
  "puebla international airport",
  "hermanos serdan international airport",
  "hermanos serdán international airport",
  "aeropuerto intercontinental de queretaro",
  "aeropuerto intercontinental de querétaro",
  "aeropuerto internacional de queretaro",
  "aeropuerto internacional de querétaro",
  "queretaro intercontinental airport",
  "querétaro intercontinental airport",
  "queretaro international airport",
  "querétaro international airport"
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeComparisonText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getAddressComponentText(address) {
  const components = Array.isArray(address && address.addressComponents)
    ? address.addressComponents
    : [];

  return components
    .map(function mapComponent(component) {
      if (!component || typeof component !== "object") {
        return "";
      }

      return [
        component.shortText,
        component.short_name,
        component.longText,
        component.long_name
      ].map(normalizeText).filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(" | ");
}

function getAddressTypesText(address) {
  return Array.isArray(address && address.types)
    ? address.types.join(" ")
    : "";
}

function getAddressSearchText(address) {
  const safeAddress = address && typeof address === "object" ? address : {};

  return [
    safeAddress.label,
    safeAddress.countryCode,
    safeAddress.administrativeAreaLevel1,
    safeAddress.administrativeAreaLevel2,
    safeAddress.locality,
    safeAddress.iataCode,
    getAddressTypesText(safeAddress),
    getAddressComponentText(safeAddress)
  ].map(normalizeComparisonText).filter(Boolean).join(" | ");
}


function hasCataloguedAirportCode(address) {
  const iataCode = normalizeText(address && address.iataCode).toUpperCase();

  return Boolean(iataCode && CATALOGUED_AIRPORT_CODES.has(iataCode));
}

function hasCataloguedAirportKeyword(address) {
  const text = getAddressSearchText(address);

  return CATALOGUED_AIRPORT_KEYWORDS.some(function matchKeyword(keyword) {
    return text.indexOf(normalizeComparisonText(keyword)) !== -1;
  });
}

function isCataloguedAirportAddress(address) {
  if (!address || typeof address !== "object") {
    return false;
  }

  return hasCataloguedAirportCode(address) || hasCataloguedAirportKeyword(address);
}

function getDirectTransferAirportRestriction(originAddress, destinationAddress) {
  if (
    isCataloguedAirportAddress(originAddress) ||
    isCataloguedAirportAddress(destinationAddress)
  ) {
    return "DIRECT_TRANSFER_AIRPORT_ROUTE_NOT_ALLOWED";
  }

  return "";
}

module.exports = {
  CATALOGUED_AIRPORT_CODES,
  CATALOGUED_AIRPORT_KEYWORDS,
  getAddressSearchText,
  isCataloguedAirportAddress,
  getDirectTransferAirportRestriction
};