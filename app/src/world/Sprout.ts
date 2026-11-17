import * as THREE from 'three';
import { ResourceSystem } from '../economy/ResourceSystem';
import type { Interactable } from '../interaction/Interactable';

export type CarrotGrowthStage = 'seed' | 'sprout' | 'leafy' | 'harvestable' | 'harvested';

export interface CarrotSnapshot {
  stage: CarrotGrowthStage;
  wetness: number;
  harvestedCount: number;
}

const CARROT_STAGES: CarrotGrowthStage[] = [
  'seed',
  'sprout',
  'leafy',
  'harvestable',
  'harvested',
];

/**
 * 保留 Sprout 这个既有文件名，同时把场景里的第一株作物实现为完整的胡萝卜状态机。
 * 成长只由有效浇水、阳光照料和施肥照料推进；不会读取真实时间。
 */
export class Sprout implements Interactable {
  object3D: THREE.Group;
  interactionRange = 1.8;

  onFeedback: (message: string) => void = () => {};
  onStateChange: () => void = () => {};
  onHarvest: () => void = () => {};

  private readonly resourceSystem: ResourceSystem;
  private stage: CarrotGrowthStage = 'seed';
  /** 0 为干燥、1 为浇透；仅用于“种子 → 发芽”的照料里程碑。 */
  private wetness = 0;
  private harvestedCount = 0;
  private readonly wetnessPerSecond = 0.25;
  private readonly waterCostPerSecond = 2;

  private isPouring = false;
  private isHarvesting = false;
  private harvestProgress = 0;
  private readonly harvestDuration = 0.4;

  private soilMesh: THREE.Mesh;
  private waterDropMesh: THREE.Mesh;
  private seedMesh: THREE.Mesh;
  private sproutMesh: THREE.Mesh;
  private leafyMesh: THREE.Group;
  private carrotMesh: THREE.Mesh;

  private readonly dryColor = new THREE.Color(0x8b6b4a);
  private readonly wetColor = new THREE.Color(0x4a3524);

