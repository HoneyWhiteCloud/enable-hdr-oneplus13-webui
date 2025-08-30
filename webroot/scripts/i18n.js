// Simple i18n
let LANG = 'auto'; // 'auto'|'zh-Hans'|'zh-Hant'|'en'
const LS_KEY = 'hdr_webui_lang';

const dict = {
  'zh-Hans': {
    title: 'HDR 应用选择器',
    moduleLabel: '模块',
    searchPlaceholder: '搜索（包名 / 应用名）',
    loading: '载入中',
    selectAll: '全选',
    deselectAll: '全不选',
    refresh: '刷新列表',
    reload: '重新载入',
    save: '保存',
    saveConfig: '保存配置',
    reboot: '重启手机',
    rebootConfirm: '确定要重启手机吗？\n\n重启后请等待设备完全启动。',
    rebootFailed: '重启失败',
    toolsMenu: '工具菜单',
    savedToastNeedsReboot: '保存成功，请重启设备生效',
    saveFailed: '保存失败',
    selectAllComplete: '全选完成，请重启设备生效',
    deselectAllComplete: '全不选完成，请重启设备生效',
    emptyList: '没有找到匹配的应用',
    selectedCount: ({sel,total}) => `已选 ${sel} / 共 ${total}`,
    // 状态栏相关
    statusInitializing: '初始化中...',
    statusFirstTimeMatching: ({labeledApps, totalApps}) => `首次启动，正在匹配APP名称，请稍后…（${labeledApps}/${totalApps}）`,
    statusFirstTimeMatchingNoCount: '首次启动，正在匹配APP名称，请稍后…',
    statusCheckingChanges: ({labeledApps, totalApps}) => `正在检查APP名称是否有更变…（${labeledApps}/${totalApps}）`,
    statusCheckingChangesNoCount: '正在检查APP名称是否有更变…',
    statusAllComplete: '所有APP名称匹配完毕！',
    statusCompleteWithFailed: ({failedApps}) => `所有APP名称匹配完毕！有${failedApps}个APP无法获取到其名称，已改用其包名最后一单词作为其名称`,
    statusRealtimeTip: '勾选/取消勾选的APP会实时保存，无需手动保存（重启生效）',
    langAuto: '跟随系统',
    langZhHans: '中文（简体）',
    langZhHant: '中文（繁體／台灣）',
    langEn: 'English',
  },
  'zh-Hant': {
    title: 'HDR 應用選擇器',
    moduleLabel: '模組',
    searchPlaceholder: '搜尋（套件名／應用名）',
    loading: '載入中',
    selectAll: '全選',
    deselectAll: '全不選',
    refresh: '重新整理',
    reload: '重新載入',
    save: '儲存',
    saveConfig: '儲存設定',
    reboot: '重新開機',
    rebootConfirm: '確定要重新開機嗎？\n\n重新開機後請等待設備完全啟動。',
    rebootFailed: '重新開機失敗',
    toolsMenu: '工具選單',
    savedToastNeedsReboot: '儲存成功，請重新開機套用',
    saveFailed: '儲存失敗',
    selectAllComplete: '全選完成，請重新開機套用',
    deselectAllComplete: '全不選完成，請重新開機套用',
    emptyList: '沒有符合的應用',
    selectedCount: ({sel,total}) => `已選 ${sel}／共 ${total}`,
    // 狀態列相關
    statusInitializing: '初始化中...',
    statusFirstTimeMatching: ({labeledApps, totalApps}) => `首次啟動，正在比對APP名稱，請稍候…（${labeledApps}/${totalApps}）`,
    statusFirstTimeMatchingNoCount: '首次啟動，正在比對APP名稱，請稍候…',
    statusCheckingChanges: ({labeledApps, totalApps}) => `正在檢查APP名稱是否有變更…（${labeledApps}/${totalApps}）`,
    statusCheckingChangesNoCount: '正在檢查APP名稱是否有變更…',
    statusAllComplete: '所有APP名稱比對完畢！',
    statusCompleteWithFailed: ({failedApps}) => `所有APP名稱比對完畢！有${failedApps}個APP無法取得其名稱，已改用其套件名最後一詞作為其名稱`,
    statusRealtimeTip: '勾選／取消勾選的APP會即時儲存，無需手動儲存（重新開機套用）',
    langAuto: '跟隨系統',
    langZhHans: '中文（簡體）',
    langZhHant: '中文（繁體／台灣）',
    langEn: 'English',
  },
  'en': {
    title: 'HDR App Picker',
    moduleLabel: 'Module',
    searchPlaceholder: 'Search (package / app name)',
    loading: 'Loading',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    refresh: 'Refresh',
    reload: 'Reload',
    save: 'Save',
    saveConfig: 'Save Config',
    reboot: 'Reboot Device',
    rebootConfirm: 'Are you sure you want to reboot the device?\n\nPlease wait for the device to boot completely after reboot.',
    rebootFailed: 'Reboot failed',
    toolsMenu: 'Tools Menu',
    savedToastNeedsReboot: 'Saved successfully. Please reboot to take effect.',
    saveFailed: 'Save failed',
    selectAllComplete: 'All selected. Please reboot to take effect.',
    deselectAllComplete: 'All deselected. Please reboot to take effect.',
    emptyList: 'No matching apps',
    selectedCount: ({sel,total}) => `Selected ${sel} / ${total}`,
    // Status bar related
    statusInitializing: 'Initializing...',
    statusFirstTimeMatching: ({labeledApps, totalApps}) => `First launch, matching app names, please wait... (${labeledApps}/${totalApps})`,
    statusFirstTimeMatchingNoCount: 'First launch, matching app names, please wait...',
    statusCheckingChanges: ({labeledApps, totalApps}) => `Checking for app name changes... (${labeledApps}/${totalApps})`,
    statusCheckingChangesNoCount: 'Checking for app name changes...',
    statusAllComplete: 'All app names matched successfully!',
    statusCompleteWithFailed: ({failedApps}) => `All app names matched! ${failedApps} apps could not retrieve their names, fallback to package name used`,
    statusRealtimeTip: 'Checked/unchecked apps are saved in real-time, no manual save needed (reboot to take effect)',
    langAuto: 'System default',
    langZhHans: 'Chinese (Simplified)',
    langZhHant: 'Chinese (Traditional, Taiwan)',
    langEn: 'English',
  }
};

