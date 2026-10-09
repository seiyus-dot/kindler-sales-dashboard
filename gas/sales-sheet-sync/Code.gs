/**
 * Google スプレッドシート「KINDLER 営業行動管理」から
 * KINDLER 営業ダッシュボードへ案件・商談を反映する一時連携スクリプト。
 * 案件の新規IDはdealsの各バッチ成功直後に書き戻し、後続処理の失敗時も保持する。
 */

const SALES_SHEET_SYNC = {
  SPREADSHEET_ID: '1gq7HSWpFtpbLNF4H-wemnopzl79ZTCDWIhBfXVBvN24',
  API_URL: 'https://kindler-sales.vercel.app/api/import-sales-sheet',
  TOKEN_PROPERTY: 'SHEET_IMPORT_TOKEN',
  DEALS_SHEET: '案件管理',
  MEETINGS_SHEET: '商談履歴',
  LOG_SHEET: '反映ログ',
  HEADER_ROW: 2,
  DATA_START_ROW: 3,
  DASHBOARD_ID_HEADER: 'ダッシュボードID',
  DASHBOARD_ID_DEFAULT_COLUMN: 17, // Q列。見出しは実際の文字から検索する。
  MAX_ROWS_PER_REQUEST: 500,
  TIME_ZONE: 'Asia/Tokyo',
  AUTO_HANDLER: 'syncSalesSheetAutomatically',
};

const DEAL_FIELDS = {
  '会社名': 'company_name',
  '担当': 'member',
  '業界': 'industry',
  'ステージ': 'stage',
  '見込金額': 'expected_amount_yen',
  '確度': 'win_probability',
  '次アクション': 'next_action',
  '期限': 'due_date',
  '最終接触日': 'last_contact_date',
  '流入経路': 'source',
  '失注理由': 'loss_reason',
  'メモ': 'notes',
  '案件タイプ': 'deal_kind',
};

const MEETING_FIELDS = {
  '商談ID': 'meeting_id',
  '商談日': 'date',
  '担当': 'member',
  '顧客名 / 会社名': 'customer',
  '商材': 'product',
  '商談区分': 'kind',
  '商談結果': 'result',
  '見込ランク': 'rank',
  '最大ネック': 'bottleneck',
  '補足・商談要約': 'summary',
  '次アクション': 'next_action',
  '期限': 'due_date',
  'Slack URL': 'slack_url',
};

/** スプレッドシートを開いたときに連携メニューを表示する。 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ダッシュボード連携')
    .addItem('今すぐ反映', 'syncSalesSheetNow')
    .addItem('自動反映を設定（30分ごと）', 'installSalesSheetSyncTrigger')
    .addItem('自動反映を止める', 'removeSalesSheetSyncTrigger')
    .addToUi();
}

/** メニューから手動で反映する。 */
function syncSalesSheetNow() {
  runSalesSheetSync_(true);
}

/** 時間主導トリガーから呼ばれる。 */
function syncSalesSheetAutomatically() {
  runSalesSheetSync_(false);
}

/** 30分ごとの自動反映トリガーを1つだけ設定する。 */
function installSalesSheetSyncTrigger() {
  const ui = SpreadsheetApp.getUi();
  try {
    deleteSalesSheetSyncTriggers_();
    ScriptApp.newTrigger(SALES_SHEET_SYNC.AUTO_HANDLER)
      .timeBased()
      .everyMinutes(30)
      .create();
    ui.alert('自動反映を設定しました。30分ごとに反映します。');
  } catch (error) {
    ui.alert('自動反映を設定できませんでした。\n\n' + errorMessage_(error));
    throw error;
  }
}

/** この連携用の自動反映トリガーをすべて削除する。 */
function removeSalesSheetSyncTrigger() {
  const count = deleteSalesSheetSyncTriggers_();
  SpreadsheetApp.getUi().alert(
    count > 0
      ? '自動反映を停止しました。'
      : '自動反映の設定はありませんでした。'
  );
}

function deleteSalesSheetSyncTriggers_() {
  let count = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === SALES_SHEET_SYNC.AUTO_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
      count += 1;
    }
  });
  return count;
}

/**
 * 反映本体。dealsの新規IDは各バッチ成功直後にシートへ書き戻す。
 * 後続バッチやmeetingsが失敗しても、書き戻し済みのIDは保持する。
 * APIが返す行単位の action=error は正常なレスポンスとしてログへ記録する。
 */
