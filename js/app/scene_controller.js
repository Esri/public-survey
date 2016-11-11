/*global $,requirejs */
/** @license
 | Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
//====================================================================================================================//

/**
 * Manages the display of a webscene accompanied by a gallery of slides.
 * @namespace scene_controller
 * @version 0.1
 *
 * @property {number} numResponseSites - Number of slides in slide gallery
 */
define([
    "lib/i18n.min!nls/resources.js",
    "app/diag"
], function (
    i18n,
    diag
) {
    "use strict";
    var scene_controller = {
        //----- Events -----------------------------------------------------------------------------------------------//

        // Published
        /**
         * @typedef {object} ResponseSiteHash
         * @property {number} set - Zero-based slide number
         * @property {string} title - Slide title
         * @property {boolean} fromCamera - Indicates if slide number was result of
         *          matching by camera location
         * @memberof scene_controller
         */
        /**
         * Provides result of trying to match current position with slides in slide gallery.
         * @event scene_controller#update-current-response-site
         * @property {?ResponseSiteHash} - Info about current slide
         */

        /**
         * @typedef {object} ResponsesHash
         * @property {array} responses - Survey responses
         * @memberof scene_controller
         */
        /**
         * Requests to go to a location with its collection of survey responses.
         * @event scene_controller#update-current-responses-set
         * @property {ResponsesHash} - Survey responses
         */

        // Consumed
        // survey_controller#cluster-clicked
        // survey_controller#goto-camera-pos
        // survey_controller#goto-response-site

        //----- Module variables -------------------------------------------------------------------------------------//

        _config: null,
        _container: null,

        _averagingFieldValues: null,
        _clusterer: null,
        _clustererView: null,
        _clusterLayerVisible: null,
        _colorRamper: null,
        _currentSlideNum: 0,
        _featureLayerOptions: null,
        _featureServiceUrl: null,
        _gallery: null,
        _multipleChoiceQuestions: null,
        _okToNavigate: true,
        _pieChartTheme: "GreySkies",
        _sizeRamper: null,
        _slides: [],
        _surveyDefinition: null,

        mapParamsReady: null,
        map: null,
        view: null,
        numResponseSites: 0,

        //----- Procedures available for external access -------------------------------------------------------------//

        /**
         * Initializes the controller.
         * @param {object} config - App config info
         * @param {object} container - DOM container for controller's graphics
         * @memberof scene_controller
         */
        init: function (config, containerName, clusterViewBuilder, _okToNavigate) {
            var sceneControllerReady = $.Deferred();
            scene_controller._config = config;
            scene_controller._container = $("#" + containerName + "");
            scene_controller._okToNavigate = _okToNavigate;

            scene_controller.mapParamsReady = $.Deferred();

            // Instantiate the scene_controller template
            scene_controller._container.loadTemplate("js/app/scene_controller.html", {}, {
                prepend: true,
                complete: function () {

                    scene_controller._loadWebScene(
                        config.appParams.webId, scene_controller.mapParamsReady);

                    scene_controller.mapParamsReady.then(function (response) {
                        // Loads once visuals panel becomes visible
                        clusterViewBuilder(scene_controller.view).then(function (clustering) {
                            scene_controller._clusterer = clustering.clusterer;
                            scene_controller._clustererView = clustering.clustererView;

                            // Go to first slide
                            if (scene_controller._config.appParams.numResponseSites > 0) {
                                scene_controller._goToSlide(0);

                                // Make sure that the cluster layer is visible and its underlying data layer is not
                            }
                            else {
                                scene_controller._fixLayerVisibility();
                            }
                        });
                    });

                    // Done with launch, but not initialization because SceneView must be visible for it to load
                    // Need to use scene_controller.mapParamsReady before accessing map, view, numResponseSites
                    sceneControllerReady.resolve();
                }
            });

            return sceneControllerReady;
        },

        launch: function () {
            // Display gallery now that we're closer to it being usable
            scene_controller._showItem($(scene_controller._gallery), true);
            //$(gallery).css("visibility", "visible");
        },

        /**
         * Shows or hides the DOM container managed by the controller.
         * @param {boolean} makeVisible - Visibility to set for container
         * @param {?function} thenDo - Function to execute after show/hide animation completes
         * @param {?object} thenDoArg - Argument for thenDo function
         * @memberof scene_controller
         */
        show: function (makeVisible, thenDo, thenDoArg) {
            scene_controller._showItem($(scene_controller._container), makeVisible, thenDo, thenDoArg);
        },

        getCurrentCameraPos: function (desiredWkid) {
            var camera, position, positionReady, surveyPoint, orientation;

            camera = scene_controller.view.viewpoint.camera;
            position = camera.position;
            orientation = {
                heading: camera.heading,
                tilt: camera.tilt,
                roll: 0
            };
            positionReady = $.Deferred();

            if (position.spatialReference.wkid !== scene_controller._config.featureSvcParams.spatialReference.wkid) {
                require([
                    "esri/tasks/GeometryService",
                    "esri/tasks/support/ProjectParameters",
                    "esri/geometry/SpatialReference"
                ], function (GeometryService, ProjectParameters, SpatialReference) {
                    var geomSer = new GeometryService({
                        url: "https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer"
                    });
                    var params = new ProjectParameters({
                        geometries: [position],
                        outSR: new SpatialReference(scene_controller._config.featureSvcParams.spatialReference)
                    });
                    geomSer.project(params).then(function (flPoint) {
                        surveyPoint = {
                            geometry: {
                                x: flPoint[0].x,
                                y: flPoint[0].y,
                                z: flPoint[0].z
                            },
                            attributes: orientation
                        };

                        positionReady.resolve(surveyPoint);
                    }, function (error) {
                        console.log("GeometryService error " + JSON.stringify(error));
                    });
                });
            }
            else {
                surveyPoint = {
                    geometry: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    attributes: orientation
                };

                positionReady.resolve(surveyPoint);
            }

            return positionReady;
        },

        //----- Procedures meant for internal module use only --------------------------------------------------------//

        /**
         * Shows or hides a jQuery item.
         * @param {object} item - jQuery item to change
         * @param {boolean} makeVisible - Visibility to set for container
         * @param {?function} thenDo - Function to execute after show/hide animation completes
         * @param {?object} thenDoArg - Argument for thenDo function; if thenDo is _showItem() and
         * thenDoArg is an array, thenDoArg is treated as the arguments to _showItem()
         * @memberof survey_controller
         */
        _showItem: function (item, makeVisible, thenDo, thenDoArg) {
            if (item.length > 1) {
                thenDoArg = item[3];
                thenDo = item[2];
                makeVisible = item[1];
                item = item[0];
            }
            if (makeVisible) {
                item.fadeIn("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
            else {
                item.fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        },

        /**
         * Loads libraries and creates a WebScene and SceneView for the supplied webscene item.
         * @param {object} webId - AGOL id of webscene item
         * @param {deferred} mapParamsReady - For reporting when setup is done
         * @fires scene_controller#update-current-responses-set
         * @listens survey_controller#cluster-clicked
         * @listens survey_controller#goto-camera-pos
         * @listens survey_controller#goto-response-site
         * @memberof scene_controller
         * @private
         */
        _loadWebScene: function (webId, mapParamsReady) {
            var package_path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));

            requirejs.config({
                baseUrl: "//js.arcgis.com/4.1/",
                paths: {
                    app: package_path + "/js/app",
                    lib: package_path + "/js/lib"
                },
                packages: [{
                    name: "dojo",
                    location: "./dojo",
                    main: "main"
                }, {
                    name: "dijit",
                    location: "./dijit",
                    main: "main"
                }, {
                    name: "dojox",
                    location: "./dojox",
                    main: "main"
                }]
            });

            require(["esri/config", "esri/WebScene", "esri/views/SceneView"],
                function (esriConfig, WebScene, SceneView) {
                    var clusterSurveys = [];

                    // Create the map (WebScene) and its view (SceneView)
                    // N.B.: The view must be visible for it to load and to resolve its event
                    esriConfig.portalUrl = scene_controller._config.appParams.portalurl;

                    scene_controller.map = new WebScene({
                        portalItem: {
                            id: webId
                        }
                    });

                    scene_controller.view = new SceneView({
                        map: scene_controller.map,
                        container: "viewDiv"
                    });

                    // Once the map and view are loaded, we can adjust the view
                    scene_controller.view.then(function () {

                        // Disable popups on all webscene layers
                        scene_controller.map.allLayers.forEach(function (layer) {
                            layer.popupEnabled = false;
                        });

                        // Are we displaying slides?
                        scene_controller._config.appParams.numResponseSites =
                            scene_controller.map.presentation && scene_controller.map.presentation.slides ?
                            scene_controller.map.presentation.slides.length : 0;
                        if (scene_controller._config.appParams.numResponseSites > 0) {
                            scene_controller._slides = scene_controller.map.presentation.slides.items;
                        }

                        // Reset the top-left widgets set
                        scene_controller.view.ui.empty("top-left");

                        // Disable popups on all webscene layers
                        scene_controller.map.allLayers.forEach(function (layer) {
                            layer.popupEnabled = false;
                        });

                        // Replace zoom action on scene view's popup with our action
                        var goToResponse = {
                            title: i18n.prompts.goToResponses,
                            id: "goto-response",
                            image: "images/blank.png"
                        };
                        scene_controller.view.popup.actions = [goToResponse];

                        scene_controller.view.popup.on("trigger-action", function (evt) {
                            if (evt.action.id === "goto-response") {
                                scene_controller.view.popup.clear();
                                scene_controller.view.popup.close();

                                // Package array because lightweight pub/sub only passes first element of arrays
                                $.publish("update-current-responses-set", {
                                    responses: clusterSurveys
                                });
                            }
                        });

                        // Remove dock option from popup
                        scene_controller.view.popup.dockEnabled = true;
                        scene_controller.view.popup.dockOptions = {
                            position: "top-left",
                            buttonEnabled: false,
                            breakpoint: false
                        };

                        // Add navigation widgets
                        require(["esri/widgets/Zoom", "esri/widgets/NavigationToggle", "esri/widgets/Compass"],
                            function (Zoom, NavigationToggle, Compass) {
                                var zoomWidget = new Zoom({
                                    view: scene_controller.view,
                                    className: "iconContainer"
                                });
                                zoomWidget.startup();
                                scene_controller.view.ui.add(zoomWidget, "top-left");

                                var navigationToggle = new NavigationToggle({
                                    view: scene_controller.view
                                });
                                navigationToggle.startup();
                                scene_controller.view.ui.add(navigationToggle, "top-left");

                                var compassWidget = new Compass({
                                    view: scene_controller.view,
                                    className: "iconContainer"
                                });
                                compassWidget.startup();
                                scene_controller.view.ui.add(compassWidget, "top-left");
                            });

                        // Create the slide gallery
                        if (scene_controller._config.appParams.numResponseSites > 0) {
                            // Create gallery frame, its label tab, and its slides container
                            scene_controller._gallery = $("<div id='gallery' class='gallery absent'></div>");
                            $("#viewDiv").append(scene_controller._gallery);
                            scene_controller.view.ui.add(scene_controller._gallery[0], "manual");

                            $(scene_controller._gallery).append("<div class='galleryTab'>Take a tour</div>");

                            var slidesHolder = $("<div id='slidesHolder'></div>");
                            $(scene_controller._gallery).append(slidesHolder);

                            // Fill the slides container with the map's slides
                            var slides = scene_controller.map.presentation.slides;
                            slides.forEach(function (slide, slideNum) {
                                console.log("// Slide #" + slideNum + ": " + slide.id);
                                console.log("   title = " + JSON.stringify(slide.title) + ";");
                                console.log("   scale = " + slide.viewpoint.scale + ";");
                                console.log("   camera = " + JSON.stringify(slide.viewpoint.camera) + ";");

                                // Slide frame and title; change the cursor to a pointer style when hovering
                                // the mouse over the slide frame
                                var slideObj = $("<span id='" + slide.id + "' class='slideDiv'></span>");
                                $(slidesHolder).append(slideObj);
                                $(slideObj).append("<span class='slideTitle'>" + slide.title.text + "<br></span>");

                                $("#" + slide.id).on("mouseover", function () {
                                    $("#" + slide.id).css("cursor", "pointer");
                                });

                                // Slide image
                                $(slideObj).append("<img id='image_" + slideNum + "' title='" + slide.title.text +
                                    "' src='" + slide.thumbnail.url + "' class='slideFrame'>");

                                // Slide click behavior
                                $("#" + slide.id).on("click", function () {
                                    scene_controller._goToSlide(slideNum);
                                });
                            });

                            // Start with first slide whenever we have a login
                            $.subscribe("signedIn-user", function (ignore, loginInfo) {
                                scene_controller._goToSlide(0);
                            });

                        }
                        else {
                            // Otherwise, add a Home widget
                            require(["esri/widgets/Home"],
                                function (Home) {
                                    var homeWidget = new Home({
                                        view: scene_controller.view,
                                        className: "iconContainer"
                                    });
                                    homeWidget.startup();
                                    scene_controller.view.ui.add(homeWidget, "top-left");
                                });

                            if (scene_controller.map.initialViewProperties) {
                                console.log("// Scene initial view:");
                                console.log("   scale = " +
                                    scene_controller.map.initialViewProperties.viewpoint.scale + ";");
                                console.log("   camera = " +
                                    JSON.stringify(scene_controller.map.initialViewProperties.viewpoint.camera) + ";");
                            }
                        }

                        mapParamsReady.resolve();
                    });

                    // Wire up app
                    $.subscribe("goto-response-site", function (ignore, iSite) {
                        scene_controller._goToSlide(iSite);
                    });

                    require(["esri/Camera"],
                        function (Camera) {
                            $.subscribe("goto-camera-pos", function (ignore, cameraOptions) {
                                console.log("goto " + JSON.stringify(cameraOptions.position) + ", " +
                                    cameraOptions.heading + "° CW, " + cameraOptions.tilt + "° up");
                                var camera = new Camera(cameraOptions);
                                scene_controller.view.goTo(camera);
                                scene_controller._updateCurrentSlide(scene_controller._getMatchingSlide(camera), true);
                            });
                        }
                    );

                    // Save cluster features list when one clicks on a cluster
                    $.subscribe("cluster-clicked", function (ignore, clusterClickInfo) {
                        var cluster = scene_controller._clusterer.getClusterById(clusterClickInfo.attributes.id);
                        clusterSurveys = cluster.features;
                    });

                    // Set up some event handlers to intercept navigation via nav widgets and mouse actions on scene
                    // canvas. Has to be done during event capturing, which Dojo's 'on' doesn't yet support, hence
                    // use of addEventListener. Interception is to prevent navigation if there is a partial survey
                    // completed. For mousedown, we have to cancel navigation if there's a partial survey even
                    // if the user agrees to cancel the survey because otherwise we don't really have a cancellation.
                    // We have an unmatched mousedown event that can only be cleared by another click, but that click
                    // is interpreted as a zoom in.

                    function checkedUpdate(evt) {
                        if (!scene_controller._okToNavigate()) {
                            evt.stopPropagation();
                            evt.preventDefault();
                        }
                        else {
                            scene_controller._updateCurrentSlide();
                        }
                    }

                    function canvasCheckedUpdate(evt) {
                        if (evt.target.nodeName.toLowerCase() === "canvas") {
                            checkedUpdate(evt);
                        }
                    }

                    $("#viewDiv").each(function (ignore, node) {
                        node.addEventListener(
                            ((typeof PointerEvent !== "undefined") // W3C recommendation
                                ?
                                "pointerdown" // IE 11
                                :
                                "mousedown"), // Chrome, Firefox
                            canvasCheckedUpdate, true);

                        node.addEventListener("wheel", checkedUpdate, true);
                    });

                    $(".esri-ui-top-left").each(function (ignore, node) {
                        node.addEventListener("click", checkedUpdate, true);
                    });
                });
        },

        _fixLayerVisibility: function (slide) {
            var clusterViewLayerId;

            // Is the survey layer visible in this slide?  If so, hide it because we'll replace it with a clustered form
            if (slide !== undefined) {
                slide.visibleLayers.items.some(function (visibleLayer, iVisibleLayer) {
                    if (scene_controller._config.featureSvcParams.id === visibleLayer.id) {
                        slide.visibleLayers.remove(visibleLayer);
                        return true;
                    }
                });

                // Similarly, if the cluster view's graphics layer is not visible, add it to the visible layers
                clusterViewLayerId = scene_controller._clustererView.layerId();
                if (clusterViewLayerId !== null) {
                    var clusterLayerVisible = slide.visibleLayers.some(function (visibleLayer, iVisibleLayer) {
                        if (clusterViewLayerId === visibleLayer.id) {
                            return true;
                        }
                    });
                    if (!clusterLayerVisible) {
                        slide.visibleLayers.add({
                            id: clusterViewLayerId
                        });
                    }
                }
            }
            else {
                scene_controller.map.findLayerById(
                    scene_controller._config.featureSvcParams.id).visible = false;
                clusterViewLayerId = scene_controller._clustererView.layerId();
                if (clusterViewLayerId !== null) {
                    scene_controller.map.findLayerById(clusterViewLayerId).visible = true;
                }
            }
        },

        _goToSlide: function (slideNum) {
            if (!scene_controller._okToNavigate() || !scene_controller._slides ||
                scene_controller._slides.length === 0) {
                return;
            }
            var slide = scene_controller._slides[slideNum];

            // Make sure that the cluster layer is visible and its underlying data layer is not
            scene_controller._fixLayerVisibility(slide);

            // Apply a slide's settings to the SceneView.
            slide.applyTo(scene_controller.view);

            scene_controller._updateCurrentSlide(slideNum);
        },

        _goToNextSlide: function () {
            scene_controller._currentSlideNum += 1;
            if (scene_controller._currentSlideNum >= scene_controller._config.appParams.numResponseSites) {
                scene_controller._currentSlideNum = 0;
            }
            scene_controller._goToSlide(scene_controller._currentSlideNum);
        },

        /**
         * Broadcasts result of trying to match current position with slides in slide gallery.
         * @param {number} slideNum - Zero-based slide number
         * @param {boolean|undefined} isFromCameraMatch - Indicates if slide number was result of
         *      matching by camera location
         * @fires scene_controller#update-current-response-site
         * @memberof scene_controller
         * @private
         */
        _updateCurrentSlide: function (slideNum, isFromCameraMatch) {
            if (scene_controller._config.appParams.numResponseSites > 0) {
                if (slideNum === undefined) {
                    $.publish("update-current-response-site");

                }
                else {
                    scene_controller._currentSlideNum = slideNum;
                    scene_controller._currentSlideTitle = scene_controller._slides[slideNum].title.text;
                    $.publish("update-current-response-site", {
                        slide: slideNum,
                        title: scene_controller._slides[slideNum].title.text,
                        fromCamera: !!isFromCameraMatch
                    });
                }

                scene_controller._highlightSlide(slideNum);
            }
        },

        _highlightSlide: function (slideNum) {
            $("img").removeClass("slideFrameHighlight");

            if (!isNaN(slideNum)) {
                // Set a border to the selected slide to indicate it has been selected
                $("#image_" + slideNum).addClass("slideFrameHighlight");
            }
        },

        _getMatchingSlide: function (camera) {
            var matchingSlideNum;

            // Determine if the view's camera (heading, position, tilt) matches any slides
            $.each(scene_controller._slides, function (slideNum, slide) {
                var slideCamera = slide.viewpoint.camera;
                if (
                    scene_controller._essentiallyEqualNums(slideCamera.heading, camera.heading) &&
                    scene_controller._essentiallyEqualPositions(slideCamera.position, camera.position) &&
                    scene_controller._essentiallyEqualNums(slideCamera.tilt, camera.tilt)
                ) {
                    matchingSlideNum = slideNum;
                    return true;
                }
            });

            return matchingSlideNum;
        },

        _essentiallyEqualNums: function (a, b) {
            var essentiallyEqual, epsilonFactor = 0.000001,
                epsilon = (a === 0 ? epsilonFactor : Math.abs(a * epsilonFactor));
            essentiallyEqual = Math.abs(a - b) < epsilon;
            return essentiallyEqual;
        },

        _essentiallyEqualPositions: function (a, b) {
            var essentiallyEqual =
                scene_controller._essentiallyEqualNums(a.x, b.x) &&
                scene_controller._essentiallyEqualNums(a.y, b.y) &&
                scene_controller._essentiallyEqualNums(a.z, b.z) &&
                a.spatialReference.wkid === b.spatialReference.wkid;
            return essentiallyEqual;
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return scene_controller;
});
