/*



*/

import { WebXRButton } from './util/webxr-button.js';   // For easier handeling of the starting and allowing of XR
import { Scene } from './render/scenes/scene.js';       // For "easier" handeling of positioning objects, a bit confusing tho
import { Renderer, createWebGLContext } from './render/core/renderer.js';   // Renderer
import { Gltf2Node } from './render/nodes/gltf2.js';    // For uploading 3D models (are there other options than gltf?)
import { QueryArgs } from './util/query-args.js';       // ?
//import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.js'
import * as THREE from './../test/build/three.module.js';   // Hack to import THREE on the server, somehow the other did't work
import * as quat from './third-party/gl-matrix/src/gl-matrix/quat.js'   // Library to build and use quaternions

// Find all the DOM elements 
const pointVis = document.getElementById('pointVis');
const geoLocVis = document.getElementById('geoLocVis');
const orientLocalVis = document.getElementById('orientLocalVis');
const orientGlobalVis = document.getElementById('orientGlobalVis');
const diffOrientVis = document.getElementById('diffOrientVis');

let btnPermissionGeo = document.getElementById("requestGeo");           // Button to ask for geolocation permission
let btnPermissionCompass = document.getElementById("requestCompass");   // Button to ask for compass permission
btnPermissionCompass.style.display="none"   // Only show it after geolocation

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

// Geo orientation globals
var orientLocal = null;     // Stores the current orientation of the phone in the local coordinate system (degree)
var orientGlobal = null;    // Stores the current orientation of the phone in the global coordinate system (degree)

// Load 3D models
let arrowN = new Gltf2Node({ url: 'media/Arrow.glb' });
let arrowE = new Gltf2Node({ url: 'media/Arrow_blue.glb' });
let arrowS = new Gltf2Node({ url: 'media/Arrow_blue.glb' });
let arrowW = new Gltf2Node({ url: 'media/Arrow_blue.glb' });
let firstTime = true;
let firstTimeCompass = true;
// Data for the different points, which are pointed to in the AR session 
let pointData = null;

// Function to make XR Button and check if AR is available
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

// Function to start the XR Session
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

// Function to start the GL canvas
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

// Function to what happens after the XR session has started
// Like for example to get the reference spaces and the animation frame
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

// Function to end the session
function onEndSession(session) {
    session.end();
}

// Reset XR Button 
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

