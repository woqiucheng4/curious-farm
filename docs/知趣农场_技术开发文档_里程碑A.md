# 知趣农场 · 技术开发文档（里程碑A：离线核心玩法验证版）

文档日期：2026-11-17。配套产品文档：`docs/知趣农场_设计方案_v2.md`（以下简称"设计文档"）。

## 0. 文档定位与使用说明

- **本文档的角色**：把设计文档中的产品/教学决策转成可直接编码的架构、数据结构、状态机和任务顺序，供负责实现的开发者或 AI agent 使用。
- **范围**：只覆盖设计文档第5节定义的**里程碑A**（离线核心玩法验证版）。不包含里程碑B（真实在线AI分析服务、家长开关、四路径网络测试、完整24知识点/96题/5物种/6分区）——这些留到里程碑A验收通过后再单独立项。
- **冲突处理**：凡与设计文档中标注"已确定"的产品/教学决策冲突，以设计文档为准；本文档中标【技术实现决定】的内容属于工程选型，实现时可以调整，但调整后请同步更新本文档，不要只改代码。
- **诚实边界**：设计文档第8节列出的"几猫源码移植工作量""点击移动是否晕动"等问题本次仍未解决，本文档只是给出一个可执行的起点方案，不代表这些问题已经有答案。本文档没有拿到《几猫国产3A大作_V1.html》原始源码，第9节的程序生成美术方案是**通用实现路径建议**，不是对该源码的复用说明。

---

## 1. 技术栈与项目结构【技术实现决定】

| 选型 | 决定 | 理由 |
|---|---|---|
| 渲染引擎 | Three.js（最新稳定版） | 浏览器3D、程序化几何/材质生态成熟，符合"程序生成场景、几何和材质"的既定方向 |
| 语言 | TypeScript | 大量状态机和数据结构，类型检查能显著减少状态机实现错误 |
| 构建工具 | Vite | 开发态模块化、产出态可配置单文件打包，符合原方案"开发时模块化、交付时独立HTML"的习惯 |
| 后端 | 无（里程碑A不需要） | 全部离线，数据存本地，符合里程碑A"不含在线AI"的范围 |
| 存档 | IndexedDB（通过轻量封装，如 idb-keyval） | localStorage 容量小且同步阻塞，存档包含较多学习记录后 IndexedDB 更合适 |
| 目标浏览器 | 最新版 Chrome / Edge / Firefox 桌面版 | 里程碑A 不要求触屏，设计文档中触屏支持留在后续版本 |
| 性能目标 | 独立显卡/主流核显笔记本 60fps；教室低配机型(核显+1080p)不低于30fps | 实现建议值，需在第10节验证关卡中实测，不是预先承诺 |

### 项目目录结构

```
knowing-farm/
  src/
    core/
      SceneManager.ts        场景、相机、渲染循环
      PlayerController.ts    点击移动 + 视角拖拽 + 进阶模式切换
      InputManager.ts        统一输入事件(鼠标/键盘)分发
      SaveSystem.ts          存档读写、版本迁移
    interaction/
      Interactable.ts        可交互物体基类/接口
      ActionStateMachine.ts  通用动作状态机基类
      actions/
        PickupAction.ts
        WateringAction.ts
        FeedingAction.ts
        HarvestAction.ts
    world/
      TerrainGenerator.ts    地形/菜畦程序化生成
      CropGenerator.ts       作物几何与成长阶段生成
      AnimalGenerator.ts     动物几何与动作
      MaterialFactory.ts     程序材质(木纹/金属/土壤湿润)
    economy/
      ResourceSystem.ts      资源数据与免费/消耗行为权限
      TaskLedger.ts          任务实例ID去重账本
    growth/
      CropGrowth.ts          作物生长状态机
      AnimalGrowth.ts        动物生长状态机
    learning/
      TopicSchema.ts         知识点/题目数据结构(为里程碑B预留字段)
      LearningRecord.ts      学习记录的写入与查询
      OfflineInsight.ts      离线规则版"学习记录解读"
    ui/
      HUD.ts                 顶部资源条、底部工具提示
      FeedConfirmPanel.ts    喂食"确认分配"界面
      GrowthJournal.ts       成长记录面板
    main.ts                  入口
  assets/                    若有必要的少量贴图种子/字体，优先程序生成
  tests/
    unit/
    manual-checklist.md      对应第10节人工测试清单
  index.html
  vite.config.ts
  package.json
```

---

## 2. 核心系统架构

