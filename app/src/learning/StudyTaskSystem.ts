import type { ResourceReward } from '../economy/ResourceSystem';
import { ResourceSystem } from '../economy/ResourceSystem';
import { interpretLearningEvents } from './LearningRecordInterpreter';
import type { KnowledgeEvidenceSummary, LearningEvent } from './LearningRecordInterpreter';
import { LEARNING_TASKS } from './taskData';
import type { LearningTaskDefinition } from './taskData';

export interface LearningTaskSnapshot {
  completedTaskIds: string[];
  /** 只保存已独立答对并完成结算的证据；取消和错误作答不会写入。 */
  learningEvents?: LearningEvent[];
}

export type TaskSubmissionResult = 'correct' | 'incorrect' | 'already-completed' | 'unknown-task';

/**
 * 数据驱动的离线任务结算系统。
 * 题目、正确答案与奖励均来自 taskData；本类只管理判分、按实例去重、资源结算和学习证据。
 */
export class StudyTaskSystem {
  onFeedback: (message: string) => void = () => {};
  onStateChange: () => void = () => {};

  private readonly resourceSystem: ResourceSystem;
  private readonly tasksById: Map<string, LearningTaskDefinition>;
  private completedTaskIds: Set<string>;
  private learningEvents: LearningEvent[];

  constructor(resourceSystem: ResourceSystem, snapshot?: Partial<LearningTaskSnapshot>) {
    this.resourceSystem = resourceSystem;
    this.tasksById = new Map(LEARNING_TASKS.map((task) => [task.instanceId, task]));
    this.completedTaskIds = new Set(
      snapshot?.completedTaskIds?.filter((id) => this.tasksById.has(id)) ?? []
    );
    this.learningEvents = this.restoreEvents(snapshot?.learningEvents);
  }

  /**
   * 只有选项命中当前任务的正确答案才会生成学习事件和奖励。
   * 错误答案是即时反馈，不是可用于判断能力的学习证据；不扣资源、不存档、不触发状态写入。
   */
  submitAnswer(taskInstanceId: string, optionId: string): TaskSubmissionResult {
    const task = this.tasksById.get(taskInstanceId);
    if (!task) {
      this.onFeedback('这个学习任务暂时不可用，请换一题试试');
      return 'unknown-task';
    }
    if (this.completedTaskIds.has(taskInstanceId)) {
      this.onFeedback('这个任务已经完成过了，奖励不会重复发放');
      return 'already-completed';
    }
    if (task.correctOptionId !== optionId) {
      this.onFeedback(`再想想：${task.explanation} 本次不扣资源，也不写学习记录。`);
      return 'incorrect';
    }

    this.completedTaskIds.add(taskInstanceId);
    this.learningEvents.push({
      taskInstanceId,
      subject: task.subject,
      knowledgePointId: task.knowledgePointId,
      format: task.format,
    });
    this.resourceSystem.addRewards(task.reward);
    this.onStateChange();
    this.onFeedback(`答对了！${task.explanation}${this.getRewardLabel(task.reward)}`);
    return 'correct';
  }

  /** 用户放弃作答时只给出反馈，任何资源与学习记录均保持原样。 */
  cancelCurrentAnswer() {
    this.onFeedback('已暂不作答，本次没有资源或学习记录变化');
  }

  isCompleted(taskInstanceId: string): boolean {
    return this.completedTaskIds.has(taskInstanceId);
  }

  getEvidenceSummaries(): KnowledgeEvidenceSummary[] {
    return interpretLearningEvents(this.learningEvents);
  }

  getSnapshot(): LearningTaskSnapshot {
    return {
      completedTaskIds: [...this.completedTaskIds],
      learningEvents: this.learningEvents.map((event) => ({ ...event })),
    };
  }

  private restoreEvents(events: LearningEvent[] | undefined): LearningEvent[] {
    if (!events) return [];

    const seenTaskIds = new Set<string>();
    const restored: LearningEvent[] = [];
    for (const event of events) {
      const task = this.tasksById.get(event.taskInstanceId);
      if (!task || seenTaskIds.has(event.taskInstanceId)) continue;
      if (
        event.subject !== task.subject ||
        event.knowledgePointId !== task.knowledgePointId ||
        event.format !== task.format
      ) {
        continue;
      }
      seenTaskIds.add(event.taskInstanceId);
      restored.push({ ...event });
    }
    return restored;
  }

  private getRewardLabel(reward: ResourceReward): string {
    const parts: string[] = [];
    if (reward.water) parts.push(`${reward.water} 份水`);
    if (reward.sunlight) parts.push(`${reward.sunlight} 份阳光`);
    if (reward.fertilizer) parts.push(`${reward.fertilizer} 份肥料`);
    if (reward.feed) parts.push(`${reward.feed} 份饲料`);
    if (reward.coins) parts.push(`${reward.coins} 枚农场币`);
    return parts.length > 0 ? ` 获得${parts.join('、')}。` : '';
  }
}