function runSalesSheetSync_(showAlert) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    const busyMessage = '別の反映処理が実行中です。しばらく待ってからもう一度お試しください。';
    if (showAlert) SpreadsheetApp.getUi().alert(busyMessage);
    else console.log(busyMessage);
    return;
  }

  let spreadsheet = null;
  const dealResults = [];
  const meetingResults = [];

  try {
    // 失敗時も反映ログを残せるよう、トークン検査より先に開く。
    spreadsheet = SpreadsheetApp.openById(SALES_SHEET_SYNC.SPREADSHEET_ID);

    const token = PropertiesService.getScriptProperties()
      .getProperty(SALES_SHEET_SYNC.TOKEN_PROPERTY);
    if (!token || !String(token).trim()) {
      throw new Error(
        'スクリプトプロパティ「SHEET_IMPORT_TOKEN」が未設定です。READMEの手順に沿って設定してください。'
      );
    }
    const dealsSheet = requireSheet_(spreadsheet, SALES_SHEET_SYNC.DEALS_SHEET);
    const meetingsSheet = requireSheet_(spreadsheet, SALES_SHEET_SYNC.MEETINGS_SHEET);

    const dealsTable = readTable_(dealsSheet);
    const meetingsTable = readTable_(meetingsSheet);
    const dashboardIdColumn = planDashboardIdColumn_(dealsTable);

    const deals = buildRows_(dealsTable, DEAL_FIELDS, '会社名', function(row) {
      row.dashboard_id = cellValue_(dealsTable, row.row, dashboardIdColumn);
    });

    const createdIdByRow = {};
    let dashboardIdHeaderWritten =
      dealsTable.columnByHeader[SALES_SHEET_SYNC.DASHBOARD_ID_HEADER] !== undefined;

    // 案件を先に送り、各バッチの応答直後に新規IDを書き戻す。
    sendBatches_('deals', deals, String(token).trim(), function(batchResults) {
      Array.prototype.push.apply(dealResults, batchResults);
      batchResults.forEach(function(result) {
        if (result.action === 'created' && result.dashboard_id) {
          createdIdByRow[result.row] = result.dashboard_id;
        }
      });
      dashboardIdHeaderWritten = writeCreatedDealIds_(
        dealsSheet,
        dashboardIdColumn,
        batchResults,
        dashboardIdHeaderWritten
      );
    });

    // APIで新規採番されたIDをメモリ上の案件一覧へ反映してから商談を組み立てる。
    const companyMatches = deals.map(function(deal) {
      return {
        company: cleanString_(deal.company_name),
        dashboardId: createdIdByRow[deal.row] || cleanString_(deal.dashboard_id),
      };
    }).filter(function(item) {
      return item.company !== '';
    }).sort(function(a, b) {
      return b.company.length - a.company.length;
    });

    const meetings = buildRows_(meetingsTable, MEETING_FIELDS, '商談ID', function(row) {
      const customer = cleanString_(row.customer);
      const match = companyMatches.find(function(item) {
        return customer.indexOf(item.company) === 0;
      });
      row.dashboard_id = match ? match.dashboardId : '';
    });

    // 案件IDの書き戻しが完了してから商談を送る。
    sendBatches_('meetings', meetings, String(token).trim(), function(batchResults) {
      Array.prototype.push.apply(meetingResults, batchResults);
    });
    const summary = summarizeResults_(dealResults, meetingResults);

    // 新規案件が0件でも、正常完了時は従来どおり見出しを用意する。
    if (!dashboardIdHeaderWritten) {
      writeDashboardIdHeader_(dealsSheet, dashboardIdColumn);
    }
    appendRunLog_(spreadsheet, summary);

    if (showAlert) SpreadsheetApp.getUi().alert(formatSummary_(summary));
  } catch (error) {
    const failureReason = errorMessage_(error);
    const failureSummary = summarizeResults_(dealResults, meetingResults);
    failureSummary.errors.unshift(
      '処理失敗: ' + failureReason,
      '案件（失敗時点）: 新規 ' + failureSummary.deals.created +
        '件 / 更新 ' + failureSummary.deals.updated + '件'
    );
    if (spreadsheet) {
      try {
        appendRunLog_(spreadsheet, failureSummary);
      } catch (logError) {
        console.error('反映ログの記録に失敗しました: ' + errorMessage_(logError));
      }
    }

    const message = 'ダッシュボードへの反映に失敗しました。\n\n' + failureReason +
      '\n\n登録済みの案件IDは書き戻しました。もう一度実行すれば続きから反映されます。';
    if (showAlert) {
      SpreadsheetApp.getUi().alert(message);
    } else {
      console.error(message);
      throw error; // トリガーの失敗履歴に残す。
    }
  } finally {
    lock.releaseLock();
  }
}

function requireSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('シート「' + name + '」が見つかりません。');
  return sheet;
}

