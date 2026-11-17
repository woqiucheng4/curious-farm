import {
  KNOWLEDGE_POINTS,
  LEARNING_TASKS,
  SUBJECT_LABELS,
} from './taskData';
import type { LearningSubject, LearningTaskFormat } from './taskData';

export interface LearningEvent {
  taskInstanceId: string;
  subject: LearningSubject;
  knowledgePointId: string;
  format: LearningTaskFormat;
}

export type EvidenceState = 'evidence-insufficient' | 'initially-mastered';

export interface KnowledgeEvidenceSummary {
  subject: LearningSubject;
  subjectLabel: string;
  knowledgePointId: string;
  knowledgePointName: string;
  completedTaskCount: number;
  state: EvidenceState;
  label: string;
  explanation: string;
}

/**
 * 离线、确定性的学习证据解读：只有同一知识点的基础题和迁移题都独立完成，
 * 才显示“初步会”。题量不足时始终保持“证据不足”，这里不推断智力、性格或错因。
 */
export function interpretLearningEvents(events: LearningEvent[]): KnowledgeEvidenceSummary[] {
  const knownTaskIds = new Set(LEARNING_TASKS.map((task) => task.instanceId));
  const validEvents = events.filter((event) => knownTaskIds.has(event.taskInstanceId));

  return KNOWLEDGE_POINTS.map((point) => {
    const pointEvents = validEvents.filter((event) => event.knowledgePointId === point.id);
    const completedTaskIds = new Set(pointEvents.map((event) => event.taskInstanceId));
    const formats = new Set(pointEvents.map((event) => event.format));
    const hasIndependentConfirmation = formats.has('basic') && formats.has('transfer');

    if (!hasIndependentConfirmation) {
      return {
        subject: point.subject,
        subjectLabel: SUBJECT_LABELS[point.subject],
        knowledgePointId: point.id,
        knowledgePointName: point.name,
        completedTaskCount: completedTaskIds.size,
        state: 'evidence-insufficient',
        label: '证据不足',
        explanation: '还需要完成基础题和迁移题，暂不输出掌握率或原因判断。',
      };
    }

    return {
      subject: point.subject,
      subjectLabel: SUBJECT_LABELS[point.subject],
      knowledgePointId: point.id,
      knowledgePointName: point.name,
      completedTaskCount: completedTaskIds.size,
      state: 'initially-mastered',
      label: '初步会',
      explanation: '已完成基础题和迁移题；仍需后续新任务确认，不作长期结论。',
    };
  });
}
