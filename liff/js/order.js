// 下單頁主邏輯（規格書 §13）

var orderState = {
  team:     '',
  ref:      '',
  group:    null,
  products: [],
  cart:     {},   // productId -> { product, quantity, selectedOptions }
  submitting: false
};

document.addEventListener('DOMContentLoaded', function () {
  orderState.team = getUrlParam('team') || '';
  orderState.ref  = getUrlParam('ref')  || '';

  // 優先從 localStorage 還原上次訂單摘要
  renderCachedOrder();

  initLiff(function () {
    if (!orderState.team) {
      showError('找不到此團購', '連結缺少 team 參數，請確認連結是否正確');
      return;
    }
    loadGroupConfig();
  });

  document.getElementById('btn-submit').addEventListener('click', submitOrder);
  document.getElementById('input-name').addEventListener('input', validateForm);
  document.getElementById('input-phone').addEventListener('input', validateForm);
});

function loadGroupConfig() {
  callGAS({ action: 'getGroupConfig', team: orderState.team })
    .then(function (res) {
      if (!res.ok) { showError('無法開啟下單頁', res.error); return; }
      orderState.group    = res.group;
      orderState.products = res.products;
      renderOrderPage();
      showScreen('order');
    })
    .catch(function () {
      showError('網路異常', '請重新整理後再試');
    });
}

function renderOrderPage() {
  document.getElementById('group-name').textContent = orderState.group.groupName;
  if (orderState.group.deadlineAt) {
    var d = new Date(orderState.group.deadlineAt);
    document.getElementById('deadline-info').textContent =
      '截團時間：' + d.toLocaleString('zh-TW');
  }
  renderProductList();
}

function renderProductList() {
  var el = document.getElementById('product-list');
  el.innerHTML = '';
  orderState.products.forEach(function (p) {
    var card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = p.productId;

    var optionsHtml = '';
    if (p.options && p.options.options) {
      optionsHtml = p.options.options.map(function (opt) {
        var inputType = opt.multiple ? 'checkbox' : 'radio';
        var choices = opt.choices.map(function (c) {
          return '<label class="choice-label">' +
                 '<input type="' + inputType + '" name="' + p.productId + '_' + opt.name + '" value="' + c + '"' +
                 ' onchange="validateForm()"> ' + c + '</label>';
        }).join('');
        return '<div class="option-group" data-option="' + opt.name + '" data-required="' + (opt.required ? 'true' : 'false') + '" data-multiple="' + (opt.multiple ? 'true' : 'false') + '">' +
               '<span class="option-label">' + opt.name + (opt.required ? ' <span class="required">*</span>' : '') + '</span>' +
               '<div class="choices">' + choices + '</div></div>';
      }).join('');
    }

    var imgHtml = '';
    if (p.imageUrl) {
      imgHtml = '<img class="product-img" src="' + p.imageUrl + '" alt="' + p.productName + '" onerror="this.style.display=\'none\'">';
    }

    card.innerHTML =
      imgHtml +
      '<div class="product-body">' +
        '<div class="product-info">' +
          '<span class="product-name">' + p.productName + (p.badge ? ' <span class="badge">' + p.badge + '</span>' : '') + '</span>' +
          '<span class="product-price">$' + p.price + '</span>' +
        '</div>' +
        (p.description ? '<p class="product-desc">' + p.description + '</p>' : '') +
        optionsHtml +
        '<div class="qty-row">' +
          '<button class="qty-btn" onclick="changeItemQty(\'' + p.productId + '\',-1)">−</button>' +
          '<span class="qty-val" id="qty-' + p.productId + '">0</span>' +
          '<button class="qty-btn" onclick="changeItemQty(\'' + p.productId + '\',1)">+</button>' +
        '</div>' +
      '</div>';

    el.appendChild(card);
  });
}

function changeItemQty(productId, delta) {
  var current = orderState.cart[productId] ? orderState.cart[productId].quantity : 0;
  var next = Math.max(0, current + delta);
  if (next === 0) {
    delete orderState.cart[productId];
  } else {
    var product = orderState.products.find(function (p) { return p.productId === productId; });
    orderState.cart[productId] = orderState.cart[productId] || { product: product, selectedOptions: {}, quantity: 0 };
    orderState.cart[productId].quantity = next;
  }
  document.getElementById('qty-' + productId).textContent = next;
  updateTotal();
  validateForm();
}

function updateTotal() {
  var total = Object.values(orderState.cart).reduce(function (s, item) {
    return s + item.product.price * item.quantity;
  }, 0);
  document.getElementById('order-total').textContent = '$' + total;
  return total;
}

