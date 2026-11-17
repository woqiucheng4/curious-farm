import * as THREE from 'three';
import './style.css';
import { PlayerController } from './core/PlayerController';
import { SceneManager } from './core/SceneManager';
import { ResourceSystem } from './economy/ResourceSystem';
import { InteractionManager } from './interaction/InteractionManager';
import { StudyTaskSystem } from './learning/StudyTaskSystem';
import { SaveSystem } from './persistence/SaveSystem';
import type { FarmSaveData } from './persistence/SaveSystem';
import { HUD } from './ui/HUD';
import { AppleTree } from './world/AppleTree';
import { Chicken } from './world/Chicken';
import { FeedingSession } from './world/FeedingSession';
import type { FeedTroughDefinition } from './world/FeedingSession';
import { FeedTrough } from './world/FeedTrough';
import { Sprout } from './world/Sprout';
import { WateringCan } from './world/WateringCan';

const appContainer = document.querySelector<HTMLDivElement>('#app')!;

function createChickenCoop(position: THREE.Vector3): THREE.Group {
  const coop = new THREE.Group();
  coop.position.copy(position);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xc58952 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x9b4238 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.25, 1.8), wallMaterial);
  base.position.y = 0.63;
  coop.add(base);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.85, 4), roofMaterial);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.67;
  coop.add(roof);

  const doorway = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.75, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x5c3927 })
  );
  doorway.position.set(0, 0.38, 0.93);
  coop.add(doorway);
  return coop;
}

