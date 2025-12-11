/**
 * Cupid's Starfield - Main Logic
 * Author: Prof. Fei Xiang
 * * IMPORTANT: 
 * If hosting on GitHub Pages public repository, do NOT commit your API Key directly.
 * You should use a proxy server or prompt the user to input their key.
 * For this demo, we use a placeholder variable.
 */

// ==========================================
// CONFIGURATION & GLOBAL VARIABLES
// ==========================================

// TODO: Replace with your actual Gemini API Key for local testing
// Or implement a UI prompt to ask user for key securely
const apiKey = ""; 

const CONFIG = {
    particleCount: 12000,
    particleSize: 1.8,
    fieldRadius: 1000,
    baseSpeed: 0.001,
    lerpSpeed: 0.05,
    repelForce: 80,
    heartScale: 15,
    colors: [0xff6699, 0xff3366, 0xff99cc, 0xffffff],
    // Micro-motion parameters for dynamic starfield
    microSpeed: 0.005,
    microRange: 15 
};

// Three.js Variables
let scene, camera, renderer;
let particles, particlePositions;
let positionsInitial, positionsHeartArrow;
let colors, sizes;
let handIndicatorMesh;
let nameTextMesh;
let font;

// State Variables
let time = 0;
let currentGesture = 'NONE';
let handPositionNormalized = new THREE.Vector3(0, 0, 0);
let handPositionWorld = new THREE.Vector3(0, 0, 0);
let belovedNameStr = "";
let isFontLoaded = false;
let useMouseMode = false;

// MediaPipe Variables
let hands;
let cameraMP;
const videoElement = document.getElementsByClassName('input_video')[0];

// ==========================================
// INITIALIZATION
// ==========================================

function init() {
    initThreeJS();
    
    // Bind UI Events
    document.getElementById('start-btn').addEventListener('click', startCamera);
    document.getElementById('mouse-mode-btn').addEventListener('click', startMouseMode);
    document.getElementById('ai-generate').addEventListener('click', handleAIGeneration);
    
    // Resize Listener
    window.addEventListener('resize', onWindowResize, false);

    // Mouse Mode Controls
    document.getElementById('btn-scatter').addEventListener('click', () => setMouseGesture('OPEN'));
    document.getElementById('btn-heart').addEventListener('click', () => setMouseGesture('FIST'));

    // Start Loading Assets
    preloadAssets().then(() => {
        // Assets loaded, enable start button
        const startBtn = document.getElementById('start-btn');
        startBtn.disabled = false;
        startBtn.innerText = "开启摄像头 (手势交互)";
        document.getElementById('loading-status').innerText = "资源加载完毕";
        
        // Start Animation Loop
        animate();
    });
}

// Start the app
init();

// ==========================================
// THREE.JS CORE LOGIC
// ==========================================

function initThreeJS() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a0a12, 0.0008);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.z = 1200;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    createParticles();
    createHandIndicator();
    
    // Update UI counter
    document.getElementById('particle-count').innerText = CONFIG.particleCount.toLocaleString();
}

