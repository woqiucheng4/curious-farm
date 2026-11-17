import * as THREE from 'three';
import type { PlayerController } from '../core/PlayerController';
import type { Interactable } from '../interaction/Interactable';

type WateringCanState = 'ground' | 'picking' | 'held';

/** 可拿取的水壶。拿取动画可被再次点击取消，只有拿取完成后才会跟随角色。 */
export class WateringCan implements Interactable {
  object3D: THREE.Group;
  interactionRange = 1.5;

  onFeedback: (message: string) => void = () => {};

  private state: WateringCanState = 'ground';
  private readonly groundPosition: THREE.Vector3;
  private readonly pickupStartPosition = new THREE.Vector3();
  private readonly desiredHeldPosition = new THREE.Vector3();
  private readonly handOffset = new THREE.Vector3(0.55, 0.12, 0.65);
  private pickupProgress = 0;
  private readonly pickupDuration = 0.4;

  constructor(position: THREE.Vector3) {
    this.groundPosition = position.clone();
    this.object3D = new THREE.Group();
    this.object3D.position.copy(position);

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x5577aa, roughness: 0.45 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.38, 12), bodyMaterial);
    body.position.y = 0.22;
    this.object3D.add(body);

    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.07, 0.36, 8),
      new THREE.MeshStandardMaterial({ color: 0x6e91bf })
    );
    spout.rotation.z = Math.PI / 3;
    spout.position.set(0.23, 0.31, 0);
    this.object3D.add(spout);

    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.025, 6, 12, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x3f5b82 })
    );
    handle.rotation.x = Math.PI / 2;
    handle.position.set(-0.02, 0.45, 0);
    this.object3D.add(handle);
  }

  onInteract() {
    if (this.state === 'held') {
      this.putDown();
      return;
    }

    if (this.state === 'picking') {
      this.cancelPickup();
      return;
    }

    this.state = 'picking';
    this.pickupProgress = 0;
    this.pickupStartPosition.copy(this.object3D.position);
    this.onFeedback('伸手拿水壶…再次点击可以取消');
  }

  /** 由 SceneManager.onUpdate 注册；偏移会随角色朝向转动。 */
  update(dt: number, playerController: PlayerController) {
    if (this.state === 'ground') return;

    this.updateDesiredHeldPosition(playerController);
    this.object3D.rotation.y = playerController.mesh.rotation.y;

    if (this.state === 'picking') {
      this.pickupProgress = Math.min(1, this.pickupProgress + dt / this.pickupDuration);
      const easedProgress = this.pickupProgress * this.pickupProgress * (3 - 2 * this.pickupProgress);
      this.object3D.position.lerpVectors(
        this.pickupStartPosition,
        this.desiredHeldPosition,
        easedProgress
      );

      if (this.pickupProgress >= 1) {
        this.state = 'held';
        this.onFeedback('拿起了水壶');
      }
      return;
    }

    this.object3D.position.copy(this.desiredHeldPosition);
  }

  getIsHeld(): boolean {
    return this.state === 'held';
  }

  private updateDesiredHeldPosition(playerController: PlayerController) {
    const rotatedOffset = this.handOffset.clone().applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      playerController.mesh.rotation.y
    );
    this.desiredHeldPosition.copy(playerController.mesh.position).add(rotatedOffset);
  }

  private putDown() {
    this.state = 'ground';
    this.object3D.position.copy(this.groundPosition);
    this.object3D.rotation.set(0, 0, 0);
    this.onFeedback('放下了水壶');
  }

  private cancelPickup() {
    this.state = 'ground';
    this.pickupProgress = 0;
    this.object3D.position.copy(this.groundPosition);
    this.object3D.rotation.set(0, 0, 0);
    this.onFeedback('没有拿起水壶，可以重新试一次');
  }
}
