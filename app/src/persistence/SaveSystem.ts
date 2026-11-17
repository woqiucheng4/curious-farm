import { get, set } from 'idb-keyval';
import type { ResourceSnapshot } from '../economy/ResourceSystem';
import type { LearningTaskSnapshot } from '../learning/StudyTaskSystem';
import type { CarrotSnapshot } from '../world/Sprout';
import type { ChickenSnapshot } from '../world/Chicken';
import type { AppleTreeSnapshot } from '../world/AppleTree';

export interface FarmSaveData {
  version: 1;
  resources: ResourceSnapshot;
  carrot: CarrotSnapshot;
  chicken: ChickenSnapshot;
  /** 旧版 v1 存档没有苹果树字段；读取时交给 AppleTree 使用默认果实。 */
  appleTree?: AppleTreeSnapshot;
  learning: LearningTaskSnapshot;
}

const SAVE_KEY = 'curious-farm-milestone-a-save';

/** IndexedDB 存档：排队写入，避免连续点击时旧快照覆盖新快照。 */
export class SaveSystem {
  private writeChain: Promise<void> = Promise.resolve();

  async load(): Promise<FarmSaveData | undefined> {
    try {
      const data = await get<FarmSaveData>(SAVE_KEY);
      return data?.version === 1 ? data : undefined;
    } catch (error) {
      console.warn('无法读取农场存档，将使用新存档开始。', error);
      return undefined;
    }
  }

  save(data: FarmSaveData): Promise<void> {
    const snapshot = this.clone(data);
    this.writeChain = this.writeChain.catch(() => undefined).then(() => set(SAVE_KEY, snapshot));
    return this.writeChain;
  }

  private clone(data: FarmSaveData): FarmSaveData {
    return {
      version: 1,
      resources: { ...data.resources },
      carrot: { ...data.carrot },
      chicken: { ...data.chicken },
      appleTree: { fruits: data.appleTree?.fruits.map((fruit) => ({ ...fruit })) ?? [] },
      learning: { completedTaskIds: [...data.learning.completedTaskIds] },
    };
  }
}
