// 初期化処理
const messageDiv = document.getElementById('message'); // メッセージ表示用のdiv要素を取得
const manifestData = chrome.runtime.getManifest();
const fileName = document.getElementById('filename-from');
const filenameCheckbox = document.getElementById('filename-checkbox');
const fileTypeRadio = document.querySelectorAll('input[name="filetype-radio"]')
const filenameAddSize = document.getElementById('filename-add-size-checkbox');
const icoSizeInfo = document.getElementById('ico-size-info');
const faviconSizes = [16, 32, 48, 64, 96, 128];

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
    messageOutput(dateTime(), `ファイル名: ${settings.fileName}${settings.saveFilename ? '（記憶する）' : ''}に変更`);
    chrome.storage.local.set({ settings: settings });
  });

  filenameAddSize.checked = savefilenameAddSize;
  filenameAddSize.addEventListener('change', () => {
    settings.filenameAddSize = filenameAddSize.checked;
    messageOutput(dateTime(), `ファイル名の末尾にサイズを${settings.filenameAddSize ? "付ける" : "付けない"} に変更`);
    chrome.storage.local.set({ settings: settings });
  });

  fileTypeRadio.forEach((radio) => {
    if (radio.value === fileType) {
      radio.checked = true;
    }
    radio.addEventListener('change', () => {
      settings.fileType = radio.value;
      messageOutput(dateTime(), `ファイル形式: ${radio.value} に変更 `);
      chrome.storage.local.set({ settings: settings });

      icoSizeInfo.style.display = radio.value === 'ico' ? 'block' : 'none';
    });
  });
}

// DOMの読み込み完了を監視し，完了後に実行
document.addEventListener('DOMContentLoaded', function () {
  const siteUrlFrom = document.getElementById('site-url-from');
  const siteUrlButton = document.getElementById('site-url-button');
  function updateFaviconUrls(siteUrl) {
    const faviconBaseUrl = `https://www.google.com/s2/favicons?domain=${siteUrl}&sz=`;

    faviconSizes.forEach((size, index) => {
      const img = document.getElementById(`favicon-${size}`);
      const faviconUrl = `${faviconBaseUrl}${size}`;
      img.src = faviconUrl;
      img.parentElement.style.visibility = 'hidden';
      getImageMetadata(faviconUrl, index)
        .then(metadata => {
          if (!metadata) return;
          // サイズが一致しない場合は非表示にする
          if (size === metadata.width || size === metadata.height) {
            img.parentElement.style.visibility = 'visible';
          }
        });
    });
  }

  function getActiveTabUrlAndProcess() {
    getActiveTabUrl(function (siteUrl) {
      if (siteUrl) {
        siteUrlFrom.value = siteUrl;
        messageOutput(dateTime(), `URL: ${siteUrl} の各サイズのファビコンを取得します`);
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

  siteUrlButton.addEventListener('click', getActiveTabUrlAndProcess);
  siteUrlFrom.addEventListener('input', () => {
    const siteUrl = siteUrlFrom.value;
    const hostname = new URL(siteUrl).hostname;
    messageOutput(dateTime(), `URL: ${hostname} の各サイズのファビコンを取得します`);
    fileName.value = hostname.replace(/\./g, '_');
    if (siteUrl) {
      updateFaviconUrls(siteUrl);
    }
  });

  getActiveTabUrlAndProcess();

  setTimeout(() => {
    const fname = document.getElementById('filename-from').value;
    const isFnameCheck = document.getElementById('filename-checkbox').checked;
    const isFnameAddSize = document.getElementById('filename-add-size-checkbox').checked;
    const radioValue = document.querySelector('input[name="filetype-radio"]:checked').value;
    messageOutput(dateTime(), `URL: ${fname}`);
    messageOutput(dateTime(), `ファイル名: ${fname} ${isFnameCheck ? '（記憶する）' : ''}`);
    messageOutput(dateTime(), `ファイル形式: ${radioValue}`);
    if (isFnameAddSize) {
      messageOutput(dateTime(), `ファイル名の末尾にサイズを付ける`);
    }
    messageOutput(dateTime(), `ファイル（例）: ${isFnameAddSize ? fname + "_16x16." + radioValue : fname + "." + radioValue}`);
  }, 100);

  // ファビコンのダウンロード処理
  document.querySelectorAll("a[data-size]").forEach(link => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      const size = link.getAttribute("data-size");
      const fileNameValue = document.getElementById('filename-from').value;
      const addSizeSuffix = document.getElementById('filename-add-size-checkbox').checked;
      const siteUrl = document.getElementById('site-url-from').value;
      const fileType = document.querySelector('input[name="filetype-radio"]:checked').value;
      const img = document.getElementById(`favicon-${size}`);

      if (!img.src || !siteUrl) return;

      const baseUrl = new URL(siteUrl).origin;
      const filename = addSizeSuffix ? `${fileNameValue}_${size}x${size}.${fileType}` : `${fileNameValue}.${fileType}`;

      try {
        const response = await fetch(img.src, { mode: 'cors' });
        if (!response.ok) throw new Error('Favicon fetch failed');
        const originalBlob = await response.blob();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const image = new Image();

        image.onload = () => {
          canvas.width = image.width;
          canvas.height = image.height;
          ctx.drawImage(image, 0, 0);

          if (fileType === 'ico') {
            const icoBlob = convertToIco(canvas);
            downloadFavicon(icoBlob, filename);
          } else {
            canvas.toBlob(blob => {
              downloadFavicon(blob, filename);
            }, `image/${fileType}`);
          }
          messageOutput(dateTime(), `${baseUrl}のサイズ${size}のファビコンをダウンロードしました`);
        };

        image.onerror = () => {
          throw new Error('Image loading failed');
        };

        image.src = URL.createObjectURL(originalBlob);

      } catch (error) {
        console.error(error);
        messageOutput(dateTime(), `サイズ${size}のファビコンのダウンロードに失敗しました`);
      }
    });
  });

  document.getElementById('title').textContent = `Easy Favicon Downloader`;
  document.getElementById('title-header').textContent = `Easy Favicon Downloader`;

  const newTabButton = document.getElementById('new-tab-button');
  newTabButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'popup/popup.html' });
  });

  const extensionLink = document.getElementById('extension_link');
  extensionLink.href = `chrome://extensions/?id=${chrome.runtime.id}`;
  if (extensionLink) clickURL(extensionLink);
  const issueLink = document.getElementById('issue-link');
  if (issueLink) clickURL(issueLink);
  const storeLink = document.getElementById('store_link');
  if (storeLink) clickURL(storeLink);
  document.getElementById('extension-id').textContent = `${chrome.runtime.id}`;
  document.getElementById('extension-name').textContent = `${manifestData.name}`;
  document.getElementById('extension-version').textContent = `${manifestData.version}`;
  document.getElementById('extension-description').textContent = `${manifestData.description}`;
  chrome.permissions.getAll((result) => {
    document.getElementById('permission-info').textContent = `${result.permissions.join(', ')}`;

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
  chrome.extension.isAllowedIncognitoAccess((isAllowedAccess) => {
    document.getElementById('incognito-enabled').textContent = `${isAllowedAccess ? '有効' : '無効'}`;
  });
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
    if (!url) return;
    const baseUrl = new URL(url).origin;
    callback(baseUrl);
  });
}

