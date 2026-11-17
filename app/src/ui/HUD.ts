import { ResourceSystem } from '../economy/ResourceSystem';
import type { KnowledgeEvidenceSummary } from '../learning/LearningRecordInterpreter';
import type { LearningTaskDefinition } from '../learning/taskData';
import type { FeedingAllocationState, FeedTroughDefinition } from '../world/FeedingSession';

interface FeedPanelHandlers {
  onRemove: (troughId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

interface LearningTaskHandlers {
  onAnswer: (taskInstanceId: string, optionId: string) => void;
  onCancel: () => void;
}

/** 场景上方的资源、成长、任务与确认分配 UI。 */
export class HUD {
  private root: HTMLDivElement;
  private resourceLabel: HTMLDivElement;
  private farmStatusLabel: HTMLDivElement;
  private feedbackLabel: HTMLDivElement;
  private feedbackTimeout: number | null = null;

  private taskContent: HTMLDivElement;
  private sunlightCareButton: HTMLButtonElement;
  private fertilizerCareButton: HTMLButtonElement;
  private feedPanel: HTMLElement;
  private feedRows: HTMLDivElement;
  private feedTotal: HTMLDivElement;

  private learningTasks: LearningTaskDefinition[] = [];
  private completedTaskIds = new Set<string>();
  private evidenceSummaries: KnowledgeEvidenceSummary[] = [];
  private onTaskAnswer: (taskInstanceId: string, optionId: string) => void = () => {};
  private onTaskCancel: () => void = () => {};
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
    taskTitle.textContent = '离线学习任务';
    const taskDescription = document.createElement('p');
    taskDescription.textContent = '每题独立结算一次；答错或暂不作答不会扣资源，也不会写入学习记录。';
    this.taskContent = document.createElement('div');
    this.taskContent.className = 'learning-task-content';
    taskCard.append(taskTitle, taskDescription, this.taskContent);
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

  setLearningTasks(tasks: LearningTaskDefinition[], handlers: LearningTaskHandlers) {
    this.learningTasks = [...tasks];
    this.onTaskAnswer = handlers.onAnswer;
    this.onTaskCancel = handlers.onCancel;
    this.renderLearningTasks();
  }

  updateLearningTaskProgress(
    completedTaskIds: Iterable<string>,
    evidenceSummaries: KnowledgeEvidenceSummary[]
  ) {
    this.completedTaskIds = new Set(completedTaskIds);
    this.evidenceSummaries = [...evidenceSummaries];
    this.renderLearningTasks();
  }

  setCarrotCareHandlers(onSunlightCare: () => void, onFertilizerCare: () => void) {
    this.onSunlightCare = onSunlightCare;
    this.onFertilizerCare = onFertilizerCare;
  }

  updateFarmStatus(
    carrotStage: string,
    chickenSummary: string,
    harvestedCarrots: number,
    appleSummary: string,
    basketApples: number
  ) {
    this.farmStatusLabel.textContent = `农场进度\n胡萝卜：${carrotStage}\n苹果树：${appleSummary}\n果篮：苹果 ${basketApples} 个\n小鸡：${chickenSummary}\n收获：胡萝卜 ${harvestedCarrots} 根`;
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

  private renderLearningTasks() {
    this.taskContent.replaceChildren();

    const evidenceTitle = document.createElement('strong');
    evidenceTitle.className = 'learning-evidence-title';
    evidenceTitle.textContent = '学习证据（离线规则解读）';
    this.taskContent.appendChild(evidenceTitle);
    for (const summary of this.evidenceSummaries) {
      const evidence = document.createElement('p');
      evidence.className = 'learning-evidence';
      evidence.textContent = `${summary.subjectLabel}·${summary.knowledgePointName}：${summary.label}（${summary.completedTaskCount} 题）`;
      this.taskContent.appendChild(evidence);
    }

    for (const task of this.learningTasks) {
      const taskItem = document.createElement('section');
      taskItem.className = 'learning-task-item';
      const title = document.createElement('strong');
      const formatLabel = task.format === 'basic' ? '基础题' : '迁移题';
      title.textContent = `${task.title}（${formatLabel}）`;
      const prompt = document.createElement('p');
      prompt.textContent = task.prompt;
      taskItem.append(title, prompt);

      if (this.completedTaskIds.has(task.instanceId)) {
        const completed = document.createElement('span');
        completed.className = 'learning-task-completed';
        completed.textContent = '已完成并领取奖励';
        taskItem.appendChild(completed);
      } else {
        const options = document.createElement('div');
        options.className = 'learning-task-options';
        for (const option of task.options) {
          const optionButton = document.createElement('button');
          optionButton.type = 'button';
          optionButton.textContent = option.text;
          optionButton.addEventListener('click', () => this.onTaskAnswer(task.instanceId, option.id));
          options.appendChild(optionButton);
        }
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'secondary-button learning-task-cancel';
        cancelButton.textContent = '暂不作答（不记录）';
        cancelButton.addEventListener('click', () => this.onTaskCancel());
        taskItem.append(options, cancelButton);
      }
      this.taskContent.appendChild(taskItem);
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