// Rotate the coordinate system of the user by the amount of angle (radian)
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
// Similar to the update() function of unity
function onXRFrame(t, frame) {

    // If first time, initialize the scene. 
    // TODO: Check if also possible in function onSessionStarted()
    if (firstTime) {

        scene = new Scene();    
        scene.enableStats(false);   // Remove the virtual display to show the FPS

        // Prepare position and rotation matrix of the 4 main directions
        let transformN = new XRRigidTransform(polarToCart2D(0, 3, 2))
        let transformE = new XRRigidTransform(polarToCart2D(90, 3, 2), polarToCartOrient(90))
        let transformS = new XRRigidTransform(polarToCart2D(180, 3, 2), polarToCartOrient(180))
        let transformW = new XRRigidTransform(polarToCart2D(270, 3, 2), polarToCartOrient(270))

        // Apply position and rotation matrix of the 4 main directions (shown as arrows)
        arrowN.matrix = transformN.matrix;
        arrowE.matrix = transformE.matrix;
        arrowS.matrix = transformS.matrix;
        arrowW.matrix = transformW.matrix;

        // Add the 4 arrows showing the main directions
        scene.addNode(arrowN);
        scene.addNode(arrowE);
        scene.addNode(arrowS);
        scene.addNode(arrowW);

        // Add another arrow for each point
        for (var i in pointData) {
            let bearing = pointData[i].bearing;
            let transform = new XRRigidTransform(polarToCart2D(bearing, 5, 3), polarToCartOrient(bearing))
            let arrow = new Gltf2Node({ url: 'media/jumpboost_arrow/jumpboost_arrow.gltf' });
            arrow.matrix = transform.matrix;
            scene.addNode(arrow);
        }

        // Don't really know what that does...
        renderer = new Renderer(gl);
        scene.setRenderer(renderer);
        scene.updateInputSources(frame, xrRefSpace);
        firstTime = false;
    }

    // Get the session of this frame!
    let session = frame.session;

    let pose = frame.getViewerPose(xrRefSpace); // Get the pose of the device (!)
    if (pose !== null) {
        
    
        let orient = pose.transform.orientation     // Only extract the orientation
        const vector = new THREE.Vector3(0, 0, 1);  // Prepare a unit vector showing the z axis
        vector.applyQuaternion(orient);             // Rotate this vector accodrding to the orientation of the device
        let vec = vector.projectOnPlane(new THREE.Vector3(0, 1, 0)) // Project the result onto the xz-plane
        let orientDeg = Math.atan2(vec.z, vec.x) * 180 / Math.PI;   // Calculate the angle of the 
        //let orientLocal_new = 90 - orientDeg;
        let orientLocal_new = orientDeg;
        if (orientLocal_new < 0) { orientLocal_new = orientLocal_new + 360 }
        let difference = orientGlobal - orientLocal_new;
    
        if (Math.abs(orientLocal_new - orientLocal) > 0.5) {
            orientLocalVis.innerHTML = "Local orientation: " + orientLocal_new.toFixed([0]).toString();
            diffOrientVis.innerHTML = "Difference: " + difference.toFixed(0).toString();
    
            //console.log({ orientGlobal, orientLocal_new, difference });
            //console.table(arrow.matrix);
        }
    
        if (Math.abs(difference) > 0.1) {
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
    }
    

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
        //if (firstTimeCompass) {alert("Using WebkitCompassHeading"); firstTime=false;}

        heading = event.webkitCompassHeading; //iOS non-standard
        acc = event.webkitCompassAccuracy;
    }
    else {
        //if (firstTime) {alert("Using alpha value"); firstTime=false;}

        //alert("Your device is reporting relative alpha values, so this compass won't point north :(");
       // var heading = 360 - alpha; //heading [0, 360)
        heading = 360 - alpha;

    }

    if (Math.abs(heading - orientGlobal) > 0.1) {
        let difference = heading - orientLocal;
        if (acc == null) {
            orientGlobalVis.innerHTML = "Global orientation: " + heading.toFixed([0]).toString();
            diffOrientVis.innerHTML = "Difference: " + difference.toFixed(0).toString();
            //console.log({ heading, orientLocal, difference});
        }
        else if (acc == -1) {
            orientGlobalVis.innerHTML = "Global orientation: Not calibrated - not usable";
        }
        else {
            orientGlobalVis.innerHTML = "Global orientation: " + heading.toFixed([0]).toString() + " +/- " + acc.toFixed(0).toString();
            diffOrientVis.innerHTML = "Difference: " + difference.toFixed(0).toString();
        }
        orientGlobal = heading;

        if (pointData != null) {
            let clostestOrient = 0;
            let diff = 400;
            for (var i in pointData) {
                // TODO: overlauf nach 360!!!
                if (Math.abs(orientGlobal - pointData[i].bearing) < diff) {
                    clostestOrient = i;
                    diff = Math.abs(orientGlobal - pointData[i].bearing);
                }
            }
            if (diff < 10) {
                pointVis.innerHTML = pointData[clostestOrient].name + " (" + pointData[clostestOrient].distance.toFixed(0) + "km)";
            } else {
                pointVis.innerHTML = "";
            }
        }
    }


    //let difference = orientGlobal - orientLocal < 0 ?  orientGlobal - orientLocal + 360 :  orientGlobal - orientLocal;


}

function permissionGeo() {
    if (!navigator.geolocation) {
        alert(
            "Geolocation not supported.", function(){}, "", "Ok"
        );
        btnPermissionGeo.innerHTML = "No Permission!";
        btnPermissionGeo.disabled = true;
        btnPermissionCompass.style.display="block";
    }
    else {
        navigator.geolocation.getCurrentPosition(currentLocation); 
        btnPermissionGeo.innerHTML = "Loading...";
        btnPermissionGeo.disabled = true;
        
    }
}

