// ==== HDR WebUI Simple Logger ====
// 简单的日志服务，专注于监控主代码运行和WebUI显示状态
// 每次启动覆盖webui.log文件，独立运行记录崩溃信息

import { exec } from './assets/kernelsu.js';

// 简化的日志配置
const LOG_CONFIG = {
  MODULE_DIR: '/data/adb/modules/enable-hdr-oneplus13-webui',
  ENABLE_CONSOLE: true
};

// 日志文件路径
const LOG_PATH = `${LOG_CONFIG.MODULE_DIR}/webui.log`;

class SimpleLogger {
  constructor() {
    this.isRunning = false;
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();

    this.init();
  }

  // 生成会话ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 初始化简单日志系统
  async init() {
    try {
      await this.initLogFile();
      this.startMonitoring();
      await this.writeLog('SERVICE', 'WebUI日志系统启动', {
        sessionId: this.sessionId,
        startTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('日志系统初始化失败:', error);
    }
  }

  // 初始化日志文件（每次启动覆盖）
  async initLogFile() {
    try {
      // 确保目录存在
      await this.runExec(`mkdir -p "${LOG_CONFIG.MODULE_DIR}"`);

      // 覆盖创建新的日志文件
      await this.runExec(`echo "" > "${LOG_PATH}"`);

      console.log('日志文件已初始化:', LOG_PATH);
    } catch (error) {
      console.error('日志文件初始化失败:', error);
    }
  }

  // 开始监控主代码和WebUI状态
  startMonitoring() {
    if (this.isRunning) return;

    this.isRunning = true;

    // 监听页面卸载
    window.addEventListener('beforeunload', () => {
      this.writeLog('SERVICE', 'WebUI关闭', { sessionId: this.sessionId });
    });

    // 监听全局错误 - 主代码崩溃检测
    window.addEventListener('error', (event) => {
      this.writeLog('ERROR', '主代码错误', {
        message: event.error?.message || event.message,
        filename: event.filename,
        lineno: event.lineno,
        stack: event.error?.stack
      });
    });

    // 监听Promise拒绝 - 异步错误检测
    window.addEventListener('unhandledrejection', (event) => {
      this.writeLog('ERROR', '未处理的Promise拒绝', {
        reason: String(event.reason),
        stack: event.reason?.stack
      });
    });

    console.log('WebUI监控系统已启动');
  }

  // 记录WebUI显示状态
  logUIStatus(status, details) {
    this.writeLog('UI_STATUS', status, details);
  }

  // 记录主代码运行状态
  logMainCode(stage, status, data = null) {
    this.writeLog('MAIN_CODE', `${stage}: ${status}`, data);
  }

  // 主要日志写入方法
  async writeLog(stage, message, data = null) {
    try {
      const entry = {
        ts: new Date().toISOString(),
        sessionId: this.sessionId,
        stage: stage || '',
        msg: message || '',
        data: data === undefined ? null : data
      };

      // 控制台输出
      if (LOG_CONFIG.ENABLE_CONSOLE) {
        console.log(`[${entry.ts}] [${entry.stage}] ${entry.msg}`);
      }

      // 写入文件
      const line = JSON.stringify(entry) + '\n';
      await this.writeToFile(line);

    } catch (error) {
      console.error('日志写入失败:', error);
    }
  }

  // 写入文件
  async writeToFile(content) {
    try {
      const escapedContent = this.escapeShellString(content);
      await this.runExec(`sh -c 'printf "%s" "${escapedContent}" >> "${LOG_PATH}"'`);
    } catch (error) {
      console.error(`写入日志文件失败 ${LOG_PATH}:`, error);
    }
  }

  // 转义shell字符串
  escapeShellString(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  // 执行shell命令
  async runExec(cmd, opts = {}) {
    try {
      const result = exec(cmd, opts);
      return typeof result?.then === 'function' ? await result : result;
    } catch (error) {
      return { errno: 1, stdout: '', stderr: String(error) };
    }
  }

  // 获取简单统计信息
  getStats() {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
      isRunning: this.isRunning,
      logPath: LOG_PATH
    };
  }
}

// 创建全局日志服务实例
const simpleLogger = new SimpleLogger();

// 导出兼容的日志接口
export async function fileLog(stage, msg, data) {
  return simpleLogger.writeLog(stage, msg, data);
}

// 导出主要监控接口
export const logger = {
  debug: (stage, msg, data) => simpleLogger.writeLog('DEBUG', `${stage}: ${msg}`, data),
  info: (stage, msg, data) => simpleLogger.writeLog('INFO', `${stage}: ${msg}`, data),
  warn: (stage, msg, data) => simpleLogger.writeLog('WARN', `${stage}: ${msg}`, data),
  error: (stage, msg, data) => simpleLogger.writeLog('ERROR', `${stage}: ${msg}`, data),
  logUIStatus: (status, details) => simpleLogger.logUIStatus(status, details),
  logMainCode: (stage, status, data) => simpleLogger.logMainCode(stage, status, data),
  getStats: () => simpleLogger.getStats()
};

// 导出日志服务实例
export { simpleLogger };

// 向全局对象添加日志接口
if (typeof window !== 'undefined') {
  window.simpleLogger = simpleLogger;
  window.logger = logger;
}

// 导出清理函数（兼容性）
export async function clearLogOnStartup() {
  return Promise.resolve();
}

export default simpleLogger;