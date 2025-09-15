// ==== HDR WebUI UI Controller ====
// UI控制和页面显示相关功能分离模块
// 用法：import { UIController } from './ui-controller.js';

import { t } from './i18n.js';
import { toast } from './assets/kernelsu.js';
import { logger } from './logger-service.js';

// UI控制器类
export class UIController {
  constructor() {
    // 状态栏管理
    this.STATUS_BAR = {
      totalApps: 0,
      labeledApps: 0,
      isFirstTime: false,
      isChecking: false,
      isCompleted: false,
      failedApps: 0,
      showStuckTip: false,
      stuckTipTimer: null,
      startTime: null,
      lastProgressTime: null,
      lastLabeledCount: 0
    };

    // 全屏控制状态
    this.isFullscreenSupported = false;
    this.isFullscreenActive = false;

    // 滚动动画状态
    this.lastScrollY = window.scrollY;
    this.isScrolling = false;
    this.scrollTimeout = null;
    this.scrollThreshold = 40;

    // 标记是否为首次渲染
    this.IS_FIRST_RENDER = true;

    // 初始化UI控制器
    this.init();
  }

  // 初始化UI控制器
  init() {
    this.checkFullscreenSupport();
    this.setupFullscreenListeners();
  }

  // DOM元素快速获取
  $ = (id) => document.getElementById(id);
  listEl = () => document.getElementById('list') || document.getElementById('applist');
  emptyEl = () => document.getElementById('empty');
  searchEl = () => document.getElementById('search');
  loadEl = () => document.getElementById('loading');
  countEl = () => document.getElementById('count');

  // 状态栏更新函数
  updateStatusBar() {
    const statusTextEl = document.getElementById('statusText');
    if (!statusTextEl) return;

    const now = Date.now();

    // 检查进度是否有更新
    if (this.STATUS_BAR.labeledApps !== this.STATUS_BAR.lastLabeledCount) {
      this.STATUS_BAR.lastLabeledCount = this.STATUS_BAR.labeledApps;
      this.STATUS_BAR.lastProgressTime = now;

      // 进度有更新，清除之前的提示和定时器
      if (this.STATUS_BAR.showStuckTip) {
        this.STATUS_BAR.showStuckTip = false;
      }
      if (this.STATUS_BAR.stuckTipTimer) {
        clearTimeout(this.STATUS_BAR.stuckTipTimer);
        this.STATUS_BAR.stuckTipTimer = null;
      }
    }

    let message = '';

    if (this.STATUS_BAR.isCompleted) {
      if (this.STATUS_BAR.failedApps > 0) {
        message = t('statusCompleteWithFailed', { failedApps: this.STATUS_BAR.failedApps });
      } else {
        message = t('statusAllComplete');
      }
    } else if (this.STATUS_BAR.showStuckTip) {
      message = `💡 提示：如果长时间卡住不动，可以尝试退出重进 (${this.STATUS_BAR.labeledApps}/${this.STATUS_BAR.totalApps})`;
    } else if (this.STATUS_BAR.isFirstTime) {
      if (this.STATUS_BAR.totalApps > 0) {
        message = t('statusFirstTimeMatching', { labeledApps: this.STATUS_BAR.labeledApps, totalApps: this.STATUS_BAR.totalApps });
      } else {
        message = t('statusFirstTimeMatchingNoCount');
      }
    } else if (this.STATUS_BAR.isChecking) {
      if (this.STATUS_BAR.totalApps > 0) {
        message = t('statusCheckingChanges', { labeledApps: this.STATUS_BAR.labeledApps, totalApps: this.STATUS_BAR.totalApps });
      } else {
        message = t('statusCheckingChangesNoCount');
      }
    } else {
      message = t('statusInitializing');
    }

    statusTextEl.textContent = message;

    // 基于进度更新时间的卡住提示逻辑
    if ((this.STATUS_BAR.isFirstTime || this.STATUS_BAR.isChecking) && !this.STATUS_BAR.isCompleted && !this.STATUS_BAR.stuckTipTimer && this.STATUS_BAR.lastProgressTime) {
      this.STATUS_BAR.stuckTipTimer = setTimeout(() => {
        // 检查是否真的5秒没有进度更新
        const timeSinceLastProgress = Date.now() - this.STATUS_BAR.lastProgressTime;
        if (timeSinceLastProgress >= 5000 && !this.STATUS_BAR.isCompleted) {
          this.STATUS_BAR.showStuckTip = true;
          this.updateStatusBar();
        }
      }, 5000); // 5秒后检查
    }
  }