function currentLocation(position) {

    let pointLng = position.coords.longitude; 
    let pointLtd = position.coords.latitude;
    let accGeo = position.coords.accuracy;
    position = [pointLng, pointLtd];
    geoLocVis.innerHTML = "Geolocation: " + pointLng.toFixed(2).toString() + ", " + pointLtd.toFixed(2).toString() + ", acc: " + accGeo.toFixed(1).toString() + "m";
    readJSON(position);

}   

function permission() {
    if (iOS()) {
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
        console.log("Absolute Orientation existing");
        //alert("Using DeviceOrientationAbsoluteEvent");
        window.addEventListener("DeviceOrientationAbsoluteEvent", deviceOrientationHandler);
    } // If not, check if the device sends any orientation data
    else if ('ondeviceorientationabsolute' in window) {
      // We can listen for the new deviceorientationabsolute event.
      //alert("Using DeviceOrientationAbsolute");

      window.addEventListener("deviceorientationabsolute", deviceOrientationHandler, true);
    } 
    else if(window.DeviceOrientationEvent){
        console.log("Only normal orientation existing");
        //alert("Using DeviceOrientation");

    window.addEventListener("deviceorientation", deviceOrientationHandler);
    } // Send an alert if the device isn't compatible
    else {
    alert("Sorry, try again on a compatible mobile device!");
    }

}

function readJSON(position) {
    // Read the GeoJSON file here
    var xhr = new XMLHttpRequest(); // xhr is a local variable
    xhr.responseType = "json"; // Make sure the server returns json
    xhr.open("GET", "data/points_selected.json"); // Open the file
    xhr.send();	

    xhr.onreadystatechange = function () {
        // If there are no errors, everything worked fine
        if (xhr.readyState == 4 && xhr.status == 200) {
            let jsonData = xhr.response;	// Read the file
            processJson(jsonData, position);
        }
    }
}

function processJson(jsonData, position) {
    pointData = []
        for (var i in jsonData){
            let lng = jsonData[i].geometry.coordinates[0];
            let lat = jsonData[i].geometry.coordinates[1];
            
            let dist = distance(position[1], position[0], lat, lng, 'K');
            let bear = bearing(position[1], position[0], lat, lng);
            pointData.push({
                'name':jsonData[i].properties.capital, 
                'distance': dist,
                'bearing': bear
            })
        }
    console.log(pointData);
    btnPermissionGeo.innerHTML = "Permission granted";
    btnPermissionCompass.style.display="block";
}

function distance(lat1, lon1, lat2, lon2, unit) {
        var radlat1 = Math.PI * lat1/180
        var radlat2 = Math.PI * lat2/180
        var theta = lon1-lon2
        var radtheta = Math.PI * theta/180
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        dist = Math.acos(dist)
        dist = dist * 180/Math.PI
        dist = dist * 60 * 1.1515
        if (unit=="K") { dist = dist * 1.609344 }
        if (unit=="N") { dist = dist * 0.8684 }
        return dist
}

// Converts from degrees to radians.
function toRadians(degrees) {
    return degrees * Math.PI / 180;
  };
   
  // Converts from radians to degrees.
  function toDegrees(radians) {
    return radians * 180 / Math.PI;
  }
  
  
  function bearing(startLat, startLng, destLat, destLng){
    startLat = toRadians(startLat);
    startLng = toRadians(startLng);
    destLat = toRadians(destLat);
    destLng = toRadians(destLng);
  
    let y = Math.sin(destLng - startLng) * Math.cos(destLat);
    let x = Math.cos(startLat) * Math.sin(destLat) -
          Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    let brng = Math.atan2(y, x);
    brng = toDegrees(brng);
    return (brng + 360) % 360;
  }

  function polarToCart2D(angle, radius, height) {
        let z = -radius * Math.cos(angle*Math.PI/180);
        let y = height;
        let x = radius * Math.sin(angle*Math.PI/180);
        return {x: x, y: y, z: z}
  }

  function polarToCartOrient(angle) {
        let a = angle * Math.PI / 180;
    return  {x: 0, y: Math.sin(-a * 0.5), z: 0, w: Math.cos(-a * 0.5)}
}