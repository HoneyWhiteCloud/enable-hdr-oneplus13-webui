// ==== HDR WebUI main.js — Core Logic Functions ====
// 用法：<script type="module" src="scripts/main.js"></script>
import { exec, spawn, toast } from './assets/kernelsu.js';
import { t, initI18n, applyI18n } from './i18n.js';
import { mergeXMLFiles, checkBackupFiles, getConfigStatus } from './xml-merger.js';
import { uiController, setupDOMContentLoaded, setupWindowEvents } from './ui-controller.js';
import { fileLog, logger, clearLogOnStartup } from './logger-service.js';

const MODULE_DIR    = '/data/adb/modules/enable-hdr-oneplus13-webui';
const APP_LIST_XMLS = [
  `${MODULE_DIR}/appList.xml`,   // 你模块的 XML（大写 L）
];
const LOG_PATH      = `${MODULE_DIR}/webui.log`;
const CACHE_PATH    = `${MODULE_DIR}/app_cache.json`; // 应用名称缓存文件
// 移除 LOG_MAX_BYTES，因为每次启动都会清除日志

// DOM元素获取函数现在由UI控制器提供
const $ = (id) => uiController.$(id);
const listEl   = () => uiController.listEl();
const emptyEl  = () => uiController.emptyEl();
const searchEl = () => uiController.searchEl();
const loadEl   = () => uiController.loadEl();
const countEl  = () => uiController.countEl();

// 状态
let APPS = [];             // [{ pkg, name, apk?, labeled:boolean }]
let APP_MAP = new Map();   // pkg -> app
let SELECTED = new Set();  // 预选集合
let FILTER_Q = '';
let NEED_SORT_SELECTED = false; // 是否需要将已选应用排到前面
let LABEL_CACHE = new Map(); // 内存中的应用名称缓存 pkg -> name
let PERSISTENT_CACHE = new Map(); // 从文件读取的持久化缓存 pkg -> {name, timestamp}
let CACHE_DIRTY = false; // 缓存是否有未保存的更改
let AUTO_SAVE_ENABLED = true; // 是否启用自动保存功能
// IS_FIRST_RENDER 现在由UI控制器管理

// 状态栏管理现在由UI控制器处理
let STATUS_BAR = uiController.STATUS_BAR;

// 超时和失败管理
const MAX_RETRY_COUNT = 3; // 最大尝试次数
const TIMEOUT_MS = 10000; // 10秒总超时
const API_TIMEOUT_MS = 5000; // 单个API调用超时（5秒）
let APP_RETRY_COUNT = new Map(); // pkg -> retry_count
let APP_FIRST_ATTEMPT = new Map(); // pkg -> first_attempt_timestamp
let FAILED_APPS = new Set(); // 记录获取失败的应用

// API超时包装函数
function withTimeout(promise, timeoutMs = API_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('API_TIMEOUT')), timeoutMs)
    )
  ]);
}

// —— 工具 & 日志 ——
const isPromise = (x) => !!x && typeof x.then === 'function';
async function runExec(cmd, opts){
  try { const r = exec(cmd, opts); return isPromise(r) ? await r : r; }
  catch(e){ return { errno: 1, stdout: '', stderr: String(e) }; }
}

// 状态栏更新函数现在由UI控制器处理
function updateStatusBar() {
  uiController.updateStatusBar();
}

// ---------- logging ----------
// 日志管理现在由独立的日志服务处理

// ---------- 持久化缓存管理 ----------
// 初始化缓存文件（如果不存在则创建空文件）
async function initCacheFile(){
  try{
    // 检查文件是否存在
    const checkResult = await runExec(`sh -c '[ -f "${CACHE_PATH}" ] && echo "exists" || echo "not_exists"'`);
    const exists = (checkResult.stdout || '').trim() === 'exists';
    
    if (!exists) {
      await fileLog('cache','init-create',{ path: CACHE_PATH });
      
      // 确保目录存在
      await ensureCacheDir();
      
      // 创建空的缓存文件
      const emptyCache = JSON.stringify({}, null, 2);
      const cmd = `sh -c 'cat > "${CACHE_PATH}" << "EOF"
${emptyCache}
EOF
chmod 0644 "${CACHE_PATH}"'`;
      
      const r = await runExec(cmd);
      if (r.errno === 0) {
        await fileLog('cache','init-success',{ path: CACHE_PATH });
      } else {
        await fileLog('cache','init-error',{ errno: r.errno, stderr: r.stderr, path: CACHE_PATH });
      }
    } else {
      await fileLog('cache','init-exists',{ path: CACHE_PATH });
    }
  }catch(e){
    await fileLog('cache','init-exception',{ error: String(e), path: CACHE_PATH });
  }
}

// 初始化 appList_new.xml 文件（如果不存在则创建空文件）
async function initAppListNewFile(){
  try{
    const APP_LIST_NEW_PATH = `${MODULE_DIR}/appList_new.xml`;
    
    // 检查文件是否存在
    const checkResult = await runExec(`sh -c '[ -f "${APP_LIST_NEW_PATH}" ] && echo "exists" || echo "not_exists"'`);
    const exists = (checkResult.stdout || '').trim() === 'exists';
    
    if (!exists) {
      await fileLog('applist_new','init-create',{ path: APP_LIST_NEW_PATH });
      
      // 确保目录存在
      await ensureCacheDir();
      
      // 创建空的 appList_new.xml 文件
      const emptyContent = '';
      const cmd = `sh -c 'cat > "${APP_LIST_NEW_PATH}" << "EOF"
${emptyContent}
EOF
chmod 0644 "${APP_LIST_NEW_PATH}"'`;
      
      const r = await runExec(cmd);
      if (r.errno === 0) {
        await fileLog('applist_new','init-success',{ path: APP_LIST_NEW_PATH });
      } else {
        await fileLog('applist_new','init-error',{ errno: r.errno, stderr: r.stderr, path: APP_LIST_NEW_PATH });
      }
    } else {
      await fileLog('applist_new','init-exists',{ path: APP_LIST_NEW_PATH });
    }
  }catch(e){
    await fileLog('applist_new','init-exception',{ error: String(e) });
  }
}

// 初始化 appList.xml 文件（如果不存在则创建空文件）
async function initAppListFile(){
  try{
    const APP_LIST_PATH = `${MODULE_DIR}/appList.xml`;
    
    // 检查文件是否存在
    const checkResult = await runExec(`sh -c '[ -f "${APP_LIST_PATH}" ] && echo "exists" || echo "not_exists"'`);
    const exists = (checkResult.stdout || '').trim() === 'exists';
    
    if (!exists) {
      await fileLog('applist','init-create',{ path: APP_LIST_PATH });
      
      // 确保目录存在
      await ensureCacheDir();
      
      // 创建空的 appList.xml 文件
      const emptyContent = '';
      const cmd = `sh -c 'cat > "${APP_LIST_PATH}" << "EOF"
${emptyContent}
EOF
chmod 0644 "${APP_LIST_PATH}"'`;
      
      const r = await runExec(cmd);
      if (r.errno === 0) {
        await fileLog('applist','init-success',{ path: APP_LIST_PATH });
      } else {
        await fileLog('applist','init-error',{ errno: r.errno, stderr: r.stderr, path: APP_LIST_PATH });
      }
    } else {
      await fileLog('applist','init-exists',{ path: APP_LIST_PATH });
    }
  }catch(e){
    await fileLog('applist','init-exception',{ error: String(e) });
  }
}

