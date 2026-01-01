// ==== XML Merger for HDR WebUI ====
// 负责将 appList.xml 和 appList_new.xml 中的应用动态合并到系统配置文件
import { exec } from './assets/kernelsu.js';

const MODULE_DIR = '/data/adb/modules/enable-hdr-oneplus13-webui';
const BACKUP_DIR = `${MODULE_DIR}/backup`;

// 文件路径配置
const FILES = {
  appList: `${MODULE_DIR}/appList.xml`,
  appListNew: `${MODULE_DIR}/appList_new.xml`,
  featureConfigBackup: `${BACKUP_DIR}/multimedia_display_feature_config.xml`,
  uirConfigBackup: `${BACKUP_DIR}/multimedia_display_uir_config.xml`,
  featureConfigModule: `${MODULE_DIR}/multimedia_display_feature_config.xml`,
  uirConfigModule: `${MODULE_DIR}/multimedia_display_uir_config.xml`
};

// ColorOS 版本缓存
let cachedColorOSVersion = null;

// 日志功能
function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [XML-MERGER] [${level}] ${message}`);
}

// 执行命令的包装函数
async function runCommand(cmd) {
  try {
    const result = await exec(cmd);
    if (result.errno !== 0) {
      throw new Error(`命令执行失败: ${result.stderr}`);
    }
    return result.stdout;
  } catch (error) {
    log('ERROR', `命令执行失败: ${cmd}, 错误: ${error.message}`);
    throw error;
  }
}

// 读取文件内容
async function readFile(filePath) {
  try {
    const result = await exec(`cat "${filePath}"`);
    if (result.errno !== 0) {
      throw new Error(`无法读取文件: ${filePath}`);
    }
    return result.stdout;
  } catch (error) {
    log('WARN', `读取文件失败: ${filePath}, ${error.message}`);
    return null;
  }
}

// 写入文件内容
async function writeFile(filePath, content) {
  try {
    // 使用 echo 写入文件，处理特殊字符
    const escapedContent = content.replace(/'/g, "'\"'\"'");
    await runCommand(`echo '${escapedContent}' > "${filePath}"`);
    log('SUCCESS', `文件写入成功: ${filePath}`);
    return true;
  } catch (error) {
    log('ERROR', `文件写入失败: ${filePath}, ${error.message}`);
    return false;
  }
}

// 解析应用列表文件
function parseAppList(xmlContent, format = 'feature') {
  const apps = [];

  // 检查内容是否为空或仅包含空白字符
  if (!xmlContent || !xmlContent.trim()) {
    log('DEBUG', `解析到 0 个应用 (格式: ${format}, 文件为空)`);
    return apps;
  }

  let regex;
  if (format === 'feature') {
    // 解析 appList.xml 格式: <application name="pkg.name"></application>
    regex = /<application\s+name="([^"]+)"[^>]*>/g;
  } else {
    // 解析 appList_new.xml 格式: <app>pkg.name</app>
    regex = /<app>([^<]+)<\/app>/g;
  }

  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    const pkgName = match[1].trim();
    if (pkgName) {
      apps.push(pkgName);
    }
  }

  log('DEBUG', `解析到 ${apps.length} 个应用 (格式: ${format})`);
  return apps;
}

// ========== ColorOS 版本检测 ==========

// 通过 getprop 检测 ColorOS 版本
async function detectColorOSVersionByProp() {
  try {
    const result = await exec('getprop persist.sys.oplus.ota_ver_display');
    const versionString = (result.stdout || '').trim();

    if (versionString) {
      log('INFO', `检测到系统版本信息: ${versionString}`);
      // 提取版本号，例如 "PJZ110_16.0.2.403(CN01V121P04)" 中的 "16"
      const match = versionString.match(/_(\d+)\./);
      if (match && match[1]) {
        const majorVersion = parseInt(match[1]);
        log('INFO', `解析系统版本: ColorOS ${majorVersion}`);
        return majorVersion;
      }
    }
  } catch (error) {
    log('WARN', `通过 getprop 检测版本失败: ${error.message}`);
  }
  return null;
}

// 通过 XML 文件格式检测 ColorOS 版本
function detectXMLFormat(xmlContent) {
  if (!xmlContent) return null;

  // ColorOS 16 特征：使用 <supportApp> 标签
  if (xmlContent.includes('<supportApp>')) {
    log('INFO', '检测到 <supportApp> 标签，判断为 ColorOS 16 格式');
    return 16;
  }

  // ColorOS 15 特征：使用 <application name=""> 标签 + HdrVision/OplusDolbyVision
  if (xmlContent.includes('<application name=') &&
      (xmlContent.includes('HdrVision') || xmlContent.includes('OplusDolbyVision'))) {
    log('INFO', '检测到 <application name=""> 标签和 HdrVision/OplusDolbyVision，判断为 ColorOS 15 格式');
    return 15;
  }

  log('WARN', '无法通过 XML 格式确定 ColorOS 版本');
  return null;
}

// 获取 ColorOS 版本（优先使用缓存）
async function getColorOSVersion(backupContent) {
  if (cachedColorOSVersion !== null) {
    log('DEBUG', `使用缓存的版本: ColorOS ${cachedColorOSVersion}`);
    return cachedColorOSVersion;
  }

  // 方法1：通过 getprop 检测
  let version = await detectColorOSVersionByProp();

  // 方法2：如果 getprop 失败，通过 XML 文件格式检测
  if (version === null && backupContent) {
    version = detectXMLFormat(backupContent);
  }

  // 默认为 ColorOS 15（向后兼容）
  if (version === null) {
    log('WARN', '无法检测 ColorOS 版本，默认使用 ColorOS 15 格式');
    version = 15;
  }

  cachedColorOSVersion = version;
  return version;
}

// ========== ColorOS 16 兼容函数 ==========

// 解析 ColorOS 16 格式的现有应用（使用 <supportApp> 标签）
function parseExistingAppsC16(xmlContent, featureName) {
  const existingApps = new Set();
  if (!xmlContent) return existingApps;

  // 查找特定 feature 区块
  const featureRegex = new RegExp(`<feature\\s+name="${featureName}"[^>]*>([\\s\\S]*?)<\\/feature>`, 'i');
  const featureMatch = xmlContent.match(featureRegex);

  if (featureMatch) {
    const featureContent = featureMatch[1];
    // 提取所有 supportApp 元素
    const appRegex = /<supportApp>([^<]+)<\/supportApp>/g;
    let match;

    while ((match = appRegex.exec(featureContent)) !== null) {
      const pkgName = match[1].trim();
      if (pkgName) {
        existingApps.add(pkgName);
      }
    }
  }

  log('DEBUG', `从 ${featureName} (C16) 中解析到 ${existingApps.size} 个现有应用`);
  return existingApps;
}

// 合并 ColorOS 16 格式的 feature 配置文件
function mergeFeatureConfigC16(backupContent, newApps) {
  if (!backupContent) {
    log('ERROR', '备份文件内容为空');
    return null;
  }

  let mergedContent = backupContent;

  // ColorOS 16 使用 HdrGeneric feature
  const featureName = 'HdrGeneric';

  const existingApps = parseExistingAppsC16(backupContent, featureName);
  const featureRegex = new RegExp(`(<feature\\s+name="${featureName}"[^>]*>[\\s\\S]*?)<\\/feature>`, 'i');

  const match = mergedContent.match(featureRegex);
  if (match) {
    const featureStart = match[1];
    let newFeatureContent = featureStart;

    // 添加新应用（避免重复）
    let addedCount = 0;
    newApps.forEach(pkgName => {
      if (!existingApps.has(pkgName)) {
        newFeatureContent += `\n            <supportApp>${pkgName}</supportApp>`;
        addedCount++;
      }
    });

    newFeatureContent += '\n        </feature>';

    // 替换原来的 feature 区块
    mergedContent = mergedContent.replace(featureRegex, newFeatureContent);

    log('INFO', `${featureName} (C16): 保留 ${existingApps.size} 个现有应用，新增 ${addedCount} 个应用`);
  } else {
    log('WARN', `未找到 ${featureName} feature，可能不支持 ColorOS 16 格式`);
  }

  return mergedContent;
}

// 解析现有的feature配置，提取现有应用
function parseExistingApps(xmlContent, featureName) {
  const existingApps = new Map(); // pkg -> full element
  if (!xmlContent) return existingApps;

  // 查找特定feature区块
  const featureRegex = new RegExp(`<feature\\s+name="${featureName}"[^>]*>([\\s\\S]*?)<\\/feature>`, 'i');
  const featureMatch = xmlContent.match(featureRegex);
  
  if (featureMatch) {
    const featureContent = featureMatch[1];
    // 提取所有application元素
    const appRegex = /<application\s+name="([^"]+)"[^>]*(?:\/>|>[^<]*<\/application>)/g;
    let match;
    
    while ((match = appRegex.exec(featureContent)) !== null) {
      const pkgName = match[1];
      const fullElement = match[0];
      existingApps.set(pkgName, fullElement);
    }
  }

  log('DEBUG', `从 ${featureName} 中解析到 ${existingApps.size} 个现有应用`);
  return existingApps;
}

// 合并feature配置文件
function mergeFeatureConfig(backupContent, newApps) {
  if (!backupContent) {
    log('ERROR', '备份文件内容为空');
    return null;
  }

  let mergedContent = backupContent;

  // 处理 HdrVision 和 OplusDolbyVision 两个特性
  const features = ['HdrVision', 'OplusDolbyVision'];

  features.forEach(featureName => {
    const existingApps = parseExistingApps(backupContent, featureName);
    const featureRegex = new RegExp(`(<feature\\s+name="${featureName}"[^>]*>[\\s\\S]*?)<\\/feature>`, 'i');
    
    const match = mergedContent.match(featureRegex);
    if (match) {
      const featureStart = match[1];
      let newFeatureContent = featureStart;
      
      // 添加新应用（避免重复）
      newApps.forEach(pkgName => {
        if (!existingApps.has(pkgName)) {
          newFeatureContent += `\n            <application name="${pkgName}"></application>`;
        }
      });
      
      newFeatureContent += '\n        </feature>';
      
      // 替换原来的feature区块
      mergedContent = mergedContent.replace(featureRegex, newFeatureContent);
      
      log('INFO', `${featureName}: 保留 ${existingApps.size} 个现有应用，新增 ${newApps.filter(pkg => !existingApps.has(pkg)).length} 个应用`);
    }
  });

  return mergedContent;
}

// 解析现有的UIR配置，提取现有应用
function parseExistingUIRApps(xmlContent) {
  const existingApps = new Set();
  if (!xmlContent) return existingApps;

  // 查找app_list区块
  const appListRegex = /<app_list>([\s\S]*?)<\/app_list>/i;
  const match = xmlContent.match(appListRegex);
  
  if (match) {
    const appListContent = match[1];
    // 提取所有app元素
    const appRegex = /<app>([^<]+)<\/app>/g;
    let appMatch;
    
    while ((appMatch = appRegex.exec(appListContent)) !== null) {
      existingApps.add(appMatch[1]);
    }
  }

  log('DEBUG', `从UIR配置中解析到 ${existingApps.size} 个现有应用`);
  return existingApps;
}

// 合并UIR配置文件
function mergeUIRConfig(backupContent, newApps) {
  if (!backupContent) {
    log('ERROR', 'UIR备份文件内容为空');
    return null;
  }

  const existingApps = parseExistingUIRApps(backupContent);
  
  // 查找并替换app_list区块
  const appListRegex = /(<app_list>[\s\S]*?)(<\/app_list>)/i;
  const match = backupContent.match(appListRegex);
  
  if (match) {
    let newAppListContent = match[1];
    
    // 添加新应用（避免重复）
    newApps.forEach(pkgName => {
      if (!existingApps.has(pkgName)) {
        newAppListContent += `\n\t\t\t<app>${pkgName}</app>`;
      }
    });
    
    newAppListContent += '\n\t\t';
    
    // 替换原来的app_list区块
    const mergedContent = backupContent.replace(appListRegex, newAppListContent + match[2]);
    
    log('INFO', `UIR配置: 保留 ${existingApps.size} 个现有应用，新增 ${newApps.filter(pkg => !existingApps.has(pkg)).length} 个应用`);
    return mergedContent;
  }

  log('ERROR', '未找到UIR配置中的app_list区块');
  return null;
}

// 测试删除功能的辅助函数
export async function testDelete() {
  log('INFO', '测试删除功能...');
  try {
    await runCommand(`rm -f "${FILES.featureConfigModule}"`);
    await runCommand(`rm -f "${FILES.uirConfigModule}"`);
    log('SUCCESS', '测试删除成功');
    return { success: true, message: '测试删除成功' };
  } catch (error) {
    log('ERROR', `测试删除失败: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// 主要的合并函数
