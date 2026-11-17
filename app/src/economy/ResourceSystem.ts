/**
 * ResourceSystem 管理玩家拥有的学习资源（阳光、水、肥料、饲料、农场币）。
 *
 * 对应设计文档的硬性规则：
 *   “浇水落空（没有命中有效区域）时，不能扣减水的数量。”
 * 这条规则不是由 ResourceSystem 自己保证的——ResourceSystem 只负责“给你一个
 * 安全的扣减方法”，真正“什么时候才算有效、能不能扣”的判断，交给调用方
 * （比如 WateringAction）在调用 trySpend 之前自己检查清楚。
 *
 * 新手提示：这里用了一个很简单的“订阅者模式”（subscribe）：HUD 不需要每帧
 * 主动去问 ResourceSystem“现在水还有多少”，而是预先“订阅”一个回调函数，
 * ResourceSystem 的数值一变化，就主动通知所有订阅者。这样 UI 更新和数据变化
 * 的代码不会耦合在一起。如果你觉得这个模式一时看不懂，也可以先简化成
 * “HUD 每帧读取一次 ResourceSystem.water”，等熟悉了再优化。
 */
export class ResourceSystem {
  private _water = 10;
  private _fertilizer = 0;
  private _sunlight = 0;
  private _feed = 0;
  private _coins = 0;

  private listeners: Array<() => void> = [];

  get water() {
    return this._water;
  }
  get fertilizer() {
    return this._fertilizer;
  }
  get sunlight() {
    return this._sunlight;
  }
  get feed() {
    return this._feed;
  }
  get coins() {
    return this._coins;
  }

  /** 注册一个“资源变化时调用我”的回调，返回取消订阅的函数 */
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * 尝试花费一定量的水。如果余量不够，直接返回 false、不做任何扣减。
   * 调用方（比如 WateringAction）必须在确认“这次浇水是有效的”之后，
   * 才调用这个方法——如果玩家瞄准的是空地，就不应该调用它。
   */
  trySpendWater(amount: number): boolean {
    if (this._water < amount) return false;
    this._water -= amount;
    this.notify();
    return true;
  }

  addWater(amount: number) {
    this._water += amount;
    this.notify();
  }

  addFertilizer(amount: number) {
    this._fertilizer += amount;
    this.notify();
  }

  addSunlight(amount: number) {
    this._sunlight += amount;
    this.notify();
  }

  addFeed(amount: number) {
    this._feed += amount;
    this.notify();
  }

  addCoins(amount: number) {
    this._coins += amount;
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
