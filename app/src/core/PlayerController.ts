import * as THREE from 'three';
import { SceneManager } from './SceneManager';

/**
 * PlayerController 实现设计文档里的“默认移动方案”：
 *   - 鼠标左键点击地面 → 角色朝目标点走过去（点击移动）
 *   - 鼠标右键按住拖拽 → 旋转视角（环绕角色的相机）
 *
 * 新手提示：这里的“镜头跟随角色”用的是最简单的球坐标（yaw 水平角 + pitch 俯仰角 +
 * distance 距离）算法：相机永远站在以角色为球心、半径为 distance 的球面上，
 * 通过改变 yaw/pitch 就能让相机绕着角色转圈。这是第一人称/第三人称跟随镜头
 * 最常见的实现方式之一，不需要用到更复杂的相机控件库。
 */
export class PlayerController {
  /** 角色的 3D 模型，目前用一个简单的“胶囊体”占位，后续可以换成真正的人物模型 */
  mesh: THREE.Mesh;

  /** 当前正在走向的目标点；为 null 表示没有移动指令 */
  private moveTarget: THREE.Vector3 | null = null;
  private readonly moveSpeed = 4; // 每秒移动多少个世界单位（约等于“米”）
  private readonly arriveThreshold = 0.1; // 离目标点多近就算“到达”，避免来回抖动

  // --- 镜头环绕参数 ---
  private yaw = 0; // 水平旋转角度（弧度）
  private pitch = 0.5; // 俯仰角度（弧度），0 是平视，正值是往下看
  private readonly minPitch = -0.3; // 对应设计文档“限制俯仰角，避免看地底/完全仰视”
  private readonly maxPitch = 1.1;
  private readonly cameraDistance = 8;

  private isDraggingCamera = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private sceneManager: SceneManager;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    const geometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xffcc66 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 0.9, 0); // 让胶囊体的底部贴在地面上
    sceneManager.scene.add(this.mesh);

    this.setupPointerEvents();
    this.updateCameraPosition();

    sceneManager.onUpdate((dt) => this.update(dt));
  }

  /** 外部（比如点击地面的逻辑）调用这个方法，告诉角色“走到这里” */
  setMoveTarget(point: THREE.Vector3) {
    this.moveTarget = point.clone();
  }

  /** 停止当前的移动（比如玩家点击了一个可交互物体，不需要再走向之前的地面点） */
  stopMoving() {
    this.moveTarget = null;
  }

  /** 判断角色当前是否在某个点的交互范围内，供交互系统调用 */
  isWithinRange(point: THREE.Vector3, range: number): boolean {
    return this.mesh.position.distanceTo(point) <= range;
  }

  private update(dt: number) {
    if (this.moveTarget) {
      const current = this.mesh.position;
      const direction = new THREE.Vector3(
        this.moveTarget.x - current.x,
        0, // 不处理垂直方向的移动，农场地形先按平地设计
        this.moveTarget.z - current.z
      );
      const distance = direction.length();

      if (distance <= this.arriveThreshold) {
        this.moveTarget = null; // 到达目标点，停止移动
      } else {
        direction.normalize();
        const step = Math.min(this.moveSpeed * dt, distance);
        current.x += direction.x * step;
        current.z += direction.z * step;
        // 让角色面朝移动方向，看起来更自然
        this.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      }
    }

    this.updateCameraPosition();
  }

  private updateCameraPosition() {
    const camera = this.sceneManager.camera;
    const target = this.mesh.position;

    // 球坐标转直角坐标：根据 yaw/pitch/distance 算出相机相对角色的偏移量
    const horizontalDistance = this.cameraDistance * Math.cos(this.pitch);
    const verticalDistance = this.cameraDistance * Math.sin(this.pitch);

    camera.position.set(
      target.x + horizontalDistance * Math.sin(this.yaw),
      target.y + verticalDistance + 1, // +1 让镜头稍微高过角色腰部
      target.z + horizontalDistance * Math.cos(this.yaw)
    );
    camera.lookAt(target.x, target.y + 0.8, target.z);
  }

  private setupPointerEvents() {
    const dom = this.sceneManager.renderer.domElement;

    // 右键按住开始拖拽视角；浏览器默认右键会弹出菜单，需要阻止
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        this.isDraggingCamera = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDraggingCamera) return;
      const deltaX = e.clientX - this.lastPointerX;
      const deltaY = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      const rotateSpeed = 0.005;
      this.yaw -= deltaX * rotateSpeed;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + deltaY * rotateSpeed,
        this.minPitch,
        this.maxPitch
      );
    });

    window.addEventListener('pointerup', (e) => {
      if (e.button === 2) {
        this.isDraggingCamera = false;
      }
    });
  }
}