async function preloadAssets() {
    // 1. Calculate Morph Shapes
    positionsHeartArrow = calculateHeartArrowShape(CONFIG.particleCount, CONFIG.heartScale);
    
    // 2. Load Font
    const loader = new THREE.FontLoader();
    return new Promise((resolve) => {
        // Using a reliable CDN for the font
        loader.load('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/gentilis_bold.typeface.json', function (loadedFont) {
            font = loadedFont;
            isFontLoaded = true;
            resolve();
        });
    });
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    particlePositions = new Float32Array(CONFIG.particleCount * 3);
    positionsInitial = new Float32Array(CONFIG.particleCount * 3);
    colors = new Float32Array(CONFIG.particleCount * 3);
    sizes = new Float32Array(CONFIG.particleCount);
    const colorObj = new THREE.Color();

    for (let i = 0; i < CONFIG.particleCount; i++) {
        // Sphere distribution
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const r = Math.cbrt(Math.random()) * CONFIG.fieldRadius;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        particlePositions[i * 3] = x;
        particlePositions[i * 3 + 1] = y;
        particlePositions[i * 3 + 2] = z;
        
        positionsInitial[i * 3] = x;
        positionsInitial[i * 3 + 1] = y;
        positionsInitial[i * 3 + 2] = z;

        // Colors
        const hexColor = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
        colorObj.setHex(hexColor);
        colors[i * 3] = colorObj.r;
        colors[i * 3 + 1] = colorObj.g;
        colors[i * 3 + 2] = colorObj.b;

        sizes[i] = Math.random() * CONFIG.particleSize + 0.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const sprite = generateSprite();
    const material = new THREE.PointsMaterial({
        size: CONFIG.particleSize * 6,
        map: sprite,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.9
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function calculateHeartArrowShape(count, scale) {
    const targetPositions = new Float32Array(count * 3);
    const heartCount = Math.floor(count * 0.8);
    const arrowCount = count - heartCount;

    // Heart Shape
    for (let i = 0; i < heartCount; i++) {
        let t = Math.random() * Math.PI * 2;
        let u = Math.random() * Math.PI;

        let xBase = 16 * Math.pow(Math.sin(t), 3);
        let yBase = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        let zThickness = (Math.random() - 0.5) * 10 * Math.sin(u);

        targetPositions[i * 3] = xBase * scale;
        targetPositions[i * 3 + 1] = yBase * scale + 100; // Shift up
        targetPositions[i * 3 + 2] = zThickness * scale;
    }

    // Arrow Shape
    const arrowStart = new THREE.Vector3(-400, -100, 100);
    const arrowEnd = new THREE.Vector3(400, 300, -100);
    const arrowDir = new THREE.Vector3().subVectors(arrowEnd, arrowStart);
    const arrowLength = arrowDir.length();
    arrowDir.normalize();

    for (let i = 0; i < arrowCount; i++) {
        let idx = heartCount + i;
        let t = i / arrowCount;
        let pos = new THREE.Vector3();

        if (t > 0.95) { // Tip
            let coneT = (t - 0.95) / 0.05;
            pos.copy(arrowStart).addScaledVector(arrowDir, arrowLength * (0.95 + coneT * 0.05));
            let rOffset = Math.random() * Math.PI * 2;
            let radius = (1 - coneT) * 30;
            let perp1 = new THREE.Vector3(0, 1, 0).cross(arrowDir).normalize();
            let perp2 = arrowDir.clone().cross(perp1).normalize();
            pos.addScaledVector(perp1, Math.cos(rOffset) * radius).addScaledVector(perp2, Math.sin(rOffset) * radius);
        } else if (t < 0.1) { // Tail
            pos.copy(arrowStart).addScaledVector(arrowDir, arrowLength * t);
            let fAngle = (Math.random() > 0.5 ? 1 : -1) * Math.PI / 4;
            let fDist = Math.random() * 40 * (1 - t / 0.1);
            pos.addScaledVector(new THREE.Vector3(0, 1, 0), fDist * Math.cos(fAngle));
        } else { // Shaft
            pos.copy(arrowStart).addScaledVector(arrowDir, arrowLength * t);
            pos.x += (Math.random() - 0.5) * 10;
            pos.y += (Math.random() - 0.5) * 10;
            pos.z += (Math.random() - 0.5) * 10;
        }
        targetPositions[idx * 3] = pos.x;
        targetPositions[idx * 3 + 1] = pos.y;
        targetPositions[idx * 3 + 2] = pos.z;
    }
    return targetPositions;
}

function updateNameText() {
    const inputVal = document.getElementById('lover-name').value;
    if (!inputVal || !isFontLoaded) return;
    belovedNameStr = inputVal;

    if (nameTextMesh) {
        scene.remove(nameTextMesh);
        nameTextMesh.geometry.dispose();
        nameTextMesh.material.dispose();
    }

    const textGeo = new THREE.TextGeometry(belovedNameStr, {
        font: font,
        size: 60,
        height: 10,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 1,
        bevelSegments: 5
    });

    textGeo.computeBoundingBox();
    const centerOffset = -0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);
    
    const textMaterial = new THREE.MeshPhongMaterial({
        color: 0xff99cc,
        emissive: 0xdd4477,
        specular: 0xffffff,
        shininess: 30
    });

    nameTextMesh = new THREE.Mesh(textGeo, textMaterial);
    nameTextMesh.position.set(centerOffset, -300, 50);
    nameTextMesh.visible = false;
    scene.add(nameTextMesh);

    if (!scene.getObjectByName("textLight")) {
        const light = new THREE.PointLight(0xffffff, 1, 2000);
        light.position.set(0, -200, 500);
        light.name = "textLight";
        scene.add(light);
    }
}

function createHandIndicator() {
    const geometry = new THREE.RingGeometry(20, 25, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
    });
    handIndicatorMesh = new THREE.Mesh(geometry, material);
    scene.add(handIndicatorMesh);
}

function generateSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,200,220,1)');
    gradient.addColorStop(0.4, 'rgba(255,100,150,0.8)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.Texture(canvas);
}

// ============ ANIMATION LOOP ============

function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    particles.rotation.y += CONFIG.baseSpeed;
    updateParticlesState();

    if (nameTextMesh && nameTextMesh.visible) {
        nameTextMesh.position.y = -300 + Math.sin(time * 2) * 10;
    }
    renderer.render(scene, camera);
}

