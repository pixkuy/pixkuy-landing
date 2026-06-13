const fs = require("fs");
const path = require("path");

const DATA_DIR_CANDIDATES = [
  path.join(process.cwd(), "assets", "js", "data"),
  path.join(__dirname, "..", "..", "..", "..", "assets", "js", "data"),
  path.join(__dirname, "..", "..", "assets", "js", "data")
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertSafeDataFileName(fileName) {
  const safeFileName = normalizeText(fileName);

  if (!safeFileName) {
    throw new Error("DATA_FILE_NAME_MISSING");
  }

  if (
    safeFileName.indexOf("/") !== -1 ||
    safeFileName.indexOf("\\") !== -1 ||
    safeFileName.indexOf("..") !== -1
  ) {
    throw new Error("DATA_FILE_NAME_UNSAFE:" + safeFileName);
  }

  return safeFileName;
}

function resolveDataFilePath(fileName) {
  const safeFileName = assertSafeDataFileName(fileName);
  const dataDir = DATA_DIR_CANDIDATES.find(function findDataDir(candidate) {
    return fs.existsSync(path.join(candidate, safeFileName));
  });

  if (!dataDir) {
    throw new Error("DATA_FILE_NOT_FOUND:" + safeFileName);
  }

  return path.join(dataDir, safeFileName);
}

function readDataFile(fileName) {
  return fs.readFileSync(resolveDataFilePath(fileName), "utf8");
}

function readJsonDataFile(fileName) {
  const raw = readDataFile(fileName);

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("DATA_FILE_INVALID_JSON:" + assertSafeDataFileName(fileName));
  }
}

function loadDirectTransferCoverageGeojson() {
  return readJsonDataFile("direct-transfer-coverage.geojson");
}

module.exports = {
  DATA_DIR_CANDIDATES,
  resolveDataFilePath,
  readDataFile,
  readJsonDataFile,
  loadDirectTransferCoverageGeojson
};