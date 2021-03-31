import { WebXRButton } from './util/webxr-button.js';
import { Scene } from './render/scenes/scene.js';
import { Renderer, createWebGLContext } from './render/core/renderer.js';
import { Gltf2Node } from './render/nodes/gltf2.js';
import { QueryArgs } from './util/query-args.js';
//import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.js'
import * as THREE from './../test/build/three.module.js';
import * as quat from './third-party/gl-matrix/src/gl-matrix/quat.js'

const orientLocalVis = document.getElementById('orientLocalVis');
const orientGlobalVis = document.getElementById('orientGlobalVis');
const diffOrientVis = document.getElementById('diffOrientVis');


let btnPermissionGeo = document.getElementById("requestGeo");
let btnPermissionCompass = document.getElementById("requestCompass");
btnPermissionCompass.style.display="none"

btnPermissionGeo.addEventListener("click", permissionGeo);
btnPermissionCompass.addEventListener("click", permission);


// XR globals.
let xrButton = null;
let xrRefSpace = null;
let xrViewerSpace = null;

// WebGL scene globals.
let gl = null;
let renderer = null;
let scene = null;

var orientLocal = null;
var orientGlobal = 20;
//let solarSystem = new Gltf2Node({url: 'media/space/space.gltf'});
let arrowN = new Gltf2Node({ url: 'media/Arrow.gltf' });
let arrowE = new Gltf2Node({ url: 'media/Arrow_blue.gltf' });
let arrowS = new Gltf2Node({ url: 'media/Arrow_blue.gltf' });
let arrowW = new Gltf2Node({ url: 'media/Arrow_blue.gltf' });
let firstTime = true;


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


    session.requestReferenceSpace('viewer').then((refSpace) => {
        xrViewerSpace = refSpace;
      });

    session.requestReferenceSpace('local').then((refSpace) => {
        xrRefSpace = refSpace;
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
    xrRefSpace = xrRefSpace.getOffsetReferenceSpace(
        new XRRigidTransform({ x: -deltaX, y: -deltaY, z: -deltaZ }));
}

function rotateZ(angle) {
    // Move the user by moving the reference space in the opposite direction,
    // adjusting originOffset's position by the inverse delta.
    const inverseOrientation = quat.create()
    quat.identity(inverseOrientation)
    quat.rotateY(inverseOrientation, inverseOrientation, angle);
    let s = Math.sin(angle * 0.5);
    let c = Math.cos(angle * 0.5);
    //let transform = new XRRigidTransform(null, { x: 0, y: s, z: 0, w: c })
    let transform = new XRRigidTransform({x: 0, y:  0, z: 0},
        {x: inverseOrientation[0], y: inverseOrientation[1],
         z: inverseOrientation[2], w: inverseOrientation[3]});
    xrRefSpace = xrRefSpace.getOffsetReferenceSpace(transform);

    //xrViewerSpace = xrViewerSpace.getOffsetReferenceSpace(transform);
}

// Called every time a XRSession requests that a new frame be drawn.
function onXRFrame(t, frame) {

    if (firstTime) {

        scene = new Scene();
        
        scene.enableStats(false);
        let transformN = new XRRigidTransform({x:0, y:2,z:-3})
        let transformE = new XRRigidTransform({x:3, y:2,z:0}, {x: 0, y: Math.sin(-Math.PI * 0.25), z: 0, w: Math.cos(-Math.PI * 0.25)})
        let transformS = new XRRigidTransform({x:0, y:2,z:3}, {x: 0, y: Math.sin(Math.PI * 0.5), z: 0, w: Math.cos(Math.PI * 0.5)})
        let transformW = new XRRigidTransform({x:-3, y:2,z:0}, {x: 0, y: Math.sin(Math.PI * 0.25), z: 0, w: Math.cos(Math.PI * 0.25)})

        arrowN.matrix = transformN.matrix;
        arrowE.matrix = transformE.matrix;
        arrowS.matrix = transformS.matrix;
        arrowW.matrix = transformW.matrix;

        //console.table(arrow.matrix);
        scene.addNode(arrowN);
        scene.addNode(arrowE);
        scene.addNode(arrowS);
        scene.addNode(arrowW);

        renderer = new Renderer(gl);
        scene.setRenderer(renderer);
        scene.updateInputSources(frame, xrRefSpace);
        firstTime = false;
    }

    let session = frame.session;

    let pose = frame.getViewerPose(xrRefSpace);
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

        //console.log({ orientGlobal, orientLocal_new, difference });
        //console.table(arrow.matrix);
    }

    if (Math.abs(difference) > 1) {
        //rotateZ(-difference / 180 * Math.PI);
        const inverseOrientation = quat.create()
        quat.identity(inverseOrientation)
        quat.rotateY(inverseOrientation, inverseOrientation, difference / 180 * Math.PI);
        //console.log(inverseOrientation)
        scene.rotation = [inverseOrientation[0], inverseOrientation[1], inverseOrientation[2], inverseOrientation[3]];
        pose = frame.getViewerPose(xrRefSpace);

    }
  //console.log(pose.transform.position);
    //console.log(scene.translation);
    scene.translation = [pose.transform.position.x, pose.transform.position.y, pose.transform.position.z]; 
    orientLocal = orientLocal_new;

    //arrow.matrix = pose.transform.matrix;


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
    var heading = null;
    let acc = null;
    //Check if absolute values have been sent
    if (typeof event.webkitCompassHeading !== "undefined") {
        heading = event.webkitCompassHeading; //iOS non-standard
        acc = event.webkitCompassAccuracy;
    }
    else {
        //alert("Your device is reporting relative alpha values, so this compass won't point north :(");
       // var heading = 360 - alpha; //heading [0, 360)
        heading = 360 - alpha;

    }

    if (Math.abs(heading - orientGlobal) > 0.5) {
        let difference = heading - orientLocal;
        if (acc == null) {
            orientGlobalVis.innerHTML = "Global orientation: " + heading.toFixed([0]).toString();
            diffOrientVis.innerHTML = "Difference: " + difference.toFixed(0).toString();
            console.log({ heading, orientLocal, difference});
        }
        else if (acc == -1) {
            orientGlobalVis.innerHTML = "Global orientation: Not calibrated - not usable";
        }
        else {
            orientGlobalVis.innerHTML = "Global orientation: " + heading.toFixed([0]).toString() + " +/- " + acc.toFixed(0).toString();
            diffOrientVis.innerHTML = "Difference: " + difference.toFixed(0).toString();
        }
        orientGlobal = heading;
    }


    //let difference = orientGlobal - orientLocal < 0 ?  orientGlobal - orientLocal + 360 :  orientGlobal - orientLocal;


}

function permissionGeo() {

    btnPermissionGeo.innerHTML = "Permission granted";
    btnPermissionGeo.disabled = true;
    btnPermissionCompass.style.display="block";
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
    btnPermissionCompass.innerHTML = "Permission granted";
    btnPermissionCompass.disabled = true;
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