function updateParticlesState() {
    const positions = particles.geometry.attributes.position.array;
    const localHandPos = handPositionWorld.clone().applyMatrix4(particles.matrixWorld.invert());

    if (nameTextMesh) {
        // Show text only if gesture is FIST and name is set
        nameTextMesh.visible = (currentGesture === 'FIST' && belovedNameStr !== "");
    }

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const px = positions[i * 3];
        const py = positions[i * 3 + 1];
        const pz = positions[i * 3 + 2];
        const idx3 = i * 3;

        let tx, ty, tz;

        if (currentGesture === 'FIST') {
            // Target: Heart/Arrow
            tx = positionsHeartArrow[idx3];
            ty = positionsHeartArrow[idx3 + 1];
            tz = positionsHeartArrow[idx3 + 2];

            // Micro-motion
            tx += Math.sin(time * CONFIG.microSpeed * (i % 7 + 1)) * CONFIG.microRange;
            ty += Math.cos(time * CONFIG.microSpeed * (i % 5 + 1)) * CONFIG.microRange;
            tz += Math.sin(time * CONFIG.microSpeed * (i % 9 + 1)) * CONFIG.microRange;

            // Lerp
            positions[idx3] += (tx - px) * CONFIG.lerpSpeed;
            positions[idx3 + 1] += (ty - py) * CONFIG.lerpSpeed;
            positions[idx3 + 2] += (tz - pz) * CONFIG.lerpSpeed;
        } else {
            // Target: Sphere
            tx = positionsInitial[idx3];
            ty = positionsInitial[idx3 + 1];
            tz = positionsInitial[idx3 + 2];

            // Micro-motion
            tx += Math.sin(time * CONFIG.microSpeed * (i % 7 + 1)) * CONFIG.microRange * 0.5;
            ty += Math.cos(time * CONFIG.microSpeed * (i % 5 + 1)) * CONFIG.microRange * 0.5;
            tz += Math.sin(time * CONFIG.microSpeed * (i % 9 + 1)) * CONFIG.microRange * 0.5;

            // Repulsion if Open Hand
            if (currentGesture === 'OPEN') {
                const dx = px - localHandPos.x;
                const dy = py - localHandPos.y;
                const dz = pz - localHandPos.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                const influenceRadiusSq = 300 * 300;

                if (distSq < influenceRadiusSq) {
                    const dist = Math.sqrt(distSq);
                    const force = (1 - dist / 300) * CONFIG.repelForce;
                    tx += (dx / dist) * force * 10;
                    ty += (dy / dist) * force * 10;
                    tz += (dz / dist) * force * 10;
                }
            }
            // Elastic return
            positions[idx3] += (tx - px) * (CONFIG.lerpSpeed * 0.5);
            positions[idx3 + 1] += (ty - py) * (CONFIG.lerpSpeed * 0.5);
            positions[idx3 + 2] += (tz - pz) * (CONFIG.lerpSpeed * 0.5);
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;
}

// ============ MEDIAPIPE & INTERACTION ============

function startMouseMode() {
    useMouseMode = true;
    hideLoader();
    document.getElementById('mouse-controls').classList.remove('hidden');
}

function setMouseGesture(gesture) {
    currentGesture = gesture;
    const statusText = gesture === 'FIST' ? "握拳 (聚拢示爱)" : "张手 (散开)";
    document.getElementById('gesture-status').innerText = statusText;
    
    // Toggle active buttons
    document.getElementById('btn-scatter').classList.toggle('active', gesture === 'OPEN');
    document.getElementById('btn-heart').classList.toggle('active', gesture === 'FIST');
}

async function startCamera() {
    if (useMouseMode) return;
    
    document.getElementById('start-btn').innerText = "正在启动...";
    try {
        initMediaPipe();
    } catch (e) {
        console.error(e);
        alert("摄像头启动失败，切换到鼠标模式");
        startMouseMode();
    }
}

function initMediaPipe() {
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
    });

    hands.onResults(onHandResults);

    cameraMP = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });
    
    cameraMP.start().then(() => {
        hideLoader();
    });
}

