#!/usr/bin/env node

// ==== HDR WebUI Simple Logger Daemon ====
// 简化的日志守护进程，专注于监控webui.log文件

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// 简化的守护进程配置
const DAEMON_CONFIG = {
  MODULE_DIR: '/data/adb/modules/enable-hdr-oneplus13-webui',
  LOG_FILE: 'webui.log',
  DAEMON_LOG_FILE: 'logger-daemon.log',
  PID_FILE: 'logger-daemon.pid',

  // 监控间隔
  CHECK_INTERVAL: 10000, // 10秒检查间隔
};

class SimpleDaemon {
  constructor() {
    this.isRunning = false;
    this.pid = process.pid;
    this.startTime = Date.now();
    this.checkInterval = null;

    this.logPaths = {
      main: path.join(DAEMON_CONFIG.MODULE_DIR, DAEMON_CONFIG.LOG_FILE),
      daemon: path.join(DAEMON_CONFIG.MODULE_DIR, DAEMON_CONFIG.DAEMON_LOG_FILE),
      pid: path.join(DAEMON_CONFIG.MODULE_DIR, DAEMON_CONFIG.PID_FILE)
    };

    this.setupSignalHandlers();
  }

  // 设置信号处理
  setupSignalHandlers() {
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      this.logError('守护进程异常', error.message);
    });

    process.on('unhandledRejection', (reason) => {
      this.logError('Promise拒绝', String(reason));
    });
  }

  // 启动守护进程
  async start() {
    try {
      await this.checkAndCreateDirectories();
      await this.writePidFile();

      this.isRunning = true;
      this.startMonitoring();

      await this.logInfo('守护进程启动', {
        pid: this.pid,
        logPath: this.logPaths.main
      });

      console.log(`简单日志守护进程启动，PID: ${this.pid}`);
      console.log(`监控日志文件: ${this.logPaths.main}`);

    } catch (error) {
      console.error('守护进程启动失败:', error);
      process.exit(1);
    }
  }

  // 检查并创建目录
  async checkAndCreateDirectories() {
    try {
      if (!fs.existsSync(DAEMON_CONFIG.MODULE_DIR)) {
        await execAsync(`mkdir -p "${DAEMON_CONFIG.MODULE_DIR}"`);
      }
    } catch (error) {
      console.error('创建目录失败:', error);
      throw error;
    }
  }

  // 写入PID文件
  async writePidFile() {
    try {
      fs.writeFileSync(this.logPaths.pid, this.pid.toString());
    } catch (error) {
      console.error('写入PID文件失败:', error);
      throw error;
    }
  }

  // 开始监控
  startMonitoring() {
    // 定期检查日志文件状态
    this.checkInterval = setInterval(() => {
      this.checkLogFile();
    }, DAEMON_CONFIG.CHECK_INTERVAL);
  }

  // 检查日志文件
  async checkLogFile() {
    try {
      if (fs.existsSync(this.logPaths.main)) {
        const stats = fs.statSync(this.logPaths.main);

        // 只记录文件状态，不做复杂处理
        if (stats.size > 0) {
          await this.logInfo('日志文件状态检查', {
            size: stats.size,
            lastModified: stats.mtime
          });
        }
      } else {
        await this.logInfo('日志文件不存在', { path: this.logPaths.main });
      }
    } catch (error) {
      await this.logError('日志文件检查失败', error.message);
    }
  }

  // 优雅关闭
  async gracefulShutdown(signal) {
    console.log(`收到 ${signal} 信号，正在关闭...`);

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    await this.logInfo('守护进程关闭', {
      signal: signal,
      uptime: Date.now() - this.startTime
    });

    // 删除PID文件
    try {
      if (fs.existsSync(this.logPaths.pid)) {
        fs.unlinkSync(this.logPaths.pid);
      }
    } catch (error) {
      console.error('删除PID文件失败:', error);
    }

    console.log('守护进程关闭完成');
    process.exit(0);
  }

  // 记录信息日志
  async logInfo(message, data = null) {
    await this.writeLog('INFO', message, data);
  }

  // 记录错误日志
  async logError(message, data = null) {
    await this.writeLog('ERROR', message, data);
  }

  // 写入日志
  async writeLog(level, message, data) {
    try {
      const entry = {
        ts: new Date().toISOString(),
        pid: this.pid,
        level: level,
        msg: message,
        data: data
      };

      const line = JSON.stringify(entry) + '\n';

      // 写入守护进程日志文件
      fs.appendFileSync(this.logPaths.daemon, line);

      // 输出到控制台
      if (process.stdout.isTTY) {
        console.log(`[${entry.ts}] [${level}] ${message}`);
      }

    } catch (error) {
      console.error('写入守护进程日志失败:', error);
    }
  }
}

// 检查现有实例
function checkExistingInstance() {
  const pidFile = path.join(DAEMON_CONFIG.MODULE_DIR, DAEMON_CONFIG.PID_FILE);

  if (fs.existsSync(pidFile)) {
    try {
      const existingPid = parseInt(fs.readFileSync(pidFile, 'utf8'));

      try {
        process.kill(existingPid, 0);
        console.error(`守护进程已在运行，PID: ${existingPid}`);
        process.exit(1);
      } catch (error) {
        // 进程不存在，删除过时的PID文件
        fs.unlinkSync(pidFile);
      }
    } catch (error) {
      // PID文件损坏，删除
      fs.unlinkSync(pidFile);
    }
  }
}

// 主函数
async function main() {
  console.log('启动HDR WebUI简单日志守护进程...');

  checkExistingInstance();

  const daemon = new SimpleDaemon();
  await daemon.start();

  // 保持进程运行
  process.stdin.resume();
}

// 直接运行
if (require.main === module) {
  main().catch(error => {
    console.error('守护进程启动失败:', error);
    process.exit(1);
  });
}

module.exports = { SimpleDaemon, DAEMON_CONFIG };