async function loadPersistentCache(){
  let cacheWasEmpty = true;
  
  try{
    await fileLog('cache','load-start',{ path: CACHE_PATH });
    
    // 首先尝试初始化缓存文件
    await initCacheFile();
    
    const r = await runExec(`sh -c 'cat "${CACHE_PATH}" 2>/dev/null'`);
    const content = (r.stdout || '').trim();
    
    if (!content) {
      await fileLog('cache','load-empty',{ path: CACHE_PATH });
      STATUS_BAR.isFirstTime = true;
      return cacheWasEmpty;
    }

    // 尝试解析 JSON
    try{
      const cacheData = JSON.parse(content);
      let loadedCount = 0;
      
      // 验证数据格式并加载
      if (cacheData && typeof cacheData === 'object') {
        const entries = Object.entries(cacheData);
        if (entries.length > 0) {
          cacheWasEmpty = false;
        }
        
        for (const [pkg, info] of entries) {
          if (info && typeof info === 'object' && info.name && typeof info.name === 'string') {
            PERSISTENT_CACHE.set(pkg, {
              name: info.name,
              timestamp: info.timestamp || Date.now()
            });
            LABEL_CACHE.set(pkg, info.name); // 同时加载到内存缓存
            loadedCount++;
          }
        }
      }
      
      await fileLog('cache','load-success',{ 
        loadedCount, 
        totalEntries: Object.keys(cacheData || {}).length 
      });
      
    }catch(parseError){
      await fileLog('cache','load-parse-error',{ 
        error: String(parseError),
        contentLength: content.length 
      });
      // 解析错误时不抛出异常，继续运行
    }
    
  }catch(readError){
    await fileLog('cache','load-read-error',{ error: String(readError) });
  }
  
  // 设置状态：如果缓存为空则为首次加载，否则需要检查名称变化
  STATUS_BAR.isFirstTime = cacheWasEmpty;
  STATUS_BAR.isChecking = !cacheWasEmpty;
  
  return cacheWasEmpty;
}

// 确保缓存目录存在
async function ensureCacheDir(){
  try{
    // 确保模块目录存在并具有正确权限
    await runExec(`sh -c 'mkdir -p "$(dirname "${CACHE_PATH}")" && chmod 755 "$(dirname "${CACHE_PATH}")"'`);
    return true;
  }catch(e){
    await fileLog('cache','ensure-dir-error',{ error: String(e) });
    return false;
  }
}

// 保存缓存到文件
// 缓存保存锁，防止并发写入
let CACHE_SAVE_LOCK = false;

async function savePersistentCache(){
  if (!CACHE_DIRTY || CACHE_SAVE_LOCK) return; // 没有更改或正在保存则不保存
  
  CACHE_SAVE_LOCK = true;
  
  try{
    await fileLog('cache','save-start',{ cacheSize: PERSISTENT_CACHE.size });
    
    // 确保目录存在
    const dirReady = await ensureCacheDir();
    if (!dirReady) {
      await fileLog('cache','save-abort','Directory not ready');
      return;
    }
    
    // 构建保存对象
    const cacheData = {};
    for (const [pkg, info] of PERSISTENT_CACHE.entries()) {
      cacheData[pkg] = {
        name: info.name,
        timestamp: info.timestamp || Date.now()
      };
    }
    
    // 生成 JSON 内容
    const jsonContent = JSON.stringify(cacheData, null, 2);
    const tempFile = `${CACHE_PATH}.tmp`;
    
    // 写入临时文件，然后原子性地移动到目标位置
    const cmd = `sh -c 'cat > "${tempFile}" << "EOF"
${jsonContent}
EOF
if [ $? -eq 0 ]; then
  mv "${tempFile}" "${CACHE_PATH}" && chmod 0644 "${CACHE_PATH}"
else
  rm -f "${tempFile}" 2>/dev/null || true
  exit 1
fi'`;

    const r = await runExec(cmd);
    
    if (r.errno === 0) {
      CACHE_DIRTY = false; // 标记为已保存
      await fileLog('cache','save-success',{ 
        entriesCount: Object.keys(cacheData).length,
        fileSize: jsonContent.length,
        filePath: CACHE_PATH
      });
    } else {
      await fileLog('cache','save-error',{ 
        errno: r.errno, 
        stderr: r.stderr,
        filePath: CACHE_PATH
      });
    }
    
  }catch(saveError){
    await fileLog('cache','save-exception',{ error: String(saveError) });
  } finally {
    CACHE_SAVE_LOCK = false;
  }
}

// 添加或更新缓存条目
function updateCache(pkg, name) {
  if (!pkg || !name) return;
  
  const existing = PERSISTENT_CACHE.get(pkg);
  const now = Date.now();
  
  // 如果名称发生变化，更新缓存
  if (!existing || existing.name !== name) {
    PERSISTENT_CACHE.set(pkg, {
      name: name,
      timestamp: now
    });
    LABEL_CACHE.set(pkg, name); // 同步到内存缓存
    CACHE_DIRTY = true; // 标记缓存需要保存
    
    // 立即更新UI中的显示
    const row = document.querySelector(`.card[data-pkg="${pkg}"]`);
    if (row) {
      const nameEl = row.querySelector('.name');
      if (nameEl && nameEl.textContent !== name) {
        nameEl.textContent = name;
      }
    }
  }
}

// 批量更新缓存
function batchUpdateCache(updates) {
  let changeCount = 0;
  for (const [pkg, name] of updates.entries()) {
    if (pkg && name) {
      const existing = PERSISTENT_CACHE.get(pkg);
      if (!existing || existing.name !== name) {
        updateCache(pkg, name);
        changeCount++;
      }
    }
  }
  
  if (changeCount > 0) {
    // 在标签获取过程中更频繁地保存，减少用户等待
    setTimeout(() => savePersistentCache(), 500);
  }
}

// 清理缓存中不存在的应用
async function cleanupCache() {
  if (PERSISTENT_CACHE.size === 0) return;
  
  const currentPkgs = new Set(APPS.map(app => app.pkg));
  const cacheKeys = Array.from(PERSISTENT_CACHE.keys());
  let removedCount = 0;
  
  for (const pkg of cacheKeys) {
    if (!currentPkgs.has(pkg)) {
      PERSISTENT_CACHE.delete(pkg);
      LABEL_CACHE.delete(pkg);
      removedCount++;
      CACHE_DIRTY = true;
    }
  }
  
  if (removedCount > 0) {
    await fileLog('cache','cleanup',{ removedCount, remainingCount: PERSISTENT_CACHE.size });
    await savePersistentCache();
  }
}

