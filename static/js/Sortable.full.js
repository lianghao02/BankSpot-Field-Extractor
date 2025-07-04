
// Sortable Core - 取自 CDN https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js



// SortableMultiDrag Plugin - 使用者上傳的內容


// 掛載 MultiDrag 插件
if (typeof Sortable !== 'undefined' && typeof MultiDrag !== 'undefined') {
  Sortable.mount(new MultiDrag());
}
