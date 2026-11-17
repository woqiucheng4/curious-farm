import { ResourceSystem } from '../economy/ResourceSystem';

/**
 * HUD（Head-Up Display，抬头显示）负责屏幕上的 2D 界面：顶部资源条、
 * 底部的提示文字。它不属于 Three.js 的 3D 世界，而是普通的 HTML/CSS，
 * 用绝对定位叠在 3D 画面上面——这是网页 3D 游戏里做 UI 最简单的方式，
 * 不需要用到 Three.js 自己的文字渲染。
 */
export class HUD {
  private root: HTMLDivElement;
  private waterLabel: HTMLDivElement;
  private feedbackLabel: HTMLDivElement;
  private feedbackTimeout: number | null = null;

  private resourceSystem: ResourceSystem;

  constructor(resourceSystem: ResourceSystem) {
    this.resourceSystem = resourceSystem;
    this.root = document.createElement('div');
    this.root.className = 'hud';

    this.waterLabel = document.createElement('div');
    this.waterLabel.className = 'hud-resource';
    this.root.appendChild(this.waterLabel);

    this.feedbackLabel = document.createElement('div');
    this.feedbackLabel.className = 'hud-feedback';
    this.root.appendChild(this.feedbackLabel);

    document.body.appendChild(this.root);

    this.updateWaterLabel();
    resourceSystem.subscribe(() => this.updateWaterLabel());
  }

  /** 显示一条短暂的提示文字，几秒后自动消失 */
  showFeedback(message: string) {
    this.feedbackLabel.textContent = message;
    this.feedbackLabel.style.opacity = '1';

    if (this.feedbackTimeout !== null) {
      window.clearTimeout(this.feedbackTimeout);
    }
    this.feedbackTimeout = window.setTimeout(() => {
      this.feedbackLabel.style.opacity = '0';
    }, 2000);
  }

  private updateWaterLabel() {
    this.waterLabel.textContent = `💧 水: ${this.resourceSystem.water.toFixed(1)}`;
  }
}