// 页面退出时保存缓存
function setupCacheAutoSave() {
  // 页面卸载前保存
  window.addEventListener('beforeunload', () => {
    if (CACHE_DIRTY) {
      // 使用 sendBeacon 进行最后的保存尝试
      try {
        savePersistentCache();
      } catch(_) {}
    }
  });
  
  // 页面隐藏时保存
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && CACHE_DIRTY) {
      savePersistentCache();
    }
  });
  
  // 定期保存（每5分钟）
  setInterval(() => {
    if (CACHE_DIRTY) {
      savePersistentCache();
    }
  }, 5 * 60 * 1000);
}
// UI显示控制函数现在由UI控制器处理
function showLoading(show) { uiController.showLoading(show); }
function setCount(sel, total) { uiController.setCount(sel, total); }

// 菜单交互逻辑 - 已移除，使用setupMenuAnimation代替

// ---------- 已选读取/保存 ----------
async function loadSelectedFromXml(){
  const found = new Set();
  
  await fileLog('loadSelected','start',{ paths: APP_LIST_XMLS });

  // 读取文件内容
  for (const p of APP_LIST_XMLS){
    const r = await runExec(`sh -c 'cat "${p}" 2>/dev/null'`);
    const s = (r.stdout||'').trim();
    
    await fileLog('loadSelected','read-file',{ path: p, hasContent: !!s, contentLength: s.length });
    
    if (!s) continue;

    // 直接逐行读取，不使用 XML 解析器
    try{
      const lines = s.split('\n');
      let foundInFile = 0;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 跳过空行和注释行（以 <!-- 开头的行）
        if (!trimmedLine || trimmedLine.startsWith('<!--')) {
          continue;
        }
        
        // 匹配你的格式：<application name="包名"></application>
        const appMatch = trimmedLine.match(/<application\s+name="([^"]+)"\s*><\/application>/);
        if (appMatch && appMatch[1]) {
          const pkg = appMatch[1].trim();
          if (pkg) {
            found.add(pkg);
            foundInFile++;
          }
          continue;
        }
        
        // 兼容旧格式：<app package="包名"/>
        const legacyMatch = trimmedLine.match(/<app\s+package="([^"]+)"\s*\/?\s*>/);
        if (legacyMatch && legacyMatch[1]) {
          const pkg = legacyMatch[1].trim();
          if (pkg) {
            found.add(pkg);
            foundInFile++;
          }
          continue;
        }
        
        // 如果这行看起来像是配置行但没有匹配，记录一下
        if (trimmedLine.includes('application') || trimmedLine.includes('app')) {
          await fileLog('loadSelected','unmatched-line',{ line: trimmedLine });
        }
      }
      
      await fileLog('loadSelected','line-parsed',{ path: p, foundInFile, totalFound: found.size });
      
    }catch(e){
      await fileLog('loadSelected','line-parse-error',{ path: p, error: String(e) });
    }
  }

  SELECTED = found;
  await fileLog('loadSelected','complete',{ totalSelected: SELECTED.size, selectedApps: Array.from(SELECTED) });
}

// 实时保存选中状态到appList.xml和appList_new.xml（不显示toast通知）
async function saveSelectedRealtime(){
  const pkgs = Array.from(SELECTED);
  
  // --- 开始：简化逻辑，保存到 appList.xml ---
  const newLinesOld = [];
  for (const pkg of pkgs) {
    newLinesOld.push(`<application name=\"${pkg}\"></application>`);
  }
  // 不再保留注释的应用，只保存当前选中的应用
  
  const targetOld = `${MODULE_DIR}/appList.xml`;
  const tmpOld = `${targetOld}.tmp`;
  
  let cmdOld;
  if (newLinesOld.length === 0) {
    // 当没有选中应用时，创建真正的空文件
    cmdOld = `sh -c 'touch \"${tmpOld}\" && mv \"${tmpOld}\" \"${targetOld}\" && chmod 0644 \"${targetOld}\"'`;
  } else {
    const payloadOld = newLinesOld.join('\n') + '\n';
    cmdOld =
      `sh -c 'cat > \"${tmpOld}\" << "EOF"\n${payloadOld}EOF\n` +
      `mv \"${tmpOld}\" \"${targetOld}\" && chmod 0644 \"${targetOld}\"'`;
  }
  
  await runExec(cmdOld);
  // --- 结束：旧逻辑 ---

  // --- 开始：简化逻辑，保存到 appList_new.xml ---
  const newLinesNew = [];
  for (const pkg of pkgs) {
    newLinesNew.push(`<app>${pkg}</app>`);
  }
  // 不再保留注释的应用，只保存当前选中的应用

  const targetNew = `${MODULE_DIR}/appList_new.xml`;
  const tmpNew = `${targetNew}.tmp`;

  let cmdNew;
  if (newLinesNew.length === 0) {
    // 当没有选中应用时，创建真正的空文件
    cmdNew = `sh -c 'touch \"${tmpNew}\" && mv \"${tmpNew}\" \"${targetNew}\" && chmod 0644 \"${targetNew}\"'`;
  } else {
    const payloadNew = newLinesNew.join('\n') + '\n';
    cmdNew =
      `sh -c 'cat > \"${tmpNew}\" << "EOF"\n${payloadNew}EOF\n` +
      `mv \"${tmpNew}\" \"${targetNew}\" && chmod 0644 \"${targetNew}\"'`;
  }
  
  const rNew = await runExec(cmdNew);
  // --- 结束：新逻辑 ---

  await fileLog('saveRealtime','result',{
    errno: rNew.errno,
    selectedCount: pkgs.length,
    commentedCount: 0, // 不再保留注释应用
    format: 'dual-file'
  });
  
  if (rNew.errno !== 0) {
    await fileLog('saveRealtime','error',{ stderr: rNew.stderr });
  } else {
    // 保存成功后自动执行XML合并
    try {
      await fileLog('saveRealtime','xml-merge-start');
      const mergeResult = await mergeXMLFiles();
      await fileLog('saveRealtime','xml-merge-result', mergeResult);
    } catch (error) {
      await fileLog('saveRealtime','xml-merge-error', { error: String(error) });
    }
  }
}

