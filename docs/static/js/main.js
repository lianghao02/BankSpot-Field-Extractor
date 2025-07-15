// main.js

const { PDFDocument, degrees } = window.PDFLib;
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const dropZone        = document.getElementById('dropZone');
const fileInput       = document.getElementById('fileInput');
const thumbnails      = document.getElementById('thumbnails');
const staging         = document.getElementById('staging');
const insertBlankBtn  = document.getElementById('insertBlankBtn');
const undoBtn         = document.getElementById('undoBtn');
const zoomIn          = document.getElementById('zoomIn');
const zoomOut         = document.getElementById('zoomOut');
const qualityInput    = document.getElementById('qualityInput');
const gapRange        = document.getElementById('gapRange');
const rotateLeftBtn   = document.getElementById('rotateLeftBtn');
const rotateRightBtn  = document.getElementById('rotateRightBtn');
const moveLeftBtn     = document.getElementById('moveLeftBtn');
const moveRightBtn    = document.getElementById('moveRightBtn');
const moveToThumbnailsBtn = document.getElementById('moveToThumbnailsBtn');
const moveToStagingBtn    = document.getElementById('moveToStagingBtn');
const deleteSelectedBtn  = document.getElementById('deleteSelectedBtn');
const clearSelectBtn     = document.getElementById('clearSelectBtn');
const exportBtn          = document.getElementById('exportBtn');
const outputName         = document.getElementById('outputName');

let fileList = [], pageList = [], undoStack = [];
let scalePercent = 100, lastSelectedIndex = null;
// 🔶 框選功能相關變數
let selectionBox = null;
let isSelecting = false;
let startX, startY;
let activeAreaKey = 'thumbnails';  // 🔸 預設為主頁區
let clickTimer = null; // 全域可重用，也可放區域變數
// ✅ 拖曳排序支援（單張 / 多張）「模擬多張拖曳」
let dragPreview = null;


function enableMarqueeSelection(container) {
  container.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.thumb')) {
      // 🔁 若沒有按 Ctrl/Shift，才清空原選取
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        pageList.forEach(i => i.selected = false);
        renderAll();
        updateControls();
      }

      isSelecting = true;
      startX = e.pageX;
      startY = e.pageY;
      selectionBox = document.createElement('div');
      selectionBox.style.position = 'absolute';
      selectionBox.style.border = '2px dashed orange';
      selectionBox.style.background = 'rgba(255,165,0,0.1)';
      selectionBox.style.zIndex = '9999';
      document.body.appendChild(selectionBox);
    }
  });


  window.addEventListener('mousemove', (e) => {
    if (!isSelecting || !selectionBox) return;
    const x = Math.min(e.pageX, startX);
    const y = Math.min(e.pageY, startY);
    const w = Math.abs(e.pageX - startX);
    const h = Math.abs(e.pageY - startY);
    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = `${w}px`;
    selectionBox.style.height = `${h}px`;

    const boxRect = selectionBox.getBoundingClientRect();
    const thumbs = container.querySelectorAll('.thumb');
    thumbs.forEach(thumb => {
      const rect = thumb.getBoundingClientRect();
      const overlap = !(rect.right < boxRect.left ||
                        rect.left > boxRect.right ||
                        rect.bottom < boxRect.top ||
                        rect.top > boxRect.bottom);
      if (overlap) thumb.classList.add('box-selected');
      else thumb.classList.remove('box-selected');
    });
  });

  window.addEventListener('mouseup', () => {
    if (isSelecting) {
      isSelecting = false;
      document.querySelectorAll('.box-selected').forEach(el => {
        const idx = parseInt(el.dataset.idx);
        if (!isNaN(idx)) pageList[idx].selected = true;
        el.classList.remove('box-selected');
      });
      if (selectionBox) selectionBox.remove();
      selectionBox = null;
      renderAll();
      updateControls();
    }
  });
}

enableMarqueeSelection(thumbnails);
enableMarqueeSelection(staging);


