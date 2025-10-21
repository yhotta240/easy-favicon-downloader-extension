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

  document.getElementById('download-all-zip').style.display = fileType === 'ico' ? 'none' : 'block';
  document.querySelectorAll('a[data-size]').forEach(link => link.style.display = fileType === 'ico' ? 'none' : 'block');
  icoSizeInfo.style.display = fileType === 'ico' ? 'block' : 'none';

  fileTypeRadio.forEach((radio) => {
    if (radio.value === fileType) {
      radio.checked = true;
    }
    radio.addEventListener('change', () => {
      settings.fileType = radio.value;
      messageOutput(dateTime(), `ファイル形式: ${radio.value} に変更 `);
      chrome.storage.local.set({ settings: settings });

      // ICO選択時、個別ダウンロードリンクとZIPダウンロードボタンを非表示にし、ICO一括ダウンロードボタンを表示
      document.getElementById('download-all-zip').style.display = radio.value === 'ico' ? 'none' : 'block';
      document.querySelectorAll('a[data-size]').forEach(link => link.style.display = radio.value === 'ico' ? 'none' : 'block');

      icoSizeInfo.style.display = radio.value === 'ico' ? 'block' : 'none';
    });
  });
}

// DOMの読み込み完了を監視し，完了後に実行
document.addEventListener('DOMContentLoaded', function () {
  const siteUrlFrom = document.getElementById('site-url-from');
  const siteUrlButton = document.getElementById('site-url-button');
  const downloadAllZipButton = document.getElementById('download-all-zip');
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

        image.onload = async () => {
          canvas.width = image.width;
          canvas.height = image.height;
          ctx.drawImage(image, 0, 0);

          if (fileType === 'ico') {
            const icoBlob = await createSingleIco(canvas);
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

  // すべてのファビコンをZIPでダウンロードする処理
  downloadAllZipButton.addEventListener('click', async () => {
    const fileNameValue = document.getElementById('filename-from').value;
    const addSizeSuffix = document.getElementById('filename-add-size-checkbox').checked;
    const fileType = document.querySelector('input[name="filetype-radio"]:checked').value;
    const siteUrl = document.getElementById('site-url-from').value;

    if (!siteUrl) {
      messageOutput(dateTime(), 'URLが入力されていません。');
      return;
    }

    messageOutput(dateTime(), 'ZIPファイルの作成を開始します...');
    const zip = new JSZip();
    const promises = [];

    faviconSizes.forEach(size => {
      const img = document.getElementById(`favicon-${size}`);
      // プレビューが表示されている画像のみを対象
      if (img.parentElement.style.visibility !== 'visible') return;

      // ZIPダウンロード時は、ファイル名の重複を避けるため常にサイズを付与する
      const filename = `${fileNameValue}_${size}x${size}.${fileType}`;

      const promise = fetch(img.src, { mode: 'cors' })
        .then(response => {
          if (!response.ok) throw new Error(`Favicon (size: ${size}) fetch failed`);
          return response.blob();
        })
        .then(blob => {
          // ICO形式の場合は変換処理を行う
          if (fileType === 'ico') {
            return convertBlobToIco(blob).then(icoBlob => zip.file(filename, icoBlob));
          } else {
            return zip.file(filename, blob);
          }
        });
      promises.push(promise);
    });

    try {
      await Promise.all(promises);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadFavicon(zipBlob, `${fileNameValue}.zip`);
      messageOutput(dateTime(), 'すべてのファビコンをZIPファイルとしてダウンロードしました。');
    } catch (error) {
      console.error('ZIP creation failed:', error);
      messageOutput(dateTime(), 'ZIPファイルの作成に失敗しました。');
    }
  });

  // ICO形式で一括ダウンロードする処理
  document.getElementById('download-all-ico').addEventListener('click', async () => {
    const fileNameValue = document.getElementById('filename-from').value;
    const siteUrl = document.getElementById('site-url-from').value;

    if (!siteUrl) {
      messageOutput(dateTime(), 'URLが入力されていません。');
      return;
    }

    messageOutput(dateTime(), 'ICOファイルの作成を開始します...');

    const canvases = [];
    const promises = faviconSizes.map(size => {
      const img = document.getElementById(`favicon-${size}`);
      if (img.parentElement.style.visibility !== 'visible') {
        return null;
      }

      return new Promise(async (resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const image = new Image();
        image.crossOrigin = "Anonymous"; // CORSエラーを回避

        image.onload = () => {
          let w = image.naturalWidth;
          let h = image.naturalHeight;
          // 256x256を超える画像は256x256にリサイズする (ICOの最大サイズ)
          if (w > 256 || h > 256) {
            const ratio = Math.min(256 / w, 256 / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          // ICOは正方形が望ましいため，小さい方の辺に合わせる
          const finalSize = Math.min(w, h);
          canvas.width = finalSize;
          canvas.height = finalSize;

          ctx.drawImage(image, 0, 0, finalSize, finalSize);
          canvases.push(canvas);
          URL.revokeObjectURL(image.src); // メモリ解放
          resolve();
        };

        image.onerror = () => {
          console.warn(`画像の読み込みに失敗: ${img.src}`);
          resolve(); // 失敗しても処理を続行
        };

        // Google Favicon APIはCORSヘッダーを返さないため，fetch経由で取得しCORSを回避
        try {
          const response = await fetch(img.src);
          const blob = await response.blob();
          image.src = URL.createObjectURL(blob);
        } catch (error) {
          console.warn(`画像のフェッチに失敗: ${img.src}`, error);
          resolve();
        }
      });
    }).filter(p => p !== null);

    try {
      await Promise.all(promises);
      const icoBlob = await convertToIco(canvases);
      downloadFavicon(icoBlob, `${fileNameValue}.ico`);
      messageOutput(dateTime(), 'すべてのファビコンを1つのICOファイルとしてダウンロードしました。');
    } catch (error) {
      console.error('ICO creation failed:', error);
      messageOutput(dateTime(), 'ICOファイルの作成に失敗しました。');
    }
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
 * BlobをICO形式のBlobに変換します
 * @param {Blob} blob - 変換元の画像Blob
 * @returns {Promise<Blob>} ICO形式のBlobオブジェクト
 */
function convertBlobToIco(blob) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const image = new Image();

    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);
      const icoBlob = convertToIco(canvas);
      resolve(icoBlob);
    };
    image.onerror = () => reject(new Error('Image loading for ICO conversion failed'));
    image.src = URL.createObjectURL(blob);
  });
}

/**
 * 単一のCanvasからICO形式のBlobを生成します
 * @param {HTMLCanvasElement} canvas - 変換元のCanvas要素
 * @returns {Promise<Blob>} ICOファイルBlob
 */
async function createSingleIco(canvas) {
  const canvases = [canvas];
  return await convertToIco(canvases);
}

/**
 * 複数のCanvasからマルチサイズICOファイルを生成
 * @param {HTMLCanvasElement[]} canvases - 各サイズのCanvasを格納した配列
 * @returns {Promise<Blob>} ICOファイルBlob
 */
async function convertToIco(canvases) {
  const imageCount = canvases.length;

  // ICOヘッダー（6バイト）
  const header = new Uint8Array(6);
  const headerView = new DataView(header.buffer);
  headerView.setUint16(0, 0, true);  // Reserved = 0
  headerView.setUint16(2, 1, true);  // Type = 1 (icon)
  headerView.setUint16(4, imageCount, true);  // Count = imageCount

  const dirEntries = [];
  const imageDatas = [];

  let offset = 6 + 16 * imageCount;

  for (const canvas of canvases) {
    const width = canvas.width;
    const height = canvas.height;

    let imageBuffer;
    let imageSize;

    // 256×256 → PNG形式
    if (width === 256 && height === 256) {
      const pngBlob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      imageBuffer = new Uint8Array(await pngBlob.arrayBuffer());
      imageSize = imageBuffer.length;
    } else {
      const ctx = canvas.getContext("2d");
      const img = ctx.getImageData(0, 0, width, height);
      const data = img.data;

      const dibHeader = new DataView(new ArrayBuffer(40));
      dibHeader.setUint32(0, 40, true);
      dibHeader.setUint32(4, width, true);
      dibHeader.setUint32(8, height * 2, true);
      dibHeader.setUint16(12, 1, true);
      dibHeader.setUint16(14, 32, true);
      dibHeader.setUint32(16, 0, true);
      dibHeader.setUint32(20, width * height * 4, true);

      const bmpData = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const src = (y * width + x) * 4;
          const dst = ((height - 1 - y) * width + x) * 4;
          bmpData[dst] = data[src + 2];
          bmpData[dst + 1] = data[src + 1];
          bmpData[dst + 2] = data[src];
          bmpData[dst + 3] = data[src + 3];
        }
      }

      const rowSize = Math.ceil(width / 32) * 4;
      const andMask = new Uint8Array(rowSize * height);
      andMask.fill(0);

      // パフォーマンス最適な結合
      imageBuffer = new Uint8Array(40 + bmpData.length + andMask.length);
      imageBuffer.set(new Uint8Array(dibHeader.buffer), 0);
      imageBuffer.set(bmpData, 40);
      imageBuffer.set(andMask, 40 + bmpData.length);
      imageSize = imageBuffer.length;
    }

    // ディレクトリエントリ
    const dir = new DataView(new ArrayBuffer(16));
    dir.setUint8(0, width === 256 ? 0 : width);
    dir.setUint8(1, height === 256 ? 0 : height);
    dir.setUint8(2, 0);
    dir.setUint8(3, 0);
    dir.setUint16(4, 1, true);
    dir.setUint16(6, 32, true);
    dir.setUint32(8, imageSize, true);
    dir.setUint32(12, offset, true);

    dirEntries.push(new Uint8Array(dir.buffer));
    imageDatas.push(imageBuffer);
    offset += imageSize;
  }

  return new Blob([header, ...dirEntries, ...imageDatas], { type: "image/x-icon" });
}