function getImageMetadata(imageUrl, index) {
  return fetch(imageUrl)
    .then(response => {
      if (!response.ok) {
        if (index === faviconSizes.length - 1) {
          console.log('画像の取得に失敗しました');
          messageOutput(dateTime(), '画像の取得に失敗しました');
        }
      }
      return response.arrayBuffer();
    })
    .then(data => {
      const blob = new Blob([data]);
      const img = new Image();
      const objectURL = URL.createObjectURL(blob);
      img.src = objectURL;

      return new Promise((resolve, reject) => {
        img.onload = function () {
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

function downloadFavicon(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Canvasの画像をICO形式のBlobに変換します
 * @param {HTMLCanvasElement} canvas - 変換元のCanvas要素
 * @returns {Blob} ICO形式のBlobオブジェクト
 */
function convertToIco(canvas) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);

  // ICOヘッダー (6バイト)
  const header = new Uint8Array([0, 0, 1, 0, 1, 0]);

  // 画像ディレクトリ (16バイト) - 画像のメタデータを格納
  const dirEntry = new DataView(new ArrayBuffer(16));
  dirEntry.setUint8(0, width);   // 幅 (0で256を示す)
  dirEntry.setUint8(1, height);  // 高さ (0で256を示す)
  dirEntry.setUint8(2, 0);       // カラーパレット数 (0は256色以上)
  dirEntry.setUint8(3, 0);       // 予約領域 (常に0)
  dirEntry.setUint16(4, 1, true); // カラープレーン (常に1)
  dirEntry.setUint16(6, 32, true);// 1ピクセルあたりのビット数
  const imageSize = width * height * 4 + 40; // DIBヘッダー(40) + ピクセルデータ
  dirEntry.setUint32(8, imageSize, true); // 画像データサイズ
  dirEntry.setUint32(12, 22, true); // 画像データオフセット (ヘッダー6バイト + ディレクトリ16バイト)

  // DIB (ビットマップ) ヘッダー (40バイト) - BITMAPINFOHEADER
  const dibHeader = new DataView(new ArrayBuffer(40));
  dibHeader.setUint32(0, 40, true); // ヘッダーサイズ
  dibHeader.setUint32(4, width, true); // 幅
  dibHeader.setUint32(8, height * 2, true); // 高さ (XORマスクとANDマスクのために2倍にする)
  dibHeader.setUint16(12, 1, true); // プレーン数 (常に1)
  dibHeader.setUint16(14, 32, true); // 1ピクセルあたりのビット数
  dibHeader.setUint32(16, 0, true); // 圧縮形式 (0は無圧縮)
  dibHeader.setUint32(20, width * height * 4, true); // 画像データサイズ
  // 残りのヘッダーフィールドは0でよい

  // ICOフォーマットはボトムアップ形式のBGRAピクセルデータを要求する
  // CanvasのgetImageDataはトップダウン形式のRGBAなので変換が必要
  const bmpData = new Uint8Array(width * height * 4);
  const data = imageData.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const destIdx = ((height - 1 - y) * width + x) * 4;
      bmpData[destIdx] = data[srcIdx + 2];     // B (青)
      bmpData[destIdx + 1] = data[srcIdx + 1]; // G (緑)
      bmpData[destIdx + 2] = data[srcIdx];     // R (赤)
      bmpData[destIdx + 3] = data[srcIdx + 3]; // A (アルファ)
    }
  }

  // ANDマスク (全ピクセルを不透明にする場合は0で埋める)
  const andMask = new Uint8Array(Math.ceil(width * height / 8));

  const icoBlob = new Blob([header, new Uint8Array(dirEntry.buffer), new Uint8Array(dibHeader.buffer), bmpData, andMask], { type: 'image/x-icon' });
  return icoBlob;
}