function movePreview(e) {
  if (!dragPreview) return;
  dragPreview.style.left = `${e.clientX}px`;
  dragPreview.style.top = `${e.clientY}px`;
}

function setupSortable(container, areaKey) {
  if (container._sortable) container._sortable.destroy();

  container._sortable = Sortable.create(container, {
    animation: 150,
    group: 'pdfpages',
    draggable: '.thumb-wrapper', // ✅ 修正為實際拖曳容器
    fallbackTolerance: 5,

    onStart: (evt) => {
      document.body.classList.add('dragging');

      const idx = +evt.item.dataset.idx;
      if (!pageList[idx].selected) {
        pageList.forEach(p => p.selected = false);
        pageList[idx].selected = true;
      }
      renderAll(); // ✅ 確保 DOM 同步
      // 🟧 取得所有選中的元素
      const selectedItems = pageList
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.selected && p.area === areaKey);

      // 🟧 將 DOM 元素隱藏（避免與浮動預覽重疊）
      selectedItems.forEach(({ i }) => {
        const el = container.querySelector(`[data-idx="${i}"]`);
        if (el) el.style.visibility = 'hidden';
      });

      // 🟧 建立浮動堆疊預覽
      if (selectedItems.length > 0) {
        dragPreview = document.createElement('div');
        dragPreview.id = 'drag-preview';

        selectedItems.slice(0, 5).forEach(({ p }, i) => {
          const img = document.createElement('img');
          img.src = p.dataURL;
          img.style.position = 'absolute';
          img.style.top = '0';
          img.style.left = '0';
          img.style.width = '80px';
          img.style.height = '110px';
          img.style.objectFit = 'contain';
          img.style.border = '1px solid #ccc';
          img.style.borderRadius = '3px';
          img.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
          img.style.transform = `translate(${i * 5}px, ${i * 5}px)`;
          img.style.zIndex = `${100 - i}`;
          dragPreview.appendChild(img);
        });

        dragPreview.style.position = 'fixed';
        dragPreview.style.zIndex = '9999';
        dragPreview.style.pointerEvents = 'none';
        dragPreview.style.transform = 'translate(-50%, -50%)';
        dragPreview.style.width = '120px';
        dragPreview.style.height = '160px';

        document.body.appendChild(dragPreview);
        window.addEventListener('mousemove', movePreview);
      }
    },

    onEnd: (evt) => {
      document.body.classList.remove('dragging');

      // ✅ 顯示原本隱藏的元素
      container.querySelectorAll('.thumb').forEach(el => {
        el.style.visibility = 'visible';
      });

      // ✅ 移除浮動預覽
      if (dragPreview) {
        dragPreview.remove();
        dragPreview = null;
        window.removeEventListener('mousemove', movePreview);
      }

      // ✅ 使用 Sortable 提供的準確插入索引（避免 visibility: hidden 錯位）
      let insertIndex = evt.newIndex ?? container.children.length;
      if (insertIndex === -1) insertIndex = container.children.length;

      // ✅ 找出當前區塊中選取的頁面
      const selectedPages = pageList.filter(p => p.selected && p.area === areaKey);

      // ✅ 先從 pageList 中移除這些頁面
      pageList = pageList.filter(p => !(p.selected && p.area === areaKey));

      // ✅ 插入到新位置（根據 insertIndex 切開）
      const before = pageList.slice(0, insertIndex);
      const after = pageList.slice(insertIndex);
      pageList = [...before, ...selectedPages, ...after];

      // ✅ 重新渲染與控制按鈕狀態
      renderAll();
      updateControls();
    },      

    onAdd: (evt) => {
      // 🔸 找出目前拖入的目標區塊
      const insertIdx = evt.newIndex;
      const selectedPages = pageList.filter(p => p.selected);

      // 🔸 更新所屬區塊
      selectedPages.forEach(p => {
        p.area = areaKey;
      });

      // 🔸 移除原位置
      pageList = pageList.filter(p => !selectedPages.includes(p));

      // 🔸 插入新位置
      const before = pageList.slice(0, insertIdx);
      const after = pageList.slice(insertIdx);
      pageList = [...before, ...selectedPages, ...after];

      renderAll();
      updateControls();
    }
  });
}

