import {WebXRButton} from './util/webxr-button.js';
import {Scene} from './render/scenes/scene.js';
import {Renderer, createWebGLContext} from './render/core/renderer.js';
import {InlineViewerHelper} from './util/inline-viewer-helper.js';
import {Gltf2Node} from './render/nodes/gltf2.js';
import {QueryArgs} from './util/query-args.js';
//import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.js'
import * as THREE from './../test/build/three.module.js';

const orientLocalVis = document.getElementById('orientLocalVis');
const orientGlobalVis = document.getElementById('orientGlobalVis');
const diffOrientVis = document.getElementById('diffOrientVis');

let btnPermission = document.getElementById( "request" );
btnPermission.addEventListener( "click", permission );

// XR globals.
let xrButton = null;
let xrImmersiveRefSpace = null;
let inlineViewerHelper = null;

let temp = null;
let RefMatrix = null;

// WebGL scene globals.
let gl = null;
let renderer = null;
let scene = null;

var orientLocal = null;
var orientGlobal = 40;
//let solarSystem = new Gltf2Node({url: 'media/space/space.gltf'});
let flower = new Gltf2Node({url: 'media/sunflower/sunflower.gltf'});


// The solar system is big (citation needed). Scale it down so that users
// can move around the planets more easily.
//solarSystem.scale = [0.1, 0.1, 0.1];
//scene.addNode(flower);

/*
const cubeNorth = new THREE.Mesh( new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial( { color: 'red' } ) );
const cubeEast = new THREE.Mesh( new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial( { color: 'blue' } ) );
const cubeSouth = new THREE.Mesh( new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial( { color: 'yellow' } ) );
const cubeWest = new THREE.Mesh( new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial( { color: 'green' } ) );

cubeNorth.position.set(0, 0, -3);
cubeEast.position.set(3, 0, 0);
cubeSouth.position.set(0, 0, 3);
cubeWest.position.set(-3, 0, 0);
scene.add( cubeNorth );
scene.add( cubeEast );
scene.add( cubeSouth );
scene.add( cubeWest );
*/

function initXR() {
xrButton = new WebXRButton({
    onRequestSession: onRequestSession,
    onEndSession: onEndSession,
    textEnterXRTitle: "START AR",
    textXRNotFoundTitle: "AR NOT FOUND",
    textExitXRTitle: "EXIT  AR",
});
document.querySelector('header').appendChild(xrButton.domElement);

if (navigator.xr) {
    // Checks to ensure that 'immersive-ar' mode is available, and only
    // enables the button if so.
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    xrButton.enabled = supported;
    });

    navigator.xr.requestSession('inline').then(onSessionStarted);
}
}

function onRequestSession() {
// Requests an 'immersive-ar' session, which ensures that the users
// environment will be visible either via video passthrough or a
// transparent display. This may be presented either in a headset or
// fullscreen on a mobile device.
return navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['dom-overlay'],
        domOverlay: {root: document.getElementById('overlay')}})
    .then((session) => {
        xrButton.setSession(session);
        session.isImmersive = true;
        onSessionStarted(session);
    });
}
scene = new Scene();
scene.addNode(flower);

function initGL() {
if (gl)
    return;

gl = createWebGLContext({
    xrCompatible: true
});
document.body.appendChild(gl.canvas);

function onResize() {
    gl.canvas.width = gl.canvas.clientWidth * window.devicePixelRatio;
    gl.canvas.height = gl.canvas.clientHeight * window.devicePixelRatio;
}
window.addEventListener('resize', onResize);
onResize();

renderer = new Renderer(gl);

scene.setRenderer(renderer);
}

function onSessionStarted(session) {
    session.addEventListener('end', onSessionEnded);


    initGL();

    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });


    let refSpaceType = session.isImmersive ? 'local' : 'viewer';
    session.requestReferenceSpace(refSpaceType).then((refSpace) => {
        if (session.isImmersive) {
        xrImmersiveRefSpace = refSpace;
        } else {
        inlineViewerHelper = new InlineViewerHelper(gl.canvas, refSpace);
        }
        session.requestAnimationFrame(onXRFrame);
    });

    pose = frame.getViewerPose(refSpace);

    flower.matrix = pose.transform.matrix;
    
}

function onEndSession(session) {
    session.end();
}

function onSessionEnded(event) {
    if (event.session.isImmersive) {
        xrButton.setSession(null);
    }
}

// Teleport the user a certain number of meters along the X, Y, and Z axes,
// for example deltaX=1 means the virtual world view changes as if the user had
// taken a 1m step to the right, so the new reference space pose should
// have its X value increased by 1m.
function teleportRelative(deltaX, deltaY, deltaZ) {
// Move the user by moving the reference space in the opposite direction,
// adjusting originOffset's position by the inverse delta.
xrImmersiveRefSpace = xrImmersiveRefSpace.getOffsetReferenceSpace(
    new XRRigidTransform({ x: -deltaX, y: -deltaY, z: -deltaZ }));
}

