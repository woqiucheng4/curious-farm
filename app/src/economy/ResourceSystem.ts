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
export interface ResourceSnapshot {
  water: number;
  fertilizer: number;
  sunlight: number;
  feed: number;
  coins: number;
}

export type ResourceReward = Partial<ResourceSnapshot>;

export class ResourceSystem {
  private _water = 10;
  private _fertilizer = 0;
  private _sunlight = 0;
  private _feed = 0;
  private _coins = 0;

  private listeners: Array<() => void> = [];

  constructor(initial?: Partial<ResourceSnapshot>) {
    if (initial) {
      this.restore(initial);
    }
  }

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
    return this.trySpend('_water', amount);
  }

  trySpendFertilizer(amount: number): boolean {
    return this.trySpend('_fertilizer', amount);
  }

  trySpendSunlight(amount: number): boolean {
    return this.trySpend('_sunlight', amount);
  }

  trySpendFeed(amount: number): boolean {
    return this.trySpend('_feed', amount);
  }

  addWater(amount: number) {
    this.add('_water', amount);
  }

  addFertilizer(amount: number) {
    this.add('_fertilizer', amount);
  }

  addSunlight(amount: number) {
    this.add('_sunlight', amount);
  }

  addFeed(amount: number) {
    this.add('_feed', amount);
  }

  addCoins(amount: number) {
    this.add('_coins', amount);
  }

  /** 一次性发放任务奖励，只通知 UI/存档一次。 */
  addRewards(reward: ResourceReward) {
    const water = this.toSafeAmount(reward.water);
    const fertilizer = this.toSafeAmount(reward.fertilizer);
    const sunlight = this.toSafeAmount(reward.sunlight);
    const feed = this.toSafeAmount(reward.feed);
    const coins = this.toSafeAmount(reward.coins);
    const hasReward = water > 0 || fertilizer > 0 || sunlight > 0 || feed > 0 || coins > 0;

    if (!hasReward) return;

    this._water += water;
    this._fertilizer += fertilizer;
    this._sunlight += sunlight;
    this._feed += feed;
    this._coins += coins;
    this.notify();
  }

  getSnapshot(): ResourceSnapshot {
    return {
      water: this._water,
      fertilizer: this._fertilizer,
      sunlight: this._sunlight,
      feed: this._feed,
      coins: this._coins,
    };
  }

  /** 只在启动读档时使用；不会根据离线时长改变任意资源。 */
  restore(snapshot: Partial<ResourceSnapshot>) {
    this._water = this.toSafeAmount(snapshot.water, this._water);
    this._fertilizer = this.toSafeAmount(snapshot.fertilizer, this._fertilizer);
    this._sunlight = this.toSafeAmount(snapshot.sunlight, this._sunlight);
    this._feed = this.toSafeAmount(snapshot.feed, this._feed);
    this._coins = this.toSafeAmount(snapshot.coins, this._coins);
    this.notify();
  }

  private trySpend(field: '_water' | '_fertilizer' | '_sunlight' | '_feed', amount: number): boolean {
    if (!this.isPositiveAmount(amount) || this[field] < amount) return false;
    this[field] -= amount;
    this.notify();
    return true;
  }

  private add(field: '_water' | '_fertilizer' | '_sunlight' | '_feed' | '_coins', amount: number) {
    if (!this.isPositiveAmount(amount)) return;
    this[field] += amount;
    this.notify();
  }

  private isPositiveAmount(amount: number): boolean {
    return Number.isFinite(amount) && amount > 0;
  }

  private toSafeAmount(amount: number | undefined, fallback = 0): number {
    if (amount === undefined) return fallback;
    return Number.isFinite(amount) && amount >= 0 ? amount : fallback;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