setupSortable(thumbnails, 'thumbnails');
setupSortable(staging, 'staging');

function syncOrder() {
  const newList = [];
  const all = [...thumbnails.children, ...staging.children];
  all.forEach(el => {
    const idx = parseInt(el.dataset.idx);
    if (!isNaN(idx)) newList.push(pageList[idx]);
  });
  pageList = newList;
}

function saveUndoState() {
  // ✅ 使用 deep copy 儲存當下的 pageList 狀態（避免 reference 問題）
  const snapshot = JSON.parse(JSON.stringify(pageList));
  undoStack.push(snapshot);

  // ✅ 限制最多 20 步（超過則移除最早的）
  if (undoStack.length > 20) {
    undoStack.shift();
  }
}

function undoLastAction() {
  if (!undoStack.length) {
    alert('⚠️ 無操作可復原');
    return;
  }

  // ✅ 回復最近一筆狀態（deep clone 避免 reference 問題）
  const last = undoStack.pop();
  pageList = JSON.parse(JSON.stringify(last));

  renderAll();
  updateControls();
}


function updateControls() {
  const anySelectedThumb = pageList.some(i => i.selected && i.area === 'thumbnails');
  const anySelectedStage = pageList.some(i => i.selected && i.area === 'staging');
  const anySelected = pageList.some(i => i.selected);
  deleteSelectedBtn.disabled = !anySelected;
  clearSelectBtn.disabled = !anySelected;
  moveLeftBtn.disabled = !(anySelectedThumb || anySelectedStage);
  moveRightBtn.disabled = !(anySelectedThumb || anySelectedStage);
  moveToThumbnailsBtn.disabled = !anySelectedStage;
  moveToStagingBtn.disabled = !anySelectedThumb;
  exportBtn.disabled = !pageList.some(i => i.area === 'thumbnails');
}

function clearSelection() {
  pageList.forEach(p => p.selected = false);
  lastSelectedIndex = null;
  renderAll();
  updateControls();
}

dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('dragover'); };
dropZone.ondragleave = () => dropZone.classList.remove('dragover');
dropZone.ondrop = e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  addFiles(e.dataTransfer.files);
};

fileInput.onchange = e => addFiles(e.target.files);

async function addFiles(files) {
  for (const file of files) {
    if (file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      const pdf = await pdfjsLib.getDocument({ url }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pageList.push({
          fileType: 'pdf',
          fileIdx: fileList.length,
          pageNum: i,
          dataURL: canvas.toDataURL(),
          area: 'thumbnails',
          originPageNum: i,
          selected: false,
          rotation: 0
        });
      }
      fileList.push(file);
      URL.revokeObjectURL(url);
    } else if (file.type.startsWith('image/')) {
      await addImageFile(file);
    }
  }
  saveUndoState();
  renderAll();
  updateControls();
}

async function addImageFile(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      pageList.push({
        fileType: 'img',
        dataURL: canvas.toDataURL(),
        area: 'thumbnails',
        originPageNum: file.name,
        selected: false,
        rotation: 0
      });
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}

