// 初期化処理
const messageDiv = document.getElementById('message'); // メッセージ表示用のdiv要素を取得
const manifestData = chrome.runtime.getManifest();
const fileName = document.getElementById('filename-from');
const filenameCheckbox = document.getElementById('filename-checkbox');
const fileTypeRadio = document.querySelectorAll('input[name="filetype-radio"]')
const fetchMethodRadio = document.querySelectorAll('input[name="fetch-method-radio"]');
const filenameAddSize = document.getElementById('filename-add-size-checkbox');
const icoSizeInfo = document.getElementById('ico-size-info');
const downloadAllZipButton = document.getElementById('download-all-zip');
const faviconSizes = [16, 32, 48, 64, 96, 128];

let isSaveFilename = false;
let saveFilename = null;
let savefilenameAddSize = true;
let fetchMethod = 'google';

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
  fetchMethod = settings.fetchMethod || 'google';

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

  toggleDownloadButton(fileType);
  const links = document.querySelectorAll('a[data-size]');
  links.forEach(link => link.classList.toggle('d-none', fileType === 'ico'));

  fileTypeRadio.forEach((radio) => {
    if (radio.value === fileType) radio.checked = true;

    radio.addEventListener('change', () => {
      settings.fileType = radio.value;
      messageOutput(dateTime(), `ファイル形式: ${radio.value} に変更 `);
      chrome.storage.local.set({ settings: settings });

      // ICO選択時，個別ダウンロードリンクとZIPダウンロードボタンを非表示にし，ICO一括ダウンロードボタンを表示
      toggleDownloadButton(radio.value);
      const links = document.querySelectorAll('a[data-size]');
      links.forEach(link => link.classList.toggle('d-none', radio.value === 'ico'));
    });
  });

  fetchMethodRadio.forEach((radio) => {
    if (radio.value === fetchMethod) {
      radio.checked = true;
    }
    radio.addEventListener('change', () => {
      settings.fetchMethod = radio.value;
      fetchMethod = radio.value;
      messageOutput(dateTime(), `取得方法: ${radio.value === 'google' ? 'Google Favicon API' : 'サイトから直接取得'} に変更 `);
      chrome.storage.local.set({ settings: settings });
      // 取得方法が変更されたらファビコンを再取得
      const siteUrl = document.getElementById('site-url-from').value;
      if (siteUrl) {
        messageOutput(dateTime(), `URL: ${fetchMethod} の各サイズのファビコンを取得します`);
        updateFaviconUrls(siteUrl);
      }
    });
  });
}

function toggleDownloadButton(fileType) {
  downloadAllZipButton.classList.toggle('d-none', fileType === 'ico');
  icoSizeInfo.classList.toggle('d-none', fileType !== 'ico');
}

function toggleDownloadLink() {
  const fileType = document.querySelector('input[name="filetype-radio"]:checked').value;
  const links = document.querySelectorAll('a[data-size]');
  links.forEach(link => link.classList.toggle('d-none', fileType === 'ico'));
}

/** 各サイズのファビコンを取得 */
function updateFaviconUrls(siteUrl) {
  if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
    messageOutput(dateTime(), '正しいURLではありません');
    return;
  }

  const previews = document.getElementById(`preview-list`);
  Array.from(previews.children).forEach((child) => child.classList.add('d-none'));

  if (fetchMethod === 'google') {
    updateFaviconUrlsFromGoogle(siteUrl);
  } else {
    updateFaviconUrlsFromMeta(siteUrl);
  }
}

/** 各サイズのファビコンを Google Favicon API から取得 */
async function updateFaviconUrlsFromGoogle(siteUrl) {
  const previewList = document.getElementById('preview-list');
  previewList.innerHTML = `
    <li class="list-group-item text-center" id="loading-spinner">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 mb-0">Google APIからファビコンを取得中...</p>
    </li>
  `;

  try {
    // 新しいGoogle Favicon APIエンドポイント
    const faviconBaseUrl = `https://www.google.com/s2/favicons?domain=${siteUrl}&sz=`;

    const faviconPromises = faviconSizes.map(async (size) => {
      const faviconUrl = `${faviconBaseUrl}${size}`;
      const meta = await getImageMetadata(faviconUrl);
      // 取得した画像のサイズが期待通りか，またはデフォルトの16x16かチェック
      if (meta && (meta.width === size || (size === 16 && meta.width > 0))) {
        return { url: faviconUrl, ...meta };
      }
      return null;
    });

    const favicons = (await Promise.all(faviconPromises)).filter(Boolean);

    // 重複するサイズのファビコンを除外（小さいサイズが優先されることがあるためMapで管理）
    const uniqueFavicons = new Map();
    favicons.forEach(favicon => {
      const sizeKey = `${favicon.width}x${favicon.height}`;
      if (!uniqueFavicons.has(sizeKey)) {
        uniqueFavicons.set(sizeKey, favicon);
      }
    });

    // ローディングスピナーを削除
    previewList.innerHTML = '';

    if (uniqueFavicons.size === 0) {
      messageOutput(dateTime(), 'Google APIから表示可能なファビコンが見つかりませんでした．');
      return;
    }

    // サイズの小さい順に並び替えてプレビューを追加
    Array.from(uniqueFavicons.values())
      .sort((a, b) => a.width - b.width)
      .forEach(favicon => {
        addPreviewItem(favicon.width, favicon.height, favicon.url);
      });

    toggleDownloadLink();

  } catch (error) {
    console.warn('Google APIからのファビコン取得に失敗:', error);
    messageOutput(dateTime(), 'Google APIからのファビコン取得に失敗しました．');
  } finally {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
      spinner.remove();
    }
  }
}

