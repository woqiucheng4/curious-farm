import * as THREE from 'three';
import type { Interactable } from '../interaction/Interactable';
import { ResourceSystem } from '../economy/ResourceSystem';

/**
 * Sprout（幼苗）是本项目第一个“完整实现五要素”的可交互物体，专门用来
 * 演示设计文档里浇水动作的规格：
 *
 *   输入：按住鼠标左键（对应 InteractionManager 触发 onInteract）
 *   过程：持续倒水，播放水滴动效，土壤颜色逐渐变深
 *   反馈：湿润度进度条、水壶剩余水量减少
 *   取消：松开鼠标（onInteractEnd），立刻停止，不做任何惩罚
 *   失败恢复：水用完会自动停止并给出提示，不计入“任务失败”
 *
 * 后续如果要做番茄、玉米等更多作物，建议把“浇水状态机”部分抽出来做成
 * 一个独立的 WateringAction 类，让 Sprout / Tomato / Corn 都可以复用，
 * 而不是每种作物都抄一遍这段逻辑。本文件为了让新手先看懂“一个完整的例子
 * 长什么样”，暂时没有做这一层抽象。
 */
export class Sprout implements Interactable {
  object3D: THREE.Group;
  interactionRange = 1.8;

  /** 0 表示干燥的土壤，1 表示已经浇透 */
  private wetness = 0;
  private readonly wetnessPerSecond = 0.25; // 浇满需要大约 4 秒
  private readonly waterCostPerSecond = 2; // 每秒消耗的水量

  private isPouring = false;

  private soilMesh: THREE.Mesh;
  private waterDropMesh: THREE.Mesh;

  private readonly dryColor = new THREE.Color(0x8b6b4a);
  private readonly wetColor = new THREE.Color(0x4a3524);

  /** 用于在屏幕上显示文字提示，比如“水用完了”。main.ts 会设置这个回调。 */
  onFeedback: (message: string) => void = () => {};

  private resourceSystem: ResourceSystem;

  constructor(position: THREE.Vector3, resourceSystem: ResourceSystem) {
    this.resourceSystem = resourceSystem;
    this.object3D = new THREE.Group();
    this.object3D.position.copy(position);

    // 土壤：一个矮圆柱，颜色会随湿润度变化
    const soilGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16);
    const soilMaterial = new THREE.MeshStandardMaterial({ color: this.dryColor });
    this.soilMesh = new THREE.Mesh(soilGeometry, soilMaterial);
    this.soilMesh.position.y = 0.05;
    this.object3D.add(this.soilMesh);

    // 幼苗本体：用一个简单的圆锥代替，之后可以换成更精细的模型
    const plantGeometry = new THREE.ConeGeometry(0.2, 0.6, 8);
    const plantMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
    const plantMesh = new THREE.Mesh(plantGeometry, plantMaterial);
    plantMesh.position.y = 0.4;
    this.object3D.add(plantMesh);

    // 浇水时显示的“水滴”提示物，平时隐藏
    const dropGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const dropMaterial = new THREE.MeshStandardMaterial({ color: 0x4fc3f7 });
    this.waterDropMesh = new THREE.Mesh(dropGeometry, dropMaterial);
    this.waterDropMesh.position.set(0, 1.2, 0);
    this.waterDropMesh.visible = false;
    this.object3D.add(this.waterDropMesh);
  }

  /** InteractionManager 确认角色已经在范围内之后才会调用这个方法 */
  onInteract() {
    if (this.wetness >= 1) {
      this.onFeedback('这株苗已经浇够水了');
      return;
    }
    if (this.resourceSystem.water <= 0) {
      // 对应“失败恢复”：没有水的时候不进入倒水状态，只是提示，不算错误
      this.onFeedback('水壶没水了，先去获取一些水吧');
      return;
    }
    this.isPouring = true;
    this.waterDropMesh.visible = true;
  }

  /** 玩家松开鼠标时调用，对应“取消”——立刻停止，不做任何惩罚 */
  onInteractEnd() {
    this.isPouring = false;
    this.waterDropMesh.visible = false;
  }

  /** 每帧由 main.ts 调用，推进“浇水中”的状态 */
  update(dt: number) {
    if (!this.isPouring) return;

    const waterNeeded = this.waterCostPerSecond * dt;
    const spent = this.resourceSystem.trySpendWater(waterNeeded);

    if (!spent) {
      // 水刚好在倒的过程中用完了：自动停止，给出提示，不算“失败”
      this.isPouring = false;
      this.waterDropMesh.visible = false;
      this.onFeedback('水壶没水了，先去获取一些水吧');
      return;
    }

    this.wetness = Math.min(1, this.wetness + this.wetnessPerSecond * dt);
    const material = this.soilMesh.material as THREE.MeshStandardMaterial;
    material.color.lerpColors(this.dryColor, this.wetColor, this.wetness);

    // 水滴轻微上下浮动，做一个很简单的“正在倒水”动效
    this.waterDropMesh.position.y = 1.1 + Math.sin(performance.now() / 150) * 0.05;

    if (this.wetness >= 1) {
      this.isPouring = false;
      this.waterDropMesh.visible = false;
      this.onFeedback('浇好了！');
    }
  }

  getWetness() {
    return this.wetness;
  }
}