  // 显示/隐藏加载状态
  showLoading(show) {
    const el = this.loadEl();
    if (el) el.style.display = show ? '' : 'none';
  }

  // 设置计数显示
  setCount(sel, total) {
    const el = this.countEl();
    if (el) {
      if (sel === 0) {
        el.style.display = 'none';
      } else {
        el.style.display = 'inline-block';
        el.textContent = `${sel} / ${total}`;
      }
    }
  }

  // 渲染应用列表
  render(apps, SELECTED, NEED_SORT_SELECTED, OBSERVER) {
    const L = this.listEl();
    if (!L) return;
    L.innerHTML = '';

    // 只在首次渲染时添加动画类
    if (this.IS_FIRST_RENDER) {
      L.classList.add('first-load');
      // 确保列表动画完成后标记完成状态
      setTimeout(() => {
        L.classList.add('first-load-complete');
      }, 800);
    } else {
      L.classList.remove('first-load');
    }

    const tpl = document.getElementById('card');

    // 智能排序：只在需要时将已选应用排到前面
    let sortedApps = [...apps];
    if (NEED_SORT_SELECTED) {
      sortedApps = apps.sort((a, b) => {
        if (SELECTED.has(a.pkg) && !SELECTED.has(b.pkg)) return -1;
        if (!SELECTED.has(a.pkg) && SELECTED.has(b.pkg)) return 1;
        return 0;
      });
    }

    // 注销旧 observer
    if (OBSERVER) {
      try {
        OBSERVER.disconnect();
      } catch(_) {}
    }

    // 为每个应用项绑定 IntersectionObserver
    for (const [index, app] of sortedApps.entries()) {
      let node;
      if (tpl && tpl.content && tpl.content.firstElementChild) {
        node = tpl.content.firstElementChild.cloneNode(true);
      } else {
        node = document.createElement('div');
        node.className = 'card';
        node.innerHTML = `
          <input type="checkbox" class="checkbox" />
          <div class="info">
            <div class="name"></div>
            <div class="pkg"></div>
          </div>`;
      }
      node.setAttribute('data-pkg', app.pkg);

      // 只在首次渲染时添加动画类和延迟
      if (this.IS_FIRST_RENDER) {
        node.classList.add('first-load');
        // 为卡片设置动画延迟和索引
        node.style.setProperty('--card-index', index);
        // 简化延迟计算，更快速的动画
        const maxDelay = Math.min(index * 0.03, 0.8); // 最大延迟0.8秒
        node.style.setProperty('--animation-delay', `${maxDelay + 0.2}s`);
      }

      const nameEl = node.querySelector('.name');
      const pkgEl = node.querySelector('.pkg');
      const cb = node.querySelector('.checkbox');

      if (nameEl) nameEl.textContent = app.name || app.pkg;
      if (pkgEl) pkgEl.textContent = app.pkg;

      if (cb) {
        cb.checked = SELECTED.has(app.pkg); // 预勾选 ✅
      }

      L.appendChild(node);
      // 观察进入视口后再补齐真实名称
      if (OBSERVER) {
        OBSERVER.observe(node);
      }
    }

    this.setCount(SELECTED.size, apps.length);

    // 只有当应用列表真正准备好并且是首次渲染时，才将标记设为false
    // 延迟设置，确保动画能够正确播放
    if (this.IS_FIRST_RENDER && apps.length > 0) {
      setTimeout(() => {
        this.IS_FIRST_RENDER = false;
      }, 1000); // 1秒后再设为false，确保动画完成
    }

    return { sortedApps, NEED_SORT_SELECTED: false }; // 返回排序状态重置信息
  }

  // 应用过滤
  applyFilter(apps, FILTER_Q, renderCallback) {
    const q = (this.searchEl()?.value || '').trim().toLowerCase();
    FILTER_Q = q;
    if (!q) return renderCallback(apps);
    const filtered = apps.filter(a =>
      (a.pkg || '').toLowerCase().includes(q) ||
      (a.name || '').toLowerCase().includes(q)
    );
    renderCallback(filtered);
    return FILTER_Q;
  }