/** 各サイズのファビコンをサイトから直接取得 */
async function updateFaviconUrlsFromMeta(siteUrl) {
  const previewList = document.getElementById('preview-list');
  // 既存のプレビューをクリアし，ローディングスピナーを表示
  previewList.innerHTML = `
    <li class="list-group-item text-center" id="loading-spinner">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2 mb-0">サイトからファビコンを取得中...</p>
    </li>
  `;

  try {
    const response = await fetch(siteUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('link[rel*="icon"]');

    if (links.length === 0) {
      messageOutput(dateTime(), 'メタタグからファビコンが見つかりませんでした．Google APIを試します．');
      // ローディング表示を消してからGoogle APIを呼び出す
      previewList.innerHTML = '';
      updateFaviconUrlsFromGoogle(siteUrl); // 見つからなければGoogle APIにフォールバック
      return;
    }

    const faviconUrls = Array.from(links).map(link => {
      let href = link.getAttribute('href');
      // hrefがない場合またはSVGファイルの場合は除外
      if (!href || href.toLowerCase().endsWith('.svg')) return null;
      // 絶対URLに変換
      try {
        return new URL(href, siteUrl).href;
      } catch (e) {
        return null; // 無効なURLは無視
      }
    }).filter(Boolean);

    if (faviconUrls.length === 0) {
      messageOutput(dateTime(), '有効なファビコンURLが見つかりませんでした．');
      return;
    }

    messageOutput(dateTime(), `${faviconUrls.length}個のファビコン候補をメタタグから見つけました．`);

    // 各サイズのファビコン情報を取得し，重複を除外する
    const faviconPromises = faviconUrls.map(async (url) => {
      const meta = await getImageMetadata(url);
      return meta ? { url, ...meta } : null;
    });

    const allFavicons = (await Promise.all(faviconPromises)).filter(Boolean);

    const uniqueFavicons = new Map();
    allFavicons.forEach(favicon => {
      const sizeKey = `${favicon.width}x${favicon.height}`;
      if (!uniqueFavicons.has(sizeKey)) {
        uniqueFavicons.set(sizeKey, favicon);
      }
    });

    // サイズの小さい順に並び替え
    const sortedFavicons = Array.from(uniqueFavicons.values())
      .sort((a, b) => a.width - b.width);

    // 各サイズのプレビューを追加
    sortedFavicons.forEach(favicon => {
      addPreviewItem(favicon.width, favicon.height, favicon.url);
    });

    toggleDownloadLink();
  } catch (error) {
    console.warn('メタタグからのファビコン取得に失敗:', error);
    messageOutput(dateTime(), `サイトのHTML取得に失敗しました．URLが正しいか確認してください．`);
  } finally {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
      spinner.remove();
    }
  }
}