async function saveSelected() {
  const pkgs = Array.from(SELECTED);
  
  // --- 开始：简化逻辑，保存到 appList.xml ---
  const newLinesOld = [];
  for (const pkg of pkgs) {
    newLinesOld.push(`<application name=\"${pkg}\"></application>`);
  }
  // 不再保留注释的应用，只保存当前选中的应用
  
  const targetOld = `${MODULE_DIR}/appList.xml`;
  const tmpOld = `${targetOld}.tmp`;
  
  let cmdOld;
  if (newLinesOld.length === 0) {
    // 当没有选中应用时，创建真正的空文件
    cmdOld = `sh -c 'touch \"${tmpOld}\" && mv \"${tmpOld}\" \"${targetOld}\" && chmod 0644 \"${targetOld}\"'`;
  } else {
    const payloadOld = newLinesOld.join('\n') + '\n';
    cmdOld =
      `sh -c 'cat > \"${tmpOld}\" << "EOF"\n${payloadOld}EOF\n` +
      `mv \"${tmpOld}\" \"${targetOld}\" && chmod 0644 \"${targetOld}\"'`;
  }
  
  await runExec(cmdOld);
  // --- 结束：旧逻辑 ---

// --- 开始：简化逻辑，保存到 appList_new.xml ---
const newLinesNew = [];
for (const pkg of pkgs) {
  newLinesNew.push(`<app>${pkg}</app>`);
}
// 不再保留注释的应用，只保存当前选中的应用

const targetNew = `${MODULE_DIR}/appList_new.xml`;
const tmpNew = `${targetNew}.tmp`;

let cmdNew;
if (newLinesNew.length === 0) {
  // 当没有选中应用时，创建真正的空文件
  cmdNew = `sh -c 'touch \"${tmpNew}\" && mv \"${tmpNew}\" \"${targetNew}\" && chmod 0644 \"${targetNew}\"'`;
} else {
  const payloadNew = newLinesNew.join('\n') + '\n';
  cmdNew =
    `sh -c 'cat > \"${tmpNew}\" << "EOF"\n${payloadNew}EOF\n` +
    `mv \"${tmpNew}\" \"${targetNew}\" && chmod 0644 \"${targetNew}\"'`;
}
  
const rNew = await runExec(cmdNew);
  // --- 结束：新逻辑 ---


  // --- 统一的日志和 UI 反馈 ---
  // 这里可以只用新文件的保存结果来决定是否成功
  await fileLog('save','result',{
    errno: rNew.errno,
    selectedCount: pkgs.length,
    commentedCount: 0, // 不再保留注释应用
    format: 'dual-file'
  });
  
  if (rNew.errno === 0) {
    // 保存成功后自动执行XML合并
    try {
      await fileLog('save','xml-merge-start');
      const mergeResult = await mergeXMLFiles();
      await fileLog('save','xml-merge-result', mergeResult);
      
      // 手动保存时显示提示
      toast(t('savedToastNeedsReboot'));
      NEED_SORT_SELECTED = true;
      render(APPS);
    } catch (error) {
      await fileLog('save','xml-merge-error', { error: String(error) });
      toast(t('saveFailed'));
    }
  } else {
    toast(t('saveFailed'));
    await fileLog('save','error',{ stderr: rNew.stderr });
  }
}

// ---------- ABI & aapt 检测（仅在真的需要时才调用） ----------
let AAPT_PATH = '';
async function detectAbi(){
  const r = await runExec(`getprop ro.product.cpu.abilist || getprop ro.product.cpu.abi`);
  const s = (r.stdout||'').toLowerCase();
  if (s.includes('arm64')) return 'arm64-v8a';
  if (s.includes('armeabi-v7a')) return 'armeabi-v7a';
  return 'arm64-v8a';
}
async function ensureAapt(){
  if (AAPT_PATH) return AAPT_PATH;
  const abi = await detectAbi();
  const cand = `${MODULE_DIR}/bin/${abi}/aapt`;
  await runExec(`sh -c '[ -f "${cand}" ] && chmod 0755 "${cand}" || true'`);
  const ok = await runExec(`sh -c '[ -x "${cand}" ] && echo ok || echo no'`);
  if ((ok.stdout||'').trim()==='ok'){ AAPT_PATH = cand; }
  else {
    const r2 = await runExec(`sh -c 'which aapt 2>/dev/null || which aapt2 2>/dev/null || true'`);
    AAPT_PATH = (r2.stdout||'').trim().split('\n')[0] || '';
  }
  await fileLog('aapt','detect',{ path: AAPT_PATH || null });
  return AAPT_PATH;
}

// ---------- 列包（首屏"快"）：只拿包名，先渲染，再懒加载名称 ——
async function listPackagesFast(){
  const cmds = [
    'pm list packages -3',
    'cmd package list packages -3',
    '/system/bin/pm list packages -3',
    '/system/bin/cmd package list packages -3',
  ];
  for (const c of cmds){
    const r = await runExec(c);
    await fileLog('pm','run',{ cmd:c, errno:r.errno, len:(r.stdout||'').length });
    if (r.errno===0 && r.stdout){
      return r.stdout.split('\n').map(s=>s.replace(/^package:/,'').trim()).filter(Boolean);
    }
  }
  return [];
}

// ---------- 快速通道拿应用名（同步优先，异步为备选） ——
function fastLabelByAPI(pkg){
  // 优先检查持久化缓存
  if (PERSISTENT_CACHE.has(pkg)) {
    const cached = PERSISTENT_CACHE.get(pkg);
    LABEL_CACHE.set(pkg, cached.name); // 同步到内存缓存
    return cached.name;
  }
  
  // 再检查内存缓存
  if (LABEL_CACHE.has(pkg)) {
    return LABEL_CACHE.get(pkg);
  }
  
  let label = null;
  
  // 尝试同步API调用（KernelSU）
  try{
    if (typeof window.ksu?.getPackagesInfo === 'function'){
      const info = JSON.parse(window.ksu.getPackagesInfo(`[${pkg}]`));
      if (info?.[0]?.appLabel) {
        label = String(info[0].appLabel);
      }
    }
  }catch(e){
    // KernelSU API 失败时静默处理
  }
  
  // 尝试同步API调用（PackageManager）
  if (!label) {
    try{
      if (typeof window.$packageManager !== 'undefined'){
        const ai = window.$packageManager.getApplicationInfo(pkg, 0, 0);
        const labelResult = ai?.getLabel?.();
        if (labelResult) {
          label = String(labelResult);
        }
      }
    }catch(e){
      // PackageManager API 失败时静默处理
    }
  }
  
  // 如果获取到标签，更新缓存
  if (label) {
    updateCache(pkg, label);
  }
  
  return label;
}

// 异步版本的快速API调用（带超时保护）
async function fastLabelByAPIAsync(pkg){
  // 先尝试同步版本
  const syncResult = fastLabelByAPI(pkg);
  if (syncResult) return syncResult;
  
  let label = null;
  
  try{
    // KernelSU API with timeout
    if (typeof window.ksu?.getPackagesInfo === 'function'){
      const apiCall = new Promise((resolve) => {
        try {
          const info = JSON.parse(window.ksu.getPackagesInfo(`[${pkg}]`));
          resolve(info?.[0]?.appLabel ? String(info[0].appLabel) : null);
        } catch(e) {
          resolve(null);
        }
      });
      label = await withTimeout(apiCall, 3000);
    }
  }catch(e){
    if (e.message !== 'API_TIMEOUT') {
      await fileLog('api','ksu-error',{ pkg, error: String(e) });
    }
  }
  
  if (!label) {
    try{
      // PackageManager API with timeout
      if (typeof window.$packageManager !== 'undefined'){
        const apiCall = new Promise((resolve) => {
          try {
            const ai = window.$packageManager.getApplicationInfo(pkg, 0, 0);
            const labelResult = ai?.getLabel?.();
            resolve(labelResult ? String(labelResult) : null);
          } catch(e) {
            resolve(null);
          }
        });
        label = await withTimeout(apiCall, 3000);
      }
    }catch(e){
      if (e.message !== 'API_TIMEOUT') {
        await fileLog('api','pm-error',{ pkg, error: String(e) });
      }
    }
  }
  
  if (label) {
    updateCache(pkg, label);
  }
  
  return label;
}