function renderAll() {
  thumbnails.innerHTML = '';
  staging.innerHTML = '';

  updateGap(); // ✅ 根據縮放自動調整 gap 間距

  let idx = 1;
  pageList.forEach(p => {
    if (p.area === 'thumbnails') p.mainPageIdx = idx++;
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });

  pageList.forEach((p, i) => {
    // ✅ 外層容器 .thumb-wrapper，控制位置與間距
    const wrapper = document.createElement('div');
    wrapper.className = 'thumb-wrapper';
    wrapper.dataset.idx = i;

    // ✅ 內層容器 .thumb，控制樣式與旋轉
    const el = document.createElement('div');
    el.className = 'thumb';
    el.dataset.idx = i;
    if (p.selected) el.classList.add('selected');

    // ✅ 設定縮放寬高與旋轉
    const baseWidth = 120;
    const baseHeight = 160;
    const scale = scalePercent / 100;
    el.style.width = `${baseWidth * scale}px`;
    el.style.height = `${baseHeight * scale}px`;
    el.style.transform = `rotate(${p.rotation}deg)`;
    el.style.transformOrigin = 'center center';
    // ✅ 根據旋轉角度動態設定 wrapper 尺寸（保持間距一致）
    if (p.rotation % 180 === 0) {
      wrapper.style.width = `${baseWidth * scale}px`;
      wrapper.style.height = `${baseHeight * scale}px`;
    } else {
      wrapper.style.width = `${baseHeight * scale}px`;
      wrapper.style.height = `${baseWidth * scale}px`;
    }

    // ✅ 建立圖片元素
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='; // 預設透明圖
    img.dataset.src = p.dataURL;
    img.loading = 'lazy';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.transform = ''; // ❌ 避免圖片重複旋轉
    observer.observe(img);

    // ✅ 點擊選取
    img.onclick = (e) => {
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        activeAreaKey = p.area;
        if (e.shiftKey && lastSelectedIndex !== null) {
          const start = Math.min(lastSelectedIndex, i);
          const end = Math.max(lastSelectedIndex, i);
          for (let j = start; j <= end; j++) {
            if (pageList[j].area === p.area) {
              pageList[j].selected = true;
            }
          }
        } else {
          if (!e.ctrlKey && !e.metaKey) {
            pageList.forEach(p => p.selected = false);
          }
          p.selected = !p.selected;
          lastSelectedIndex = i;
        }
        document.querySelectorAll('.thumb').forEach((thumb, idx) => {
          if (pageList[idx].selected) {
            thumb.classList.add('selected');
          } else {
            thumb.classList.remove('selected');
          }
        });
        updateControls();
      }, 125);
    };

    // ✅ 雙擊預覽
    img.ondblclick = () => {
      if (clickTimer) clearTimeout(clickTimer);
      previewImage(p.dataURL);
    };

    el.appendChild(img);

    // ✅ 加入頁面標籤與索引
    const label = document.createElement('div');
    label.className = 'page-label';
    label.textContent = p.fileType === 'img' ? '圖片' : `檔${p.fileIdx + 1}-頁${p.originPageNum}`;
    el.appendChild(label);

    if (p.area === 'thumbnails') {
      const idxLbl = document.createElement('div');
      idxLbl.className = 'page-index';
      idxLbl.textContent = p.mainPageIdx;
      el.appendChild(idxLbl);
    }

    // ✅ 刪除按鈕
    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.onclick = e => {
      e.stopPropagation();
      saveUndoState();
      const realIdx = parseInt(wrapper.dataset.idx);
      if (!isNaN(realIdx) && pageList[realIdx]) {
        pageList.splice(realIdx, 1);
        renderAll();
        updateControls();
      } else {
        console.warn('❗ 無法刪除：索引無效', realIdx);
      }
    };
    el.appendChild(del);

    wrapper.appendChild(el);
    const container = p.area === 'thumbnails' ? thumbnails : staging;
    container.appendChild(wrapper);
  });
}

    function previewImage(dataURL) {
      const modal = new bootstrap.Modal(document.getElementById('previewModal'));
      document.getElementById('previewImage').src = dataURL;
      modal.show();
    }
    function updateGap() {
      const gap = gapRange.value * scalePercent / 100;
      thumbnails.style.gap = `${gap}px`;
      staging.style.gap = `${gap}px`;
    }





insertBlankBtn.onclick = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 595;
  canvas.height = 842;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ccc';
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.font = '30px Arial';
  ctx.fillStyle = '#ccc';
  ctx.fillText('空白頁', 200, 420);
  pageList.push({
    fileType: 'blank',
    dataURL: canvas.toDataURL(),
    area: 'thumbnails',
    originPageNum: '空白',
    selected: false,
    rotation: 0
  });
  saveUndoState();
  renderAll();
  updateControls();
};