// 各サイズのプレビューを表示
function addPreviewItem(width, height, faviconUrl) {
  const previewList = document.getElementById('preview-list');
  const li = document.createElement('li');
  li.classList.add('list-group-item', 'd-flex', 'align-items-center');
  previewList.appendChild(li);

  const img = document.createElement('img');
  img.classList.add('border', 'rounded', 'me-3');
  img.src = faviconUrl;
  // プレビュー画像の最大サイズを制限
  img.style.width = `${Math.min(width, 128)}px`;
  img.style.height = `${Math.min(height, 128)}px`;
  li.appendChild(img);

  const span = document.createElement('span');
  span.classList.add('flex-grow-1');
  span.textContent = `${width}x${height}`;
  li.appendChild(span);

  const downloadLink = document.createElement('a');
  downloadLink.href = '#';
  downloadLink.dataset.url = faviconUrl; // ダウンロード用にURLを保持
  downloadLink.dataset.size = `${width}x${height}`; // ダウンロード用にサイズを保持
  downloadLink.classList.add('text-primary', 'download-link');
  downloadLink.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
        class="bi bi-download" viewBox="0 0 16 16">
        <path
          d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5" />
        <path
          d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z" />
      </svg>
  `;
  li.appendChild(downloadLink);
}

// DOMの読み込み完了を監視し，完了後に実行
document.addEventListener('DOMContentLoaded', function () {
  const siteUrlFrom = document.getElementById('site-url-from');
  const siteUrlButton = document.getElementById('site-url-button');
  const downloadAllZipButton = document.getElementById('download-all-zip');

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
  document.getElementById('preview-list').addEventListener('click', async (event) => {
    const downloadLink = event.target.closest('.download-link');
    if (downloadLink) {
      event.preventDefault();
      const faviconUrl = downloadLink.dataset.url;
      const size = downloadLink.dataset.size;
      const fileNameValue = document.getElementById('filename-from').value;
      const addSizeSuffix = document.getElementById('filename-add-size-checkbox').checked;
      const siteUrl = document.getElementById('site-url-from').value;
      const fileType = document.querySelector('input[name="filetype-radio"]:checked').value;

      if (!faviconUrl || !siteUrl) return;

      const baseUrl = new URL(siteUrl).origin;
      const filename = addSizeSuffix ? `${fileNameValue}_${size}.${fileType}` : `${fileNameValue}.${fileType}`;

      try {
        const response = await fetch(faviconUrl, { mode: 'cors' });
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
    }
  })

  // すべてのファビコンをZIPでダウンロードする処理
  downloadAllZipButton.addEventListener('click', async () => {
    const siteUrl = document.getElementById('site-url-from').value;
    if (!siteUrl) {
      messageOutput(dateTime(), 'URLが入力されていません．');
      return;
    }

    const imageElements = document.querySelectorAll('#preview-list img');
    if (imageElements.length === 0) {
      messageOutput(dateTime(), 'ダウンロード対象のファビコンがありません．');
      return;
    }

    const fileNameValue = document.getElementById('filename-from').value;
    const fileType = document.querySelector('input[name="filetype-radio"]:checked').value;

    messageOutput(dateTime(), 'ZIPファイルの作成を開始します...');
    const zip = new JSZip();

    try {
      for (const img of imageElements) {
        const size = img.parentElement.querySelector('span').textContent; // "16x16" などを取得
        const faviconUrl = img.src;
        // ZIPダウンロード時は，ファイル名の重複を避けるため常にサイズを付与する
        const filename = `${fileNameValue}_${size}.${fileType}`;

        const response = await fetch(faviconUrl, { mode: 'cors' });
        if (!response.ok) {
          console.warn(`Favicon (size: ${size}) fetch failed`);
          continue; // 失敗した場合はスキップ
        }
        const blob = await response.blob();

        // ICO形式の場合は変換処理を行う
        const fileBlob = fileType === 'ico' ? await convertBlobToIco(blob) : blob;
        zip.file(filename, fileBlob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadFavicon(zipBlob, `${fileNameValue}.zip`);
      messageOutput(dateTime(), 'すべてのファビコンをZIPファイルとしてダウンロードしました．');
    } catch (error) {
      console.error('ZIP creation failed:', error);
      messageOutput(dateTime(), 'ZIPファイルの作成に失敗しました．');
    }
  });

  // ICO形式で一括ダウンロードする処理
  document.getElementById('download-all-ico').addEventListener('click', async () => {
    const fileNameValue = document.getElementById('filename-from').value;
    const siteUrl = document.getElementById('site-url-from').value;

    if (!siteUrl) {
      messageOutput(dateTime(), 'URLが入力されていません．');
      return;
    }

    messageOutput(dateTime(), 'ICOファイルの作成を開始します...');

    const imageElements = document.querySelectorAll('#preview-list img');
    if (imageElements.length === 0) {
      messageOutput(dateTime(), 'ダウンロード対象のファビコンがありません．');
      return;
    }

    const canvases = [];
    const promises = Array.from(imageElements).map(img => {
      return new Promise(async (resolve) => {
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
          if (finalSize > 0) {
            canvas.width = finalSize;
            canvas.height = finalSize;
            ctx.drawImage(image, 0, 0, finalSize, finalSize);
            canvases.push(canvas);
          }
          URL.revokeObjectURL(image.src); // メモリ解放
          resolve();
        };

        image.onerror = () => {
          console.warn(`画像の読み込みに失敗: ${img.src}`);
          resolve(); // 失敗しても処理を続行
        };

        // Google Favicon APIはCORSヘッダーを返さないことがあるため，fetch経由で取得しCORSを回避
        try {
          const response = await fetch(img.src);
          if (!response.ok) throw new Error('Fetch failed');
          const blob = await response.blob();
          image.src = URL.createObjectURL(blob);
        } catch (error) {
          console.warn(`画像のフェッチに失敗: ${img.src}`, error);
          resolve();
        }
      });
    });

    try {
      await Promise.all(promises);
      if (canvases.length === 0) {
        messageOutput(dateTime(), 'ICOに変換できる画像がありませんでした．');
        return;
      }
      const icoBlob = await convertToIco(canvases);
      downloadFavicon(icoBlob, `${fileNameValue}.ico`);
      messageOutput(dateTime(), 'すべてのファビコンを1つのICOファイルとしてダウンロードしました．');
    } catch (error) {
      console.error('ICO creation failed:', error);
      messageOutput(dateTime(), 'ICOファイルの作成に失敗しました．');
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

async function getImageMetadata(imageUrl) {
  return fetch(imageUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`画像の取得に失敗: ${response.statusText}`);
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
          reject(new Error('画像の読み込みに失敗しました'));
        };
      });
    })
    .catch(error => {
      console.warn(`メタデータの取得に失敗: ${imageUrl}`, error);
      return null;
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