// 批量获取应用信息
async function batchGetLabels(pkgs) {
  const results = new Map();
  const toFetch = [];
  
  // 先从缓存中获取已有的标签
  for (const pkg of pkgs) {
    if (PERSISTENT_CACHE.has(pkg)) {
      const cached = PERSISTENT_CACHE.get(pkg);
      results.set(pkg, cached.name);
      LABEL_CACHE.set(pkg, cached.name); // 同步到内存
    } else if (LABEL_CACHE.has(pkg)) {
      results.set(pkg, LABEL_CACHE.get(pkg));
    } else {
      toFetch.push(pkg);
    }
  }
  
  // 只为未缓存的包获取标签
  if (toFetch.length > 0) {
    try {
      if (typeof window.ksu?.getPackagesInfo === 'function' && toFetch.length > 1) {
        const pkgArray = JSON.stringify(toFetch);
        const infos = JSON.parse(window.ksu.getPackagesInfo(pkgArray));
        if (Array.isArray(infos)) {
          const cacheUpdates = new Map();
          infos.forEach((info, index) => {
            if (info?.appLabel && toFetch[index]) {
              const label = String(info.appLabel);
              results.set(toFetch[index], label);
              cacheUpdates.set(toFetch[index], label);
            }
          });
          
          // 批量更新缓存和状态
          if (cacheUpdates.size > 0) {
            batchUpdateCache(cacheUpdates);
            // 更新状态栏（如果有应用被标记）
            STATUS_BAR.labeledApps += cacheUpdates.size;
            updateStatusBar();
          }
        }
      }
    } catch(e) {
      // 失败时逐个尝试快速API
      for (const pkg of toFetch) {
        const label = fastLabelByAPI(pkg);
        if (label) {
          results.set(pkg, label);
        }
      }
    }
  }
  
  return results;
}

// ---------- 慢通道（只对出现在视口的项尝试）：pm path → aapt → dumpsys —— 
async function getApkPath(pkg){
  try {
    const r = await withTimeout(
      runExec(`sh -c 'pm path "${pkg}" | grep -m 1 "base.apk" | cut -d: -f2'`),
      3000 // 3秒超时
    );
    return (r.stdout||'').trim();
  } catch(e) {
    return '';
  }
}
async function labelByAapt(pkg){
  try {
    const apk = await getApkPath(pkg);
    if (!apk) return '';
    const aapt = await ensureAapt();
    if (!aapt) return '';
    
    const r = await withTimeout(
      runExec(`sh -c '${aapt} dump badging "${apk}" 2>/dev/null | grep -m 1 "application-label"'`),
      5000 // 5秒超时
    );
    
    if (r.errno===0 && r.stdout) {
      const label = parseAaptLabel(r.stdout);
      if (label) {
        updateCache(pkg, label); // 更新缓存
      }
      return label;
    }
  } catch(e) {
    if (e.message !== 'API_TIMEOUT') {
      await fileLog('api','aapt-error',{ pkg, error: String(e) });
    }
  }
  return '';
}

async function labelByDump(pkg){
  const tries = [ `dumpsys package "${pkg}"`, `pm dump "${pkg}"` ];
  for (const cmd of tries){
    try {
      const r = await withTimeout(runExec(cmd), 4000); // 4秒超时
      if (r.errno===0 && r.stdout){
        let m = r.stdout.match(/application-label:\s*(.*)/);
        if (m && m[1]) {
          const label = m[1].trim();
          updateCache(pkg, label); // 更新缓存
          return label;
        }
        m = r.stdout.match(/label=([^\n]+)/);
        if (m && m[1]) {
          const label = m[1].trim();
          updateCache(pkg, label); // 更新缓存
          return label;
        }
      }
    } catch(e) {
      if (e.message !== 'API_TIMEOUT') {
        await fileLog('api','dump-error',{ pkg, cmd, error: String(e) });
      }
      // 继续尝试下一个命令
    }
  }
  return '';
}

// 解析 aapt 输出的应用标签
function parseAaptLabel(output) {
  const match = output.match(/application-label:'([^']+)'/);
  return match ? match[1] : '';
}

// ---------- 快速首屏 + 并发补齐 ----------
const LABEL_QUEUE = [];
const LABEL_DONE  = new Set();
let   LABEL_RUNNING = 0;
const LABEL_CONCURRENCY = 32; // 恢复32个并发

