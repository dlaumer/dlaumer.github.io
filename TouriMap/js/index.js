/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready

/* *** DEFINITIONS *************************************************************  */

// Symbols for POI
symbols = {
    favourites: {
        type: "picture-marker",  // autocasts as new PictureMarkerSymbol()
        url: "https://static.arcgis.com/images/Symbols/Shapes/YellowStarLargeB.png",
        width: "32px",
        height: "32px"
    },
    natural : {                          // autocasts as new SimpleMarkerSymbol()
        type: "simple-marker",
        color: "#9FE2BF"
    },
    cultural: {                          // autocasts as new SimpleMarkerSymbol()
          type: "simple-marker",
          color: "#6495ED"
    },
    historical: {                         // autocasts as new SimpleMarkerSymbol()
        type: "simple-marker",
        color: "#FFBF00"
    },
    religion: {                         // autocasts as new SimpleMarkerSymbol()
        type: "simple-marker",
        color: "#DE3163"
    },
    architecture: {                         // autocasts as new SimpleMarkerSymbol()
        type: "simple-marker",
        color: "#DFFF00"
    },
    industrial_facilities: {                         // autocasts as new SimpleMarkerSymbol()
        type: "simple-marker",
        color: "#40E0D0"
    },
    other: {                         // autocasts as new SimpleMarkerSymbol()
        type: "simple-marker",
        color: "#CCCCFF"
    }
}

// The names of the different layers
var typesPoint = ["favourites", "natural","cultural", "historical", "religion", "architecture",  "industrial_facilities", "other"]

// Definition of the favourite button
var markFavAction = {
  title: "Mark/Remove as favourite",
  id: "favourite",
  image:
    "https://www.flaticon.com/svg/static/icons/svg/1828/1828884.svg"
};

// Template of the popup
var popup = {
  title: "Point of interest:",
  content: [
    {
      type: "fields",
      fieldInfos: [
      {
          fieldName: "name",
          label: "Name"
        },
        {
          fieldName: "kind",
          label: "Category"
        },
        {
          fieldName: "type",
          label: "Other categories"
        },
        {
          fieldName: "wikidata",
          label: "Wikidata ID"
        }
      ]
    }
  ],
  actions: [markFavAction]
};


var featureLayers = {}; // Dict of all the feature layers
var visibleLayers = {}  // Dict of all the visible layers

// Set all layers to visible
for (var i=0;i<typesPoint.length;i++) {
  visibleLayers[typesPoint[i]] = true;
}
var legend;
var jsonFavourites ={"favourites":[]};  // Json object which is saved locally and holds the favourites
var fileObj;

// Url for the api call, here with an example call
var url = "https://api.opentripmap.com/0.1/ru/places/bbox?lon_min=-0.32856&lat_min=39.464587&lon_max=-0.30856&lat_max=39.484587&format=geojson&apikey=5ae2e3f221c38a28845f05b6aaceeb8303eb6b32050050abdc0a21ce";

// The different components of the api url
var opentripURL = "https://api.opentripmap.com/0.1/ru/places/bbox?";
var opentripKEY = "5ae2e3f221c38a28845f05b6aaceeb8303eb6b32050050abdc0a21ce";


