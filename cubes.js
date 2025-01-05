import * as THREE from "three";
//import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {cubeMap} from "./cubemap.js";

//chamferbox
function createBox(width, height, dept, radi, shrink) {
  const s = new THREE.Shape();
  s.moveTo(shrink, shrink + radi); //1
  s.lineTo(shrink, shrink + height - shrink - radi); //2
  s.lineTo(shrink + radi, shrink + height - shrink); //3
  s.lineTo(shrink + width - shrink - radi, shrink + height - shrink); //4
  s.lineTo(shrink + width - shrink, shrink + height - shrink - radi); //5
  s.lineTo(shrink + width - shrink, shrink + radi); //6
  s.lineTo(shrink + width - shrink - radi, shrink); //7
  s.lineTo(shrink + radi, shrink); //8
  s.lineTo(shrink, shrink + radi); //0 again

  const geom = new THREE.ExtrudeGeometry(s, {
    steps: 1,
    depth: dept - 2 * radi,
    bevelEnabled: true,
    bevelThickness: radi,
    bevelSize: radi,
    bevelOffset: -radi,
    bevelSegments: 1,
  });
  geom.translate(-width / 2, -height / 2, -dept / 2);

  return geom;
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // Set to light gray
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias: true});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Camera position
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

// Orbit controls
//const controls = new OrbitControls(camera, renderer.domElement);
//controls.enableDamping = true;

//lights
const ambientLight = new THREE.AmbientLight(0xfff4b5, 0.4);
scene.add(ambientLight);

let hemiLight = new THREE.HemisphereLight(0xffbbbb, 0x080820, 1);
scene.add(hemiLight);

// Directional light
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(-10, 15, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.bias = -0.0001;
scene.add(dirLight);

// Adjust floor material
const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.7,
  metalness: 0.1,
  emissive: 0x777777,
});

// Infinite floor
const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

/*
//test geomtry
const geomA = new THREE.BoxGeometry(10, 10, 10);
const cubeA = new THREE.Mesh(geomA, new THREE.MeshStandardMaterial({color: 0xff0000}));
cubeA.position.set(0, 0, 0);
scene.add(cubeA);

const geomB = createBox(10, 10, 10, 0.08, 0);
const cubeB = new THREE.Mesh(geomB, new THREE.MeshStandardMaterial({color: 0x00ff00}));
cubeB.position.set(0, 0, 0);
scene.add(cubeB);
*/

class GridCube {
  constructor(x, z, color) {
    this.gridX = x;
    this.gridZ = z;
    this.destX = x;
    this.destZ = z;
    this.color = color;
    this.cubeSize = 0.95;
    this.doneAll = true;

    // Create the physical cube
    //const geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
    const geometry = createBox(this.cubeSize, this.cubeSize, this.cubeSize, 0.04, 0);
    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.8,
      metalness: 0.1,
      envMapIntensity: 3,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(x - 20, this.cubeSize / 2, z - 7); // Adjusted y position for new size
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Add new properties for movement
    this.isMoving = false;
    this.animationStep = 0;
    this.TOTAL_ANIMATION_STEPS = 20;
    this.TOTAL_JUMP_STEPS = 12;
    this.moveFromX = x;
    this.moveFromZ = z;
    this.moveToX = x;
    this.moveToZ = z;
    // Add delay property
    this.moveDelay = 0;
  }

  updatePosition(x, z) {
    this.gridX = x;
    this.gridZ = z;
    this.mesh.position.set(x - 20, this.cubeSize / 2, z - 7);
  }

  getMesh() {
    return this.mesh;
  }

  setDestination(x, z) {
    this.destX = x;
    this.destZ = z;
  }

  getDestination() {
    return {x: this.destX, z: this.destZ};
  }

  hasReachedDestination() {
    const reached = this.gridX === this.destX && this.gridZ === this.destZ;
    return reached;
  }

  tryMove() {
    //console.log(`Cube at (${this.gridX},${this.gridZ}) trying to move to (${this.destX},${this.destZ})`);

    if (this.isMoving || this.isJumping || this.doneAll) {
      return false;
    }

    const possibleMoves = this.getPossibleMoves();
    //console.log("Possible moves:", possibleMoves);

    const bestMove = this.chooseBestMove(possibleMoves);
    //console.log("Best move:", bestMove);

    if (bestMove) {
      // Double check the spot is still free before moving
      const moveKey = `${bestMove.x},${bestMove.z}`;
      if (!occupiedSpots.has(moveKey)) {
        //console.log(`Starting move to (${bestMove.x},${bestMove.z})`);
        this.startMove(bestMove.x, bestMove.z);
        // Immediately mark the spot as occupied
        occupiedSpots.set(moveKey, this);
        return true;
      }
    }
    return false;
  }