export async function mergeXMLFiles() {
  try {
    log('INFO', '开始执行XML文件合并');

    // 1. 读取应用列表文件
    log('INFO', '读取应用列表文件...');
    const appListContent = await readFile(FILES.appList);
    const appListNewContent = await readFile(FILES.appListNew);

    // 2. 解析应用列表（即使文件为空也继续处理）
    const featureApps = parseAppList(appListContent, 'feature');
    const uirApps = parseAppList(appListNewContent, 'uir');
    
    log('INFO', `解析结果: feature应用${featureApps.length}个, UIR应用${uirApps.length}个`);

    // 3. 读取备份文件
    log('INFO', '读取备份文件...');
    const featureBackupContent = await readFile(FILES.featureConfigBackup);
    const uirBackupContent = await readFile(FILES.uirConfigBackup);

    // 3.5 检测 ColorOS 版本
    const colorOSVersion = await getColorOSVersion(featureBackupContent);
    log('INFO', `当前系统版本: ColorOS ${colorOSVersion}`);

    let successCount = 0;
    let errorCount = 0;

    // 4. 处理feature配置文件
    log('DEBUG', `feature应用数量: ${featureApps.length}, 备份文件存在: ${!!featureBackupContent}`);
    if (featureApps.length === 0) {
      // 没有应用时，删除配置文件
      log('INFO', `删除feature配置文件 (无选中应用): ${FILES.featureConfigModule}`);
      try {
        await runCommand(`rm -f "${FILES.featureConfigModule}"`);
        successCount++;
        log('SUCCESS', 'feature配置文件已删除');
      } catch (error) {
        errorCount++;
        log('ERROR', `删除feature配置文件失败: ${error.message}`);
      }
    } else if (featureBackupContent) {
      // 有应用时，根据 ColorOS 版本选择合并策略
      log('INFO', `合并feature配置文件 (${featureApps.length} 个应用, ColorOS ${colorOSVersion})...`);

      let mergedFeatureContent;
      if (colorOSVersion >= 16) {
        // ColorOS 16 使用新的合并方法
        mergedFeatureContent = mergeFeatureConfigC16(featureBackupContent, featureApps);
      } else {
        // ColorOS 15 使用原有的合并方法
        mergedFeatureContent = mergeFeatureConfig(featureBackupContent, featureApps);
      }

      if (mergedFeatureContent && await writeFile(FILES.featureConfigModule, mergedFeatureContent)) {
        successCount++;
        log('SUCCESS', `feature配置文件合并完成 (${featureApps.length} 个应用, ColorOS ${colorOSVersion})`);
      } else {
        errorCount++;
        log('ERROR', 'feature配置文件合并失败');
      }
    } else {
      log('WARN', '跳过feature配置文件合并 (无备份文件)');
    }

    // 5. 处理UIR配置文件
    log('DEBUG', `UIR应用数量: ${uirApps.length}, 备份文件存在: ${!!uirBackupContent}`);
    if (uirApps.length === 0) {
      // 没有应用时，删除配置文件
      log('INFO', `删除UIR配置文件 (无选中应用): ${FILES.uirConfigModule}`);
      try {
        await runCommand(`rm -f "${FILES.uirConfigModule}"`);
        successCount++;
        log('SUCCESS', 'UIR配置文件已删除');
      } catch (error) {
        errorCount++;
        log('ERROR', `删除UIR配置文件失败: ${error.message}`);
      }
    } else if (uirBackupContent) {
      // 有应用时，合并配置文件
      log('INFO', `合并UIR配置文件 (${uirApps.length} 个应用)...`);
      const mergedUIRContent = mergeUIRConfig(uirBackupContent, uirApps);
      
      if (mergedUIRContent && await writeFile(FILES.uirConfigModule, mergedUIRContent)) {
        successCount++;
        log('SUCCESS', `UIR配置文件合并完成 (${uirApps.length} 个应用)`);
      } else {
        errorCount++;
        log('ERROR', 'UIR配置文件合并失败');
      }
    } else {
      log('WARN', '跳过UIR配置文件合并 (无备份文件)');
    }

    // 6. 返回结果
    const message = `合并完成：${successCount} 个文件成功，${errorCount} 个文件失败 (ColorOS ${colorOSVersion})`;
    log('INFO', message);

    return {
      success: errorCount === 0,
      message: message,
      details: {
        colorOSVersion: colorOSVersion,
        featureAppsCount: featureApps.length,
        uirAppsCount: uirApps.length,
        successCount,
        errorCount
      }
    };

  } catch (error) {
    const errorMessage = `XML合并过程发生错误: ${error.message}`;
    log('ERROR', errorMessage);
    return {
      success: false,
      message: errorMessage,
      error: error.message
    };
  }
}

// 检查备份文件是否存在
export async function checkBackupFiles() {
  const checks = {};
  
  for (const [key, path] of Object.entries(FILES)) {
    if (key.includes('Backup')) {
      const content = await readFile(path);
      checks[key] = {
        exists: !!content,
        path: path,
        size: content ? content.length : 0
      };
    }
  }
  
  return checks;
}

// 获取当前配置文件状态
export async function getConfigStatus() {
  const status = {};
  
  const moduleFiles = [
    { key: 'featureConfig', path: FILES.featureConfigModule },
    { key: 'uirConfig', path: FILES.uirConfigModule }
  ];
  
  for (const file of moduleFiles) {
    const content = await readFile(file.path);
    status[file.key] = {
      exists: !!content,
      path: file.path,
      size: content ? content.length : 0,
      lastModified: content ? new Date().toISOString() : null
    };
  }
  
  return status;
}