async function labelWorker(){
  if (LABEL_RUNNING >= LABEL_CONCURRENCY) return;
  LABEL_RUNNING++;
  try{
    while (LABEL_QUEUE.length){
      const app = LABEL_QUEUE.shift();
      if (!app) continue;

      // 检查是否已经失败过或者已经标记过
      if (FAILED_APPS.has(app.pkg) || app.labeled) {
        // 使用传统命名方式
        if (!app.labeled) {
          const tail = app.pkg.split('.').pop() || app.pkg;
          const fallbackName = tail.charAt(0).toUpperCase() + tail.slice(1);
          app.name = fallbackName;
          app.labeled = true;
          
          const row = document.querySelector(`.card[data-pkg="${app.pkg}"]`);
          if (row){
            const nameEl = row.querySelector('.name');
            if (nameEl) nameEl.textContent = fallbackName;
          }
          
          STATUS_BAR.labeledApps++;
          updateStatusBar();
        }
        continue;
      }

      // 首先检查缓存（持久化和内存）
      let label = null;
      let fromCache = false;
      if (PERSISTENT_CACHE.has(app.pkg)) {
        const cached = PERSISTENT_CACHE.get(app.pkg);
        label = cached.name;
        LABEL_CACHE.set(app.pkg, label); // 同步到内存缓存
        fromCache = true;
      } else if (LABEL_CACHE.has(app.pkg)) {
        label = LABEL_CACHE.get(app.pkg);
        fromCache = true;
      }

      // 如果缓存中没有，尝试获取
      if (!label) {
        const now = Date.now();
        const currentRetryCount = APP_RETRY_COUNT.get(app.pkg) || 0;
        
        // 记录首次尝试时间
        if (!APP_FIRST_ATTEMPT.has(app.pkg)) {
          APP_FIRST_ATTEMPT.set(app.pkg, now);
        }
        
        const firstAttemptTime = APP_FIRST_ATTEMPT.get(app.pkg);
        const totalElapsed = now - firstAttemptTime;
        
        // 检查是否应该标记为失败：超过重试次数 OR 超过总时间限制
        if (currentRetryCount >= MAX_RETRY_COUNT || totalElapsed > TIMEOUT_MS) {
          // 标记为失败并使用传统命名
          FAILED_APPS.add(app.pkg);
          STATUS_BAR.failedApps++;
          
          const tail = app.pkg.split('.').pop() || app.pkg;
          const fallbackName = tail.charAt(0).toUpperCase() + tail.slice(1);
          app.name = fallbackName;
          app.labeled = true;
          
          const row = document.querySelector(`.card[data-pkg="${app.pkg}"]`);
          if (row){
            const nameEl = row.querySelector('.name');
            if (nameEl) nameEl.textContent = fallbackName;
          }
          
          STATUS_BAR.labeledApps++;
          updateStatusBar();
          
          const failureReason = currentRetryCount >= MAX_RETRY_COUNT ? 'max_retries' : 'timeout';
          await fileLog('label','failed',{ 
            pkg: app.pkg, 
            retryCount: currentRetryCount, 
            totalElapsed: totalElapsed,
            reason: failureReason,
            fallbackName: fallbackName 
          });
          
          // 清理相关记录
          APP_RETRY_COUNT.delete(app.pkg);
          APP_FIRST_ATTEMPT.delete(app.pkg);
          continue;
        }
        
        APP_RETRY_COUNT.set(app.pkg, currentRetryCount + 1);
        
        // 快速通道先试（一般足够快）
        label = fastLabelByAPI(app.pkg);

        // 慢通道只在必要时使用，增加超时处理
        if (!label) {
          try {
            label = await Promise.race([
              labelByAapt(app.pkg),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
            ]);
          } catch (e) {
            // AAPT超时，尝试dumpsys
            if (!label) {
              try {
                label = await Promise.race([
                  labelByDump(app.pkg),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
                ]);
              } catch (e2) {
                // 两个方法都超时，标记为失败
                label = null;
              }
            }
          }
        }
      }

      if (label){
        // 只要获取到标签就立即标记为完成
        app.name = label;
        app.labeled = true;
        // 成功获取到标签，清除重试计数和时间记录
        APP_RETRY_COUNT.delete(app.pkg);
        APP_FIRST_ATTEMPT.delete(app.pkg);
        
        const row = document.querySelector(`.card[data-pkg="${app.pkg}"]`);
        if (row){
          const nameEl = row.querySelector('.name');
          if (nameEl) nameEl.textContent = label;
        }
        
        // 如果标签是新获取的（不是从缓存来的），更新缓存
        if (!fromCache) {
          updateCache(app.pkg, label);
        }
        
        STATUS_BAR.labeledApps++;
        updateStatusBar();
        
        // 每获取20个标签就保存一次缓存，减少并发冲突
        if (STATUS_BAR.labeledApps % 20 === 0) {
          setTimeout(() => periodicCacheSave(), 500);
        }
      } else if (!app.labeled) {
        // 没有获取到标签，将其重新加入队列等待重试（无论是否来自缓存）
        const currentRetryCount = APP_RETRY_COUNT.get(app.pkg) || 0;
        if (currentRetryCount < MAX_RETRY_COUNT) {
          // 检查应用是否已经在队列中，避免重复
          if (!LABEL_QUEUE.find(queueApp => queueApp.pkg === app.pkg)) {
            LABEL_QUEUE.push(app);
          }
        } else {
          // 超过重试次数，使用fallback名称
          const tail = app.pkg.split('.').pop() || app.pkg;
          const fallbackName = tail.charAt(0).toUpperCase() + tail.slice(1);
          app.name = fallbackName;
          app.labeled = true;
          
          const row = document.querySelector(`.card[data-pkg="${app.pkg}"]`);
          if (row) {
            const nameEl = row.querySelector('.name');
            if (nameEl) nameEl.textContent = fallbackName;
          }
          
          FAILED_APPS.add(app.pkg);
          STATUS_BAR.failedApps++;
          STATUS_BAR.labeledApps++;
          updateStatusBar();
          
          await fileLog('label','fallback',{ pkg: app.pkg, fallbackName: fallbackName, retryCount: currentRetryCount });
        }
      }
      
      await fileLog('label','update',{ pkg: app.pkg, got: !!label, fromCache: fromCache, retryCount: APP_RETRY_COUNT.get(app.pkg) || 0 });
    }
  } finally {
    LABEL_RUNNING--;
    // 检查是否所有标签都已完成
    setTimeout(checkLabelingComplete, 100);
    
    // 确保如果队列中还有项目，继续启动worker
    if (LABEL_QUEUE.length > 0 && LABEL_RUNNING < LABEL_CONCURRENCY) {
      setTimeout(() => runLabelWorkers(), 200);
    }
  }
}

// 队列去重函数
function deduplicateQueue() {
  if (LABEL_QUEUE.length === 0) return; // 队列为空时直接返回
  
  const seen = new Set();
  const uniqueQueue = [];
  
  for (const app of LABEL_QUEUE) {
    if (app && app.pkg && !seen.has(app.pkg) && !app.labeled) {
      seen.add(app.pkg);
      uniqueQueue.push(app);
    }
  }
  
  LABEL_QUEUE.length = 0; // 清空后再填入去重的结果
  LABEL_QUEUE.push(...uniqueQueue);
}

// 定义 runLabelWorkers 函数
function runLabelWorkers(){
  deduplicateQueue(); // 去重
  // 这个函数会启动多个 worker 来并发处理所有未标记的应用
  while (LABEL_QUEUE.length > 0 && LABEL_RUNNING < LABEL_CONCURRENCY) {
    labelWorker();
  }
}

// 检查标签匹配是否完成
function checkLabelingComplete() {
  const allAppsLabeled = APPS.every(app => app.labeled);
  const noWorkersRunning = LABEL_RUNNING === 0;
  const queueEmpty = LABEL_QUEUE.length === 0;
  
  if (allAppsLabeled && noWorkersRunning && queueEmpty && !STATUS_BAR.isCompleted) {
    STATUS_BAR.isCompleted = true;
    STATUS_BAR.isFirstTime = false;
    STATUS_BAR.isChecking = false;
    STATUS_BAR.showStuckTip = false;
    
    // 清理提示定时器
    if (STATUS_BAR.stuckTipTimer) {
      clearTimeout(STATUS_BAR.stuckTipTimer);
      STATUS_BAR.stuckTipTimer = null;
    }
    
    updateStatusBar();
    
    // 延迟显示完成状态后，切换到实用提示
    const completionDelay = 3000; // 固定3秒显示完成状态
    setTimeout(() => {
      const statusTextEl = document.getElementById('statusText');
      if (statusTextEl && STATUS_BAR.isCompleted) {
        // 切换到实用提示信息
        statusTextEl.textContent = t('statusRealtimeTip');
        statusTextEl.style.opacity = '0.7'; // 稍微降低透明度表示这是提示信息
      }
    }, completionDelay);
  }
}

// 死锁检测和恢复机制
let lastProgressCount = 0;
let lastProgressTime = Date.now();
let deadlockCheckInterval = null;