```
main.ts
  → SceneManager (持有 THREE.Scene / Camera / Renderer / 渲染循环)
      → world/* 生成场景物体，注册为 Interactable
      → PlayerController (监听 InputManager，控制角色位置与视角)
      → InteractionSystem (持有当前可交互目标、当前 ActionStateMachine 实例)
          → actions/* 四个具体动作状态机
      → ResourceSystem (单例，供 actions 查询/扣减资源，供 HUD 读取显示)
      → TaskLedger (单例，供 learning 模块结算奖励时查重)
      → growth/* (每帧或事件驱动更新作物/动物状态，读取 ResourceSystem 的里程碑记录)
      → learning/* (里程碑A 只做"已领取资源"的模拟入口 + 离线规则解读，不接学习任务引擎本体)
      → SaveSystem (定期/关键事件触发写入 IndexedDB)
```

**模块边界原则**：`actions/*` 只负责"这一次交互的输入-过程-反馈-取消-失败恢复"，不直接操作存档；资源的扣减/发放统一走 `ResourceSystem` 暴露的方法，方便后续里程碑B替换为服务端校验而不用改动作逻辑。

---

## 3. 玩家控制器规格（对应设计文档第2.0节）

### 默认模式：点击移动 + 拖拽视角

- **移动**：鼠标左键点击地面（对地形 mesh 做 raycast），得到目标点；角色朝目标点直线移动(里程碑A 场景简单，不需要寻路/避障，若后续场景变复杂再引入 NavMesh)；移动中可随时重新点击改变目标点，无需等待到达。
- **视角**：按住鼠标右键拖拽旋转水平/俯仰角；俯仰角限制在约 `[-60°, 70°]`，避免看到地底或完全仰视导致迷失方向。
- **交互触发**：鼠标悬停在可交互物体上出现高亮(描边或轻微发光)，左键点击触发对应动作状态机；若角色不在可交互范围内，先自动走近再触发(走近中若用户再次点击别处，取消前一个交互意图)。

### 进阶模式（可选，默认关闭）

- 设置面板开关；开启后启用 WASD 移动 + 鼠标自由视角(指针锁定 Pointer Lock API)。
- 两种模式共用同一套 `PlayerController` 接口，只是底层实现不同的 `IMovementStrategy`，便于后续根据第10节验证结果调整默认值。

### 开放决策（实现时可自行定，不需要等产品确认）

- 点击移动的具体速度曲线(匀速/加减速)。
- 高亮描边的具体颜色与粗细。
- 俯仰角的精确上下限数值，可在验证后微调。

---

## 4. 交互与动作状态机规格

### 4.0 通用基类

```ts
interface InteractableObject {
  id: string;
  type: 'tool' | 'crop' | 'animal' | 'container';
  position: Vector3;
  isReachable(playerPos: Vector3): boolean; // 距离与遮挡检测
  getAvailableAction(): ActionType | null;
}

abstract class ActionStateMachine {
  state: 'idle' | 'approaching' | 'inProgress' | 'confirming' | 'success' | 'cancelled' | 'failed';
  onInputStart(): void;   // 对应"输入"
  onTick(dt: number): void; // 对应"过程"
  onInputEnd(): void;     // 触发反馈/确认
  cancel(): void;         // 对应"取消"：必须保证不产生任何资源消耗或记录
  abstract getFailureReason(): FailureReason | null; // 对应"失败恢复"
}
```

**硬性规则**：任何动作状态机在 `cancelled` 或 `failed` 状态下，**不得调用 `ResourceSystem` 的扣减方法、不得写入 `LearningRecord`**。这是把设计文档"操作失误不计入知识错误"落到代码层面的关键约束，建议在代码评审时专门检查这一条。

### 4.1 拿取 PickupAction

状态转移：`idle → approaching(自动寻路靠近) → inProgress(抓握动画0.3~0.5s) → success(物体挂载到手部骨骼/占位点)`

- `cancel()`：`inProgress` 期间再次点击或松开触发，直接回到 `idle`，物体保持原位，不触发任何事件。
- `失败恢复`：进入 `approaching` 后检测到路径被遮挡/距离超限，转为 `failed`，播放"够不到"动效(建议：角色伸手落空的简短动画 + 轻音效)，立即允许重新触发，不记录失败次数。

### 4.2 浇水 WateringAction

状态转移：`idle → holding(持壶，等待瞄准) → pouring(按住期间持续) → idle`