async function bootstrap() {
  const saveSystem = new SaveSystem();
  const savedData = await saveSystem.load();

  const sceneManager = new SceneManager(appContainer);
  const playerController = new PlayerController(sceneManager);
  const resourceSystem = new ResourceSystem(savedData?.resources);
  const hud = new HUD(resourceSystem);
  const interactionManager = new InteractionManager(sceneManager, playerController);

  interactionManager.onFeedback = (message) => hud.showFeedback(message);

  // --- 可拿取工具 ---
  const wateringCan = new WateringCan(new THREE.Vector3(-1.8, 0, 1.4));
  wateringCan.onFeedback = (message) => hud.showFeedback(message);
  sceneManager.scene.add(wateringCan.object3D);
  interactionManager.register(wateringCan);
  // 水壶跟随角色的逻辑必须在每帧更新里运行，偏移会随角色朝向旋转。
  sceneManager.onUpdate((dt) => wateringCan.update(dt, playerController));

  // --- 胡萝卜：种子 → 发芽 → 长叶 → 可收获 ---
  const carrot = new Sprout(new THREE.Vector3(2, 0, -1), resourceSystem, savedData?.carrot);
  carrot.onFeedback = (message) => hud.showFeedback(message);
  sceneManager.scene.add(carrot.object3D);
  interactionManager.register(carrot);
  sceneManager.onUpdate((dt) => carrot.update(dt));

  // --- 苹果树保留在原处；每个苹果独立注册，成熟度和采摘状态互不影响。 ---
  const appleTree = new AppleTree(new THREE.Vector3(4, 0, -3.2), savedData?.appleTree);
  appleTree.onFeedback = (message) => hud.showFeedback(message);
  sceneManager.scene.add(appleTree.object3D);
  for (const apple of appleTree.fruits) {
    sceneManager.scene.add(apple.object3D);
    interactionManager.register(apple);
    sceneManager.onUpdate((dt) => apple.update(dt));
  }

  // --- 一个鸡舍、一只小鸡和两个可交互食槽 ---
  sceneManager.scene.add(createChickenCoop(new THREE.Vector3(-2.6, 0, -2.8)));
  const chicken = new Chicken(new THREE.Vector3(-2.4, 0, -1.45), savedData?.chicken);
  chicken.onFeedback = (message) => hud.showFeedback(message);
  sceneManager.scene.add(chicken.object3D);
  interactionManager.register(chicken);

  const troughDefinitions: FeedTroughDefinition[] = [
    { id: 'left-trough', label: '左侧食槽' },
    { id: 'right-trough', label: '右侧食槽' },
  ];
  const feedingSession = new FeedingSession(resourceSystem, troughDefinitions);
  feedingSession.onFeedback = (message) => hud.showFeedback(message);
  const troughs = [
    new FeedTrough('left-trough', new THREE.Vector3(-3.1, 0, -0.7), feedingSession),
    new FeedTrough('right-trough', new THREE.Vector3(-1.9, 0, -0.7), feedingSession),
  ];
  for (const trough of troughs) {
    sceneManager.scene.add(trough.object3D);
    interactionManager.register(trough);
  }

  feedingSession.onPendingChanged = (state) => {
    troughs.forEach((trough, index) => trough.setPendingAmount(state.amounts[troughDefinitions[index].id]));
    hud.showFeedConfirmation(state, troughDefinitions, {
      onRemove: (troughId) => feedingSession.removePortion(troughId),
      onConfirm: () => feedingSession.confirm(),
      onCancel: () => feedingSession.cancel(),
    });
  };
  feedingSession.onConfirmed = (_amounts, total) => chicken.receiveConfirmedFeed(total);

  // --- 离线示例学习任务：按任务实例 ID 去重发奖 ---
  const studyTasks = new StudyTaskSystem(resourceSystem, savedData?.learning);
  studyTasks.onFeedback = (message) => hud.showFeedback(message);
  hud.setTaskHandler(() => studyTasks.completeSampleTask());
  hud.setTaskCompleted(studyTasks.hasCompletedSampleTask());
  hud.setCarrotCareHandlers(
    () => carrot.applySunlightCare(),
    () => carrot.applyFertilizerCare()
  );

  const updateFarmStatus = () => {
    hud.updateFarmStatus(
      carrot.getStageLabel(),
      chicken.getSummary(),
      carrot.getSnapshot().harvestedCount,
      appleTree.getSummary()
    );
  };

  const buildSaveData = (): FarmSaveData => ({
    version: 1,
    resources: resourceSystem.getSnapshot(),
    carrot: carrot.getSnapshot(),
    chicken: chicken.getSnapshot(),
    appleTree: appleTree.getSnapshot(),
    learning: studyTasks.getSnapshot(),
  });

  // 资源通知发生在动作更新过程中；排到 microtask 后再取快照，能记录同一帧最新状态。
  let saveQueued = false;
  const requestSave = () => {
    if (saveQueued) return;
    saveQueued = true;
    queueMicrotask(() => {
      saveQueued = false;
      void saveSystem.save(buildSaveData()).catch(() => {
        hud.showFeedback('存档暂时写入失败，当前进度仍保留在本页');
      });
    });
  };

  resourceSystem.subscribe(requestSave);
  carrot.onStateChange = () => {
    updateFarmStatus();
    requestSave();
  };
  carrot.onHarvest = () => {
    updateFarmStatus();
    requestSave();
  };
  chicken.onStateChange = () => {
    updateFarmStatus();
    requestSave();
  };
  appleTree.onStateChange = () => {
    updateFarmStatus();
    requestSave();
  };
  studyTasks.onStateChange = () => {
    hud.setTaskCompleted(studyTasks.hasCompletedSampleTask());
    requestSave();
  };

  window.addEventListener('pagehide', () => {
    void saveSystem.save(buildSaveData());
  });

  updateFarmStatus();
  if (savedData) {
    hud.showFeedback('已恢复离线农场进度');
  }

  sceneManager.start();

  // 开发期调试钩子：可查看实时状态、显式保存或重复触发任务去重验证。
  (window as unknown as { __debugGame: unknown }).__debugGame = {
    sceneManager,
    playerController,
    resourceSystem,
    wateringCan,
    carrot,
    appleTree,
    chicken,
    feedingSession,
    studyTasks,
    save: () => saveSystem.save(buildSaveData()),
  };
}

void bootstrap();
