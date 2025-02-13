let isEnabled = false; // ツールの有効状態を示すフラグ（初期値は無効）
const manifestData = chrome.runtime.getManifest();
// Sampleツールの有効/無効を処理する関数
const handleSampleTool = (isEnabled) => {
  if (isEnabled) { // ツールが有効になったときの処理
    // console.log(`${manifestData.name} がONになりました`); 
  } else { // ツールが無効になったときの処理
    // console.log(`${manifestData.name} がOFFになりました`);
  }
};


// 最初の読み込みまたはリロード後に実行する処理
chrome.storage.local.get(['settings', 'isEnabled'], (data) => {
  isEnabled = data.isEnabled !== undefined ? data.isEnabled : isEnabled;
  handleSampleTool(isEnabled);
});

// 特定のキー（Ctrl + B）が押されたときに実行される処理（ショートカット用）
document.addEventListener('keydown', (e) => {
  if (e.key === 'b' && e.ctrlKey && !e.shiftKey && !e.altKey) {
    chrome.storage.local.get(['settings', 'isEnabled'], (data) => {
      isEnabled = !data.isEnabled;
      chrome.storage.local.set({ settings: data.settings, isEnabled: isEnabled });
      handleSampleTool(isEnabled);
    });
  }
});


// ストレージの値が変更されたときに実行される処理
chrome.storage.onChanged.addListener((changes) => {
  isEnabled = changes.isEnabled ? changes.isEnabled.newValue : isEnabled;
  handleSampleTool(isEnabled);
});
