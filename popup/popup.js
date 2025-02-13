// 初期化処理
const panelButton = document.getElementById('panelButton');
const messagePanel = document.getElementById('messagePanel');
const messageDiv = document.getElementById('message'); // メッセージ表示用のdiv要素を取得
const manifestData = chrome.runtime.getManifest();
const fileName = document.getElementById('filename-from');
const filenameCheckbox = document.getElementById('filename-checkbox');
const fileTypeRadio = document.querySelectorAll('input[name="filetype-radio"]')
const filenameAddSize = document.getElementById('filename-add-size-checkbox');

let isSaveFilename = false;
let saveFilename = null;
let savefilenameAddSize = true;

chrome.storage.local.get(['settings'], (data) => {
  const settings = data.settings || {};
  // console.log("settings", settings);
  loading(settings);
  chrome.storage.local.set({ settings: settings });
});

function loading(settings) {
  const fileType = settings.fileType || 'png';
  isSaveFilename = settings.saveFilename || false;
  saveFilename = settings.fileName || null;
  savefilenameAddSize = settings.filenameAddSize;

  filenameCheckbox.checked = settings.saveFilename;
  filenameCheckbox.addEventListener('change', () => {
    settings.saveFilename = filenameCheckbox.checked;
    settings.fileName = document.getElementById('filename-from').value;
    chrome.storage.local.set({ settings: settings });
  });

  filenameAddSize.checked = savefilenameAddSize;
  filenameAddSize.addEventListener('change', () => {
    settings.filenameAddSize = filenameAddSize.checked;
    chrome.storage.local.set({ settings: settings });
  });

  fileTypeRadio.forEach((radio) => {
    if (radio.value === fileType) {
      radio.checked = true;
    }
    radio.addEventListener('change', () => {
      settings.fileType = radio.value;
      chrome.storage.local.set({ settings: settings });
    });
  });
}

