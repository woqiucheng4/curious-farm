import type { ResourceReward } from '../economy/ResourceSystem';

export type LearningSubject = 'chinese' | 'math' | 'english';
export type LearningTaskFormat = 'basic' | 'transfer';

export interface LearningOption {
  id: string;
  text: string;
}

export interface LearningTaskDefinition {
  instanceId: string;
  subject: LearningSubject;
  knowledgePointId: string;
  knowledgePointName: string;
  format: LearningTaskFormat;
  title: string;
  prompt: string;
  options: LearningOption[];
  correctOptionId: string;
  explanation: string;
  reward: ResourceReward;
}

export interface KnowledgePointDefinition {
  id: string;
  subject: LearningSubject;
  name: string;
}

export const SUBJECT_LABELS: Record<LearningSubject, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
};

/** 里程碑 A 的原创题目数据：每科两个知识点，每个知识点有基础与迁移两道独立题。 */
export const LEARNING_TASKS: LearningTaskDefinition[] = [
  {
    instanceId: 'chinese-growth-order-basic-001',
    subject: 'chinese',
    knowledgePointId: 'chinese-growth-order',
    knowledgePointName: '观察顺序',
    format: 'basic',
    title: '给胡萝卜成长排顺序',
    prompt: '请选出胡萝卜从开始种植到长叶的正确顺序。',
    options: [
      { id: 'a', text: '播种 → 浇水 → 发芽 → 长叶' },
      { id: 'b', text: '浇水 → 播种 → 长叶 → 发芽' },
      { id: 'c', text: '发芽 → 播种 → 浇水 → 长叶' },
    ],
    correctOptionId: 'a',
    explanation: '先把种子放进土里，再浇水，才会发芽并长出叶子。',
    reward: { water: 1 },
  },
  {
    instanceId: 'chinese-growth-order-transfer-001',
    subject: 'chinese',
    knowledgePointId: 'chinese-growth-order',
    knowledgePointName: '观察顺序',
    format: 'transfer',
    title: '给苹果生长排顺序',
    prompt: '树上会先开花，再结青果，最后成熟。哪一组顺序正确？',
    options: [
      { id: 'a', text: '熟果 → 开花 → 青果' },
      { id: 'b', text: '开花 → 青果 → 熟果' },
      { id: 'c', text: '青果 → 熟果 → 开花' },
    ],
    correctOptionId: 'b',
    explanation: '花谢后才会结出青果，青果继续成长才成为熟果。',
    reward: { sunlight: 1 },
  },
  {
    instanceId: 'chinese-harvest-conditions-basic-001',
    subject: 'chinese',
    knowledgePointId: 'chinese-harvest-conditions',
    knowledgePointName: '提取限制条件',
    format: 'basic',
    title: '读懂苹果订单',
    prompt: '订单写着“请装入 2 个成熟红苹果，青苹果留在树上”。应该怎么做？',
    options: [
      { id: 'a', text: '摘 2 个成熟红苹果，青苹果不摘' },
      { id: 'b', text: '摘 2 个青苹果，成熟苹果不摘' },
      { id: 'c', text: '把看到的苹果全摘下来' },
    ],
    correctOptionId: 'a',
    explanation: '要同时满足数量、成熟和颜色三个条件。',
    reward: { fertilizer: 1 },
  },
  {
    instanceId: 'chinese-harvest-conditions-transfer-001',
    subject: 'chinese',
    knowledgePointId: 'chinese-harvest-conditions',
    knowledgePointName: '提取限制条件',
    format: 'transfer',
    title: '读懂胡萝卜提示',
    prompt: '提示写着“只拔长叶、已经成熟的胡萝卜，不动刚发芽的苗”。哪种做法正确？',
    options: [
      { id: 'a', text: '先判断成熟，再采摘长叶胡萝卜' },
      { id: 'b', text: '只要看到绿色叶子就采摘' },
      { id: 'c', text: '先采摘刚发芽的苗' },
    ],
    correctOptionId: 'a',
    explanation: '“长叶、成熟”都是不能漏掉的限制条件。',
    reward: { water: 1 },
  },
  {
    instanceId: 'math-average-feed-001',
    subject: 'math',
    knowledgePointId: 'math-average-sharing',
    knowledgePointName: '平均分',
    format: 'basic',
    title: '平均分饲料',
    prompt: '把 12 份饲料平均放进 3 个食槽，每个食槽放几份？',
    options: [
      { id: 'a', text: '3 份' },
      { id: 'b', text: '4 份' },
      { id: 'c', text: '6 份' },
    ],
    correctOptionId: 'b',
    explanation: '12 ÷ 3 = 4，每个食槽都是 4 份。',
    reward: { feed: 2 },
  },
  {
    instanceId: 'math-average-sharing-transfer-001',
    subject: 'math',
    knowledgePointId: 'math-average-sharing',
    knowledgePointName: '平均分',
    format: 'transfer',
    title: '平均装胡萝卜',
    prompt: '把 8 根胡萝卜平均装进 2 个篮子，每个篮子放几根？',
    options: [
      { id: 'a', text: '2 根' },
      { id: 'b', text: '4 根' },
      { id: 'c', text: '6 根' },
    ],
    correctOptionId: 'b',
    explanation: '8 ÷ 2 = 4，两个篮子里的数量一样多。',
    reward: { water: 1 },
  },
  {
    instanceId: 'math-row-column-basic-001',
    subject: 'math',
    knowledgePointId: 'math-row-column',
    knowledgePointName: '行列乘法',
    format: 'basic',
    title: '数菜畦里的幼苗',
    prompt: '菜畦有 3 行，每行 4 株幼苗，一共有几株？',
    options: [
      { id: 'a', text: '7 株' },
      { id: 'b', text: '12 株' },
      { id: 'c', text: '16 株' },
    ],
    correctOptionId: 'b',
    explanation: '3 行各有 4 株，3 × 4 = 12。',
    reward: { sunlight: 1 },
  },
  {
    instanceId: 'math-row-column-transfer-001',
    subject: 'math',
    knowledgePointId: 'math-row-column',
    knowledgePointName: '行列乘法',
    format: 'transfer',
    title: '数围栏木桩',
    prompt: '农场摆了 5 组木桩，每组 2 根，一共有几根？',
    options: [
      { id: 'a', text: '7 根' },
      { id: 'b', text: '10 根' },
      { id: 'c', text: '12 根' },
    ],
    correctOptionId: 'b',
    explanation: '5 组各有 2 根，5 × 2 = 10。',
    reward: { fertilizer: 1 },
  },
  {
    instanceId: 'english-color-count-basic-001',
    subject: 'english',
    knowledgePointId: 'english-color-count',
    knowledgePointName: '颜色与数量',
    format: 'basic',
    title: 'English fruit request',
    prompt: '“Two red apples, please.” 应该准备哪一组？',
    options: [
      { id: 'a', text: '2 个红苹果' },
      { id: 'b', text: '2 个青苹果' },
      { id: 'c', text: '3 个红苹果' },
    ],
    correctOptionId: 'a',
    explanation: 'two 是 2，red apples 是红苹果。',
    reward: { feed: 2 },
  },
  {
    instanceId: 'english-color-count-transfer-001',
    subject: 'english',
    knowledgePointId: 'english-color-count',
    knowledgePointName: '颜色与数量',
    format: 'transfer',
    title: 'English egg request',
    prompt: '“Three yellow eggs, please.” 应该准备哪一组？',
    options: [
      { id: 'a', text: '2 个黄鸡蛋' },
      { id: 'b', text: '3 个白鸡蛋' },
      { id: 'c', text: '3 个黄鸡蛋' },
    ],
    correctOptionId: 'c',
    explanation: 'three 是 3，yellow eggs 是黄鸡蛋。',
    reward: { water: 1 },
  },
  {
    instanceId: 'english-location-basic-001',
    subject: 'english',
    knowledgePointId: 'english-location',
    knowledgePointName: '方位表达',
    format: 'basic',
    title: 'Find the basket',
    prompt: '“The basket is under the tree.” 表示果篮在树的哪里？',
    options: [
      { id: 'a', text: '树下' },
      { id: 'b', text: '树上' },
      { id: 'c', text: '树后' },
    ],
    correctOptionId: 'a',
    explanation: 'under 表示“在……下面”。',
    reward: { sunlight: 1 },
  },
  {
    instanceId: 'english-location-transfer-001',
    subject: 'english',
    knowledgePointId: 'english-location',
    knowledgePointName: '方位表达',
    format: 'transfer',
    title: 'Find the water can',
    prompt: '“The water can is beside the coop.” 表示水壶在鸡舍哪里？',
    options: [
      { id: 'a', text: '鸡舍旁边' },
      { id: 'b', text: '鸡舍里面' },
      { id: 'c', text: '鸡舍上面' },
    ],
    correctOptionId: 'a',
    explanation: 'beside 表示“在……旁边”。',
    reward: { fertilizer: 1 },
  },
];

export const KNOWLEDGE_POINTS: KnowledgePointDefinition[] = [
  { id: 'chinese-growth-order', subject: 'chinese', name: '观察顺序' },
  { id: 'chinese-harvest-conditions', subject: 'chinese', name: '提取限制条件' },
  { id: 'math-average-sharing', subject: 'math', name: '平均分' },
  { id: 'math-row-column', subject: 'math', name: '行列乘法' },
  { id: 'english-color-count', subject: 'english', name: '颜色与数量' },
  { id: 'english-location', subject: 'english', name: '方位表达' },
];