function validateForm() {
  var name  = document.getElementById('input-name').value.trim();
  var phone = document.getElementById('input-phone').value.trim();
  var hasItems = Object.keys(orderState.cart).length > 0;
  var btn = document.getElementById('btn-submit');

  var requiredOptionsMissing = false;
  if (hasItems) {
    Object.keys(orderState.cart).forEach(function (pid) {
      var card = document.querySelector('[data-product-id="' + pid + '"]');
      if (!card) return;
      card.querySelectorAll('.option-group[data-required="true"]').forEach(function (group) {
        var isMultiple = group.dataset.multiple === 'true';
        if (isMultiple) {
          var checked = group.querySelectorAll('input[type="checkbox"]:checked');
          if (checked.length === 0) requiredOptionsMissing = true;
        } else {
          var checked = group.querySelector('input[type="radio"]:checked');
          if (!checked) requiredOptionsMissing = true;
        }
      });
    });
  }

  btn.disabled = !name || !phone || !hasItems || requiredOptionsMissing || orderState.submitting;
}

function submitOrder() {
  if (orderState.submitting) return;
  orderState.submitting = true;

  var btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = '訂單送出中...';

  var clientOrderId = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  var items = Object.keys(orderState.cart).map(function (pid) {
    var entry = orderState.cart[pid];
    return {
      productId:       pid,
      quantity:        entry.quantity,
      selectedOptions: collectOptions(pid)
    };
  });

  var payload = {
    action:        'submitGroupOrder',
    clientOrderId: clientOrderId,
    team:          orderState.team,
    ref:           orderState.ref,
    customer: {
      name:  document.getElementById('input-name').value.trim(),
      phone: document.getElementById('input-phone').value.trim(),
      note:  document.getElementById('input-note').value.trim()
    },
    items: items
  };

  callGAS(payload)
    .then(function (res) {
      if (res.ok) {
        localStorage.setItem('lastOrder', JSON.stringify(Object.assign({}, res.summary, {
          viewUrl: res.viewUrl,
          team: orderState.team,
          savedAt: Date.now()
        })));
        showSuccessPage(res);
      } else {
        alert('送出失敗：' + res.error);
        orderState.submitting = false;
        btn.disabled = false;
        btn.textContent = '送出訂單';
      }
    })
    .catch(function () {
      alert('網路異常，請重試');
      orderState.submitting = false;
      btn.disabled = false;
      btn.textContent = '重試送出';
    });
}

function collectOptions(productId) {
  var card = document.querySelector('[data-product-id="' + productId + '"]');
  var options = {};
  if (!card) return options;
  card.querySelectorAll('.option-group').forEach(function (group) {
    var optName    = group.dataset.option;
    var isMultiple = group.dataset.multiple === 'true';
    if (isMultiple) {
      var checked = Array.from(group.querySelectorAll('input[type="checkbox"]:checked')).map(function (el) { return el.value; });
      if (checked.length > 0) options[optName] = checked;
    } else {
      var checked = group.querySelector('input[type="radio"]:checked');
      if (checked) options[optName] = checked.value;
    }
  });
  return options;
}

function showSuccessPage(res) {
  var summaryEl = document.getElementById('success-summary');
  var s = res.summary;
  summaryEl.innerHTML =
    '<p><strong>' + s.groupName + '</strong></p>' +
    '<p>姓名：' + s.customerName + '</p>' +
    '<p>訂單編號：' + res.orderId + '</p>' +
    s.items.map(function (i) {
      return '<p>' + i.productName + ' × ' + i.quantity + '　$' + i.subtotal + '</p>';
    }).join('') +
    '<p class="total-line">合計：$' + s.totalAmount + '</p>';

  document.getElementById('btn-view-order').href = res.viewUrl;
  showScreen('success');
}

function renderCachedOrder() {
  var raw = localStorage.getItem('lastOrder');
  if (!raw) return;
  try {
    var s = JSON.parse(raw);
    var isRecent = s.savedAt && (Date.now() - s.savedAt < 30 * 60 * 1000);
    var isSameTeam = s.team === orderState.team;
    if (!isRecent || !isSameTeam) {
      localStorage.removeItem('lastOrder');
      return;
    }
    var summaryEl = document.getElementById('success-summary');
    if (!summaryEl) return;
    summaryEl.innerHTML =
      '<p><strong>' + (s.groupName || '') + '</strong></p>' +
      '<p>姓名：' + (s.customerName || '') + '</p>' +
      (s.items || []).map(function (i) {
        return '<p>' + i.productName + ' × ' + i.quantity + '　$' + i.subtotal + '</p>';
      }).join('') +
      '<p class="total-line">合計：$' + (s.totalAmount || 0) + '</p>';
    if (s.viewUrl) {
      var viewBtn = document.getElementById('btn-view-order');
      if (viewBtn) viewBtn.href = s.viewUrl;
    }
    showScreen('success');
  } catch (e) {
    localStorage.removeItem('lastOrder');
  }
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