- `onTick`：每帧对瞄准射线与地形/植株做碰撞检测，命中有效区域(菜畦/植株的"可浇水"包围盒)则：①播放水滴粒子与出水动画 ②对应 `CropGrowth` 实例的湿润度累加 ③`ResourceSystem.water -= rate * dt`。
- **关键规则**：命中无效区域(空地/已经浇够的植株)时，**不调用 `ResourceSystem.water -=`**，只播放"水花溅开、无变化"的轻反馈——这是把设计文档"落空不消耗资源"写进实现的具体位置。
- `cancel()`：松开按键或移开瞄准，`pouring → idle`，无需额外处理(本来就是正常停止)。
- `失败恢复`：水壶余量为0时自动停止出水，提示"水用完了"，不算失败，只是资源不足的正常状态。

### 4.3 喂食 FeedingAction（含"确认分配"流程）

状态转移：`idle → scooping(舀取动画) → holding(手持一份) → pouring(倾倒到目标食槽) → [重复 scooping~pouring] → confirming(弹出FeedConfirmPanel) → success(写入ResourceSystem.feed扣减与LearningRecord草稿) 或 cancelled(关闭面板不提交)`

- 每次 `scooping → holding` 只产生"待分配"的一份计数，暂存在 `FeedingAction` 实例内部，**不立即扣减 `ResourceSystem.feed`**。
- `holding` 状态下可以执行"倒回料袋"操作（`cancel()` 的一种），直接丢弃这一份暂存计数。
- 倒入某个食槽后，`confirming` 阶段的 `FeedConfirmPanel` 展示每个食槽当前份数，支持点击"取出一份"把份数挪回暂存池或直接丢弃。
- **只有在 `confirming` 阶段点击"确认"后**，才统一执行：`ResourceSystem.feed -= totalUsed`，并把最终每槽份数写入 `LearningRecord`(如果这次喂食对应一个学习任务)。点击"取消"则 `cancelled`，所有暂存计数作废，不消耗任何资源。
- `失败恢复`：料袋为空时 `scooping` 直接失败，提示"饲料用完了"，不计入错误。

### 4.4 收获 HarvestAction

状态转移：`idle → approaching → grasping(抓握0.3~0.5s) → detaching(脱离动画) → success(入篮)`

- `grasping` 期间松开 → `cancel()`，果实留在原植株，`idle`。
- **成熟度判定**：`Interactable`(作物实例)暴露 `isHarvestable(): boolean`。未成熟时：`grasping` 阶段检测到 `!isHarvestable()`，转入 `failed`，播放"轻微摇晃拒绝/摘下后弹回原位"动效，并提示"还没熟"文案，**不计入任务失败、不消耗/不生成任何物品**。
- 对带条件的收获任务(如"只摘成熟番茄")：若摘到的对象不满足任务条件(例如摘到了不要求的颜色/数量)，不要在交互层直接判定"任务失败"，而是允许"放回原位"——即篮子UI里对应项提供"放回"操作，把果实 `success` 状态回退、减少篮内计数、果实重新挂回植株为已采摘前状态。这是设计文档要求的"摘错后允许放回"在系统层面的落点。

---

## 5. 资源与经济系统（对应设计文档第3节）

```ts
interface ResourceState {
  sunlight: number;
  water: number;
  fertilizer: number;
  feed: number;
  coins: number;
}
```

### 免费 vs 消耗行为权限表

| 行为 | 是否消耗资源 | 实现位置 |
|---|---|---|
| 自由行走/观察 | 否 | PlayerController，不涉及 ResourceSystem |
| 抚摸/呼唤已拥有动物 | 否 | 独立的 `PetAction`，只播放动画，不接入 ActionStateMachine 的资源扣减逻辑 |
| 远观已成熟但不收获的作物 | 否 | 不触发 HarvestAction 即可 |
| 查看成长记录/相册 | 否 | GrowthJournal UI，纯读操作 |
| 用农场币买装饰/改名 | 否(消耗币不消耗学习资源) | 独立的商店系统，不在本文档范围，里程碑A可先做最简单的改名功能 |
| 播种 | 消耗 sunlight | 播种动作状态机(本文档未展开，结构同拿取+放置的组合) |
| 浇水 | 消耗 water | 见4.2 |
| 追肥 | 消耗 fertilizer | 结构同浇水 |
| 喂食 | 消耗 feed | 见4.3 |

**"每日保底资源"选项**(设计文档3.3节标注为待讨论)：实现上预留一个 `ResourceSystem.grantDailyBaseline(config)` 接口，默认不调用；产品侧确认是否启用后再决定是否在游戏启动时调用此方法。**不要在没有产品明确确认的情况下默认开启**。

