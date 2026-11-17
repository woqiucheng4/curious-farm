import * as THREE from 'three';
import type { Interactable } from '../interaction/Interactable';
import { FeedingSession } from './FeedingSession';

/** 可点击食槽：只负责场景反馈，把临时分配交给 FeedingSession 管理。 */
export class FeedTrough implements Interactable {
  object3D: THREE.Group;
  interactionRange = 1.6;

  private readonly id: string;
  private readonly feedingSession: FeedingSession;
  private grainMesh: THREE.Mesh;

  constructor(id: string, position: THREE.Vector3, feedingSession: FeedingSession) {
    this.id = id;
    this.feedingSession = feedingSession;
    this.object3D = new THREE.Group();
    this.object3D.position.copy(position);

    const trough = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.22, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x8a6037 })
    );
    trough.position.y = 0.16;
    this.object3D.add(trough);

    this.grainMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.06, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xe3b341 })
    );
    this.grainMesh.position.y = 0.3;
    this.grainMesh.visible = false;
    this.object3D.add(this.grainMesh);
  }

  onInteract() {
    this.feedingSession.addPortion(this.id);
  }

  setPendingAmount(amount: number) {
    this.grainMesh.visible = amount > 0;
    this.grainMesh.scale.y = Math.max(0.2, Math.min(amount, 4));
  }
}
