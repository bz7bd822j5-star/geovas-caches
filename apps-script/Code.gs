const API_TOKEN = "geovas_7c2b9a4f1d6e8a3c5b0d9f2a1e7c4b8d";
const SHEET_NAME = "caches";

function doGet(e) {
  const sheet = getOrCreateSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return jsonResponse_({ ok: true, data: [] });
  }

  const since = e && e.parameter && e.parameter.since ? e.parameter.since : null;
  const rows = values.slice(1);
  const data = rows
    .map((row) => rowToCache_(row))
    .filter((cache) => {
      if (!since) return true;
      return cache.updated_at > since;
    });

  return jsonResponse_({ ok: true, data: data });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (!payload || payload.token !== API_TOKEN || !payload.cache) {
      return jsonResponse_({ ok: false, error: "Unauthorized" });
    }

    const cache = payload.cache;
    const sheet = getOrCreateSheet_();
    const values = sheet.getDataRange().getValues();
    const rows = values.slice(1);
    let rowIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === cache.id) {
        rowIndex = i + 2;
        break;
      }
    }

    const rowValues = cacheToRow_(cache);
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return jsonResponse_({ ok: true, id: cache.id });
  } catch (error) {
    return jsonResponse_({ ok: false, error: "Invalid payload" });
  }
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "id",
      "lat",
      "lng",
      "type",
      "adresse",
      "note",
      "created_at",
      "updated_at",
      "source"
    ]);
  }
  return sheet;
}

function cacheToRow_(cache) {
  return [
    cache.id || "",
    cache.lat || "",
    cache.lng || "",
    cache.type || "",
    cache.adresse || "",
    cache.note || "",
    cache.created_at || "",
    cache.updated_at || "",
    cache.source || ""
  ];
}

function rowToCache_(row) {
  return {
    id: row[0],
    lat: Number(row[1]),
    lng: Number(row[2]),
    type: row[3],
    adresse: row[4],
    note: row[5],
    created_at: row[6],
    updated_at: row[7],
    source: row[8]
  };
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