undoBtn.onclick = undoLastAction;
zoomIn.onclick = () => {
  scalePercent = Math.min(300, scalePercent + 10);
  qualityInput.value = scalePercent;
  renderAll(); // 已包含 updateGap
};

zoomOut.onclick = () => {
  scalePercent = Math.max(10, scalePercent - 10);
  qualityInput.value = scalePercent;
  renderAll(); // 已包含 updateGap
};
qualityInput.onchange = () => { scalePercent = Math.min(300, Math.max(10, parseInt(qualityInput.value) || 100)); renderAll(); };

gapRange.oninput = () => {
  updateGap(); // ✅ 取代舊的 thumbnails.style.gap
};

rotateLeftBtn.onclick = () => { pageList.forEach(p => { if (p.selected) p.rotation = (p.rotation - 90 + 360) % 360; }); renderAll(); updateControls(); };
rotateRightBtn.onclick = () => { pageList.forEach(p => { if (p.selected) p.rotation = (p.rotation + 90) % 360; }); renderAll(); updateControls(); };

moveToThumbnailsBtn.onclick = () => { pageList.forEach(p => { if (p.selected && p.area === 'staging') p.area = 'thumbnails'; }); renderAll(); updateControls(); };
moveToStagingBtn.onclick = () => { pageList.forEach(p => { if (p.selected && p.area === 'thumbnails') p.area = 'staging'; }); renderAll(); updateControls(); };

moveLeftBtn.onclick = () => {
  const arr = pageList.filter(p => p.selected);
  for (const p of arr) {
    const idx = pageList.indexOf(p);
    if (idx > 0) {
      [pageList[idx - 1], pageList[idx]] = [pageList[idx], pageList[idx - 1]];
    }
  }
  renderAll();
  updateControls();
};

moveRightBtn.onclick = () => {
  const arr = pageList.filter(p => p.selected).reverse();
  for (const p of arr) {
    const idx = pageList.indexOf(p);
    if (idx < pageList.length - 1) {
      [pageList[idx + 1], pageList[idx]] = [pageList[idx], pageList[idx + 1]];
    }
  }
  renderAll();
  updateControls();
};

deleteSelectedBtn.onclick = () => { pageList = pageList.filter(p => !p.selected); renderAll(); updateControls(); };
clearSelectBtn.onclick = clearSelection;