/** 見出し行とデータ行を一度に読む。値は表示文字列ではなく元の型を保つ。 */
function readTable_(sheet) {
  const requiredColumns = Math.max(
    sheet.getLastColumn(),
    SALES_SHEET_SYNC.DASHBOARD_ID_DEFAULT_COLUMN
  );
  const lastColumn = Math.min(requiredColumns, sheet.getMaxColumns());
  const lastRow = Math.max(sheet.getLastRow(), SALES_SHEET_SYNC.HEADER_ROW);
  const values = sheet.getRange(
    SALES_SHEET_SYNC.HEADER_ROW,
    1,
    lastRow - SALES_SHEET_SYNC.HEADER_ROW + 1,
    lastColumn
  ).getValues();
  const headers = values[0].map(function(value) { return cleanString_(value); });
  const columnByHeader = {};
  headers.forEach(function(header, index) {
    if (header && columnByHeader[header] === undefined) columnByHeader[header] = index + 1;
  });
  return {
    sheet: sheet,
    headers: headers,
    columnByHeader: columnByHeader,
    rows: values.slice(1),
  };
}

/**
 * 見出しがあればその列を使い、なければQ列を予約する。
 * Q列に別の見出しがある場合は、意図しない上書きを避けるため停止する。
 */
function planDashboardIdColumn_(table) {
  const existing = table.columnByHeader[SALES_SHEET_SYNC.DASHBOARD_ID_HEADER];
  if (existing !== undefined) return existing;

  const qHeader = table.headers[SALES_SHEET_SYNC.DASHBOARD_ID_DEFAULT_COLUMN - 1];
  if (qHeader) {
    throw new Error(
      '「案件管理」のQ2には「' + qHeader + '」があります。空欄にしてから再実行してください。'
    );
  }
  return SALES_SHEET_SYNC.DASHBOARD_ID_DEFAULT_COLUMN;
}

/** 見出し名から列を引き、API用の行オブジェクトを作る。 */
function buildRows_(table, fieldMap, requiredHeader, decorate) {
  const requiredHeaders = Object.keys(fieldMap);
  const missing = requiredHeaders.filter(function(header) {
    return table.columnByHeader[header] === undefined;
  });
  if (missing.length > 0) {
    throw new Error(
      'シート「' + table.sheet.getName() + '」に必要な見出しがありません: ' + missing.join(', ')
    );
  }

  const requiredColumn = table.columnByHeader[requiredHeader];
  const rows = [];
  table.rows.forEach(function(values, index) {
    const sheetRow = SALES_SHEET_SYNC.DATA_START_ROW + index;
    if (isBlank_(values[requiredColumn - 1])) return;

    const item = { row: sheetRow };
    requiredHeaders.forEach(function(header) {
      const value = values[table.columnByHeader[header] - 1];
      item[fieldMap[header]] = normalizeValue_(value);
    });
    decorate(item);
    rows.push(item);
  });
  return rows;
}

function cellValue_(table, sheetRow, column) {
  const rowIndex = sheetRow - SALES_SHEET_SYNC.DATA_START_ROW;
  const value = (table.rows[rowIndex] || [])[column - 1];
  return value === undefined ? '' : normalizeValue_(value);
}

function normalizeValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, SALES_SHEET_SYNC.TIME_ZONE, 'yyyy-MM-dd');
  }
  return value;
}

