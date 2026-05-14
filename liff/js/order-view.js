// 查看完整訂單邏輯（規格書 §14.2）

document.addEventListener('DOMContentLoaded', function () {
  var orderId = getUrlParam('orderId');
  var token   = getUrlParam('token');

  if (!orderId || !token) {
    showError('連結無效', '缺少必要參數');
    return;
  }

  initLiff(function () {
    callGAS({ action: 'getOrder', orderId: orderId, token: token })
      .then(function (res) {
        if (!res.ok) { showError('無法查看此訂單', res.error); return; }
        renderOrder(res.order, res.items);
        showScreen('order');
      })
      .catch(function () {
        showError('網路異常', '請重新整理後再試');
      });
  });
});

function renderOrder(order, items) {
  var el = document.getElementById('order-detail');
  var createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString('zh-TW') : '';
  el.innerHTML =
    '<p class="order-id">訂單編號：' + order.orderId + '</p>' +
    '<p>團購：' + order.groupName + '</p>' +
    '<p>姓名：' + order.customerName + '</p>' +
    '<p>電話：' + order.customerPhone + '</p>' +
    '<p>下單時間：' + createdAt + '</p>' +
    '<hr />' +
    items.map(function (i) {
      return '<p>' + i.productName + ' × ' + i.quantity + '　$' + i.subtotal + '</p>';
    }).join('') +
    '<hr />' +
    '<p class="total-line">合計：$' + order.totalAmount + '</p>' +
    '<p class="pickup-status">取貨狀態：' + (order.pickupStatus === 'picked_up' ? '已取貨' : '未取貨') + '</p>';
}

function showError(title, msg) {
  document.getElementById('error-title').textContent = title;
  document.getElementById('error-message').textContent = msg;
  showScreen('error');
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById('screen-' + name).classList.add('active');
}