  // 动态调整顶部间距的函数
  adjustTopInset() {
    const header = document.querySelector('.header');
    if (!header) return;

    // 获取当前的安全区域值
    const currentTopInset = getComputedStyle(document.documentElement)
      .getPropertyValue('--window-inset-top');

    // 如果安全区域值过大，则限制它
    if (currentTopInset && currentTopInset !== '0px') {
      const insetValue = parseInt(currentTopInset);
      if (insetValue > 48) { // 如果超过48px，则限制为24px
        document.documentElement.style.setProperty('--top-inset', '24px');
      }
    }

    // 根据屏幕高度动态调整
    const screenHeight = window.innerHeight;
    if (screenHeight < 600) {
      // 小屏幕设备，减少顶部间距
      header.style.paddingTop = 'clamp(0px, var(--top-inset), 16px)';
    } else if (screenHeight > 800) {
      // 大屏幕设备，可以适当增加间距
      header.style.paddingTop = 'clamp(0px, var(--top-inset), 32px)';
    } else {
      // 中等屏幕，使用默认值
      header.style.paddingTop = 'clamp(0px, var(--top-inset), 24px)';
    }
  }

  // 检测全屏API支持
  checkFullscreenSupport() {
    this.isFullscreenSupported = !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
    );
    return this.isFullscreenSupported;
  }

  // 进入全屏模式
  enterFullscreen() {
    if (!this.isFullscreenSupported) return false;

    const docEl = document.documentElement;
    try {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
      return true;
    } catch (error) {
      console.log('全屏模式请求失败:', error);
      return false;
    }
  }

  // 退出全屏模式
  exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      return true;
    } catch (error) {
      console.log('退出全屏失败:', error);
      return false;
    }
  }

  // 动态计算并设置容器偏移量
  updateDynamicLayout() {
    const header = document.querySelector('.header');
    const container = document.querySelector('.container');

    if (!header || !container) return;

    // 获取header的实际高度
    const headerRect = header.getBoundingClientRect();
    const headerHeight = headerRect.height;

    // 获取当前的安全区域值
    const topInset = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--top-inset').replace('px', '')) || 0;

    // 计算总偏移量：header高度 + 安全区域 + 额外间距
    const totalOffset = headerHeight + topInset + 25;

    // 设置CSS变量
    document.documentElement.style.setProperty('--dynamic-header-offset', `${totalOffset}px`);

    // 验证CSS变量是否实际应用
    const computedOffset = getComputedStyle(document.documentElement)
      .getPropertyValue('--dynamic-header-offset');
    const containerComputedTop = container.offsetTop;

    console.log('布局调试信息:', {
      headerHeight,
      topInset,
      totalOffset,
      computedOffset,
      containerOffsetTop: containerComputedTop,
      isFullscreen: this.isFullscreenActive,
      headerBottom: header.offsetTop + headerHeight
    });

    // 如果container的实际位置还是被遮挡，强制设置
    if (containerComputedTop < headerHeight + topInset) {
      console.warn('检测到container被遮挡，强制修正');
      container.style.marginTop = `${totalOffset}px`;
    }
  }

  // 更新全屏按钮状态
  updateFullscreenButton() {
    const fs = document.getElementById('fullscreen');
    if (!fs) return;

    const icon = fs.querySelector('.menu-icon');
    const text = fs.querySelector('.menu-text');

    if (this.isFullscreenActive) {
      icon.textContent = '🔳';
      text.textContent = '退出全屏';
    } else {
      icon.textContent = '🔲';
      text.textContent = '全屏模式';
    }
  }

  // 全屏状态变化监听
  setupFullscreenListeners() {
    const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange'];

    fullscreenEvents.forEach(event => {
      document.addEventListener(event, () => {
        this.isFullscreenActive = !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        );

        console.log('全屏状态变化:', this.isFullscreenActive);

        // 更新全屏按钮状态
        this.updateFullscreenButton();

        // 全屏状态变化时重新计算布局
        setTimeout(() => this.updateDynamicLayout(), 100);
      });
    });
  }

  // 滚动动画控制
  setupScrollAnimation() {
    const header = document.querySelector('.header');

    if (!header) return;

    window.addEventListener('scroll', () => {
      this.isScrolling = true;
      clearTimeout(this.scrollTimeout);

      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
      }, 200);

      // 向下滚动且超过阈值时隐藏header
      if (window.scrollY > this.lastScrollY && window.scrollY > this.scrollThreshold) {
        header.style.transform = 'translateY(-100%)';

        // 同时收回菜单（如果菜单是打开的）
        const menuDropdown = document.getElementById('menuDropdown');
        if (menuDropdown && menuDropdown.classList.contains('show')) {
          menuDropdown.classList.remove('show');
          // 移除菜单按钮焦点
          const menuToggle = document.getElementById('menuToggle');
          if (menuToggle) {
            setTimeout(() => menuToggle.blur(), 100);
          }
        }
      }
      // 向上滚动时显示
      else if (window.scrollY < this.lastScrollY) {
        header.style.transform = 'translateY(0)';
      }

      this.lastScrollY = window.scrollY;
    });
  }

  // 菜单交互逻辑
  async setupMenuInteractions() {
    logger.debug('menu', 'function-start');

    const menuToggle = document.getElementById('menuToggle');
    const menuDropdown = document.getElementById('menuDropdown');

    logger.debug('menu', 'elements-check', {
      menuToggle: !!menuToggle,
      menuDropdown: !!menuDropdown
    });

    if (!menuToggle || !menuDropdown) {
      logger.warn('menu', 'elements-missing');
      return;
    }

    // 简化的切换函数
    function toggleMenu(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const isShown = menuDropdown.classList.contains('show');

      if (isShown) {
        // 关闭菜单时，移除焦点（消除绿色描边）
        menuDropdown.classList.remove('show');
        setTimeout(() => {
          if (menuToggle) {
            menuToggle.blur();
          }
        }, 100);
      } else {
        // 打开菜单时，保持焦点（显示绿色描边）
        menuDropdown.classList.add('show');
        // 重新触发菜单项动画
        const menuItems = menuDropdown.querySelectorAll('.menu-item');
        menuItems.forEach((item, index) => {
          // 重置动画
          item.style.animation = 'none';
          // 强制重绘
          void item.offsetWidth;
          // 重新设置动画
          item.style.animation = `menuItemFadeIn 0.3s ease forwards`;
          item.style.animationDelay = `${(index + 1) * 0.05}s`;
        });
      }
    }

    // 隐藏菜单
    function hideMenu() {
      menuDropdown.classList.remove('show');
      // 菜单被外部事件关闭时，也移除焦点
      setTimeout(() => {
        if (menuToggle) {
          menuToggle.blur();
        }
      }, 100);
    }

    // 绑定菜单按钮事件
    logger.debug('menu', 'binding-toggle');

    menuToggle.onclick = function(e) {
      toggleMenu(e);
    };

    // 查找菜单项
    const menuItems = menuDropdown.querySelectorAll('.menu-item');
    logger.debug('menu', 'found-items', { count: menuItems.length });

    // 绑定菜单项事件
    menuItems.forEach((item, index) => {
      item.onclick = function() {
        setTimeout(hideMenu, 150);
      };
    });

    // 简化的外部点击处理
    document.addEventListener('click', function(e) {
      if (!menuToggle.contains(e.target) && !menuDropdown.contains(e.target)) {
        hideMenu();
      }
    });

    logger.info('menu', 'setup-complete');
  }

  // 初始化全屏和布局管理
  setupFullscreenAndLayout() {
    // 检测全屏支持
    this.checkFullscreenSupport();

    // 设置全屏事件监听
    this.setupFullscreenListeners();

    // 尝试自动进入全屏（需要用户交互后才能生效）
    if (this.isFullscreenSupported) {
      console.log('全屏模式已支持，可通过用户交互触发');

      // 添加点击事件来触发全屏
      let hasTriedFullscreen = false;
      const tryFullscreen = () => {
        if (!hasTriedFullscreen && !this.isFullscreenActive) {
          hasTriedFullscreen = true;
          const success = this.enterFullscreen();
          if (success) {
            console.log('已尝试进入全屏模式');
          }
        }
      };

      // 在用户首次交互时尝试全屏
      document.addEventListener('click', tryFullscreen, { once: true });
      document.addEventListener('touchstart', tryFullscreen, { once: true });
    }

    // 立即计算初始布局，确保UI组件能正确显示
    setTimeout(() => {
      this.updateDynamicLayout();
      this.updateFullscreenButton();
    }, 0);

    // 再次确保布局正确（DOM可能还在调整）
    setTimeout(() => {
      this.updateDynamicLayout();
    }, 100);

    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      setTimeout(() => this.updateDynamicLayout(), 100);
    });

    // 监听方向变化
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.updateDynamicLayout(), 300);
    });
  }

  // UI组件优先初始化函数
  setupUIComponents() {
    // 立即初始化动画系统
    this.setupScrollAnimation();
    this.setupMenuInteractions();
    // 立即初始化全屏和布局
    this.setupFullscreenAndLayout();
    // 立即绑定基础事件
    this.setupBasicEvents();
  }

  // 基础事件绑定（不依赖app列表）
  setupBasicEvents() {
    // 搜索框事件
    const s = this.searchEl();
    if (s) {
      s.addEventListener('input', () => {
        // 这里需要从主模块传入applyFilter回调
        if (this.applyFilterCallback) {
          this.applyFilterCallback();
        }
      });
    }

    // 基础按钮事件绑定（不需要等待app列表）
    const r = this.$('reload');
    if (r) {
      r.addEventListener('click', () => {
        // 这里需要从主模块传入reload回调
        if (this.reloadCallback) {
          this.reloadCallback();
        }
      });
    }

    // 全屏按钮
    const fs = this.$('fullscreen');
    if (fs) {
      fs.addEventListener('click', () => {
        if (!this.isFullscreenSupported) {
          toast('当前浏览器不支持全屏模式');
          return;
        }

        if (this.isFullscreenActive) {
          this.exitFullscreen();
          toast('已退出全屏模式');
        } else {
          const success = this.enterFullscreen();
          if (success) {
            toast('已进入全屏模式');
          } else {
            toast('进入全屏模式失败');
          }
        }
      });
    }
  }

  // 设置回调函数（由主模块调用）
  setCallbacks(callbacks) {
    this.applyFilterCallback = callbacks.applyFilter;
    this.reloadCallback = callbacks.reload;
  }

  // 绑定复选框事件（由主模块调用）
  bindCheckboxEvents(apps, SELECTED, AUTO_SAVE_ENABLED, saveSelectedRealtime) {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card) => {
      const cb = card.querySelector('.checkbox');
      const pkg = card.getAttribute('data-pkg');

      if (!cb || !pkg) return;

      // 移除之前的事件监听器
      const newCb = cb.cloneNode(true);
      cb.parentNode.replaceChild(newCb, cb);
      const newCard = newCb.closest('.card');

      // 复选框变化处理函数
      const handleToggle = async () => {
        if (newCb.checked) {
          SELECTED.add(pkg);
        } else {
          SELECTED.delete(pkg);
        }
        this.setCount(SELECTED.size, apps.length);

        // 实时保存到XML文件
        if (AUTO_SAVE_ENABLED) {
          await saveSelectedRealtime();
        }
      };

      // 绑定复选框变化事件
      newCb.onchange = handleToggle;

      // 绑定整个卡片的点击事件
      newCard.onclick = (e) => {
        // 如果直接点击的是复选框，不要重复处理
        if (e.target === newCb) return;

        // 切换复选框状态
        newCb.checked = !newCb.checked;
        // 手动触发处理函数
        handleToggle();
      };
    });
  }
}

// 导出单例实例
export const uiController = new UIController();

// 导出工具函数
export function setupDOMContentLoaded(callback) {
  document.addEventListener('DOMContentLoaded', callback);
}

export function setupWindowEvents(uiController) {
  // 页面加载完成后调整间距
  document.addEventListener('DOMContentLoaded', function() {
    uiController.adjustTopInset();

    // 监听窗口大小变化
    window.addEventListener('resize', () => uiController.adjustTopInset());

    // 监听WebUI管理器的状态栏变化
    if (window.WebUI) {
      window.WebUI.addEventListener('statusbar', () => uiController.adjustTopInset());
    }
  });

  // 导出函数供其他模块使用
  window.adjustTopInset = () => uiController.adjustTopInset();
}