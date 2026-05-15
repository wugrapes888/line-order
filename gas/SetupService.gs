// 初始化 Google Sheets 結構（首次部署時執行一次）
// 在 GAS 編輯器中手動執行 initSheets()

// 遷移：在「團購商品設定」第 J 欄加上 imageUrl 標題（舊試算表執行一次即可）
function migrateAddImageUrl() {
  var sheet = getSpreadsheet().getSheetByName('團購商品設定');
  if (!sheet) { Logger.log('找不到「團購商品設定」工作表'); return; }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf('imageUrl') !== -1) {
    Logger.log('imageUrl 欄位已存在，略過');
    return;
  }

  var col = headers.length + 1; // 接在最後一欄後面
  sheet.getRange(1, col).setValue('imageUrl').setFontWeight('bold');
  Logger.log('已在第 ' + col + ' 欄新增 imageUrl 標題');
}

function initSheets() {
  var ss = getSpreadsheet();

  var sheets = [
    {
      name: '團購主檔',
      headers: ['groupId', 'team', 'groupName', 'status', 'deadlineAt', 'createdAt', 'closedAt', 'shareUrl', 'summarySheetName', 'note']
    },
    {
      name: '團購商品設定',
      headers: ['productId', 'groupId', 'productName', 'price', 'description', 'optionsJson', 'isActive', 'sortOrder', 'badge', 'imageUrl']
    },
    {
      name: '團購訂單主檔',
      headers: ['orderId', 'clientOrderId', 'groupId', 'team', 'groupName', 'customerName', 'customerPhone', 'sourceRef', 'totalAmount', 'orderStatus', 'pickupStatus', 'note', 'createdAt', 'closedAt', 'viewToken']
    },
    {
      name: '團購訂單明細',
      headers: ['lineItemId', 'orderId', 'groupId', 'productId', 'productName', 'selectedOptions', 'quantity', 'unitPrice', 'subtotal', 'createdAt']
    },
    {
      name: 'POS發貨清單',
      headers: ['createdAt', 'orderId', 'customerName', 'customerPhone', 'productSummary', 'quantitySummary', 'totalAmount', 'pickupStatus', 'groupName', 'sourceRef']
    },
    {
      name: '系統設定',
      headers: ['key', 'value']
    }
  ];

  sheets.forEach(function (def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      Logger.log('建立工作表：' + def.name);
    } else {
      Logger.log('已存在，略過：' + def.name);
      return;
    }
    sheet.appendRow(def.headers);
    // 標題列加粗凍結
    sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });

  // 系統設定預設值（若尚未存在）
  var settingsSheet = ss.getSheetByName('系統設定');
  var settingsData  = settingsSheet.getDataRange().getValues();
  var existingKeys  = settingsData.map(function (r) { return r[0]; });

  var defaults = [
    ['liffId', '<<填入 LINE LIFF ID>>'],
    ['notifyEmail', Session.getActiveUser().getEmail()]
  ];

  defaults.forEach(function (pair) {
    if (existingKeys.indexOf(pair[0]) === -1) {
      settingsSheet.appendRow(pair);
    }
  });

  Logger.log('initSheets 完成');
}