function rotateZ(angle) {
// Move the user by moving the reference space in the opposite direction,
// adjusting originOffset's position by the inverse delta.

let s = Math.sin(angle * 0.5);
let c = Math.cos(angle * 0.5);
xrImmersiveRefSpace = xrImmersiveRefSpace.getOffsetReferenceSpace(
    new XRRigidTransform(null, { x: 0, y: s, z: 0, w: c }));
}

// Called every time a XRSession requests that a new frame be drawn.
function onXRFrame(t, frame) {
let session = frame.session;



let refSpace = session.isImmersive ?
                    xrImmersiveRefSpace :
                    inlineViewerHelper.referenceSpace;
let pose = frame.getViewerPose(refSpace);
let temp_new = pose.transform.matrix;

if (RefMatrix == null) {
    RefMatrix = new THREE.Matrix4();
    RefMatrix.fromArray(temp_new);
}
if (JSON.stringify(temp_new)!==JSON.stringify(temp)) {
    temp = temp_new;
    //console.log(new Array(temp))
    const m = new THREE.Matrix4();
    m.fromArray(temp)
    const a = new THREE.Euler()
    a.setFromRotationMatrix(m);


    let position = new THREE.Vector3();
    let quat = new THREE.Quaternion();
    let scale = new THREE.Vector3();
    m.decompose(position, quat, scale)

    let orient = pose.transform.orientation

    const vector = new THREE.Vector3( 0, 0, 1 );
    vector.applyQuaternion( orient );
    let vec = vector.projectOnPlane(new THREE.Vector3(0,1,0))
    let orientDeg = Math.atan2(vec.z,vec.x) * 180 / Math.PI;
    orientLocal = 90 - orientDeg;
    if (orientLocal < 0) {orientLocal = orientLocal + 360}
    orientLocalVis.innerHTML = "Local orientation: " + orientLocal.toFixed([0]).toString();
    console.log(orientLocal.toFixed([0]).toString()) //YESSSSSS

    let difference = orientGlobal - orientLocal;
    console.log(difference);
    diffOrientVis.innerHTML = "Difference: " + difference.toFixed(0).toString();
    
    if (Math.abs(difference) > 1) {
        rotateZ(-difference/180 * Math.PI);
    }
    //console.log(vec);
    //console.log(quat.toArray().map(function(x) { return x * 180 / Math.PI; }));
    //console.log(orient.toArray().map(function(x) { return x * 180 / Math.PI; }));
    //console.log(m.extractRotation(RefMatrix))
}

scene.startFrame();

session.requestAnimationFrame(onXRFrame);

scene.drawXRFrame(frame, pose);

scene.endFrame();
}

function iOS() {
return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
].includes(navigator.platform)
// iPad on iOS 13 detection
|| (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}


// Get event data
function deviceOrientationHandler(event) {
var alpha    = event.alpha; //z axis rotation [0,360)
var beta     = event.beta; //x axis rotation [-180, 180]
var gamma    = event.gamma; //y axis rotation [-90, 90]
//Check if absolute values have been sent
if (typeof event.webkitCompassHeading !== "undefined") {
    alpha = event.webkitCompassHeading; //iOS non-standard
    var heading = alpha
    orientGlobalVis.innerHTML = "Global orientation: " + heading.toFixed([0]).toString();
}
else {
    //alert("Your device is reporting relative alpha values, so this compass won't point north :(");
    var heading = 360 - alpha; //heading [0, 360)
    orientGlobalVis.innerHTML = "Global orientation: " + heading.toFixed([0]).toString();
}

orientGlobal = heading;
//let difference = orientGlobal - orientLocal < 0 ?  orientGlobal - orientLocal + 360 :  orientGlobal - orientLocal;


}

function permission () {
if (iOS){
    if ( typeof( DeviceMotionEvent ) !== "undefined" && typeof( DeviceMotionEvent.requestPermission ) === "function" ) {
    // (optional) Do something before API request prompt.
    DeviceMotionEvent.requestPermission()
        .then( response => {
        // (optional) Do something after API prompt dismissed.
        if ( response == "granted" ) {
            handler();
        }
    })
    .catch( console.error )
} else {
    console.log( "DeviceMotionEvent is not defined" );
    handler();
}
} else {
    handler();
}

}

function handler() {
    btnPermission.innerHTML = "Permission granted";
    btnPermission.disabled = true;
    initXR();

    // Check if device can provide absolute orientation data
    if (window.DeviceOrientationAbsoluteEvent) {
        comsole.log("Absolute Orientation existing");
    window.addEventListener("DeviceOrientationAbsoluteEvent", deviceOrientationHandler);
    } // If not, check if the device sends any orientation data
    else if(window.DeviceOrientationEvent){
        console.log("Only normal orientation existing");
    window.addEventListener("deviceorientation", deviceOrientationHandler);
    } // Send an alert if the device isn't compatible
    else {
    alert("Sorry, try again on a compatible mobile device!");
    }
    
}


