import { ResourceSystem } from '../economy/ResourceSystem';
import type { FeedingAllocationState, FeedTroughDefinition } from '../world/FeedingSession';

interface FeedPanelHandlers {
  onRemove: (troughId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 场景上方的资源、成长、任务与确认分配 UI。 */
export class HUD {
  private root: HTMLDivElement;
  private resourceLabel: HTMLDivElement;
  private farmStatusLabel: HTMLDivElement;
  private feedbackLabel: HTMLDivElement;
  private feedbackTimeout: number | null = null;

  private taskButton: HTMLButtonElement;
  private sunlightCareButton: HTMLButtonElement;
  private fertilizerCareButton: HTMLButtonElement;
  private feedPanel: HTMLElement;
  private feedRows: HTMLDivElement;
  private feedTotal: HTMLDivElement;

  private onTaskClick: () => void = () => {};
  private onSunlightCare: () => void = () => {};
  private onFertilizerCare: () => void = () => {};

  private resourceSystem: ResourceSystem;

  constructor(resourceSystem: ResourceSystem) {
    this.resourceSystem = resourceSystem;
    this.root = document.createElement('div');
    this.root.className = 'hud';

    this.resourceLabel = document.createElement('div');
    this.resourceLabel.className = 'hud-card hud-resource';
    this.root.appendChild(this.resourceLabel);

    this.farmStatusLabel = document.createElement('div');
    this.farmStatusLabel.className = 'hud-card hud-farm-status';
    this.root.appendChild(this.farmStatusLabel);

    const taskCard = document.createElement('section');
    taskCard.className = 'hud-card hud-task-card';
    const taskTitle = document.createElement('strong');
    taskTitle.textContent = '示例学习任务：平均分饲料';
    const taskDescription = document.createElement('p');
    taskDescription.textContent = '完成一次，领取水、阳光、肥料和 6 份饲料。任务实例只能领取一次。';
    this.taskButton = document.createElement('button');
    this.taskButton.type = 'button';
    this.taskButton.addEventListener('click', () => this.onTaskClick());
    taskCard.append(taskTitle, taskDescription, this.taskButton);
    this.root.appendChild(taskCard);

    const careCard = document.createElement('section');
    careCard.className = 'hud-card hud-care-card';
    const careTitle = document.createElement('strong');
    careTitle.textContent = '胡萝卜照料';
    const careDescription = document.createElement('p');
    careDescription.textContent = '发芽后先照阳光，再施肥；不满足阶段或资源时不会扣除资源。';
    this.sunlightCareButton = document.createElement('button');
    this.sunlightCareButton.type = 'button';
    this.sunlightCareButton.textContent = '投入 1 份阳光';
    this.sunlightCareButton.addEventListener('click', () => this.onSunlightCare());
    this.fertilizerCareButton = document.createElement('button');
    this.fertilizerCareButton.type = 'button';
    this.fertilizerCareButton.textContent = '投入 1 份肥料';
    this.fertilizerCareButton.addEventListener('click', () => this.onFertilizerCare());
    careCard.append(careTitle, careDescription, this.sunlightCareButton, this.fertilizerCareButton);
    this.root.appendChild(careCard);

    this.feedPanel = document.createElement('section');
    this.feedPanel.className = 'hud-card hud-feed-panel';
    const feedTitle = document.createElement('strong');
    feedTitle.textContent = '确认分配';
    const feedDescription = document.createElement('p');
    feedDescription.textContent = '当前只是临时份数。点击确认后才会真正扣除饲料。';
    this.feedRows = document.createElement('div');
    this.feedRows.className = 'feed-rows';
    this.feedTotal = document.createElement('div');
    this.feedTotal.className = 'feed-total';
    this.feedPanel.append(feedTitle, feedDescription, this.feedRows, this.feedTotal);
    this.root.appendChild(this.feedPanel);
    this.hideFeedConfirmation();

    this.feedbackLabel = document.createElement('div');
    this.feedbackLabel.className = 'hud-feedback';
    this.root.appendChild(this.feedbackLabel);

    document.body.appendChild(this.root);
    this.updateResourceLabel();
    resourceSystem.subscribe(() => this.updateResourceLabel());
  }

  setTaskHandler(handler: () => void) {
    this.onTaskClick = handler;
  }

  setTaskCompleted(completed: boolean) {
    this.taskButton.textContent = completed ? '已领取本任务奖励' : '完成示例任务并领取奖励';
  }

  setCarrotCareHandlers(onSunlightCare: () => void, onFertilizerCare: () => void) {
    this.onSunlightCare = onSunlightCare;
    this.onFertilizerCare = onFertilizerCare;
  }

  updateFarmStatus(
    carrotStage: string,
    chickenSummary: string,
    harvestedCarrots: number,
    appleSummary: string
  ) {
    this.farmStatusLabel.textContent = `农场进度\n胡萝卜：${carrotStage}\n苹果树：${appleSummary}\n小鸡：${chickenSummary}\n收获：胡萝卜 ${harvestedCarrots} 根`;
  }

  showFeedConfirmation(
    state: FeedingAllocationState,
    troughs: FeedTroughDefinition[],
    handlers: FeedPanelHandlers
  ) {
    if (!state.isOpen) {
      this.hideFeedConfirmation();
      return;
    }

    this.feedPanel.hidden = false;
    this.removeFeedActions();
    this.feedRows.replaceChildren();
    for (const trough of troughs) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      const label = document.createElement('span');
      label.textContent = `${trough.label}：${state.amounts[trough.id]} 份`;
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = '取出一份';
      removeButton.disabled = state.amounts[trough.id] <= 0;
      removeButton.addEventListener('click', () => handlers.onRemove(trough.id));
      row.append(label, removeButton);
      this.feedRows.appendChild(row);
    }

    this.feedTotal.textContent = `待确认总数：${state.total} 份`;
    const actions = document.createElement('div');
    actions.className = 'feed-actions';
    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.textContent = '确认分配';
    confirmButton.addEventListener('click', handlers.onConfirm);
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'secondary-button';
    cancelButton.textContent = '取消（不扣饲料）';
    cancelButton.addEventListener('click', handlers.onCancel);
    actions.append(confirmButton, cancelButton);
    this.feedPanel.appendChild(actions);
  }

  hideFeedConfirmation() {
    this.feedPanel.hidden = true;
    this.removeFeedActions();
  }

  private removeFeedActions() {
    const actionRows = this.feedPanel.querySelectorAll('.feed-actions');
    for (const actionRow of actionRows) {
      actionRow.remove();
    }
  }

  /** 显示一条短暂的提示文字，几秒后自动消失。 */
  showFeedback(message: string) {
    this.feedbackLabel.textContent = message;
    this.feedbackLabel.style.opacity = '1';

    if (this.feedbackTimeout !== null) {
      window.clearTimeout(this.feedbackTimeout);
    }
    this.feedbackTimeout = window.setTimeout(() => {
      this.feedbackLabel.style.opacity = '0';
    }, 2400);
  }

  private updateResourceLabel() {
    this.resourceLabel.textContent = [
      `💧 水：${this.resourceSystem.water.toFixed(1)}`,
      `☀️ 阳光：${this.resourceSystem.sunlight.toFixed(0)}`,
      `🧪 肥料：${this.resourceSystem.fertilizer.toFixed(0)}`,
      `🌾 饲料：${this.resourceSystem.feed.toFixed(0)}`,
      `🪙 农场币：${this.resourceSystem.coins.toFixed(0)}`,
    ].join('\n');
  }
}
