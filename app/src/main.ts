import * as THREE from 'three';
import './style.css';
import { SceneManager } from './core/SceneManager';
import { PlayerController } from './core/PlayerController';
import { InteractionManager } from './interaction/InteractionManager';
import { ResourceSystem } from './economy/ResourceSystem';
import { Sprout } from './world/Sprout';
import { HUD } from './ui/HUD';

/**
 * main.ts 是整个游戏的“装配车间”：把前面写好的各个零件（场景、角色、
 * 资源、HUD、交互系统）拿出来，按顺序创建、互相连接起来。
 *
 * 新手提示：读代码时建议按这个顺序理解——
 *   1. 先有 SceneManager（有地方可以放东西了）
 *   2. 再有 PlayerController（有角色可以动了）
 *   3. 再有 ResourceSystem（有资源数值可以用了）
 *   4. 再有具体的场景物体，比如 Sprout（有东西可以互动了）
 *   5. 最后用 InteractionManager 把“点击”和“物体”串起来
 */

const appContainer = document.querySelector<HTMLDivElement>('#app')!;

const sceneManager = new SceneManager(appContainer);
const playerController = new PlayerController(sceneManager);
const resourceSystem = new ResourceSystem();
const hud = new HUD(resourceSystem);
const interactionManager = new InteractionManager(sceneManager, playerController);

// 把 InteractionManager 和 Sprout 的提示信息都接到 HUD 上显示
interactionManager.onFeedback = (message) => hud.showFeedback(message);

// --- 放置一株幼苗作为演示 ---
const sprout = new Sprout(new THREE.Vector3(2, 0, -1), resourceSystem);
sprout.onFeedback = (message) => hud.showFeedback(message);
sceneManager.scene.add(sprout.object3D);
interactionManager.register(sprout);

sceneManager.onUpdate((dt) => sprout.update(dt));

sceneManager.start();

// 调试钩子：开发时可以在浏览器控制台里输入 __debugGame.resourceSystem.water
// 之类的语句查看内部状态，方便排查问题。正式发布前可以按需移除。
(window as unknown as { __debugGame: unknown }).__debugGame = {
  sceneManager,
  playerController,
  resourceSystem,
  sprout,
};
