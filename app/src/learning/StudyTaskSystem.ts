import type { ResourceReward } from '../economy/ResourceSystem';
import { ResourceSystem } from '../economy/ResourceSystem';

export interface LearningTaskSnapshot {
  completedTaskIds: string[];
}

export const SAMPLE_TASK_ID = 'math-average-feed-001';

const SAMPLE_TASK_REWARD: ResourceReward = {
  water: 2,
  sunlight: 1,
  fertilizer: 1,
  feed: 6,
};

/**
 * 里程碑 A 的离线任务占位。实际题目接入时，仍必须由任务实例 ID 做同样的去重。
 */
export class StudyTaskSystem {
  onFeedback: (message: string) => void = () => {};
  onStateChange: () => void = () => {};

  private readonly resourceSystem: ResourceSystem;
  private completedTaskIds: Set<string>;

  constructor(resourceSystem: ResourceSystem, snapshot?: Partial<LearningTaskSnapshot>) {
    this.resourceSystem = resourceSystem;
    this.completedTaskIds = new Set(snapshot?.completedTaskIds?.filter((id) => id.length > 0) ?? []);
  }

  /**
   * 同一实例无论重复点击、刷新后重试或动画重入，都只会结算一次。
   * 先写入内存去重记录，再发放一次性资源奖励，存档回调会保存二者的同一份状态。
   */
  completeSampleTask(): boolean {
    if (this.completedTaskIds.has(SAMPLE_TASK_ID)) {
      this.onFeedback('这个示例任务已经领取过奖励了');
      return false;
    }

    this.completedTaskIds.add(SAMPLE_TASK_ID);
    this.resourceSystem.addRewards(SAMPLE_TASK_REWARD);
    this.onStateChange();
    this.onFeedback('学习任务完成：获得水、阳光、肥料和 6 份饲料');
    return true;
  }

  hasCompletedSampleTask(): boolean {
    return this.completedTaskIds.has(SAMPLE_TASK_ID);
  }

  getSnapshot(): LearningTaskSnapshot {
    return { completedTaskIds: [...this.completedTaskIds] };
  }
}