  constructor(
    position: THREE.Vector3,
    resourceSystem: ResourceSystem,
    snapshot?: Partial<CarrotSnapshot>
  ) {
    this.resourceSystem = resourceSystem;
    this.object3D = new THREE.Group();
    this.object3D.position.copy(position);

    const soilMaterial = new THREE.MeshStandardMaterial({ color: this.dryColor });
    this.soilMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.1, 16), soilMaterial);
    this.soilMesh.position.y = 0.05;
    this.object3D.add(this.soilMesh);

    this.seedMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc08a45 })
    );
    this.seedMesh.position.y = 0.14;
    this.object3D.add(this.seedMesh);

    this.sproutMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.56, 8),
      new THREE.MeshStandardMaterial({ color: 0x58a64f })
    );
    this.sproutMesh.position.y = 0.4;
    this.object3D.add(this.sproutMesh);

    this.leafyMesh = new THREE.Group();
    for (let index = 0; index < 5; index += 1) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.52, 6),
        new THREE.MeshStandardMaterial({ color: 0x3f8f45 })
      );
      const angle = (index / 5) * Math.PI * 2;
      leaf.position.set(Math.sin(angle) * 0.11, 0.48, Math.cos(angle) * 0.11);
      leaf.rotation.x = Math.cos(angle) * 0.55;
      leaf.rotation.z = Math.sin(angle) * 0.55;
      this.leafyMesh.add(leaf);
    }
    this.object3D.add(this.leafyMesh);

    this.carrotMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.48, 10),
      new THREE.MeshStandardMaterial({ color: 0xf28c28 })
    );
    this.carrotMesh.rotation.x = Math.PI;
    this.carrotMesh.position.y = 0.26;
    this.object3D.add(this.carrotMesh);

    this.waterDropMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7 })
    );
    this.waterDropMesh.position.set(0, 1.2, 0);
    this.waterDropMesh.visible = false;
    this.object3D.add(this.waterDropMesh);

    this.restore(snapshot);
  }

  /** 按住种子浇水；成熟后改为按住采摘，其他阶段给温和的引导。 */
  onInteract() {
    if (this.stage === 'seed') {
      this.startWatering();
      return;
    }

    if (this.stage === 'harvestable') {
      this.startHarvesting();
      return;
    }

    if (this.stage === 'harvested') {
      this.onFeedback('这根胡萝卜已经在篮子里了');
      return;
    }

    this.onFeedback('还没长好，再完成下一次照料吧');
  }

  /** 松开浇水或采摘都会立即取消当前过程，不会扣除新的资源或写入记录。 */
  onInteractEnd() {
    if (this.isPouring) {
      this.isPouring = false;
      this.waterDropMesh.visible = false;
      return;
    }

    if (this.isHarvesting) {
      this.isHarvesting = false;
      this.harvestProgress = 0;
      this.carrotMesh.position.y = 0.26;
      this.onFeedback('松开了，胡萝卜还留在土里');
    }
  }

  /** 每帧推进浇水或抓握过程。 */
  update(dt: number) {
    if (this.isPouring) {
      this.updateWatering(dt);
    }

    if (this.isHarvesting) {
      this.updateHarvesting(dt);
    }
  }

  /** 只有照料完全部三个阶段后才允许采摘。 */
  isHarvestable(): boolean {
    return this.stage === 'harvestable';
  }

  /** 发芽后消耗一份阳光，推进到长叶；条件不满足时不消耗。 */
  applySunlightCare(): boolean {
    if (this.stage !== 'sprout') {
      this.onFeedback('胡萝卜现在不需要阳光照料');
      return false;
    }
    if (!this.resourceSystem.trySpendSunlight(1)) {
      this.onFeedback('阳光不够，先完成一个学习任务吧');
      return false;
    }

    this.setStage('leafy');
    this.onFeedback('阳光照料完成，胡萝卜长出叶子了');
    return true;
  }

  /** 长叶后消耗一份肥料，推进为可收获；条件不满足时不消耗。 */
  applyFertilizerCare(): boolean {
    if (this.stage !== 'leafy') {
      this.onFeedback('胡萝卜还没到施肥阶段');
      return false;
    }
    if (!this.resourceSystem.trySpendFertilizer(1)) {
      this.onFeedback('肥料不够，先完成一个学习任务吧');
      return false;
    }

    this.setStage('harvestable');
    this.onFeedback('胡萝卜成熟了！按住它可以采摘');
    return true;
  }

  getWetness(): number {
    return this.wetness;
  }

  getStage(): CarrotGrowthStage {
    return this.stage;
  }

  getStageLabel(): string {
    const labels: Record<CarrotGrowthStage, string> = {
      seed: '种子（需要浇水）',
      sprout: '发芽（需要阳光照料）',
      leafy: '长叶（需要施肥）',
      harvestable: '可收获',
      harvested: '已收获',
    };
    return labels[this.stage];
  }

  getSnapshot(): CarrotSnapshot {
    return {
      stage: this.stage,
      wetness: this.wetness,
      harvestedCount: this.harvestedCount,
    };
  }

  /** 读档只恢复已保存的状态，绝不会按离线时间自动成长或枯萎。 */
  restore(snapshot?: Partial<CarrotSnapshot>) {
    if (snapshot?.stage && CARROT_STAGES.includes(snapshot.stage)) {
      this.stage = snapshot.stage;
    }
    if (typeof snapshot?.wetness === 'number' && Number.isFinite(snapshot.wetness)) {
      this.wetness = THREE.MathUtils.clamp(snapshot.wetness, 0, 1);
    }
    if (
      typeof snapshot?.harvestedCount === 'number' &&
      Number.isFinite(snapshot.harvestedCount) &&
      snapshot.harvestedCount >= 0
    ) {
      this.harvestedCount = Math.floor(snapshot.harvestedCount);
    }
    this.updateVisuals();
  }

  private startWatering() {
    if (this.wetness >= 1 || this.resourceSystem.water <= 0) {
      this.onFeedback('水壶没水了，先去完成一个学习任务吧');
      return;
    }
    this.isPouring = true;
    this.waterDropMesh.visible = true;
  }

  private updateWatering(dt: number) {
    const remainingWetness = Math.max(0, 1 - this.wetness);
    const wetnessAdded = Math.min(this.wetnessPerSecond * dt, remainingWetness);
    const waterNeeded = (wetnessAdded / this.wetnessPerSecond) * this.waterCostPerSecond;

    // 先确认此时仍在对正确作物有效浇灌，再尝试扣水。
    const spent = this.resourceSystem.trySpendWater(waterNeeded);
    if (!spent) {
      this.isPouring = false;
      this.waterDropMesh.visible = false;
      this.onFeedback('水壶没水了，先去完成一个学习任务吧');
      return;
    }

    this.wetness = Math.min(1, this.wetness + wetnessAdded);
    const material = this.soilMesh.material as THREE.MeshStandardMaterial;
    material.color.lerpColors(this.dryColor, this.wetColor, this.wetness);
    this.waterDropMesh.position.y = 1.1 + Math.sin(performance.now() / 150) * 0.05;
    this.onStateChange();

    if (this.wetness >= 1) {
      this.isPouring = false;
      this.waterDropMesh.visible = false;
      this.setStage('sprout');
      this.onFeedback('浇好了！胡萝卜发芽了');
    }
  }

  private startHarvesting() {
    this.isHarvesting = true;
    this.harvestProgress = 0;
    this.onFeedback('轻轻拔起胡萝卜…松开可以取消');
  }

  private updateHarvesting(dt: number) {
    this.harvestProgress = Math.min(1, this.harvestProgress + dt / this.harvestDuration);
    this.carrotMesh.position.y = 0.26 + this.harvestProgress * 0.4;

    if (this.harvestProgress < 1) return;

    this.isHarvesting = false;
    this.harvestedCount += 1;
    this.setStage('harvested');
    this.onHarvest();
    this.onFeedback('收获成功！胡萝卜已放入篮子');
  }

  private setStage(stage: CarrotGrowthStage) {
    this.stage = stage;
    this.updateVisuals();
    this.onStateChange();
  }

  private updateVisuals() {
    this.seedMesh.visible = this.stage === 'seed';
    this.sproutMesh.visible = this.stage === 'sprout';
    this.leafyMesh.visible = this.stage === 'leafy' || this.stage === 'harvestable';
    this.carrotMesh.visible = this.stage === 'harvestable';
    this.waterDropMesh.visible = this.isPouring;

    const material = this.soilMesh.material as THREE.MeshStandardMaterial;
    material.color.lerpColors(this.dryColor, this.wetColor, this.wetness);
  }
}