### 任务实例去重账本 TaskLedger

```ts
interface TaskLedger {
  settledTaskInstanceIds: Set<string>;
  trySettle(taskInstanceId: string, grantFn: () => void): boolean; // 已存在则直接返回false，不执行grantFn
}
```

所有"完成学习任务发放资源"的入口必须经过 `TaskLedger.trySettle`，并持久化 `settledTaskInstanceIds` 到存档，防止刷新/重试重复发奖——这是设计文档第7节保留机制的具体实现点。

---

## 6. 作物与动物成长系统

```ts
type CropStage = 'seed' | 'sprout' | 'leafy' | 'flowering' | 'fruiting' | 'harvestable';

interface CropGrowth {
  stage: CropStage;
  careProgress: number;      // 由已投入资源+照料里程碑累加，不随真实时间自动增长
  advance(resourceUsed: ResourceType, amount: number): void;
  isHarvestable(): boolean;
}
```

- **生长驱动规则**：`careProgress` 只在玩家执行有效的浇水/施肥/喂食动作时增加(即4.2节"命中有效区域"的那部分才计入)，不挂钩系统时钟，满足设计文档"不因断签/资源不足导致枯萎、现实时间只用于安排复习"的要求。
- **离线保留进度**：游戏启动时直接从存档恢复 `stage` 和 `careProgress`，不做"离线期间自动扣血/生长"的计算，即无论离线多久，再次打开时状态与离线前一致。

动物成长同理，用 `AnimalGrowth` 状态机，阶段为 `chick → young → adult`，产蛋/产奶等行为挂在 `adult` 阶段且需要完成一次"照料里程碑"后触发。

---

## 7. 学习任务与证据记录（为里程碑B预留结构，里程碑A只做最简实现）

```ts
interface TopicRecord {
  topicId: string;        // 保留来源图谱的命名空间，如 goralcao:xxx
  subject: 'math' | 'chinese' | 'english';
  grade: number;
  sourceUrl?: string;
  sourceVersion?: string;  // 对应设计文档第4节"记录版本号/日期"的要求
}

interface LearningEvent {
  taskInstanceId: string;
  topicId: string;
  timestamp: number;
  mode: 'independent' | 'hinted' | 'transfer' | 'delayedReview';
  correct: boolean;
  hintsUsed: number;
}
```

- 里程碑A 不需要真正的出题/判分引擎，可以用**写死的几道示例题**(对应设计文档验证流程里的"分饲料""浇水"等场景)跑通"完成任务→TaskLedger结算→ResourceSystem发放→LearningEvent写入"的完整链路，重点验证链路通不通、去重生效，而不是题库完整性。
- `OfflineInsight.ts` 实现一个**规则驱动、非AI**的"学习记录解读"：基于 `LearningEvent` 的 `mode` 和 `correct` 字段，用预先写好的文本模板拼出类似设计文档材料A§9"面向孩子/面向家长"的两段话。这是里程碑A替代真实AI分析的占位实现，不是AI功能的完成品。

---

## 8. 存档系统

- 用 IndexedDB(建议 `idb-keyval` 或同类轻量封装)，单一 key 存一个 JSON 对象：

```ts
interface SaveData {
  version: number; // 存档结构版本号，用于后续迁移
  resources: ResourceState;
  crops: Record<string, CropGrowth>;
  animals: Record<string, AnimalGrowth>;
  settledTaskInstanceIds: string[];
  learningEvents: LearningEvent[];
  settings: { advancedControlMode: boolean };
}
```

- 启动时读取并按 `version` 做迁移(里程碑A版本号从 `1` 开始，预留迁移函数签名，不需要真的实现多版本迁移逻辑)。
- 关键事件(资源结算、成长阶段变化、动作confirm完成)后立即写入，不等定时器，避免中途关闭丢进度。

---

## 9. 程序生成美术资源的实现建议（通用路径，非对几猫源码的复用说明）

**重要说明**：本次没有拿到《几猫国产3A大作_V1.html》的原始文件，以下建议是通用的 Three.js 程序化内容实现路径，仅供起步参考。等拿到原始源码后，应该由工程直接评估哪些函数/技术可以移植，而不是按本节重新发明。