function setupDeadlockDetection() {
  // 每5秒检查一次是否有死锁
  deadlockCheckInterval = setInterval(async () => {
    if (STATUS_BAR.isCompleted) {
      clearInterval(deadlockCheckInterval);
      return;
    }
    
    const currentProgress = STATUS_BAR.labeledApps;
    const now = Date.now();
    
    // 如果10秒内进度没有变化，认为可能存在死锁
    if (currentProgress === lastProgressCount) {
      if (now - lastProgressTime > 10000) { // 10秒无进展
        await handleDeadlock();
      }
    } else {
      // 进度有变化，更新记录
      lastProgressCount = currentProgress;
      lastProgressTime = now;
    }
    
    // 检查是否有未标记的应用但队列为空的情况
    const unlabeledApps = APPS.filter(app => !app.labeled);
    if (unlabeledApps.length > 0 && LABEL_QUEUE.length === 0 && LABEL_RUNNING === 0) {
      await fileLog('recovery','missing-apps',{ 
        unlabeledCount: unlabeledApps.length,
        missingApps: unlabeledApps.slice(0, 5).map(app => app.pkg) // 记录前5个
      });
      
      // 重新将未标记的应用加入队列（避免重复）
      const missingApps = unlabeledApps.filter(app => 
        !LABEL_QUEUE.find(queueApp => queueApp.pkg === app.pkg)
      );
      LABEL_QUEUE.push(...missingApps);
      runLabelWorkers();
    }
    
    // 检查单个应用是否处理时间过长
    await checkStuckApps();
    
    // 确保worker持续运行
    runLabelWorkers();
    
  }, 5000); // 5秒检查一次
}

async function handleDeadlock() {
  await fileLog('deadlock','detected',{ 
    labeledApps: STATUS_BAR.labeledApps, 
    totalApps: STATUS_BAR.totalApps,
    queueLength: LABEL_QUEUE.length,
    runningWorkers: LABEL_RUNNING
  });
  
  // 强制失败队列中最老的几个应用，更积极处理
  const stuckApps = LABEL_QUEUE.splice(0, Math.min(10, LABEL_QUEUE.length));
  for (const app of stuckApps) {
    if (!app.labeled) {
      FAILED_APPS.add(app.pkg);
      STATUS_BAR.failedApps++;
      
      const tail = app.pkg.split('.').pop() || app.pkg;
      const fallbackName = tail.charAt(0).toUpperCase() + tail.slice(1);
      app.name = fallbackName;
      app.labeled = true;
      
      const row = document.querySelector(`.card[data-pkg="${app.pkg}"]`);
      if (row) {
        const nameEl = row.querySelector('.name');
        if (nameEl) nameEl.textContent = fallbackName;
      }
      
      STATUS_BAR.labeledApps++;
      
      await fileLog('deadlock','force-failed',{ 
        pkg: app.pkg, 
        fallbackName: fallbackName 
      });
    }
  }
  
  updateStatusBar();
  
  // 重新启动workers
  setTimeout(() => {
    runLabelWorkers();
  }, 1000);
}

async function checkStuckApps() {
  const now = Date.now();
  const stuckApps = [];
  
  // 检查处理时间过长的应用
  for (const [pkg, startTime] of APP_FIRST_ATTEMPT.entries()) {
    if (now - startTime > 45000 && !FAILED_APPS.has(pkg)) { // 45秒还未完成
      stuckApps.push(pkg);
    }
  }
  
  // 强制标记为失败
  for (const pkg of stuckApps) {
    const app = APP_MAP.get(pkg);
    if (app && !app.labeled) {
      FAILED_APPS.add(pkg);
      STATUS_BAR.failedApps++;
      
      const tail = pkg.split('.').pop() || pkg;
      const fallbackName = tail.charAt(0).toUpperCase() + tail.slice(1);
      app.name = fallbackName;
      app.labeled = true;
      
      const row = document.querySelector(`.card[data-pkg="${pkg}"]`);
      if (row) {
        const nameEl = row.querySelector('.name');
        if (nameEl) nameEl.textContent = fallbackName;
      }
      
      STATUS_BAR.labeledApps++;
      
      // 清理记录
      APP_RETRY_COUNT.delete(pkg);
      APP_FIRST_ATTEMPT.delete(pkg);
      
      await fileLog('deadlock','stuck-app-failed',{ 
        pkg, 
        totalElapsed: now - APP_FIRST_ATTEMPT.get(pkg), 
        fallbackName 
      });
    }
  }
  
  if (stuckApps.length > 0) {
    updateStatusBar();
  }
}

// 定期保存缓存的函数
async function periodicCacheSave() {
  if (CACHE_DIRTY) {
    await savePersistentCache();
  }
}

// 设置定期保存缓存
function setupPeriodicCacheSave() {
  // 每30秒检查一次是否需要保存缓存
  setInterval(periodicCacheSave, 30000);
}

// ---------- IntersectionObserver 初始化 ——
let OBSERVER = null;
function initObserver() {
  OBSERVER = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const pkg = e.target.getAttribute('data-pkg');
        const app = APP_MAP.get(pkg);
        if (app && !app.labeled) {
          LABEL_QUEUE.push(app);
          runLabelWorkers();
        }
      }
    }
  }, { root: null, rootMargin: '100px', threshold: 0 });
}

// 渲染应用列表现在由UI控制器处理
function render(apps) {
  const result = uiController.render(apps, SELECTED, NEED_SORT_SELECTED, OBSERVER);
  if (result && result.NEED_SORT_SELECTED !== undefined) {
    NEED_SORT_SELECTED = result.NEED_SORT_SELECTED;
  }

  // 重新绑定复选框事件
  uiController.bindCheckboxEvents(APPS, SELECTED, AUTO_SAVE_ENABLED, saveSelectedRealtime);
}

// ---------- 过滤 ----------
function applyFilter(){
  FILTER_Q = uiController.applyFilter(APPS, FILTER_Q, render);
}

