// 團購主檔 & 商品設定操作
// 工作表：團購主檔、團購商品設定

var GroupService = (function () {

  var GROUPS_SHEET    = '團購主檔';
  var PRODUCTS_SHEET  = '團購商品設定';

  // 取得單一團購設定（供下單頁使用）
  function getGroupConfig(team) {
    var cacheKey = 'groupConfig_' + team;
    var cache = CacheService.getScriptCache();
    var cached = cache.get(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      // 截止時間需即時判斷，不能用快取結果直接回傳錯誤
      var deadline = parsed.group && parsed.group.deadlineAt ? new Date(parsed.group.deadlineAt) : null;
      if (deadline && deadline < new Date()) return { ok: false, error: '此團已截止' };
      return parsed;
    }

    var ss = getSpreadsheet();
    var groupsData = ss.getSheetByName(GROUPS_SHEET).getDataRange().getValues();

    var group = null;
    for (var i = 1; i < groupsData.length; i++) {
      if (String(groupsData[i][1]) === String(team)) {
        group = {
          groupId:    groupsData[i][0],
          team:       groupsData[i][1],
          groupName:  groupsData[i][2],
          status:     groupsData[i][3],
          deadlineAt: groupsData[i][4] ? groupsData[i][4].toISOString() : null,
          shareUrl:   groupsData[i][7]
        };
        break;
      }
    }

    if (!group) return { ok: false, error: '找不到此團購，請確認連結' };
    if (group.status === 'closed') return { ok: false, error: '此團已結團' };
    if (group.status === 'draft')  return { ok: false, error: '此團尚未開放下單' };

    var deadline = group.deadlineAt ? new Date(group.deadlineAt) : null;
    if (deadline && deadline < new Date()) return { ok: false, error: '此團已截止' };

    var products = getProductsByGroup(group.groupId);
    var result = { ok: true, group: group, products: products };
    cache.put(cacheKey, JSON.stringify(result), 60); // 快取 60 秒
    return result;
  }

  function getProductsByGroupAll(groupId) {
    var data = getSheet(PRODUCTS_SHEET).getDataRange().getValues();
    var results = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === groupId) {
        var optionsJson = data[i][5];
        var options = {};
        try { options = JSON.parse(optionsJson); } catch (e) { options = {}; }
        results.push({
          productId:   data[i][0],
          productName: data[i][2],
          price:       Number(data[i][3]),
          description: data[i][4],
          options:     options,
          isActive:    data[i][6] === true || data[i][6] === 'TRUE',
          badge:       data[i][8] || '',
          imageUrl:    data[i][9] || ''
        });
      }
    }
    return results;
  }

  function getProductsByGroup(groupId) {
    var data = getSheet(PRODUCTS_SHEET).getDataRange().getValues();
    var results = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][1] === groupId && (data[i][6] === true || data[i][6] === 'TRUE')) {
        var optionsJson = data[i][5];
        var options = {};
        try { options = JSON.parse(optionsJson); } catch (e) { options = {}; }
        results.push({
          productId:   data[i][0],
          productName: data[i][2],
          price:       Number(data[i][3]),
          description: data[i][4],
          options:     options,
          sortOrder:   data[i][7] || 999,
          badge:       data[i][8] || '',
          imageUrl:    data[i][9] || ''
        });
      }
    }
    return results.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  // 建立新團購
  function createGroup(payload) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(GROUPS_SHEET);
    var now = new Date();
    var groupId = 'grp_' + Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMdd') + '_' +
                  Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    var team = String(payload.team || toTeamCode(payload.groupName));

    var liffId = getLiffId();
    var shareUrl = 'https://liff.line.me/' + liffId + '?team=' + team;

    sheet.appendRow([
      groupId,
      team,
      payload.groupName,
      'active',
      payload.deadlineAt ? new Date(payload.deadlineAt) : '',
      now,
      '',
      shareUrl,
      '',
      payload.note || ''
    ]);

    if (payload.products && payload.products.length > 0) {
      payload.products.forEach(function (p) { addProduct(groupId, p); });
    }

    return { ok: true, groupId: groupId, team: team, shareUrl: shareUrl };
  }

  // 結團
  function closeGroup(groupId) {
    var sheet = getSheet(GROUPS_SHEET);
    var data = sheet.getDataRange().getValues();
    var now = new Date();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === groupId) {
        var row = i + 1;
        sheet.getRange(row, 4).setValue('closed');
        sheet.getRange(row, 7).setValue(now);

        var groupName = data[i][2];
        var summarySheet = createSummarySheet(groupId, groupName, now);

        return { ok: true, status: 'closed', summarySheetName: summarySheet };
      }
    }
    return { ok: false, error: '找不到此團購' };
  }

  // 列出所有團購（後台用）
  function listGroups() {
    var data = getSheet(GROUPS_SHEET).getDataRange().getValues();
    var groups = [];
    for (var i = 1; i < data.length; i++) {
      groups.push({
        groupId:   data[i][0],
        team:      data[i][1],
        groupName: data[i][2],
        status:    data[i][3],
        deadlineAt: data[i][4] ? data[i][4].toISOString() : null,
        shareUrl:  data[i][7]
      });
    }
    return { ok: true, groups: groups };
  }

  // 列出某團商品（後台用）
  function listProducts(groupId) {
    var data = getSheet(PRODUCTS_SHEET).getDataRange().getValues();
    var products = [];
    for (var i = 1; i < data.length; i++) {
      if (!groupId || data[i][1] === groupId) {
        var optionsJson = data[i][5];
        var options = {};
        try { options = JSON.parse(optionsJson); } catch (e) { options = {}; }
        products.push({
          productId:   data[i][0],
          groupId:     data[i][1],
          productName: data[i][2],
          price:       Number(data[i][3]),
          description: data[i][4],
          options:     options,
          isActive:    data[i][6] === true || data[i][6] === 'TRUE',
          sortOrder:   data[i][7] || 0,
          badge:       data[i][8] || '',
          imageUrl:    data[i][9] || '',
          rowIndex:    i + 1
        });
      }
    }
    return { ok: true, products: products };
  }

  // 新增或更新商品（productId 有值則更新，否則新增）
  function saveProduct(payload) {
    var sheet = getSheet(PRODUCTS_SHEET);
    var optionsStr = payload.options ? JSON.stringify(payload.options) : '';

    if (payload.productId) {
      // 更新現有商品
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === payload.productId) {
          var row = i + 1;
          sheet.getRange(row, 3).setValue(payload.productName);
          sheet.getRange(row, 4).setValue(payload.price);
          sheet.getRange(row, 5).setValue(payload.description || '');
          sheet.getRange(row, 6).setValue(optionsStr);
          sheet.getRange(row, 7).setValue(payload.isActive !== false);
          sheet.getRange(row, 9).setValue(payload.badge || '');
          sheet.getRange(row, 10).setValue(payload.imageUrl || '');
          return { ok: true, productId: payload.productId };
        }
      }
      return { ok: false, error: '找不到此商品' };
    } else {
      // 新增商品
      addProduct(payload.groupId, {
        productName: payload.productName,
        price: payload.price,
        description: payload.description || '',
        optionsJson: payload.options || {},
        isActive: payload.isActive !== false,
        badge: payload.badge || ''
      });
      return { ok: true };
    }
  }

  // 切換上下架狀態
  function toggleProduct(productId, isActive) {
    var sheet = getSheet(PRODUCTS_SHEET);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === productId) {
        sheet.getRange(i + 1, 7).setValue(isActive);
        return { ok: true, productId: productId, isActive: isActive };
      }
    }
    return { ok: false, error: '找不到此商品' };
  }

  // 刪除商品
  function deleteProduct(productId) {
    var sheet = getSheet(PRODUCTS_SHEET);
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === productId) {
        sheet.deleteRow(i + 1);
        return { ok: true };
      }
    }
    return { ok: false, error: '找不到此商品' };
  }

  // 複製團購為新團（模板功能）
  function copyGroup(sourceGroupId, newGroupName, newDeadlineAt) {
    var sourceProducts = getProductsByGroupAll(sourceGroupId);
    var now = new Date();
    var groupId = 'grp_' + Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMdd') + '_' +
                  Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    var team = toTeamCode(newGroupName);
    var liffId = getLiffId();
    var shareUrl = 'https://liff.line.me/' + liffId + '?team=' + team;

    var groupSheet = getSheet(GROUPS_SHEET);
    groupSheet.appendRow([
      groupId, team, newGroupName, 'draft',
      newDeadlineAt ? new Date(newDeadlineAt) : '',
      now, '', shareUrl, '', ''
    ]);

    sourceProducts.forEach(function (p) {
      addProduct(groupId, {
        productName: p.productName,
        price: p.price,
        description: p.description,
        optionsJson: p.options || {},
        isActive: p.isActive,
        badge: p.badge,
        imageUrl: p.imageUrl || ''
      });
    });

    return { ok: true, groupId: groupId, team: team, shareUrl: shareUrl };
  }

  // 取得團購統計（商品統計、來源統計）
  function getGroupStats(groupId) {
    var ordersData = getSheet('團購訂單主檔').getDataRange().getValues();
    var itemsData  = getSheet('團購訂單明細').getDataRange().getValues();

    var activeOrderIds = {};
    var refStats = {};
    var totalAmount = 0;
    var totalOrders = 0;

    for (var i = 1; i < ordersData.length; i++) {
      if (ordersData[i][2] === groupId && ordersData[i][9] !== 'cancelled') {
        activeOrderIds[ordersData[i][0]] = true;
        var ref = ordersData[i][7] || '直接下單';
        refStats[ref] = (refStats[ref] || 0) + 1;
        totalAmount += Number(ordersData[i][8]) || 0;
        totalOrders++;
      }
    }

    var productStats = {};
    for (var j = 1; j < itemsData.length; j++) {
      if (activeOrderIds[itemsData[j][1]]) {
        var key = itemsData[j][4];
        var qty = Number(itemsData[j][6]) || 0;
        productStats[key] = (productStats[key] || 0) + qty;
      }
    }

    return {
      ok: true,
      totalOrders: totalOrders,
      totalAmount: totalAmount,
      productStats: productStats,
      refStats: refStats
    };
  }

  // ===== 內部輔助 =====

  function addProduct(groupId, p) {
    var sheet = getSheet(PRODUCTS_SHEET);
    var now = new Date();
    var productId = 'prd_' + Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMddHHmmss') + '_' +
                    Math.floor(Math.random() * 100);
    var count = sheet.getLastRow();
    sheet.appendRow([
      productId,
      groupId,
      p.productName,
      p.price,
      p.description || '',
      p.optionsJson ? JSON.stringify(p.optionsJson) : '',
      p.isActive !== false,
      count,
      p.badge || '',
      p.imageUrl || ''
    ]);
  }

  function toTeamCode(name) {
    var code = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').substring(0, 20);
    if (!code) code = 't' + Date.now().toString(36).slice(-6);
    return code;
  }

  function getLiffId() {
    var settingsData = getSheet('系統設定').getDataRange().getValues();
    for (var i = 0; i < settingsData.length; i++) {
      if (settingsData[i][0] === 'liffId') return settingsData[i][1];
    }
    return '<<LIFF_ID>>';
  }

  // 建立結團封存分頁（規格書 §16.2）
  function createSummarySheet(groupId, groupName, closedAt) {
    var ss = getSpreadsheet();
    var dateStr = Utilities.formatDate(closedAt, 'Asia/Taipei', 'MMdd');
    var baseName = groupName + ' ' + dateStr;
    var sheetName = baseName;
    var suffix = 2;
    while (ss.getSheetByName(sheetName)) {
      sheetName = baseName + '-' + suffix;
      suffix++;
    }

    var newSheet = ss.insertSheet(sheetName);
    var orders = getSheet('團購訂單主檔').getDataRange().getValues();
    var items  = getSheet('團購訂單明細').getDataRange().getValues();

    newSheet.appendRow(['結團封存：' + groupName]);
    newSheet.appendRow(['結團時間', Utilities.formatDate(closedAt, 'Asia/Taipei', 'yyyy-MM-dd HH:mm')]);
    newSheet.appendRow(['groupId', groupId]);
    newSheet.appendRow([]);
    newSheet.appendRow(['訂單ID', '客人姓名', '電話', '來源', '總金額', '取貨狀態']);

    orders.forEach(function (r, idx) {
      if (idx === 0) return;
      if (r[2] === groupId && r[9] !== 'cancelled') {
        newSheet.appendRow([r[0], r[5], r[6], r[7], r[8], r[10]]);
      }
    });

    // 封存時寫入各訂單的 closedAt
    var ordersSheet = getSheet('團購訂單主檔');
    var ordersData = ordersSheet.getDataRange().getValues();
    for (var i = 1; i < ordersData.length; i++) {
      if (ordersData[i][2] === groupId) {
        ordersSheet.getRange(i + 1, 14).setValue(closedAt);
      }
    }

    return sheetName;
  }

  return {
    getGroupConfig: getGroupConfig,
    createGroup:    createGroup,
    closeGroup:     closeGroup,
    listGroups:     listGroups,
    listProducts:   listProducts,
    saveProduct:    saveProduct,
    toggleProduct:  toggleProduct,
    deleteProduct:  deleteProduct,
    copyGroup:      copyGroup,
    getGroupStats:  getGroupStats
  };

})();
