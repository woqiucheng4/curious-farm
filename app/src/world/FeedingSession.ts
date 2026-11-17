import { ResourceSystem } from '../economy/ResourceSystem';

export interface FeedTroughDefinition {
  id: string;
  label: string;
}

export interface FeedingAllocationState {
  isOpen: boolean;
  total: number;
  amounts: Record<string, number>;
}

/**
 * 喂食分配的临时状态机。这里的份数不是资源余额；在 confirm 前绝不调用扣减方法。
 */
export class FeedingSession {
  onFeedback: (message: string) => void = () => {};
  onPendingChanged: (state: FeedingAllocationState) => void = () => {};
  onConfirmed: (amounts: Readonly<Record<string, number>>, total: number) => void = () => {};

  private readonly resourceSystem: ResourceSystem;
  private readonly troughs: FeedTroughDefinition[];
  private pendingAmounts: Record<string, number> = {};
  private isPanelOpen = false;

  constructor(resourceSystem: ResourceSystem, troughs: FeedTroughDefinition[]) {
    this.resourceSystem = resourceSystem;
    this.troughs = troughs;
    for (const trough of troughs) {
      this.pendingAmounts[trough.id] = 0;
    }
  }

  /** 点击食槽只把一份饲料放进临时分配，不会扣减真实资源。 */
  addPortion(troughId: string) {
    if (!this.hasTrough(troughId)) return;
    if (this.getPendingTotal() >= this.resourceSystem.feed) {
      this.onFeedback('饲料不够，先完成学习任务领取更多饲料');
      return;
    }

    this.pendingAmounts[troughId] += 1;
    this.isPanelOpen = true;
    this.onFeedback('已暂存一份饲料，请在确认分配面板核对');
    this.emitPending();
  }

  removePortion(troughId: string) {
    if (!this.hasTrough(troughId) || this.pendingAmounts[troughId] <= 0) return;
    this.pendingAmounts[troughId] -= 1;
    this.emitPending();
  }

  /** 唯一允许调用 trySpendFeed 的入口。 */
  confirm(): boolean {
    const total = this.getPendingTotal();
    if (total <= 0) {
      this.onFeedback('还没有分配饲料');
      return false;
    }

    // 前置条件（有待确认的有效分配）已满足，现在才真正扣减资源。
    const spent = this.resourceSystem.trySpendFeed(total);
    if (!spent) {
      this.onFeedback('饲料不够，分配仍保留，可以调整或取消');
      return false;
    }

    const confirmedAmounts = this.copyAmounts();
    this.onConfirmed(confirmedAmounts, total);
    this.resetPending();
    this.onFeedback(`已确认分配 ${total} 份饲料`);
    return true;
  }

  /** 取消只丢弃临时变量，不扣资源、不写学习记录。 */
  cancel() {
    if (this.getPendingTotal() <= 0 && !this.isPanelOpen) return;
    this.resetPending();
    this.onFeedback('已取消本次分配，饲料和学习记录都没有变化');
  }

  getState(): FeedingAllocationState {
    return {
      isOpen: this.isPanelOpen,
      total: this.getPendingTotal(),
      amounts: this.copyAmounts(),
    };
  }

  private resetPending() {
    for (const trough of this.troughs) {
      this.pendingAmounts[trough.id] = 0;
    }
    this.isPanelOpen = false;
    this.emitPending();
  }

  private emitPending() {
    this.onPendingChanged(this.getState());
  }

  private copyAmounts(): Record<string, number> {
    const copy: Record<string, number> = {};
    for (const trough of this.troughs) {
      copy[trough.id] = this.pendingAmounts[trough.id];
    }
    return copy;
  }

  private getPendingTotal(): number {
    return Object.values(this.pendingAmounts).reduce((total, amount) => total + amount, 0);
  }

  private hasTrough(troughId: string): boolean {
    return this.troughs.some((trough) => trough.id === troughId);
  }
}
