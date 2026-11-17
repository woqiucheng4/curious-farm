import * as THREE from 'three';
import type { Interactable } from '../interaction/Interactable';

export type AppleStage = 'unripe' | 'mature';

export interface AppleFruitSnapshot {
  id: string;
  stage: AppleStage;
  picked: boolean;
}

export interface AppleTreeSnapshot {
  fruits: AppleFruitSnapshot[];
}

interface AppleDefinition {
  id: string;
  offset: THREE.Vector3;
  stage: AppleStage;
}

const APPLE_DEFINITIONS: AppleDefinition[] = [
  // z 为正的一侧朝向初始相机，确保每个可交互果实都不会被树冠遮住。
  { id: 'apple-a', offset: new THREE.Vector3(-0.62, 1.72, 1.32), stage: 'mature' },
  { id: 'apple-b', offset: new THREE.Vector3(0.58, 1.92, 1.28), stage: 'unripe' },
  { id: 'apple-c', offset: new THREE.Vector3(-0.08, 2.42, 1.2), stage: 'mature' },
  { id: 'apple-d', offset: new THREE.Vector3(0.24, 1.48, 1.46), stage: 'unripe' },
];

/**
 * 果树本体始终留在场景；每个苹果是独立 Interactable，因此成熟度、采摘与存档互不影响。
 */
export class AppleTree {
  object3D: THREE.Group;
  fruits: AppleFruit[];

  onFeedback: (message: string) => void = () => {};
  onStateChange: () => void = () => {};

  constructor(position: THREE.Vector3, snapshot?: Partial<AppleTreeSnapshot>) {
    this.object3D = this.createTree(position);
    const snapshotById = new Map(snapshot?.fruits?.map((fruit) => [fruit.id, fruit]));
    this.fruits = APPLE_DEFINITIONS.map((definition) => {
      const savedFruit = snapshotById.get(definition.id);
      const fruit = new AppleFruit(
        definition.id,
        position.clone().add(definition.offset),
        savedFruit?.stage ?? definition.stage,
        savedFruit?.picked ?? false
      );
      fruit.onFeedback = (message) => this.onFeedback(message);
      fruit.onStateChange = () => this.onStateChange();
      return fruit;
    });
  }

  getSnapshot(): AppleTreeSnapshot {
    return { fruits: this.fruits.map((fruit) => fruit.getSnapshot()) };
  }

  getSummary(): string {
    const fruits = this.fruits.map((fruit) => fruit.getSnapshot());
    const mature = fruits.filter((fruit) => fruit.stage === 'mature' && !fruit.picked).length;
    const unripe = fruits.filter((fruit) => fruit.stage === 'unripe' && !fruit.picked).length;
    const picked = fruits.filter((fruit) => fruit.picked).length;
    return `成熟 ${mature} 个｜未成熟 ${unripe} 个｜已摘 ${picked} 个`;
  }

  getPickedCount(): number {
    return this.fruits.filter((fruit) => fruit.getSnapshot().picked).length;
  }

  private createTree(position: THREE.Vector3): THREE.Group {
    const tree = new THREE.Group();
    tree.position.copy(position);
    tree.name = 'apple-tree';

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.38, 2.15, 10),
      new THREE.MeshStandardMaterial({ color: 0x7b4b2a })
    );
    trunk.position.y = 1.08;
    tree.add(trunk);

    const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x3f8f45 });
    const canopyPositions = [
      new THREE.Vector3(-0.55, 2.25, 0),
      new THREE.Vector3(0.5, 2.35, 0.05),
      new THREE.Vector3(0, 2.75, -0.15),
      new THREE.Vector3(0, 2.05, 0.55),
    ];
    for (const canopyPosition of canopyPositions) {
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), canopyMaterial);
      canopy.position.copy(canopyPosition);
      tree.add(canopy);
    }
    return tree;
  }
}

/** 一个苹果的独立收获状态机；不成熟分支没有资源或学习记录副作用。 */
export class AppleFruit implements Interactable {
  object3D: THREE.Group;
  // 果实分布在高且横向展开的树冠内；初始出生点约 5 个单位外，仍会触发自动走近。
  interactionRange = 4;

  onFeedback: (message: string) => void = () => {};
  onStateChange: () => void = () => {};

  private readonly id: string;
  private stage: AppleStage;
  private picked: boolean;
  private isHarvesting = false;
  private harvestProgress = 0;
  private readonly harvestDuration = 0.4;
  private appleMesh: THREE.Mesh;
  private leafMesh: THREE.Mesh;
  private hitAreaMesh: THREE.Mesh;
  private readonly initialLocalY: number;
  private readonly initialLeafY: number;

  constructor(id: string, position: THREE.Vector3, stage: AppleStage, picked: boolean) {
    this.id = id;
    this.stage = stage;
    this.picked = picked;
    this.object3D = new THREE.Group();
    this.object3D.name = id;
    // InteractionManager 的靠近计算使用 object3D.position，根节点必须留在地面。
    this.object3D.position.set(position.x, 0, position.z);
    this.initialLocalY = position.y;
    this.initialLeafY = position.y + 0.14;

    const appleMaterial = new THREE.MeshStandardMaterial({
      color: stage === 'mature' ? 0xd84b3e : 0xc4d85e,
    });
    this.appleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), appleMaterial);
    this.appleMesh.position.y = this.initialLocalY;
    this.object3D.add(this.appleMesh);

    this.leafMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.26, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a9a48 })
    );
    this.leafMesh.position.set(0.1, this.initialLeafY, 0);
    this.leafMesh.rotation.z = Math.PI / 3;
    this.object3D.add(this.leafMesh);

    // 透明命中区扩大鼠标点击容错，不改变苹果的可见尺寸或业务状态。
    this.hitAreaMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    this.hitAreaMesh.position.y = this.initialLocalY;
    this.object3D.add(this.hitAreaMesh);
    this.updateVisuals();
  }

  onInteract() {
    if (this.picked) {
      this.onFeedback('这个苹果已经摘下来了');
      return;
    }
    if (this.stage === 'unripe') {
      this.onFeedback('这个苹果还没熟，先留在树上吧');
      return;
    }

    this.isHarvesting = true;
    this.harvestProgress = 0;
    this.onFeedback('轻轻摘苹果…松开可以取消');
  }

  onInteractEnd() {
    if (!this.isHarvesting) return;
    this.isHarvesting = false;
    this.harvestProgress = 0;
    this.appleMesh.position.y = this.initialLocalY;
    this.leafMesh.position.y = this.initialLeafY;
    this.onFeedback('松开了，苹果还留在树上');
  }

  update(dt: number) {
    if (!this.isHarvesting) return;

    this.harvestProgress = Math.min(1, this.harvestProgress + dt / this.harvestDuration);
    this.appleMesh.position.y = this.initialLocalY + this.harvestProgress * 0.35;
    this.leafMesh.position.y = this.initialLeafY + this.harvestProgress * 0.2;

    if (this.harvestProgress < 1) return;

    this.isHarvesting = false;
    this.picked = true;
    this.updateVisuals();
    this.onStateChange();
    this.onFeedback('收获成功！苹果已放入篮子');
  }

  getSnapshot(): AppleFruitSnapshot {
    return { id: this.id, stage: this.stage, picked: this.picked };
  }

  private updateVisuals() {
    this.appleMesh.visible = !this.picked;
    this.leafMesh.visible = !this.picked;
    this.hitAreaMesh.visible = !this.picked;
  }
}
