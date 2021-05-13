import * as THREE from '../three_local/build/three.module.js';
import { GLTFLoader } from '../three_local/examples/jsm/loaders/GLTFLoader.js';

let renderer = null;
let scene = null;
let camera = null;
let model = null;
let mixer = null;
let action = null;
let reticle = null;
let lastFrame = Date.now();
let canvas = null;

// Load 3D models
let arrowN = null;
let arrowE = null;
let arrowS = null;
let arrowW = null;

let firstTime = true;
let pointData = null;

// Geo orientation globals
var orientLocal = null;     // Stores the current orientation of the phone in the local coordinate system (degree)
var orientGlobal = null;    // Stores the current orientation of the phone in the global coordinate system (degree)


const initScene = (gl, session) => {

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.matrixAutoUpdate = false;

  var light = new THREE.PointLight(0xffffff, 2, 100); // soft white light
  light.position.z = 1;
  light.position.y = 5;
  scene.add(light);

  // create and configure three.js renderer with XR support
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    canvas: canvas,
    context: gl,
  });
  renderer.autoClear = true;

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  renderer.xr.setSession(session);

  // simple sprite to indicate detected surfaces
  reticle = new THREE.Mesh(
    new THREE.RingBufferGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: 0x0fff00 })
 );
  // we will update it's matrix later using WebXR hit test pose matrix
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
};

// button to start XR experience
const xrButton = document.getElementById('xr-button');
xrButton.style.display="none"   // Only show it after geolocation

// to display debug information
const info = document.getElementById('info');


const btnPermissionGeo = document.getElementById("requestGeo");           // Button to ask for geolocation permission
const btnPermissionCompass = document.getElementById("requestCompass");   // Button to ask for compass permission
btnPermissionCompass.style.display="none"   // Only show it after geolocation


btnPermissionGeo.addEventListener("click", permissionGeo);
btnPermissionCompass.addEventListener("click", permission);


// to control the xr session
let xrSession = null;
// reference space used within an application https://developer.mozilla.org/en-US/docs/Web/API/XRSession/requestReferenceSpace
let xrRefSpace = null;
// for hit testing with detected surfaces
let xrHitTestSource = null;

// Canvas OpenGL context used for rendering
let gl = null;

function checkXR() {
  if (!window.isSecureContext) {
    document.getElementById("warning").innerText = "WebXR unavailable. Please use secure context";
  }
  if (navigator.xr) {
    navigator.xr.addEventListener('devicechange', checkSupportedState);
    checkSupportedState();
  } else {
    document.getElementById("warning").innerText = "WebXR unavailable for this browser"; 
  }
}

function loadModels() {
    // load our gltf model
    var loader = new GLTFLoader();
    loader.load(
      'models/Arrow.glb',
      (gltf) => {
        arrowN = gltf.scene;
        arrowN.scale.set(1, 1, 1);
        arrowN.castShadow = true;
        arrowN.receiveShadow = true;
      },
      () => {},
      (error) => console.error(error)
    );
    loader.load(
        'models/Arrow_blue.glb',
        (gltf) => {
          var arrow = gltf.scene;
          arrow.scale.set(1, 1, 1);
          arrow.castShadow = true;
          arrow.receiveShadow = true;
          arrowE = arrow.clone();
          arrowS = arrow.clone();
          arrowW = arrow.clone();

        },
        () => {},
        (error) => console.error(error)
      );
  }

function checkSupportedState() {
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    if (supported) {
      xrButton.innerHTML = 'Enter AR';
      xrButton.addEventListener('click', onButtonClicked);
    } else {
      xrButton.innerHTML = 'AR not found';
    }
    xrButton.disabled = !supported;
  });
}

function onButtonClicked() {
  if (!xrSession) {
      navigator.xr.requestSession('immersive-ar', {
          optionalFeatures: ['dom-overlay'],
          requiredFeatures: ['local', 'hit-test'],
          domOverlay: {root: document.getElementById('overlay')}
      }).then(onSessionStarted, onRequestSessionError);
  } else {
    xrSession.end();
  }
}

