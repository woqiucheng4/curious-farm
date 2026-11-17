import * as THREE from 'three';
import { SceneManager } from '../core/SceneManager';
import { PlayerController } from '../core/PlayerController';
import type { Interactable } from './Interactable';

/**
 * InteractionManager 负责把“鼠标点了屏幕上的某个位置”翻译成游戏里的两种意图：
 *
 *   1. 点到了地面的空地 → 让角色走过去（点击移动）
 *   2. 点到了一个可交互物体（比如幼苗）→ 触发它的交互
 *
 * 新手提示：这里用到的核心技术叫“射线投射”（Raycasting）。可以这样理解：
 * 鼠标点击屏幕上的一个 2D 点时，我们从摄像机的位置、穿过这个 2D 点，往场景里
 * 发射一条“看不见的激光”，看它先打中了哪个物体——这就是 3D 游戏里判断
 * “我点的到底是什么”的标准做法。
 *
 * 本项目的简化约定（新手先按这个来，后面可以自己增强）：
 *   - 如果点击的可交互物体“够不到”（角色不在它的 interactionRange 内），
 *     我们只是让角色走过去，并不会在走到之后自动开始交互——需要玩家
 *     走近后再点一次。这是为了让代码更容易看懂，设计文档里“自动走近后
 *     触发”的版本可以作为后续练习自己加上。
 */
export class InteractionManager {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private interactables: Interactable[] = [];
  private heldInteractable: Interactable | null = null;

  /** 给太远 / 没有命中任何物体等情况显示提示文字，由 main.ts 接到 HUD 上 */
  onFeedback: (message: string) => void = () => {};

  private sceneManager: SceneManager;
  private playerController: PlayerController;

  constructor(sceneManager: SceneManager, playerController: PlayerController) {
    this.sceneManager = sceneManager;
    this.playerController = playerController;
    const dom = sceneManager.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
  }

  /** 把一个可交互物体注册进来，之后点击检测才会考虑到它 */
  register(interactable: Interactable) {
    this.interactables.push(interactable);
  }

  private onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return; // 只处理鼠标左键，右键交给 PlayerController 做视角拖拽

    this.updatePointerPosition(event);
    this.raycaster.setFromCamera(this.pointer, this.sceneManager.camera);

    const hitInteractable = this.raycastInteractables();
    if (hitInteractable) {
      this.tryInteract(hitInteractable);
      return;
    }

    const groundHit = this.raycaster.intersectObject(this.sceneManager.ground)[0];
    if (groundHit) {
      this.playerController.stopMoving();
      this.playerController.setMoveTarget(groundHit.point);
    }
  }

  private onPointerUp(event: PointerEvent) {
    if (event.button !== 0) return;
    if (this.heldInteractable?.onInteractEnd) {
      this.heldInteractable.onInteractEnd();
    }
    this.heldInteractable = null;
  }

  private tryInteract(interactable: Interactable) {
    const inRange = this.playerController.isWithinRange(
      interactable.object3D.position,
      interactable.interactionRange
    );

    if (!inRange) {
      // 对应“失败恢复”的一种：够不到时不执行任何动作，只是提示 + 让角色先走过去
      this.onFeedback('太远了，先走近一点');
      const approachPoint = this.computeApproachPoint(
        interactable.object3D.position,
        interactable.interactionRange
      );
      this.playerController.setMoveTarget(approachPoint);
      return;
    }

    this.playerController.stopMoving();
    interactable.onInteract();
    this.heldInteractable = interactable;
  }

  /**
   * 走到目标物体附近、但不要走到它正中心（否则角色模型会和物体重叠在一起，
   * 看起来很奇怪）。做法：沿着“目标 → 玩家当前位置”这条连线，在距离目标
   * interactionRange 稍近一点的地方取一个点，让角色走到那里就算“到了”。
   */
  private computeApproachPoint(target: THREE.Vector3, range: number): THREE.Vector3 {
    const playerPos = this.playerController.mesh.position;
    const direction = new THREE.Vector3().subVectors(playerPos, target);
    direction.y = 0;
    if (direction.lengthSq() < 0.0001) {
      direction.set(0, 0, 1); // 玩家和目标几乎重合这种极端情况，给一个默认方向兜底
    }
    direction.normalize();
    const approachDistance = Math.max(range - 0.4, 0.2);
    return new THREE.Vector3(
      target.x + direction.x * approachDistance,
      target.y,
      target.z + direction.z * approachDistance
    );
  }

  /** 在所有已注册的可交互物体里找射线最先打中的那一个 */
  private raycastInteractables(): Interactable | null {
    const objects = this.interactables.map((i) => i.object3D);
    const hits = this.raycaster.intersectObjects(objects, true); // true = 包含子物体
    if (hits.length === 0) return null;

    const hitObject = hits[0].object;
    return this.interactables.find((i) => this.isDescendantOf(hitObject, i.object3D)) ?? null;
  }

  private isDescendantOf(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = node;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  }

  private updatePointerPosition(event: PointerEvent) {
    // Three.js 的 Raycaster 需要 -1 到 1 之间的坐标（NDC，标准化设备坐标），
    // 而不是像素坐标，所以要做一次换算
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
}