// ---------- 初始化 ----------
async function init(){
  // 初始化国际化
  initI18n();
  applyI18n();

  // 每次启动时清除旧日志
  await clearLogOnStartup();

  await fileLog('init','start',{ ua:(navigator?.userAgent)||'', url:(location?.href)||'' });

  // 初始化状态栏
  updateStatusBar();

  showLoading(true);
  try{
    // 1) 确保必要的文件存在（app_cache.json、appList.xml 和 appList_new.xml）
    await initCacheFile();
    await initAppListFile();
    await initAppListNewFile();

    // 2) 先加载持久化缓存（这会设置isFirstTime和isChecking状态）
    const cacheWasEmpty = await loadPersistentCache();
    updateStatusBar();

    // 3) 读取预勾选（XML）
    await loadSelectedFromXml();

    // 4) 秒拿包名并渲染（标题优先用缓存，否则用包名尾段）
    const pkgs = await listPackagesFast();
    APPS = pkgs.map(pkg => {
      let name;
      if (PERSISTENT_CACHE.has(pkg)) {
        // 优先使用缓存中的名称
        name = PERSISTENT_CACHE.get(pkg).name;
        LABEL_CACHE.set(pkg, name); // 同步到内存缓存
        return { pkg, name, labeled: true }; // 标记为已标记
      } else {
        // 否则使用包名尾段
        const tail = pkg.split('.').pop() || pkg;
        name = tail.charAt(0).toUpperCase() + tail.slice(1);
        return { pkg, name, labeled: false };
      }
    });

    // 更新应用映射和状态栏总数
    APPS.forEach(app => APP_MAP.set(app.pkg, app));
    STATUS_BAR.totalApps = APPS.length;
    STATUS_BAR.labeledApps = APPS.filter(app => app.labeled).length;
    // 初始化进度跟踪时间
    STATUS_BAR.lastProgressTime = Date.now();
    STATUS_BAR.lastLabeledCount = STATUS_BAR.labeledApps;
    updateStatusBar();

    // 5) 重新加载时需要排序
    NEED_SORT_SELECTED = true;

    // 6) 初始化Observer和渲染列表
    initObserver();
    render(APPS);

    // 7) UI控制器设置菜单和搜索框交互（最高优先级，防止阻塞）
    await fileLog('menu','setup-start');
    try {
      await uiController.setupMenuInteractions();
      await fileLog('menu','setup-success');
    } catch(e) {
      await fileLog('menu','setup-error',{ error: String(e) });
    }

    // 8) 异步批量获取前50个未缓存应用的名称（不阻塞用户操作）
    setTimeout(async () => {
      const unlabeledApps = APPS.filter(app => !app.labeled);
      const firstBatch = unlabeledApps.slice(0, 50);
      if (firstBatch.length > 0) {
        try {
          const batchLabels = await batchGetLabels(firstBatch.map(a => a.pkg));
          
          // 应用批量获取的结果
          firstBatch.forEach(app => {
            if (batchLabels.has(app.pkg)) {
              app.name = batchLabels.get(app.pkg);
              app.labeled = true;
            }
          });
          
          // 更新显示和状态栏
          STATUS_BAR.labeledApps = APPS.filter(app => app.labeled).length;
          updateStatusBar();
          render(APPS); // 重新渲染以显示更新的应用名称
        } catch(e) {
          await fileLog('batchLabels','error',{ error: String(e) });
        }
      }
    }, 100); // 非常短的延迟，让菜单先设置

    // 9) 延迟处理剩余未标记的应用（低优先级）
    setTimeout(() => {
      const remaining = APPS.filter(app => !app.labeled);
      if (remaining.length > 0) {
        LABEL_QUEUE.push(...remaining);
        runLabelWorkers();
      }
    }, 500); // 延迟500ms，让菜单优先设置
    
    // 10) 对于前100个应用中未缓存的，尝试快速API（更低优先级）
    setTimeout(async () => {
      const quickBatch = APPS.slice(0, 100).filter(app => !app.labeled);
      const cacheUpdates = new Map();
      
      for (const app of quickBatch) {
        const label = fastLabelByAPI(app.pkg);
        if (label && label !== app.name) {
          app.name = label;
          app.labeled = true;
          cacheUpdates.set(app.pkg, label);
          
          // 立即更新UI
          const row = document.querySelector(`.card[data-pkg="${app.pkg}"]`);
          if (row) {
            const nameEl = row.querySelector('.name');
            if (nameEl) nameEl.textContent = label;
          }
        }
      }
      
      // 批量更新缓存和状态
      if (cacheUpdates.size > 0) {
        batchUpdateCache(cacheUpdates);
        // 注意：这里不需要再次更新STATUS_BAR.labeledApps，因为在updateCache中会处理
        updateStatusBar();
      }
      
    }, 500); // 500ms后开始快速标记，确保菜单优先设置
    
    const cachedCount = APPS.filter(app => app.labeled).length;
    await fileLog('init','first-render',{ 
      count: APPS.length, 
      preselected: SELECTED.size, 
      cachedCount: cachedCount,
      uncachedCount: APPS.length - cachedCount
    });
    
    // 11) 设置缓存自动保存和清理
    setupCacheAutoSave();
    setupPeriodicCacheSave(); // 设置定期保存缓存
    
    // 12) 清理缓存中不存在的应用（延迟执行，避免阻塞UI）
    setTimeout(() => cleanupCache(), 5000);
    
    // 13) 设置定期检查标签完成状态
    const completionCheckInterval = setInterval(() => {
      checkLabelingComplete();
      if (STATUS_BAR.isCompleted) {
        clearInterval(completionCheckInterval);
      }
    }, 1000);
    
    // 初始检查（如果所有应用都已从缓存加载）
    setTimeout(checkLabelingComplete, 500);
    
    // 启动死锁检测机制
    setupDeadlockDetection();
    
  }catch(e){
    await fileLog('init','error',{ error: String(e) });
  }finally{
    showLoading(false);
    await fileLog('init','complete');
  }

  
  // 绑定应用操作按钮事件
  const sa = $('selectAll');
  if (sa) {
    const selectAllHandler = async () => {
      APPS.forEach(a=>SELECTED.add(a.pkg));
      applyFilter();
      // 实时保存到XML文件
      if (AUTO_SAVE_ENABLED) {
        await saveSelectedRealtime();
      }
      toast(t('selectAllComplete'));
    };
    sa.addEventListener('click', selectAllHandler);
  }

  const da = $('deselectAll');
  if (da) {
    const deselectAllHandler = async () => {
      SELECTED.clear();
      applyFilter();
      // 实时保存到XML文件
      if (AUTO_SAVE_ENABLED) {
        await saveSelectedRealtime();
      }
      toast(t('deselectAllComplete'));
    };
    da.addEventListener('click', deselectAllHandler);
  }

  const sv = $('save');
  if (sv) {
    const saveHandler = async () => {
      await saveSelected();
    };
    sv.addEventListener('click', saveHandler);
  }

  const rb = $('reboot');
  if (rb) {
    const rebootHandler = async () => {
      // 显示确认对话框
      if (confirm(t('rebootConfirm'))) {
        try {
          // 执行重启命令，不显示toast因为用户看不到
          await runExec('reboot');
        } catch (error) {
          toast(t('rebootFailed') + ': ' + error.message);
        }
      }
    };
    rb.addEventListener('click', rebootHandler);
  }

  // 设置UI控制器的回调函数
  uiController.setCallbacks({
    applyFilter: applyFilter,
    reload: async () => {
      NEED_SORT_SELECTED = true;
      await init();
    }
  });
}

// UI相关函数现在由UI控制器处理

// 全屏和布局控制现在由UI控制器处理

// UI组件和事件处理现在由UI控制器和新的初始化逻辑处理

// 新的页面加载事件处理
setupDOMContentLoaded(() => {
  // 1. 立即初始化UI组件和布局，不等待数据加载
  uiController.setupUIComponents();

  // 2. 异步初始化数据和其他功能
  init();
});

// 设置窗口事件
setupWindowEvents(uiController);