- **地形/菜畦/围栏/农舍**：用参数化的 `BoxGeometry`/`PlaneGeometry` 组合 + 简单噪声函数做地形起伏，不需要复杂的地形编辑器。
- **作物几何**：按 `CropStage` 切换不同的简化几何体或骨骼缩放，阶段间用 `THREE.AnimationMixer` 做过渡。
- **程序材质**：优先用 `Canvas2D` 生成贴图(木纹、土壤颗粒、湿润遮罩)喂给 `THREE.CanvasTexture`，比手写 GLSL shader 更快起步；湿润效果可以用一张动态生成的灰度遮罩贴图叠加暗色调。
- **角色手部与持物**：里程碑A 建议先用**简化的低多边形手部网格 + 预制关键帧动画**(拿起/倾倒/抓握/松开几个姿态之间插值)，不需要一开始复刻设计文档材料C描述的完整手指骨骼插值系统；等后续真正评估几猫源码的可复用程度后，再决定是否升级到更精细的程序化手部方案。
- **性能分级**：预留一个 `QualityManager`，根据简单的帧耗时采样动态调整阴影分辨率/粒子数量，对应设计文档对"性能可调节"的要求，不需要一开始做到几猫源码描述的复杂程度。

---

## 10. 验收标准与测试计划

### 10.1 自动化单元测试（建议覆盖）

- `TaskLedger.trySettle`：同一 taskInstanceId 重复调用只结算一次。
- 四个 `ActionStateMachine` 的 `cancel()` 路径：断言资源数值和 `LearningEvent` 列表均无变化。
- `CropGrowth.advance`：只有"命中有效区域"的调用才增加 `careProgress`。
- `SaveData` 的序列化/反序列化往返一致性。

### 10.2 人工测试清单（直接对应设计文档第6节的5~8分钟验证流程）

把设计文档第6节的流程原样列入 `tests/manual-checklist.md`，包括"故意浇错位置""故意喂错食槽""故意摘未成熟果实"这几个专门测试取消/失败恢复的步骤，并记录设计文档定义的成功/失败可观察标准。

### 10.3 性能基线测试

在目标最低配置(核显+1080p)下，记录场景满载(里程碑A范围：一块菜地+一棵果树+一个鸡舍)时的帧率，低于30fps则需要调低默认画质分级，而不是先假设达标。

---

## 11. 开发任务拆分与依赖顺序（按依赖关系排序，不做日历估算）

1. 项目脚手架(Vite + TypeScript + Three.js 基础场景能跑起来)。
2. `PlayerController` 默认模式(点击移动+拖拽视角)，可在空场景里走动。
3. `ResourceSystem` + `TaskLedger` 基础数据结构与单元测试。
4. `Interactable` 基类 + 一个最简单的可交互物体(先用一个占位方块验证交互触发流程)。
5. 依次实现四个动作状态机：拿取 → 浇水 → 收获 → 喂食(喂食涉及UI面板，复杂度最高，放最后)。
6. `CropGrowth` / `AnimalGrowth` 状态机，接入浇水/喂食/收获的调用。
7. `world/*` 程序化生成实际场景几何体，替换占位方块。
8. `SaveSystem` 接入，验证存档/读取/离线保留进度。
9. `LearningEvent` 写入链路 + `OfflineInsight` 规则文案。
10. 按第10.2节清单做人工测试，根据结果调整移动方案/交互细节。
11. 性能基线测试与画质分级接入。

每一步完成后建议直接可玩/可观察，不要攒到最后才能看到效果——这也方便随时对照设计文档第6节的验证标准检查。

---

## 12. 明确排除在里程碑A之外的内容（防止范围蔓延）

- 真实在线AI分析服务、家长开关、网络路径测试。
- 完整24个知识点/96题/5物种/6分区——里程碑A只需语数英各2~3个知识点、3个物种、1块菜地+1棵果树+1个鸡舍。
- 触屏适配。
- 多人/社交功能。
- 知识图谱的全量接入与许可审核流程落地(第4节的流程规定留给里程碑B前的内容生产阶段执行)。

---

## 13. 给实现者的开放决策清单（可自行决定，不需要等产品确认）

- 具体的动画时长、缓动曲线数值。
- 高亮/粒子特效的具体视觉参数。
- 代码里的具体类名/文件拆分方式(只要保持本文档定义的模块边界和硬性规则)。
- 点击移动的寻路实现细节(里程碑A场景简单可以直接直线移动)。

**不可自行决定、需要回头看设计文档或向产品确认的**：资源门槛是否放宽(3.3节)、移动方案最终是否保留默认点击模式(需第10.2节实测结果)、教材版本与题目审核责任人(设计文档第8节未定事项)。