// DOMの読み込み完了を監視し，完了後に実行
document.addEventListener('DOMContentLoaded', function () {
  const siteUrlFrom = document.getElementById('site-url-from');
  const siteUrlButton = document.getElementById('site-url-button');
  const faviconSizes = [16, 32, 64, 128];

  // ファビコンURLを更新する関数
  function updateFaviconUrls(siteUrl) {
    const faviconBaseUrl = `https://www.google.com/s2/favicons?domain=${siteUrl}&sz=`;

    faviconSizes.forEach(size => {
      const img = document.getElementById(`favicon-${size}`);
      const faviconUrl = `${faviconBaseUrl}${size}`;
      img.src = faviconUrl;
      img.parentElement.style.visibility = 'hidden';
      getImageMetadata(faviconUrl)
        .then(metadata => {
          if (!metadata) return;
          // サイズが一致しない場合は非表示にする
          if (size === metadata.width || size === metadata.height) {
            img.parentElement.style.visibility = 'visible';
          }
        });
    });
  }

  // 現在のタブのURLを取得して処理を行う
  function getActiveTabUrlAndProcess() {
    getActiveTabUrl(function (siteUrl) {
      if (siteUrl) {
        siteUrlFrom.value = siteUrl;
        const hostname = new URL(siteUrl).hostname;
        const filename_header = hostname.replace(/\./g, '_');
        if (isSaveFilename) {
          fileName.value = saveFilename;
        } else {
          fileName.value = filename_header;
        }
        updateFaviconUrls(siteUrl);
      }
    });
  }

  // イベントリスナー
  siteUrlButton.addEventListener('click', getActiveTabUrlAndProcess);
  siteUrlFrom.addEventListener('input', () => {
    const siteUrl = siteUrlFrom.value;
    const hostname = new URL(siteUrl).hostname;
    fileName.value = hostname.replace(/\./g, '_');
    if (siteUrl) {
      updateFaviconUrls(siteUrl);
    }
  });

  // 初回処理（タブURLが取得できた場合に実行）
  getActiveTabUrlAndProcess();



  // アイコンのダウンロード処理
  document.querySelectorAll("a[data-size]").forEach(link => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const size = link.getAttribute("data-size");
      const fileNameValue = document.getElementById('filename-from').value;
      const savefilenameAddSize = document.getElementById('filename-add-size-checkbox').checked;

      // チェックされたラジオボタンの値を取得
      const fileType = document.querySelector('input[name="filetype-radio"]:checked').value;
      const img = document.getElementById(`favicon-${size}`);
      const url = img.src;
      // console.log("url", url);

      if (!url) {
        return;
      }

      fetch(img.src, { mode: 'cors' }) // CORS対応
        .then(response => response.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = savefilenameAddSize ? `${fileNameValue}_${size}x${size}.${fileType}` : `${fileNameValue}.${fileType}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url); // メモリ解放
        })
        .catch(error => console.log("アイコンのダウンロードに失敗しました"));
    });
  });



  const title = document.getElementById('title');
  title.textContent = `Easy Favicon Downloader`;
  const titleHeader = document.getElementById('title-header');
  titleHeader.textContent = `Easy Favicon Downloader`;

  // メッセージパネルの表示・非表示を切り替える
  panelButton.addEventListener('click', function () {
    // メッセージパネルの高さを指定（必要に応じて調整可能）
    const panelHeight = '170px';

    if (messagePanel.style.height === panelHeight) {
      // パネルが開いている場合は閉じる
      messagePanel.style.height = '0';
      panelButton.textContent = 'メッセージパネルを開く';
    } else {
      // パネルが閉じている場合は開く
      messagePanel.style.height = panelHeight;
      panelButton.textContent = 'メッセージパネルを閉じる';
    }
  });

  // 情報タブ: 
  // ストアリンクのクリックイベントを設定
  const extensionLink = document.getElementById('extension_link');
  extensionLink.href = `chrome://extensions/?id=${chrome.runtime.id}`;
  if (extensionLink) clickURL(extensionLink);
  const issueLink = document.getElementById('issue-link');
  if (issueLink) clickURL(issueLink);
  const storeLink = document.getElementById('store_link');
  if (storeLink) clickURL(storeLink);
  // manifest.jsonから拡張機能の情報を取得
  // 各情報をHTML要素に反映
  document.getElementById('extension-id').textContent = `${chrome.runtime.id}`;
  document.getElementById('extension-name').textContent = `${manifestData.name}`;
  document.getElementById('extension-version').textContent = `${manifestData.version}`;
  document.getElementById('extension-description').textContent = `${manifestData.description}`;
  chrome.permissions.getAll((result) => {
    let siteAccess;
    if (result.origins.length > 0) {
      if (result.origins.includes("<all_urls>")) {
        siteAccess = "すべてのサイト";
      } else {
        siteAccess = result.origins.join("<br>");
      }
    } else {
      siteAccess = "クリックされた場合のみ";
    }
    document.getElementById('site-access').innerHTML = siteAccess;
  });
  // シークレットモードでのアクセス権を確認し，結果を表示
  chrome.extension.isAllowedIncognitoAccess((isAllowedAccess) => {
    document.getElementById('incognito-enabled').textContent = `${isAllowedAccess ? '有効' : '無効'}`;
  });
  // GitHubリンクのクリックイベントを設定
  const githubLink = document.getElementById('github-link');
  if (githubLink) clickURL(githubLink);

});

function clickURL(link) {
  const url = link.href ? link.href : link;
  if (link instanceof HTMLElement) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      chrome.tabs.create({ url });
    });
  }
}
function messageOutput(datetime, message) {
  messageDiv.innerHTML += '<p class="m-0">' + datetime + ' ' + message + '</p>';
}
document.getElementById('messageClearButton').addEventListener('click', () => {
  messageDiv.innerHTML = '<p class="m-0">' + '' + '</p>';
});


// 現在の時間を取得する
function dateTime() {
  const now = new Date();
  const year = now.getFullYear();                                    // 年
  const month = String(now.getMonth() + 1).padStart(2, '0');         // 月（0始まりのため+1）
  const day = String(now.getDate()).padStart(2, '0');                // 日
  const hours = String(now.getHours()).padStart(2, '0');             // 時
  const minutes = String(now.getMinutes()).padStart(2, '0');         // 分

  // フォーマットした日時を文字列で返す
  const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`;
  return formattedDateTime;
}


function getActiveTabUrl(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length === 0) return;
    const url = tabs[0].url;
    const baseUrl = new URL(url).origin
    callback(baseUrl);
  });
}

function getImageMetadata(imageUrl) {
  return fetch(imageUrl)
    .then(response => {
      if (!response.ok) {
        console.log('画像の取得に失敗しました');
      }
      // 画像のバイナリデータを取得
      return response.arrayBuffer();
    })
    .then(data => {
      const blob = new Blob([data]);
      const img = new Image();
      const objectURL = URL.createObjectURL(blob);
      img.src = objectURL;

      return new Promise((resolve, reject) => {
        img.onload = function () {
          // 画像の組み込みサイズ（元のファイルサイズ）
          const width = img.width;
          const height = img.height;
          resolve({ width, height });
        };

        img.onerror = function () {
          // reject(new Error('画像の読み込みに失敗しました'));
        };
      });
    })
    .catch(error => {
      // console.error(error);
    })
    ;
}