// LIFF SDK 初始化
// 文件：https://developers.line.biz/en/docs/liff/

function initLiff(onReady) {
  liff.init({ liffId: CONFIG.LIFF_ID })
    .then(function () {
      onReady();
    })
    .catch(function (err) {
      console.error('LIFF init failed:', err);
      // 非 LINE 環境仍可繼續（開發測試用）
      onReady();
    });
}

function callGAS(payload) {
  return fetch(CONFIG.GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  }).then(function (res) {
    return res.json();
  });
}

function getUrlParam(key) {
  var params = new URLSearchParams(window.location.search);
  return params.get(key);
}