function isBlank_(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function cleanString_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

/** 最大500行ずつ送り、各バッチ成功直後にコールバックを呼ぶ。 */
function sendBatches_(kind, rows, token, onBatchSuccess) {
  const allResults = [];
  for (let offset = 0; offset < rows.length; offset += SALES_SHEET_SYNC.MAX_ROWS_PER_REQUEST) {
    const batch = rows.slice(offset, offset + SALES_SHEET_SYNC.MAX_ROWS_PER_REQUEST);
    const payload = {};
    payload[kind] = batch;
    const response = UrlFetchApp.fetch(SALES_SHEET_SYNC.API_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();
    const responseText = response.getContentText();
    let body;
    try {
      body = JSON.parse(responseText);
    } catch (error) {
      throw new Error('APIからJSONではない応答が返りました（HTTP ' + status + '）。');
    }

    if (status < 200 || status >= 300) {
      const detail = body && body.error ? body.error : responseText.slice(0, 300);
      throw new Error('APIエラー（HTTP ' + status + '）: ' + detail);
    }
    if (!body || !Array.isArray(body[kind])) {
      throw new Error('APIの応答形式が正しくありません（' + kind + ' の結果がありません）。');
    }
    if (onBatchSuccess) onBatchSuccess(body[kind]);
    Array.prototype.push.apply(allResults, body[kind]);
  }
  return allResults;
}

function summarizeResults_(dealResults, meetingResults) {
  const count = function(results, action) {
    return results.filter(function(result) { return result.action === action; }).length;
  };
  const errors = [];
  dealResults.forEach(function(result) {
    if (result.action === 'error') {
      errors.push('案件管理 ' + result.row + '行目: ' + (result.error || '不明なエラー'));
    }
  });
  meetingResults.forEach(function(result) {
    if (result.action === 'error') {
      errors.push('商談履歴 ' + result.row + '行目: ' + (result.error || '不明なエラー'));
    }
  });

  return {
    deals: {
      created: count(dealResults, 'created'),
      updated: count(dealResults, 'updated'),
      locked: count(dealResults, 'locked'),
      error: count(dealResults, 'error'),
    },
    meetings: {
      created: count(meetingResults, 'created'),
      exists: count(meetingResults, 'exists'),
      skipped: count(meetingResults, 'skipped'),
      error: count(meetingResults, 'error'),
    },
    errors: errors,
  };
}

/** 新規作成された案件IDをそのバッチ内で書き戻し、即時反映する。 */
function writeCreatedDealIds_(dealsSheet, dashboardIdColumn, batchResults, headerWritten) {
  const createdResults = batchResults.filter(function(result) {
    return result.action === 'created' && result.dashboard_id;
  });
  if (createdResults.length === 0) return headerWritten;

  if (!headerWritten) {
    writeDashboardIdHeader_(dealsSheet, dashboardIdColumn);
    headerWritten = true;
  }
  ensureColumn_(dealsSheet, dashboardIdColumn);
  createdResults.forEach(function(result) {
    dealsSheet.getRange(Number(result.row), dashboardIdColumn).setValue(result.dashboard_id);
  });
  SpreadsheetApp.flush();
  return headerWritten;
}

function writeDashboardIdHeader_(dealsSheet, dashboardIdColumn) {
  ensureColumn_(dealsSheet, dashboardIdColumn);
  dealsSheet.getRange(SALES_SHEET_SYNC.HEADER_ROW, dashboardIdColumn)
    .setValue(SALES_SHEET_SYNC.DASHBOARD_ID_HEADER);
}

function ensureColumn_(sheet, column) {
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < column) {
    sheet.insertColumnsAfter(maxColumns, column - maxColumns);
  }
}

/** 成功・失敗のどちらの実行結果も1行追記する。 */
function appendRunLog_(spreadsheet, summary) {
  let logSheet = spreadsheet.getSheetByName(SALES_SHEET_SYNC.LOG_SHEET);
  if (!logSheet) logSheet = spreadsheet.insertSheet(SALES_SHEET_SYNC.LOG_SHEET);
  const lockedHeader = '案件 ダッシュボード管理';
  let lockedColumn;
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow([
      '実行日時',
      '案件 新規', '案件 更新', '案件 エラー',
      '商談 新規', '商談 登録済み', '商談 スキップ', '商談 エラー',
      'エラー内容',
      lockedHeader,
    ]);
    lockedColumn = 10;
  } else {
    const lastColumn = Math.max(logSheet.getLastColumn(), 1);
    const headers = logSheet.getRange(1, 1, 1, lastColumn).getValues()[0]
      .map(function(value) { return cleanString_(value); });
    const lockedIndex = headers.indexOf(lockedHeader);
    lockedColumn = lockedIndex >= 0 ? lockedIndex + 1 : lastColumn + 1;
    if (lockedIndex < 0) logSheet.getRange(1, lockedColumn).setValue(lockedHeader);
  }
  const logRow = [
    new Date(),
    summary.deals.created,
    summary.deals.updated,
    summary.deals.error,
    summary.meetings.created,
    summary.meetings.exists,
    summary.meetings.skipped,
    summary.meetings.error,
    summary.errors.slice(0, 10).join('\n'),
  ];
  while (logRow.length < lockedColumn) logRow.push('');
  logRow[lockedColumn - 1] = summary.deals.locked;
  logSheet.appendRow(logRow);
}

function formatSummary_(summary) {
  let message = [
    'ダッシュボードへの反映が完了しました。',
    '',
    '案件：新規 ' + summary.deals.created + '件 / 更新 ' + summary.deals.updated +
      '件 / ダッシュボード管理 ' + summary.deals.locked + '件 / エラー ' + summary.deals.error + '件',
    '商談：新規 ' + summary.meetings.created + '件 / 登録済み ' + summary.meetings.exists +
      '件 / スキップ ' + summary.meetings.skipped + '件 / エラー ' + summary.meetings.error + '件',
  ].join('\n');
  if (summary.errors.length > 0) {
    message += '\n\nエラー（先頭10件）\n' + summary.errors.slice(0, 10).join('\n');
  }
  return message;
}

function errorMessage_(error) {
  return error && error.message ? error.message : String(error);
}