  getPossibleMoves() {
    const moves = [
      {x: this.gridX + 1, z: this.gridZ}, // East
      {x: this.gridX - 1, z: this.gridZ}, // West
      {x: this.gridX, z: this.gridZ + 1}, // North
      {x: this.gridX, z: this.gridZ - 1}, // South
    ];

    // Define grid boundaries
    const MIN_X = -2;
    const MAX_X = 42;
    const MIN_Z = -2;
    const MAX_Z = 17;

    // Randomize move order to prevent predictable patterns
    moves.sort(() => Math.random() - 0.5);

    // Filter out moves that are:
    // 1. Occupied
    // 2. Outside grid boundaries
    return moves.filter((move) => !isSpotOccupied(move.x, move.z) && move.x >= MIN_X && move.x <= MAX_X && move.z >= MIN_Z && move.z <= MAX_Z);
  }

  manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  findPath() {
    const start = {x: this.gridX, z: this.gridZ};
    const goal = {x: this.destX, z: this.destZ};

    // Set of nodes to evaluate
    const openSet = [start];
    // Set of nodes already evaluated
    const closedSet = new Set();
    // For each node, which node it can most efficiently be reached from
    const cameFrom = new Map();

    // For each node, the cost of getting from start to that node
    const gScore = new Map();
    gScore.set(`${start.x},${start.z}`, 0);

    // For each node, estimated total cost from start to goal through this node
    const fScore = new Map();
    fScore.set(`${start.x},${start.z}`, this.manhattanDistance(start, goal));

    // Increase max iterations for longer paths
    const maxIterations = Math.max(1000, this.manhattanDistance(start, goal) * 30);
    let iterations = 0;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Get the node with lowest fScore (not gScore like before)
      const current = openSet.reduce((a, b) => ((fScore.get(`${a.x},${a.z}`) || Infinity) < (fScore.get(`${b.x},${b.z}`) || Infinity) ? a : b));

      // If we reached the goal
      if (current.x === goal.x && current.z === goal.z) {
        const path = this.reconstructPath(cameFrom, current);
        if (path.length < 2) return null; // No move needed
        return path[1]; // Return the next move
      }

      // Remove current from openSet
      const currentIndex = openSet.findIndex((node) => node.x === current.x && node.z === current.z);
      if (currentIndex > -1) {
        openSet.splice(currentIndex, 1);
      }

      // Add to closedSet
      const currentKey = `${current.x},${current.z}`;
      closedSet.add(currentKey);

      // Check all neighboring squares
      const neighbors = [
        {x: current.x + 1, z: current.z}, // Right
        {x: current.x - 1, z: current.z}, // Left
        {x: current.x, z: current.z + 1}, // Up
        {x: current.x, z: current.z - 1}, // Down
      ];

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.z}`;

        // Skip if we've already evaluated this node
        if (closedSet.has(neighborKey)) continue;

        // Check if spot is occupied (except for goal)
        const isOccupied = occupiedSpots.has(neighborKey);
        const isGoal = neighbor.x === goal.x && neighbor.z === goal.z;

        // Skip if occupied (unless it's the goal)
        if (isOccupied && !isGoal) {
          closedSet.add(neighborKey);
          continue;
        }

        const tentativeGScore = gScore.get(currentKey) + 1;

        // Add to openSet if not already there
        if (!openSet.some((node) => node.x === neighbor.x && node.z === neighbor.z)) {
          openSet.push(neighbor);
        }

        // Skip if this path is worse
        if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
          continue;
        }

        // This path is better - record it
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + this.manhattanDistance(neighbor, goal));
      }
    }

    // No path found or max iterations reached
    return null;
  }

  reconstructPath(cameFrom, current) {
    const path = [current];
    let currentKey = `${current.x},${current.z}`;

    while (cameFrom.has(currentKey)) {
      current = cameFrom.get(currentKey);
      path.unshift(current);
      currentKey = `${current.x},${current.z}`;
    }

    return path;
  }

  chooseBestMove(possibleMoves) {
    if (possibleMoves.length === 0) return null;

    // Get the next step from pathfinding
    const nextStep = this.findPath();

    // If we found a valid next step and it's in our possible moves, use it
    if (nextStep && possibleMoves.some((move) => move.x === nextStep.x && move.z === nextStep.z)) {
      return nextStep;
    }

    // If no path found or next step is blocked, pick a random move
    // This helps prevent gridlock by allowing cubes to move out of the way
    return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  }

  startMove(newX, newZ) {
    this.isMoving = true;
    this.isJumping = false;
    this.doneAll = false;
    this.animationStep = 0;
    this.jumpStep = 0;
    this.moveFromX = this.gridX;
    this.moveFromZ = this.gridZ;
    this.moveToX = newX;
    this.moveToZ = newZ;
    // Add random delay between 0-10 steps
    this.moveDelay = Math.floor(Math.random() * 11);
  }

  update() {
    if (this.doneAll) return;

    // Wait for delay before starting movement
    if (this.moveDelay > 0) {
      this.moveDelay--;
      return;
    }

    if (this.isMoving) {
      this.animationStep++;

      // Calculate progress (0 to 1)
      const progress = this.animationStep / this.TOTAL_ANIMATION_STEPS;

      // Determine direction of movement
      const dx = this.moveToX - this.moveFromX;
      const dz = this.moveToZ - this.moveFromZ;

      // Calculate rotation axis and angle
      let rotationAxis;
      let pivotPoint;
      if (dx > 0) {
        // Moving right
        rotationAxis = new THREE.Vector3(0, 0, -1);
        pivotPoint = new THREE.Vector3(this.moveFromX - 20 + this.cubeSize / 2, 0, this.moveFromZ - 7);
      } else if (dx < 0) {
        // Moving left
        rotationAxis = new THREE.Vector3(0, 0, 1);
        pivotPoint = new THREE.Vector3(this.moveFromX - 20 - this.cubeSize / 2, 0, this.moveFromZ - 7);
      } else if (dz > 0) {
        // Moving forward
        rotationAxis = new THREE.Vector3(1, 0, 0);
        pivotPoint = new THREE.Vector3(this.moveFromX - 20, 0, this.moveFromZ - 7 + this.cubeSize / 2);
      } else {
        // Moving back
        rotationAxis = new THREE.Vector3(-1, 0, 0);
        pivotPoint = new THREE.Vector3(this.moveFromX - 20, 0, this.moveFromZ - 7 - this.cubeSize / 2);
      }

      // Calculate rotation angle based on progress
      const angle = (progress * Math.PI) / 2;

      // Reset position/rotation
      this.mesh.position.set(this.moveFromX - 20, this.cubeSize / 2, this.moveFromZ - 7);
      this.mesh.rotation.set(0, 0, 0);

      // Move to pivot point, rotate, move back
      this.mesh.position.sub(pivotPoint);
      this.mesh.position.applyAxisAngle(rotationAxis, angle);
      this.mesh.position.add(pivotPoint);

      // Rotate the mesh
      this.mesh.rotateOnWorldAxis(rotationAxis, angle);

      // Check if movement is complete
      if (this.animationStep >= this.TOTAL_ANIMATION_STEPS) {
        this.isMoving = false;
        this.gridX = this.moveToX;
        this.gridZ = this.moveToZ;
        // Remove old position from occupied spots
        const oldKey = `${this.moveFromX},${this.moveFromZ}`;
        occupiedSpots.delete(oldKey);
        if (this.hasReachedDestination()) {
          this.isJumping = true;
        }
        //console.log(`Cube completed move to (${this.gridX},${this.gridZ})`);
      }
    } else if (this.isJumping) {
      this.jumpStep++;

      // Calculate progress (0 to 1)
      const progress = this.jumpStep / this.TOTAL_JUMP_STEPS;

      // update const new  Y position tweening so it looks like the cube is jumping then landing back down
      const jumpHeight = 0.3;
      const newY = this.cubeSize / 2 + jumpHeight * Math.sin(progress * Math.PI);

      // Update mesh position
      this.mesh.position.set(this.gridX - 20, newY, this.gridZ - 7);
      // Check if movement is complete
      if (this.jumpStep >= this.TOTAL_JUMP_STEPS) {
        this.isJumping = false;
        this.doneAll = true;
      }
    }
  }
}

// Add this function to track occupied spots
const occupiedSpots = new Map();

function isSpotOccupied(x, z) {
  const key = `${x},${z}`;
  return occupiedSpots.has(key);
}

function updateOccupiedSpots(gridCubes) {
  occupiedSpots.clear();

  // First pass: mark current positions and active movements
  gridCubes.forEach((cube) => {
    // Mark current position
    const currentKey = `${cube.gridX},${cube.gridZ}`;
    occupiedSpots.set(currentKey, cube);

    // If already moving, mark the destination
    if (cube.isMoving) {
      const destKey = `${cube.moveToX},${cube.moveToZ}`;
      occupiedSpots.set(destKey, cube);
    }
  });
}

function createMapCubes() {
  const colors = [
    0xfee44e, // yellow
    0xdb4243, // red
    0x0aabd7, // blue
    0x5da14f, // green
    0xb23d75, // purple
    0xfe9c00, // orange
  ];

  const cubes = [];

  cubeMap.forEach((coords, index) => {
    const [x, z] = coords;
    const colorIndex = index % colors.length;
    const cube = new GridCube(x, z, colors[colorIndex]);
    cubes.push(cube);
    scene.add(cube.getMesh()); //matty1
  });

  return cubes;
}

function shuffleCubes(cubes) {
  // Verify we have cubes to work with
  //console.log("Total cubes:", cubes.length);
  if (cubes.length === 0) {
    console.error("No cubes to shuffle!");
    return;
  }

  updateOccupiedSpots(gridCubes);
  // Keep track of which cubes have been used
  const usedCubes = new Set();

  // Do 4 pairs of swaps
  //console.log("starting shuffle");
  let foundValidPair = false;
  let attempts = 0;
  const maxAttempts = 40;

  while (!foundValidPair && attempts < maxAttempts) {
    // Pick two random cubes that haven't been used yet, and that have reached their destination
    const availableCubes = cubes.filter((_, index) => !usedCubes.has(index) && gridCubes[index].doneAll);
    if (availableCubes.length < 2) break; // Not enough cubes left

    const index1 = Math.floor(Math.random() * availableCubes.length);
    let index2;
    do {
      index2 = Math.floor(Math.random() * availableCubes.length);
    } while (index2 === index1 && availableCubes.length > 1);

    const cube1 = availableCubes[index1];
    const cube2 = availableCubes[index2];

    // Get their original indices to mark them as used later
    const originalIndex1 = cubes.indexOf(cube1);
    const originalIndex2 = cubes.indexOf(cube2);

    // Store original positions
    const pos1 = {x: cube1.gridX, z: cube1.gridZ};
    const pos2 = {x: cube2.gridX, z: cube2.gridZ};

    // Temporarily set destinations to check paths
    cube1.destX = pos2.x;
    cube1.destZ = pos2.z;
    cube2.destX = pos1.x;
    cube2.destZ = pos1.z;

    // Check if both cubes can reach their destinations
    const path1 = cube1.findPath();
    const path2 = cube2.findPath();

    if (path1 && path2) {
      // Valid pair found! Keep these destinations
      //console.log(`Found valid pair between (${pos1.x},${pos1.z}) and (${pos2.x},${pos2.z})`);
      foundValidPair = true;

      // Mark these cubes as used
      usedCubes.add(originalIndex1);
      usedCubes.add(originalIndex2);
      cube1.doneAll = false;
      cube2.doneAll = false;
    } else {
      // Reset destinations and try again
      cube1.destX = pos1.x;
      cube1.destZ = pos1.z;
      cube2.destX = pos2.x;
      cube2.destZ = pos2.z;
    }

    attempts++;
  }

  if (!foundValidPair) {
    //console.log(`Warning: Could not find valid pair for swap ${swapCount + 1} after ${maxAttempts} attempts`);
  }
  //console.log("done shuffling");
}

// Create and initialize cubes
const gridCubes = createMapCubes();

var shuffleCount = 0;

// Create performance stats display
/*
const statsDiv = document.createElement("div");
statsDiv.style.position = "fixed";
statsDiv.style.top = "10px";
statsDiv.style.left = "10px";
statsDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
statsDiv.style.color = "white";
statsDiv.style.padding = "10px";
statsDiv.style.fontFamily = "monospace";
statsDiv.style.fontSize = "12px";
statsDiv.style.zIndex = "100";
document.body.appendChild(statsDiv);*/

let lastTime = performance.now();
let frameCount = 0;
let totalFrameTime = 0;
let currentFrameTime = 0;
let cubeToGo = 0;
let lastCubeToGo = 0;
let cameraRadius = 20;
let cameraElevation = 20;
let timeOffset = 0;

// Animation loop
function animate() {
  const currentTime = performance.now();
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  // Update frame statistics
  frameCount++;
  totalFrameTime += deltaTime;

  // Update stats every second
  if (totalFrameTime >= 250) {
    currentFrameTime = totalFrameTime / frameCount;
    //currentFps = 150 / currentFrameTime;
    frameCount = 0;
    totalFrameTime = 0;
    // Update stats display
    //statsDiv.innerHTML = `Frame Time: ${currentFrameTime.toFixed(2)}ms`;
  }

  requestAnimationFrame(animate);

  // check if all cubes have reached their destination every 5 seconds
  if (Date.now() % 5000 < 16) {
    const reachedCubes = gridCubes.filter((cube) => cube.doneAll).length;
    const totalCubes = gridCubes.length;
    cubeToGo = totalCubes - reachedCubes;
    //console.log(`${reachedCubes}/${totalCubes} cubes reached destination`);
    //console.log("shuffle count: " + shuffleCount);
  }

  //check were not stuck
  if (Date.now() % 10000 < 16) {
    if (cubeToGo === lastCubeToGo) {
      shuffleCount = Math.max(0, shuffleCount - 1);
    }
    lastCubeToGo = cubeToGo;
  }

  // Update occupied spots BEFORE any movement
  updateOccupiedSpots(gridCubes);

  // Now try to move cubes
  gridCubes.forEach((cube) => {
    cube.tryMove();
    cube.update();
  });
  //add shuffle every 0.5 seconds
  if (Date.now() % 500 < 16) {
    if (shuffleCount < 20 && currentFrameTime < 100) {
      shuffleCount++;
      shuffleCubes(gridCubes);
    }
    if (cubeToGo < 4) {
      shuffleCount = Math.max(0, shuffleCount - 1);
    }
  }

  if (Date.now() % 5000 < 16) {
    cameraRadius = Math.random() * 25 + 5; //random number between 10 and 30
    cameraElevation = Math.random() * 40 + 3;
    timeOffset = Math.random() * 20;
  }

  const rotationSpeed = 0.00002;
  const time = Date.now() * rotationSpeed; // Convert to seconds
  camera.position.x = Math.cos(time + timeOffset) * cameraRadius;
  camera.position.z = Math.sin(time + timeOffset) * cameraRadius;
  camera.position.y = cameraElevation;
  camera.lookAt(-2, 0, 5);

  //controls.update();
  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create text element
const textDiv = document.createElement("div");
textDiv.innerHTML = "Pioneering safe AI for children that sparks creativity, learning, and play.";
textDiv.style.position = "fixed";
textDiv.style.left = "50%";
textDiv.style.transform = "translateX(-50%)";
textDiv.style.color = "#333";
textDiv.style.fontFamily = '"Poetsen One", serif';
textDiv.style.fontWeight = "400";
textDiv.style.fontSize = "clamp(48px, 4vw, 80px)"; // Responsive font size
textDiv.style.textAlign = "center";
textDiv.style.zIndex = "100";
textDiv.style.maxWidth = "90%"; // Responsive width
textDiv.style.width = "min(800px, 90vw)"; // Responsive with maximum
textDiv.style.padding = "clamp(10px, 2vw, 20px)";
textDiv.style.lineHeight = "1.4";
textDiv.style.margin = "0 auto";

// Add media queries for mobile
const mediaQuery = window.matchMedia("(max-width: 768px)");
function handleMobileChange(e) {
  if (e.matches) {
    // Mobile styles
    textDiv.style.bottom = "10%";
    textDiv.style.fontSize = "80px";
    textDiv.style.letterSpacing = "-1px";
    textDiv.style.padding = "10px";
  } else {
    // Desktop styles
    textDiv.style.bottom = "10%";
    textDiv.style.fontSize = "48px";
    textDiv.style.letterSpacing = "-1px";
    textDiv.style.padding = "20px";
  }
}
// Add listener for screen size changes
mediaQuery.addListener(handleMobileChange);
// Initial check
handleMobileChange(mediaQuery);

document.body.appendChild(textDiv);

// Handle window resize
window.addEventListener("resize", () => {
  handleMobileChange(mediaQuery);
});

animate();
