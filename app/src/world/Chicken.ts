import * as THREE from 'three';
import type { Interactable } from '../interaction/Interactable';

export type ChickenGrowthStage = 'chick' | 'young' | 'adult';

export interface ChickenSnapshot {
  stage: ChickenGrowthStage;
  confirmedFeedPortions: number;
  careCycles: number;
  eggs: number;
}

/**
 * 小鸡只在“确认分配”后接收饲料。它的成长不依赖时间：
 * 一次已确认的照料会成为里程碑，累计投入的饲料满足阈值才会升级。
 */
export class Chicken implements Interactable {
  object3D: THREE.Group;
  interactionRange = 1.7;

  onFeedback: (message: string) => void = () => {};
  onStateChange: () => void = () => {};

  private stage: ChickenGrowthStage = 'chick';
  private confirmedFeedPortions = 0;
  private careCycles = 0;
  private eggs = 0;
  private readonly label: string;
  private bodyMesh: THREE.Mesh;
  private headMesh: THREE.Mesh;
  private combMesh: THREE.Mesh;

  constructor(position: THREE.Vector3, snapshot?: Partial<ChickenSnapshot>, label = '小鸡') {
    this.label = label;
    this.object3D = new THREE.Group();
    this.object3D.position.copy(position);

    this.bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xffdc54 })
    );
    this.bodyMesh.position.y = 0.38;
    this.object3D.add(this.bodyMesh);

    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe16a })
    );
    this.headMesh.position.set(0.18, 0.68, 0.05);
    this.object3D.add(this.headMesh);

    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.14, 6),
      new THREE.MeshStandardMaterial({ color: 0xf4a72c })
    );
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.37, 0.67, 0.05);
    this.object3D.add(beak);

    this.combMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xd94b47 })
    );
    this.combMesh.position.set(0.17, 0.9, 0.05);
    this.object3D.add(this.combMesh);

    this.restore(snapshot);
  }

  /** 抚摸小鸡是免费互动，不推进成长也不消耗资源。 */
  onInteract() {
    this.onFeedback(`${this.label}开心地“叽叽”叫了一声`);
  }

  /** 只能由 FeedingSession 的“确认”路径调用。 */
  receiveConfirmedFeed(portions: number) {
    if (!Number.isFinite(portions) || portions <= 0) return;

    const previousStage = this.stage;
    this.confirmedFeedPortions += Math.floor(portions);
    this.careCycles += 1;
    this.updateStage();

    if (previousStage === 'adult' && this.stage === 'adult') {
      this.eggs += 1;
      this.onFeedback(`${this.label}完成一轮照料，产下了一个鸡蛋！`);
    } else if (this.stage !== previousStage) {
      this.onFeedback(`照料完成，${this.label}成长为${this.getStageLabel()}了！`);
    } else {
      this.onFeedback(`${this.label}吃得很开心，继续照料它吧`);
    }
    this.onStateChange();
  }

  getStage(): ChickenGrowthStage {
    return this.stage;
  }

  getStageLabel(): string {
    const labels: Record<ChickenGrowthStage, string> = {
      chick: '雏鸡',
      young: '小鸡',
      adult: '成年母鸡',
    };
    return labels[this.stage];
  }

  getSnapshot(): ChickenSnapshot {
    return {
      stage: this.stage,
      confirmedFeedPortions: this.confirmedFeedPortions,
      careCycles: this.careCycles,
      eggs: this.eggs,
    };
  }

  getSummary(): string {
    return `${this.label}：${this.getStageLabel()}｜已喂 ${this.confirmedFeedPortions} 份｜照料 ${this.careCycles} 次｜鸡蛋 ${this.eggs} 枚`;
  }

  /** 读档保持当时阶段，不根据离线时长改变成长或健康状态。 */
  restore(snapshot?: Partial<ChickenSnapshot>) {
    if (snapshot?.stage === 'chick' || snapshot?.stage === 'young' || snapshot?.stage === 'adult') {
      this.stage = snapshot.stage;
    }
    this.confirmedFeedPortions = this.toWholeNumber(snapshot?.confirmedFeedPortions);
    this.careCycles = this.toWholeNumber(snapshot?.careCycles);
    this.eggs = this.toWholeNumber(snapshot?.eggs);
    this.updateVisuals();
  }

  private updateStage() {
    if (this.confirmedFeedPortions >= 3 && this.careCycles >= 2) {
      this.stage = 'adult';
    } else if (this.confirmedFeedPortions >= 1 && this.careCycles >= 1) {
      this.stage = 'young';
    }
    this.updateVisuals();
  }

  private updateVisuals() {
    const scale = this.stage === 'chick' ? 0.85 : this.stage === 'young' ? 1 : 1.2;
    this.bodyMesh.scale.setScalar(scale);
    this.headMesh.scale.setScalar(scale);
    this.combMesh.visible = this.stage === 'adult';

    const bodyMaterial = this.bodyMesh.material as THREE.MeshStandardMaterial;
    bodyMaterial.color.set(this.stage === 'adult' ? 0xfff2df : 0xffdc54);
  }

  private toWholeNumber(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 0;
  }
}
