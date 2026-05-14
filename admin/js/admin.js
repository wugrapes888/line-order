// 後台主功能：團購列表、訂單查看

function loadDashboard() {
  callGAS({ action: 'listGroups', adminToken: getToken() })
    .then(function (res) {
      if (!res.ok) { logout(); return; }
      renderGroupList(res.groups);
    });
}

function renderGroupList(groups) {
  var el = document.getElementById('group-list');
  if (groups.length === 0) {
    el.innerHTML = '<p class="muted" style="padding:16px;">尚無團購，點擊「開新團」開始</p>';
    return;
  }
  el.innerHTML = groups.map(function (g) {
    var statusLabel = { draft: '草稿', active: '進行中', closed: '已結團' }[g.status] || g.status;
    var statusClass = { draft: 'tag-draft', active: 'tag-active', closed: 'tag-closed' }[g.status] || '';
    var isActive = g.status === 'active';
    var isClosed = g.status === 'closed';

    return '<div class="group-card">' +
      '<div class="group-header">' +
        '<span class="group-name">' + g.groupName + '</span>' +
        '<span class="tag ' + statusClass + '">' + statusLabel + '</span>' +
      '</div>' +
      '<p class="muted">team: ' + g.team + '</p>' +
      (g.deadlineAt ? '<p class="muted">截團：' + new Date(g.deadlineAt).toLocaleString('zh-TW') + '</p>' : '') +
      '<div class="group-actions">' +
        '<button onclick="viewOrders(\'' + g.groupId + '\')">訂單</button>' +
        '<button onclick="goTo(\'products.html?groupId=' + g.groupId + '\')">商品</button>' +
        '<button onclick="goTo(\'stats.html?groupId=' + g.groupId + '\')">統計</button>' +
        (isActive ? '<button class="btn-danger" onclick="closeGroup(\'' + g.groupId + '\', \'' + g.groupName + '\')">結團</button>' : '') +
        '<button onclick="copyGroupPrompt(\'' + g.groupId + '\', \'' + g.groupName + '\')">複製為模板</button>' +
        '<button onclick="copyLink(\'' + (g.shareUrl || '') + '\')">複製連結</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function viewOrders(groupId) {
  window.location.href = 'dashboard.html?groupId=' + groupId;
}

function closeGroup(groupId, groupName) {
  if (!confirm('確定結團「' + groupName + '」？結團後將無法接受新訂單。')) return;
  callGAS({ action: 'closeGroup', adminToken: getToken(), groupId: groupId })
    .then(function (res) {
      if (res.ok) {
        alert('結團完成！封存分頁：' + res.summarySheetName);
        loadDashboard();
      } else {
        alert('結團失敗：' + res.error);
      }
    });
}

function copyGroupPrompt(sourceGroupId, sourceName) {
  var newName = prompt('新團名稱（留空使用「' + sourceName + ' 複製」）', sourceName + ' 複製');
  if (newName === null) return; // 取消
  if (!newName.trim()) newName = sourceName + ' 複製';

  callGAS({ action: 'copyGroup', adminToken: getToken(), groupId: sourceGroupId, groupName: newName.trim() })
    .then(function (res) {
      if (res.ok) {
        alert('已複製為「' + newName + '」（草稿狀態）\n分享連結：' + res.shareUrl + '\n\n請到商品頁設定截團時間後再分享。');
        loadDashboard();
      } else {
        alert('複製失敗：' + res.error);
      }
    });
}

function copyLink(url) {
  if (!url) { alert('尚無分享連結'); return; }
  navigator.clipboard.writeText(url).then(function () { alert('連結已複製！'); });
}