exportBtn.onclick = async () => {
  exportBtn.disabled = true;
  exportBtn.textContent = '匯出中...';

  try {
    const out = await PDFDocument.create();
    const origs = [];
    for (const f of fileList) {
      try {
        const b = await f.arrayBuffer();
        origs.push(await PDFDocument.load(b));
      } catch {
        origs.push(null);
      }
    }

    // 📦 取得品質設定
    const qualityLevel = document.getElementById('exportQuality').value;
    const qualityMap = {
      high:  { scale: 1.0, quality: 0.9 },
      medium:{ scale: 0.75, quality: 0.7 },
      low:   { scale: 0.5, quality: 0.5 }
    };
    const { scale, quality } = qualityMap[qualityLevel];

    for (const it of pageList.filter(p => p.area === 'thumbnails')) {
      if (it.fileType === 'blank') {
        out.addPage([595, 842]);
        continue;
      }

      if (it.fileType === 'pdf' && it.fileIdx >= 0 && origs[it.fileIdx]) {
        const [copiedPage] = await out.copyPages(origs[it.fileIdx], [it.pageNum - 1]);
        if (it.rotation) copiedPage.setRotation(degrees(it.rotation));
        out.addPage(copiedPage);
        continue;
      }

      const img = new Image();
      img.src = it.dataURL;

      await new Promise(resolve => img.onload = resolve);

      // 建立 canvas 並縮放 + 壓縮
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const jpegURL = canvas.toDataURL('image/jpeg', quality);

      const bytes = Uint8Array.from(atob(jpegURL.split(',')[1]), c => c.charCodeAt(0));
      const embeddedImg = await out.embedJpg(bytes);

      let width = embeddedImg.width;
      let height = embeddedImg.height;
      let pageWidth = width;
      let pageHeight = height;
      let x = 0, y = 0;
      const rotation = (it.rotation || 0) % 360;

      if (rotation === 90 || rotation === 270) {
        pageWidth = height;
        pageHeight = width;
      }

      const page = out.addPage([pageWidth, pageHeight]);

      if (rotation === 0) {
        x = 0; y = 0;
      } else if (rotation === 90) {
        x = pageWidth; y = 0;
      } else if (rotation === 180) {
        x = pageWidth; y = pageHeight;
      } else if (rotation === 270) {
        x = 0; y = pageHeight;
      }

      page.drawImage(embeddedImg, {
        x,
        y,
        width,
        height,
        rotate: degrees(rotation),
      });
    }

    const pdfBytes = await out.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${outputName.value || 'output'}.pdf`;
    a.click();

  } catch (err) {
    alert('❌ 匯出整份 PDF 失敗');
    console.error(err);
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = '匯出 PDF';
  }
};


renderAll();
updateControls();

let shiftAnchorIndex = null; // 👈 用來記住 Shift 起點

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // ✅ Delete 鍵：刪除選取的頁面
  if (e.key === 'Delete') {
    const anySelected = pageList.some(p => p.selected);
    if (anySelected) {
      saveUndoState();
      pageList = pageList.filter(p => !p.selected);
      renderAll();
      updateControls();
    }
    return; // ⚠️ 防止繼續執行下方邏輯
  }

  // ✅ Ctrl+Z：復原
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undoLastAction();
    return;
  }

  // ✅ Ctrl+A：全選當前區域
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    const area = activeAreaKey;
    pageList.forEach(p => {
      if (p.area === area) p.selected = true;
    });
    renderAll();
    updateControls();
    return;
  }

  // 🔽 鍵盤方向鍵：移動選取
  const area = activeAreaKey;
  const areaList = pageList
    .map((p, i) => ({ ...p, globalIdx: i }))
    .filter(p => p.area === area);

  if (areaList.length === 0) return;

  const currentCol = 5; // ← 依你的畫面設計調整
  const curIdx = areaList.findIndex(p => p.globalIdx === lastSelectedIndex);
  let idx = curIdx !== -1 ? curIdx : 0;

  let nextIdx = null;
  switch (e.key) {
    case 'ArrowLeft':  nextIdx = idx - 1; break;
    case 'ArrowRight': nextIdx = idx + 1; break;
    case 'ArrowUp':    nextIdx = idx - currentCol; break;
    case 'ArrowDown':  nextIdx = idx + currentCol; break;
    default: return;
  }

  e.preventDefault();
  if (nextIdx < 0 || nextIdx >= areaList.length) return;

  const nextGlobalIdx = areaList[nextIdx].globalIdx;

  if (e.shiftKey) {
    const anchorStillExists = areaList.some(p => p.globalIdx === shiftAnchorIndex);
    if (!anchorStillExists) {
      shiftAnchorIndex = lastSelectedIndex ?? areaList[idx].globalIdx;
    }

    const anchorIdx = areaList.findIndex(p => p.globalIdx === shiftAnchorIndex);
    const min = Math.min(anchorIdx, nextIdx);
    const max = Math.max(anchorIdx, nextIdx);

    pageList.forEach(p => {
      if (p.area === area) p.selected = false;
    });

    for (let i = min; i <= max; i++) {
      pageList[areaList[i].globalIdx].selected = true;
    }
  } else {
    clearSelection();
    pageList[nextGlobalIdx].selected = true;
    shiftAnchorIndex = null;
  }

  lastSelectedIndex = nextGlobalIdx;
  renderAll();
  updateControls();
});