function onSessionStarted(session) {
  xrSession = session;
  xrButton.innerHTML = 'Exit AR';

  // Show which type of DOM Overlay got enabled (if any)
  if (session.domOverlayState) {
    info.innerHTML = 'DOM Overlay type: ' + session.domOverlayState.type;
  }

  // create a canvas element and WebGL context for rendering
  session.addEventListener('end', onSessionEnded);
  canvas = document.createElement('canvas');
  gl = canvas.getContext('webgl', { xrCompatible: true });
  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

  // here we ask for viewer reference space, since we will be casting a ray
  // from a viewer towards a detected surface. The results of ray and surface intersection
  // will be obtained via xrHitTestSource variable
  session.requestReferenceSpace('viewer').then((refSpace) => {
    session.requestHitTestSource({ space: refSpace }).then((hitTestSource) => {
      xrHitTestSource = hitTestSource;
    });
  });

  session.requestReferenceSpace('local').then((refSpace) => {
    xrRefSpace = refSpace;
    session.requestAnimationFrame(onXRFrame);
  });

  // initialize three.js scene
  initScene(gl, session);
}

function onRequestSessionError(ex) {
  info.innerHTML = "Failed to start AR session.";
  console.error(ex.message);
}

function onSessionEnded(event) {
  xrSession = null;
  xrButton.innerHTML = 'Enter AR';
  info.innerHTML = '';
  gl = null;
  if (xrHitTestSource) xrHitTestSource.cancel();
  xrHitTestSource = null;
}

function placeObject() {
  if (arrowN) {

    // we'll be placing our object right where the reticle was
    var pos = polarToCart2D(0, 3, 2)
    arrowN.position.set(pos.x, pos.y, pos.z);
    scene.add(arrowN);
    pos = polarToCart2D(90, 3, 2);
    console.log(pos);
    arrowE.position.set(pos.x, pos.y, pos.z);
    scene.add(arrowE);
    pos = polarToCart2D(180, 3, 2);
    arrowS.position.set(pos.x, pos.y, pos.z);
    scene.add(arrowS);
    pos = polarToCart2D(270, 3, 2);
    arrowW.position.set(pos.x, pos.y, pos.z);
    scene.add(arrowW);
    firstTime = false;
  }
}

function onXRFrame(t, frame) {
  let session = frame.session;
  session.requestAnimationFrame(onXRFrame);

  if (firstTime) {
    placeObject();
  }

  // bind our gl context that was created with WebXR to threejs renderer
  gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
  // render the scene
  // Retrieve the pose of the device.
  // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
  const pose = frame.getViewerPose(xrRefSpace);

  if (pose) {
    // In mobile AR, we only have one view.
    const view = pose.views[0];

    //const viewport = session.renderState.baseLayer.getViewport(view);
    //renderer.setSize(viewport.width, viewport.height)

    // Use the view's transform matrix and projection matrix to configure the THREE.camera.
    camera.matrix.fromArray(view.transform.matrix)
    camera.projectionMatrix.fromArray(view.projectionMatrix);
    camera.updateMatrixWorld(true);

    var vecCamera = new THREE.Vector3();
    camera.getWorldDirection(vecCamera);
    let orientDeg = Math.atan2(vecCamera.z, vecCamera.x) * 180 / Math.PI;   // Calculate the angle of the 
    orientDeg = orientDeg + 180;
    orientLocalVis.innerHTML = "Local orientation: " + orientDeg.toFixed([0]).toString();

    // Render the scene with THREE.WebGLRenderer.
    renderer.render(scene, camera)
  }
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
  xrButton.style.display="block"   // Only show it after geolocation

  checkXR();

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

  orientGlobalVis.innerHTML = "Global orientation: " + heading.toFixed([0]).toString();


  //let difference = orientGlobal - orientLocal < 0 ?  orientGlobal - orientLocal + 360 :  orientGlobal - orientLocal;


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

loadModels();