/* *** MAIN EXECUTION *************************************************************  */

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    // jQuery elements, only starts when all is ready
    $(document).ready(function() {
        
        console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);

        /* *** ESRI REQUIRES *************************************************************  */

        // Here we load the packages from esri
        require([
             "esri/widgets/Track",
             "esri/Map",
             "esri/views/MapView",
             "esri/Graphic",
             "esri/layers/FeatureLayer",
             "esri/core/watchUtils",
             "esri/geometry/support/webMercatorUtils",
             "esri/widgets/Legend",
             "esri/widgets/Expand",
             "esri/widgets/LayerList",
             "esri/widgets/Search",
            "esri/widgets/Locate",
             "dojo/domReady!"
        ], function(Track, Map, MapView, Graphic, FeatureLayer, watchUtils, webMercatorUtils,Legend, Expand, LayerList, Search, Locate) {
            
          /* *** MAP ELEMENTS *************************************************************  */

          // Make a new Map
            var map = new Map({
              basemap: "streets",
            });
            
            // Add a mapview
            var view = new MapView({
              container: "viewDiv",
              map: map,
              zoom: 13,
              center: [-0.32856, 39.464587]
            });
            
            
                       
            // Create an instance of the Track widget
                // and add it to the view's UI
                var track = new Track({
                  view: view
                });
                view.ui.add(track, "top-left");

                // The sample will start tracking your location
                // once the view becomes ready
                view.when(function () {
                  track.start();
                });
            
            view.ui.add("titleDiv", "top-right"); // Add it to the map

            
            // Create the layer list inside of an expand object
            list = new Expand({
              content: new LayerList({
              view: view,
              listItemCreatedFunction: function(event) {
                const item = event.item;
                if (item.layer.type != "group") { // don't show legend twice
                  item.panel = {
                    content: "legend",
                  };
                }
              }
            }),
              view: view,
              expanded: false
            });
            view.ui.add(list, "top-right"); // Add it to the map
            
            
            // Add a search widget
            var search = new Expand({
              content: new Search({
              view: view
            }),
              view: view,
              expanded: false
            });
            // Add it to the map
            view.ui.add(search, {
              position: "top-left",
              index: 0
            });

            // Create the button to delete the favourites
            var element = document.createElement('div');
            element.className = "esri-icon-trash esri-widget--button esri-widget esri-interactive home";
            element.addEventListener('click', function (event) {
                
                if (confirm("Are you sure you want to delete all favourites?")) {
                  
                    jsonFavourites["favourites"] = [];  // Delete the favourites
                    writeJSON();  // Save the empty object to the file
                    // Update the visible layers
                    for (var i=0;i<typesPoint.length;i++) {
                        visibleLayers[typesPoint[i]] = featureLayers[typesPoint[i]].visible
                    }
                    apiCall(); // Refresh the map
                    
                    alert("The favourites were deleted");
                } else {
                  alert("Nothing was deleted");
                }
                    });
            view.ui.add(element, "top-right");  // Add it to the map
            
            
            // Add the info box button
            var bgExpand = new Expand({
            expandIconClass: "esri-icon-question",
            expanded: false,
            expandTooltip: "Get information",
            view: view,
              content: document.getElementById('alerts'),
            });
            view.ui.add(bgExpand, "top-right"); // Add it to the map
            

            
            /* *** MAP FUNCTIONS *************************************************************  */

            apiCall();  // Load the necesary information for the layers. 
            

            // Observer for the change of the extent
            watchUtils.whenTrue(view, "stationary", function() {
              // Get the new extent of the view only when view is stationary.
              if (view.extent) {
                  // Only load layers if it is close enough 
                  if (view.zoom > 8){
                     
                    // Update the visible layers
                      for (var i=0;i<typesPoint.length;i++) {
                          visibleLayers[typesPoint[i]] = featureLayers[typesPoint[i]].visible
                      }
                          
                      // Get the extent in lat/long
                      var min = webMercatorUtils.xyToLngLat(view.extent.xmin,view.extent.ymin);
                      var max = webMercatorUtils.xyToLngLat(view.extent.xmax,view.extent.ymax);

                      // Create the new url with the new exent
                      url = opentripURL +  "lon_min="+min[0]+"&lat_min="+min[1]+"&lon_max="+max[0]+"&lat_max="+max[1]+"&format=geojson&apikey=" + opentripKEY;
                      // Update the layers
                      apiCall(); 
                  }
                  else {
                      // If it is zoomed out too much, don't show anything (otherwise map overload)
                      for (var i=0;i<typesPoint.length;i++) {
                          map.layers.remove(featureLayers[typesPoint[i]]);    // Remove the existing featureLayer
                      }
                  }
              }
            });
            
            
            // Function that is fired after a button on the popup is clicked
            view.popup.on("trigger-action", function (event) {
              // Execute the measureThis() function if the measure-this action is clicked
              if (event.action.id === "favourite") {
                markAsFavourite();
              }           
            });
            
            // Function that is fired after the favourite button is clicked
            function markAsFavourite() {
                
              // Find the selected feature
              selectedId = parseInt(view.popup.selectedFeature.attributes.ObjectId);

              // Either add or remove it from the favourites
              if (!(jsonFavourites["favourites"].includes(selectedId))) {
                  jsonFavourites["favourites"].push(selectedId);
              }
              else {
                  jsonFavourites["favourites"] = arrayRemove(jsonFavourites["favourites"],selectedId);
              }
              view.popup.close();

              // Refresh the map view
              for (var i=0;i<typesPoint.length;i++) {
                  visibleLayers[typesPoint[i]] = featureLayers[typesPoint[i]].visible
              }
              apiCall();
              // Save the info locally
              writeJSON();

            }
            
            // Helper function to remove element in list
            function arrayRemove(arr, value) {
                
                    return arr.filter(function(ele){
                        return ele != value;
                    });
                }
            
            // Function to read the local favourites file
            function readJson() {
                var fileName = "favourites.json"; // Hard coded filename
                    
                var storageLocation = "";
                switch (device.platform) {
                        case "Android":
                          storageLocation = cordova.file.externalDataDirectory;
                          break;

                        case "iOS":
                          storageLocation = cordova.file.documentsDirectory;
                          break;
                      }
                    
                window.resolveLocalFileSystemURL(storageLocation, function(dir) {
                    dir.getFile(fileName, {create:true}, function(fileEntry) {
                        fileEntry.file(gotFile, fail);
                    });
                });
                
            }
            
            // Helper to read the file
            function gotFile(file) {
                var reader = new FileReader();
                reader.onloadend = function(evt) {
                    //console.log("Read as text");
                    //console.log(evt.target.result);
                    jsonFavourites = JSON.parse(evt.target.result);
                };
                reader.readAsText(file);
            }
            
            // Helper to read the file
            function fail(evt) {
                    console.log(evt.target.error.code);
                }
            

            // Function to save the favourites json locally
            function writeJSON() {
                
                var fileName = "favourites.json";
                    
                var storageLocation = "";
                switch (device.platform) {
                        case "Android":
                          storageLocation = cordova.file.externalDataDirectory;
                          break;

                        case "iOS":
                          storageLocation = cordova.file.documentsDirectory;
                          break;
                      }
                    
                window.resolveLocalFileSystemURL(storageLocation, function(dir) {
                    dir.getFile(fileName, {create:true}, function(fileEntry) {
                        fileObj = fileEntry;
                        writeFile(JSON.stringify(jsonFavourites, null, 2));
                    });
                });
            }

            // Helper to write the file
            function writeFile(jsonString){
                if(!fileObj) {
                    return;
                }

                fileObj.createWriter(function(fileWriter) {
                    var blob = new Blob([jsonString], {type:'text/json'});
                    fileWriter.write(blob);
                }, writeFileError);

            }

            // Helper to write the file
            function writeFileError(e) {
                navigator.notification.alert(
                    "FileSystem Error\n" + JSON.stringify(e, null, 2), function(){},
                    "G2",
                    "Ok"
                    );
                return;
            }
            
            
            /* *** OPENTRIPMAP API CALL *************************************************************  */

            function apiCall() {
                // Read the favourites, so we know which features to mark with a star
                readJson();
                
                // Get the new data from the OpenTrip API with a asynchronous ajax call
                $.ajax({url: url, success: function(result){
                    
                    graphics ={};
                    // Prepare a list for each layer
                    for (var i=0;i<typesPoint.length;i++) {
                        graphics[typesPoint[i]] = [];
                    }
                    // Go through all features and distribute them into the different layers
                    for (var i=0;i < result.features.length;i++) {
                        var feature = result.features[i]
                        var kinds = feature.properties.kinds.split(",");
                        // Only take the ones tagged as interesting
                        if (kinds.includes("interesting_places")){
                            
                          // Create new graphic
                            var grapic = new Graphic({
                              attributes: {
                                ObjectId: feature.id,
                                name: feature.properties.name,
                                type: feature.properties.kinds,
                                wikidata:feature.properties.wikidata,
                              },
                              geometry: {
                              type: "point",
                                longitude: feature.geometry.coordinates[0],
                                latitude: feature.geometry.coordinates[1]
                              }
                            });
                            
                            // Check if this one is a favourite
                            if (jsonFavourites.favourites.includes(parseInt(feature.id))) {
                                grapic.attributes.favourite = true;
                            }
                            else {
                                grapic.attributes.favourite = false;
                            }
                            
                            // Check the layer
                            if (jsonFavourites.favourites.includes(parseInt(feature.id))) {
                                grapic.attributes.kind = "favourites"
                                graphics["favourites"].push(grapic);
                            }
                            else if (kinds.includes("natural")){
                                grapic.attributes.kind = "natural"
                                graphics["natural"].push(grapic)
                            }
                            else if (kinds.includes("cultural")){
                                grapic.attributes.kind = "cultural"
                                graphics["cultural"].push(grapic)
                            }
                            else if (kinds.includes("historical")){
                                grapic.attributes.kind = "historical"
                                graphics["historical"].push(grapic)
                            }
                            else if (kinds.includes("religion")){
                                grapic.attributes.kind = "religion"
                                graphics["religion"].push(grapic)
                            }
                            else if (kinds.includes("architecture")){
                                grapic.attributes.kind = "architecture"
                                graphics["architecture"].push(grapic)
                            }
                            else if (kinds.includes("industrial_facilities")){
                                grapic.attributes.kind = "industrial_facilities"
                                graphics["industrial_facilities"].push(grapic)
                            }
                            else {
                                grapic.attributes.kind = "other"
                                graphics["other"].push(grapic)
                            }
                            
                        }
                    };

                    // Loop over all layers and create the feature layer
                    for (var i=typesPoint.length-1;i>=0;i--) {
                        map.layers.remove(featureLayers[typesPoint[i]]);    // Remove the existing featureLayer
                        featureLayers[typesPoint[i]] = new FeatureLayer({
                          geometryType:  "point",
                          source: graphics[typesPoint[i]],
                          title: typesPoint[i],
                          visible: visibleLayers[typesPoint[i]],
                          renderer: {
                              type: "simple", // autocasts as new SimpleRenderer()
                              symbol: symbols[typesPoint[i]]},
                          popupTemplate: popup,
                          objectIdField: "ObjectID",           // This must be defined when creating a layer from `Graphic` objects
                          fields: [
                            {
                              name: "ObjectID",
                              alias: "ObjectID",
                              type: "oid"
                            },
                            {
                              name: "name",
                              alias: "name",
                              type: "string"
                            },
                           {
                             name: "kind",
                             alias: "kind",
                             type: "string"
                           }
                          ],
                        outFields: ["*"],
                        });
                        
                        featureLayers[typesPoint[i]].opacity = 0.7;
                        map.layers.add(featureLayers[typesPoint[i]]);
                        
                    }
                                    
                   
            
                    // Add the legend, but only one time (the first time)
                    if (legend == null) {

                        legend = new Expand({
                          content: new Legend({
                            view: view,
                           
                          }),
                          view: view,
                          expanded: false
                        });
                        view.ui.add(legend, "bottom-left");
                    }

                    
                }});
            }
        });
        
        
    });
}
