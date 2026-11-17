import * as THREE from 'three';

/**
 * SceneManager 负责：创建 Three.js 的三件套（Scene / Camera / Renderer）、
 * 搭建最基础的地面和光照、维护一个“每帧要执行的函数列表”。
 *
 * 新手提示：Three.js 里几乎所有东西都挂在 Scene 上；Camera 决定你看到的角度；
 * Renderer 负责把 Scene 真正画到 <canvas> 上。这三样东西几乎每个 Three.js
 * 项目都要创建一次，所以单独放一个类管理，方便复用。
 */
export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  ground: THREE.Mesh;

  /** 每帧需要执行的回调函数，格式为 (deltaTime 秒) => void */
  private updateCallbacks: Array<(dt: number) => void> = [];
  private clock = new THREE.Clock();

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe3ff); // 淡蓝色天空，先用纯色占位

    this.camera = new THREE.PerspectiveCamera(
      60, // 视野角度（FOV），数值越大能看到的范围越广，但会有“鱼眼”变形
      window.innerWidth / window.innerHeight,
      0.1, // 近裁剪面：比这个距离更近的东西不会被画出来
      1000 // 远裁剪面：比这个距离更远的东西不会被画出来
    );
    this.camera.position.set(0, 5, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // --- 光照：没有光，场景里的东西全是黑的 ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 均匀的环境光，避免阴影面完全死黑
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff2cc, 1.2); // 暖色调的“太阳光”
    sunLight.position.set(5, 10, 5);
    this.scene.add(sunLight);

    // --- 地面：一块绿色平面代表农场地面 ---
    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x7ec850 });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    // PlaneGeometry 默认是竖直朝上的（像一面墙），需要绕 X 轴转 -90 度让它躺平成地面
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.name = 'ground';
    this.scene.add(this.ground);

    window.addEventListener('resize', () => this.onResize());
  }

  /** 注册一个每帧都会被调用的函数，用来更新角色位置、动画状态等 */
  onUpdate(callback: (dt: number) => void) {
    this.updateCallbacks.push(callback);
  }

  /** 启动渲染循环。只需要在 main.ts 里调用一次。 */
  start() {
    const loop = () => {
      const dt = this.clock.getDelta(); // 距离上一帧过去了多少秒
      for (const cb of this.updateCallbacks) {
        cb(dt);
      }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
