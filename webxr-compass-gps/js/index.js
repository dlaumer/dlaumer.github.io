import { WebXRButton } from './util/webxr-button.js';
import { Scene } from './render/scenes/scene.js';
import { Renderer, createWebGLContext } from './render/core/renderer.js';
import { Gltf2Node } from './render/nodes/gltf2.js';
import { QueryArgs } from './util/query-args.js';
//import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.js'
import * as THREE from './../test/build/three.module.js';

const orientLocalVis = document.getElementById('orientLocalVis');
const orientGlobalVis = document.getElementById('orientGlobalVis');
const diffOrientVis = document.getElementById('diffOrientVis');

let btnPermission = document.getElementById("request");
btnPermission.addEventListener("click", permission);

// XR globals.
let xrButton = null;
let xrImmersiveRefSpace = null;

// WebGL scene globals.
let gl = null;
let renderer = null;
let scene = null;

var orientLocal = null;
var orientGlobal = 13;
//let solarSystem = new Gltf2Node({url: 'media/space/space.gltf'});
let flower = new Gltf2Node({ url: 'media/sunflower/sunflower.gltf' });
let firstTime = true;

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

    }
}

function onRequestSession() {
    // Requests an 'immersive-ar' session, which ensures that the users
    // environment will be visible either via video passthrough or a
    // transparent display. This may be presented either in a headset or
    // fullscreen on a mobile device.
    return navigator.xr.requestSession('immersive-ar', {
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.getElementById('overlay') }
    })
        .then((session) => {
            xrButton.setSession(session);
            session.isImmersive = true;
            onSessionStarted(session);
        });
}


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

}

function onSessionStarted(session) {
    session.addEventListener('end', onSessionEnded);

    initGL();

    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    let refSpaceType = 'local' ;
    session.requestReferenceSpace(refSpaceType).then((refSpace) => {
        xrImmersiveRefSpace = refSpace;
        session.requestAnimationFrame(onXRFrame);
    });



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

    let refSpace = xrImmersiveRefSpace;

    let pose = frame.getViewerPose(refSpace);
    let orient = pose.transform.orientation
    const vector = new THREE.Vector3(0, 0, 1);
    vector.applyQuaternion(orient);
    let vec = vector.projectOnPlane(new THREE.Vector3(0, 1, 0))
    let orientDeg = Math.atan2(vec.z, vec.x) * 180 / Math.PI;
    let orientLocal_new = 90 - orientDeg;
    if (orientLocal_new < 0) { orientLocal_new = orientLocal_new + 360 }
    let difference = orientGlobal - orientLocal_new;

    if (Math.abs(orientLocal_new - orientLocal) > 0.5) {
        orientLocalVis.innerHTML = "Local orientation: " + orientLocal_new.toFixed([0]).toString();
        diffOrientVis.innerHTML = "Difference: " + difference.toFixed(0).toString();

        console.log({ orientGlobal, orientLocal_new, difference });
        //console.table(flower.matrix);
    }

    if (Math.abs(difference) > 1) {
        rotateZ(-difference / 180 * Math.PI);
    }
    orientLocal = orientLocal_new;

    //flower.matrix = pose.transform.matrix;
    if (firstTime) {

        scene = new Scene();
        flower.matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, -2, 1];
        //console.table(flower.matrix);
        scene.addNode(flower);
        renderer = new Renderer(gl);

        scene.setRenderer(renderer);
        firstTime = false;
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
    var alpha = event.alpha; //z axis rotation [0,360)
    var beta = event.beta; //x axis rotation [-180, 180]
    var gamma = event.gamma; //y axis rotation [-90, 90]
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

function permission() {
    if (iOS) {
        if (typeof (DeviceMotionEvent) !== "undefined" && typeof (DeviceMotionEvent.requestPermission) === "function") {
            // (optional) Do something before API request prompt.
            DeviceMotionEvent.requestPermission()
                .then(response => {
                    // (optional) Do something after API prompt dismissed.
                    if (response == "granted") {
                        handler();
                    }
                })
                .catch(console.error)
        } else {
            console.log("DeviceMotionEvent is not defined");
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
    else if (window.DeviceOrientationEvent) {
        console.log("Only normal orientation existing");
        window.addEventListener("deviceorientation", deviceOrientationHandler);
    } // Send an alert if the device isn't compatible
    else {
        alert("Sorry, try again on a compatible mobile device!");
    }

}


