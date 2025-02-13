// 初期化
let context = 'all'; // コンテキストの初期値を設定（全体を対象）
let title = chrome.runtime.getManifest().name; // 拡張機能の名前をmanifest.jsonから取得
let isEnabled = false; // ツールの有効状態を示すフラグ（初期値はfalse）


// 拡張機能がインストールされたときに実行される処理
chrome.runtime.onInstalled.addListener(() => {
  // 現在の有効状態をストレージに保存
  chrome.storage.local.set({ isEnabled: isEnabled });

  // コンテキストメニューを作成
  chrome.contextMenus.create({
    title: `${title}${isEnabled ? '無効にする' : '有効にする'}`, // 有効/無効に応じたタイトルを設定
    contexts: [context], // コンテキストメニューを表示するコンテキスト
    id: "Sample" // メニュー項目のID
  });
});



// ストレージの値が変更されたときに実行される処理
chrome.storage.onChanged.addListener((changes) => {
  // 'isEnabled'の変更があった場合
  if (changes.isEnabled) {
    // 新しい値を取得し、未設定の場合は既存の'isEnabled'を保持
    isEnabled = changes.isEnabled.newValue;
  }
  updateContextMenu(); // コンテキストメニューを更新
});


// コンテキストメニューの項目がクリックされたときに実行される処理
chrome.contextMenus.onClicked.addListener((info) => {
  // クリックされたメニュー項目が"Sample"である場合
  if (info.menuItemId === "Sample") {
    // 有効状態を反転
    isEnabled = !isEnabled;

    // 現在の状態をログに出力（デバッグ用）
    // console.log(`現在の状態: ${isEnabled ? 'ON' : 'OFF'}`);

    // 新しい有効状態をストレージに保存
    chrome.storage.local.set({ isEnabled: isEnabled });

    updateContextMenu(); // コンテキストメニューを更新
  }
});


// メッセージを受信したときに実行される処理
chrome.runtime.onMessage.addListener((msg) => {
  // メッセージにkeyEnabledが含まれている場合
  if (msg.keyEnabled) {
    // 有効状態を反転
    isEnabled = !isEnabled;

    // 現在の状態をログに出力（デバッグ用）
    // console.log(`現在の状態: ${isEnabled ? 'ON' : 'OFF'}`);

    // 新しい有効状態をストレージに保存
    chrome.storage.local.set({ isEnabled: isEnabled });

    updateContextMenu(); // コンテキストメニューを更新
  }
});


// タブが更新されたときに実行される処理
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // タブの読み込みが完了したとき
  if (changeInfo.status === 'complete') {
    // ストレージから'isEnabled'の値を取得
    chrome.storage.local.get('isEnabled', (data) => {
      // 取得した値を使用し、未設定の場合は既存の'isEnabled'を保持
      isEnabled = data.isEnabled !== undefined ? data.isEnabled : isEnabled;

      // ページがリロードされたことをログに出力（デバッグ用）
      // console.log("ページがリロードされました。", `現在の状態: ${isEnabled ? 'ON' : 'OFF'}`);

      updateContextMenu(); // コンテキストメニューを更新
    });
  }
});


// コンテキストメニューを更新する関数
function updateContextMenu() {
  // 既存の"Sample"メニュー項目を削除
  chrome.contextMenus.remove("Sample", () => {
    // 削除が成功した場合に新しいメニュー項目を作成
    if (!chrome.runtime.lastError) {
      chrome.contextMenus.create({
        title: `${title}${isEnabled ? '無効にする' : '有効にする'}`, // 有効/無効に応じたタイトルを設定
        contexts: [context], // メニューを表示するコンテキスト
        id: "Sample" // メニュー項目のID
      });
    }
  });
}

