import * as THREE from 'three';

/**
 * 所有“可以被点击交互”的场景物体都要实现这个接口。
 * 比如幼苗、水壶、果树、动物，以后都会有一个对应的类去实现它。
 *
 * 新手提示：TypeScript 的 interface（接口）不是具体的类，而是一份“承诺”——
 * 承诺任何实现了这个接口的类，一定会有 object3D / interactionRange / onInteract
 * 这几样东西。这样 InteractionManager 就不需要关心具体是幼苗还是水壶，
 * 只需要知道“它是一个 Interactable，我可以调用它的 onInteract()”。
 */
export interface Interactable {
  /** 场景里真正能被鼠标点中的 3D 物体 */
  object3D: THREE.Object3D;

  /** 角色需要走到离这个物体多近，才允许触发交互（对应设计文档的“够不到”判定） */
  interactionRange: number;

  /** 当玩家点击了这个物体、且角色已经在范围内时，会被调用 */
  onInteract(): void;

  /**
   * 可选：鼠标抬起/松开时调用，用于“按住倾倒，松开停止”这种需要持续按住的动作。
   * 不是所有可交互物体都需要这个（比如“拿取”一次点击就完成，不需要它）。
   */
  onInteractEnd?(): void;
}