function hideLoader() {
    const loader = document.getElementById('loader');
    loader.style.opacity = 0;
    setTimeout(() => loader.classList.add('hidden'), 800);
}

function onHandResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Update Hand Position in 3D world
        updateHand3DPos(landmarks);
        
        // Detect Gesture
        const fingerTips = [8, 12, 16, 20];
        const wrist = landmarks[0];
        let curledFingers = 0;

        fingerTips.forEach(tipIdx => {
            const tip = landmarks[tipIdx];
            const distSq = Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2);
            if (distSq < 0.035) curledFingers++;
        });

        if (curledFingers >= 3) {
            currentGesture = 'FIST';
            document.getElementById('gesture-status').innerText = "握拳 (聚拢示爱)";
        } else {
            currentGesture = 'OPEN';
            document.getElementById('gesture-status').innerText = "张手 (散开)";
        }
    } else {
        currentGesture = 'NONE';
        document.getElementById('gesture-status').innerText = "未检测到手势";
        handPositionNormalized.set(-1, -1, -1);
        if(handIndicatorMesh) handIndicatorMesh.material.opacity = 0;
    }
}

function updateHand3DPos(landmarks) {
    const wrist = landmarks[0];
    const middleFingerMCP = landmarks[9];
    
    handPositionNormalized.x = (wrist.x + middleFingerMCP.x) / 2;
    handPositionNormalized.y = (wrist.y + middleFingerMCP.y) / 2;
    const handSize = Math.sqrt(Math.pow(wrist.x - middleFingerMCP.x, 2) + Math.pow(wrist.y - middleFingerMCP.y, 2));
    handPositionNormalized.z = (1 - handSize) * 2 - 1;

    // Convert to World
    const ndcX = (1.0 - handPositionNormalized.x) * 2 - 1;
    const ndcY = -(handPositionNormalized.y * 2 - 1);
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    handPositionWorld.copy(camera.position).add(dir.multiplyScalar(distance));

    // Update Visual Indicator
    if (handIndicatorMesh) {
        handIndicatorMesh.position.copy(handPositionWorld);
        handIndicatorMesh.material.opacity = 0.5;
        handIndicatorMesh.material.color.setHex(currentGesture === 'FIST' ? 0xff3366 : 0x00ffff);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============ GEMINI AI API ============

async function handleAIGeneration() {
    const nameInput = document.getElementById('lover-name').value;
    const btn = document.getElementById('ai-generate');
    const msgBox = document.getElementById('ai-message-box');

    if (!nameInput) {
        alert("请先输入名字...");
        return;
    }

    if (!apiKey) {
        alert("API Key 未配置。请在 script.js 中设置 apiKey 变量。");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = "✨ 星星正在思考...";
    msgBox.style.opacity = 0;

    // Ensure name is updated in 3D
    belovedNameStr = nameInput;
    updateNameText();

    try {
        const poem = await generateLovePoem(nameInput);
        msgBox.innerText = `"${poem}"`;
        msgBox.style.opacity = 1;

        btn.innerHTML = "✨ 正在合成...";
        await playTTS(poem);
        btn.innerHTML = "✨ 再次聆听";
    } catch (error) {
        console.error(error);
        msgBox.innerText = "星际信号干扰...";
        msgBox.style.opacity = 1;
        btn.innerHTML = "重试";
    } finally {
        btn.disabled = false;
    }
}

async function generateLovePoem(name) {
    const prompt = `你是一个浪漫的星际诗人。请为名字是'${name}'的人写一句简短的情话。主题要包含宇宙、星辰或永恒。20字以内，中文。不要任何解释，只返回句子。`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "星河万顷，你是唯一的引力。";
}

async function playTTS(text) {
    const payload = {
        contents: [{ parts: [{ text: text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
        },
        model: "gemini-2.5-flash-preview-tts"
    };
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    const audioContent = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (audioContent) {
        const audioBlob = base64ToBlob(audioContent, 'audio/wav'); // Try simple conversion first or use PCM helper
        // Note: For robustness, use the pcmToWav helper from the single-file version if raw PCM is returned
        // Here we assume standard playback for brevity in split version
        const audio = new Audio("data:audio/wav;base64," + audioContent);
        await audio.play();
    }
}

function base64ToBlob(base64, type) {
    const bin = atob(base64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type });
}