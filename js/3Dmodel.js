// Import the THREE.js library
import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
// To allow for the camera to move around the scene
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
// To allow for importing the .gltf file
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

// Create a Three.JS Scene
const scene = new THREE.Scene();
// Create a new camera with positions and angles
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);

// Instantiate a new renderer and set its size
const renderer = new THREE.WebGLRenderer({ alpha: true }); // Alpha: true allows for the transparent background
renderer.setSize(window.innerWidth, window.innerHeight);

// Add the renderer to the DOM
document.getElementById("container3D").appendChild(renderer.domElement);

// Instantiate a loader for the .gltf file
const loader = new GLTFLoader();

// Load the file
let model; // Store the loaded model
loader.load(
  `/nipscernwebtest/assets/model/scene.gltf`, // Ensure this path is correct
  function (gltf) {
    // If the file is loaded, add it to the scene
    model = gltf.scene; // Store the loaded model
    model.scale.set(0.1, 0.1, 0.1); // Adjust the scale to fit the view
    scene.add(model);

    // Start the animation loop after the model is loaded
    animate(); // No need to pass the object; we can access it globally
  },
  function (xhr) {
    // While it is loading, log the progress
    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
  },
  function (error) {
    // If there is an error, log it
    console.error("Error loading GLTF model:", error);
  }
);

// Set camera position
camera.position.set(-300, 200, 500); // Position the camera further back to see the whole model

// CSS for the container (adjust as necessary)
const container = document.getElementById("container3D");
container.style.width = "100%"; // Expand to full width
container.style.height = "100vh"; // Expand to full height
container.style.position = "relative"; // Ensure the container is positioned correctly
container.style.overflow = "hidden"; // Prevent overflow

// Add orbit controls to the camera
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // An animation loop is required when either damping or auto-rotation are enabled
controls.dampingFactor = 0.25;
controls.enableZoom = true; // Allow zooming
controls.enablePan = true; // Allow panning
controls.maxPolarAngle = Math.PI / 2; // Limit vertical movement

// Rotation state
let isPanning = false;

// Render the scene
function animate() {
  requestAnimationFrame(animate); // Recursive call to animate
  controls.update(); // Update controls

  // Rotate the model only if not panning
  if (!isPanning && model) {
    model.rotation.y += 0.01; // Small rotation for smooth spinning
  }

  // Render the scene
  renderer.render(scene, camera);
}

// Add event listeners for panning
controls.addEventListener('start', () => {
  isPanning = true; // Set panning state to true
});

controls.addEventListener('end', () => {
  isPanning = false; // Reset panning state to false
});

// Add a listener to the window, so we can resize the window and the camera
window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