function detectLang(){
  const saved = localStorage.getItem(LS_KEY);
  if (saved) return saved;
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  const low = (nav||'').toLowerCase();
  if (low.startsWith('zh')){
    if (low.includes('hant') || low.includes('tw') || low.includes('hk') || low.includes('mo')) return 'zh-Hant';
    return 'zh-Hans';
  }
  return 'en';
}

export function initI18n(){
  LANG = detectLang();
}

export function setLang(newLang){
  LANG = newLang;
  if (newLang==='auto'){
    localStorage.removeItem(LS_KEY);
  }else{
    localStorage.setItem(LS_KEY, newLang);
  }
  applyI18n();
}

export function onLangChange(sel){
  sel.addEventListener('change', ()=>{
    setLang(sel.value);
  });
}

export function t(key, vars){
  const d = dict[LANG==='auto'? detectLang() : LANG] || dict['en'];
  const val = d[key];
  if (typeof val === 'function') return val(vars||{});
  return val || key;
}

export function applyI18n(){
  // Buttons and labels by id if present
  const elTitle = document.querySelector('h1');
  if (elTitle) elTitle.textContent = t('title');
  const badge = document.querySelector('.badge');
  if (badge) {
    const text = badge.textContent;
    const parts = text.split('：');
    const suffix = parts.length>1? parts.slice(1).join('：') : text;
    badge.textContent = `${t('moduleLabel')}：${suffix}`;
  }
  const search = document.getElementById('search');
  if (search) search.placeholder = t('searchPlaceholder');
  const loadingTxt = document.querySelector('#loading span');
  if (loadingTxt) loadingTxt.textContent = t('loading');
  
  // Menu items
  const toolsMenuTitle = document.querySelector('.menu-title');
  if (toolsMenuTitle) toolsMenuTitle.textContent = t('toolsMenu');
  
  // Menu buttons - using querySelector for more reliable selection
  const reloadBtn = document.querySelector('#reload .menu-text');
  if (reloadBtn) reloadBtn.textContent = t('reload');
  const selectAllBtn = document.querySelector('#selectAll .menu-text'); 
  if (selectAllBtn) selectAllBtn.textContent = t('selectAll');
  const deselectAllBtn = document.querySelector('#deselectAll .menu-text'); 
  if (deselectAllBtn) deselectAllBtn.textContent = t('deselectAll');
  const saveBtn = document.querySelector('#save .menu-text'); 
  if (saveBtn) saveBtn.textContent = t('saveConfig');
  const rebootBtn = document.querySelector('#reboot .menu-text');
  if (rebootBtn) rebootBtn.textContent = t('reboot');
  
  // Legacy support for old IDs (if they exist without .menu-text)
  const selAll = document.getElementById('selectAll'); 
  if (selAll && !selAll.querySelector('.menu-text')) selAll.textContent = t('selectAll');
  const deselAll = document.getElementById('deselectAll'); 
  if (deselAll && !deselAll.querySelector('.menu-text')) deselAll.textContent = t('deselectAll');
  const refresh = document.getElementById('refresh'); 
  if (refresh) refresh.textContent = t('refresh');
  const reload = document.getElementById('reload'); 
  if (reload && !reload.querySelector('.menu-text')) reload.textContent = t('reload');
  const save = document.getElementById('save'); 
  if (save && !save.querySelector('.menu-text')) save.textContent = t('save');
  
  // Empty state can be updated during render() via t('emptyList')
  const emptyEl = document.getElementById('empty');
  if (emptyEl) emptyEl.textContent = `📱 ${t('emptyList')}`;
  
  // Title tag
  const headTitle = document.querySelector('title'); 
  if (headTitle) headTitle.textContent = `${t('title')} · enable-hdr-oneplus13-webui`;
  
  // Language selector (labels set in index.html options)
  const count = document.getElementById('count'); 
  if (count && count.textContent) { /* will be updated by counter */ }
}