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
 * @namespace visualsController
 * @version 0.1
 *
 * @property {number} numResponseSites - Number of slides in slide gallery
 */
define([
    "lib/i18n.min!nls/testScene_resources.js",
    "app/diag"
], function (
    i18n,
    diag
) {
    "use strict";
    var visualsController = {
        //----- Events -----------------------------------------------------------------------------------------------//

        // Published
        /**
         * @typedef {object} ResponseSiteHash
         * @property {number} set - Zero-based slide number
         * @property {string} title - Slide title
         * @property {boolean} fromCamera - Indicates if slide number was result of
         *          matching by camera location
         * @memberof visualsController
         */
        /**
         * Provides result of trying to match current position with slides in slide gallery.
         * @event visualsController#current-response-site
         * @property {?ResponseSiteHash} - Info about current slide
         */

        /**
         * @typedef {object} ResponsesHash
         * @property {array} responses - Survey responses
         * @memberof visualsController
         */
        /**
         * Requests to go to a location with its collection of survey responses.
         * @event visualsController#goto_location
         * @property {ResponsesHash} - Survey responses
         */

         // Consumed
         // surveyController#cluster-clicked
         // surveyController#goto-camera-pos
         // surveyController#goto-response-site

        //----- Module variables -------------------------------------------------------------------------------------//

        _prepareAppConfigInfo: null,
        _container: null,

        _averagingFieldValues: null,
        _clusterer: null,
        _clustererView: null,
        _clusterLayerVisible: null,
        _colorRamper: null,
        _config: null,
        _currentSlideNum: 0,
        _featureLayerOptions: null,
        _featureServiceUrl: null,
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
         * @memberof visualsController
         */
        init: function (prepareAppConfigInfo, container, clusterViewBuilder, _okToNavigate) {
            var visualsControllerReady = $.Deferred();
            visualsController._prepareAppConfigInfo = prepareAppConfigInfo;
            visualsController._container = container;
            visualsController._okToNavigate = _okToNavigate;

            visualsController.mapParamsReady = $.Deferred();

            // Instantiate the visualsController template
            container.loadTemplate("js/app/visualsController3d.html", {
            }, {
                prepend: true,
                complete: function () {

                    visualsController._loadWebScene(
                        prepareAppConfigInfo.appParams.webId, visualsController.mapParamsReady);

                    visualsController.mapParamsReady.then(function (response) {
                        // Loads once visuals panel becomes visible
                        $("#viewDiv").removeClass("loading-indicator");
                        console.log("webscene ready");

                        clusterViewBuilder(visualsController.view).then(function (clustering) {
                            visualsController._clusterer = clustering.clusterer;
                            visualsController._clustererView = clustering.clustererView;

                            // Go to first slide
                            if (visualsController.numResponseSites > 0) {
                                visualsController._goToSlide(0);

                            // Make sure that the cluster layer is visible and its underlying data layer is not
                            } else {
                                visualsController._fixLayerVisibility();
                            }
                        });
                    });

                    // Done with launch, but not initialization because SceneView must be visible for it to load
                    // Need to use visualsController.mapParamsReady before accessing map, view, numResponseSites
                    visualsControllerReady.resolve();
                }
            });

            return visualsControllerReady;
        },

        /**
         * Shows or hides the DOM container managed by the controller.
         * @param {boolean} makeVisible - Visibility to set for container
         * @param {?function} thenDo - Function to execute after show/hide animation completes
         * @param {?object} thenDoArg - Argument for thenDo function
         * @memberof visualsController
         */
        show: function (makeVisible, thenDo, thenDoArg) {
            if (makeVisible) {
                $(visualsController._container).fadeIn("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            } else {
                $(visualsController._container).fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        },

        //----- Procedures meant for internal module use only --------------------------------------------------------//

        /**
         * Loads libraries and creates a WebScene and SceneView for the supplied webscene item.
         * @param {object} webId - AGOL id of webscene item
         * @param {deferred} mapParamsReady - For reporting when setup is done
         * @fires visualsController#goto_location
         * @listens surveyController#cluster-clicked
         * @listens surveyController#goto-camera-pos
         * @listens surveyController#goto-response-site
         * @memberof visualsController
         * @private
         */
        _loadWebScene: function (webId, mapParamsReady) {

            requirejs.config({
                baseUrl: "//js.arcgis.com/4.0/",
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
                esriConfig.portalUrl = visualsController._prepareAppConfigInfo.appParams.portalurl;

                visualsController.map = new WebScene({
                    portalItem: {
                        id: webId
                    }
                });

                visualsController.view = new SceneView({
                    map: visualsController.map,
                    container: "viewDiv"
                });

                // Once the map and view are loaded, we can adjust the view
                visualsController.view.then(function () {

                    // Disable popups on all webscene layers
                    visualsController.map.allLayers.forEach(function (layer) {
                        layer.popupEnabled = false;
                    });

                    // Are we displaying slides?
                    visualsController.numResponseSites =
                        visualsController.map.presentation && visualsController.map.presentation.slides
                        ? visualsController.map.presentation.slides.length : 0;
                    if (visualsController.numResponseSites > 0) {
                        visualsController._slides = visualsController.map.presentation.slides.items;
                    }

                    // Reset the top-left widgets set
                    visualsController.view.ui.empty("top-left");

                    // Disable popups on all webscene layers
                    visualsController.map.allLayers.forEach(function (layer) {
                        layer.popupEnabled = false;
                    });

                    // Replace zoom action on scene view's popup with our action
                    var goToResponse = {
                        title: i18n.prompts.goToResponses,
                        id: "goto-response",
                        image: "images/blank.png"
                    };
                    visualsController.view.popup.actions = [goToResponse];

                    visualsController.view.popup.on("trigger-action", function (evt) {
                        if (evt.action.id === "goto-response") {
                            visualsController.view.popup.clear();
                            visualsController.view.popup.close();

                            // Package array because lightweight pub/sub only passes first element of arrays
                            $.publish("goto_location", {responses: clusterSurveys});
                        }
                    });

                    // Remove dock option from popup
                    visualsController.view.popup.dockEnabled = true;
                    visualsController.view.popup.dockOptions = {
                        position: "top-left",
                        buttonEnabled: false,
                        breakpoint: false
                    };

                    // Add navigation widgets
                    require(["esri/widgets/Zoom", "esri/widgets/NavigationToggle", "esri/widgets/Compass"],
                        function (Zoom, NavigationToggle, Compass) {
                        var zoomWidget = new Zoom({view: visualsController.view, className: "iconContainer"});
                        zoomWidget.startup();
                        visualsController.view.ui.add(zoomWidget, "top-left");

                        var navigationToggle = new NavigationToggle({view: visualsController.view});
                        navigationToggle.startup();
                        visualsController.view.ui.add(navigationToggle, "top-left");

                        var compassWidget = new Compass({view: visualsController.view, className: "iconContainer"});
                        compassWidget.startup();
                        visualsController.view.ui.add(compassWidget, "top-left");
                    });

                    // Create the slide gallery
                    if (visualsController.numResponseSites > 0) {
                        // Create gallery frame, its label tab, and its slides container
                        var gallery = $("<div id='gallery' class='gallery'></div>");
                        $("#viewDiv").append(gallery);
                        visualsController.view.ui.add(gallery[0], "manual");

                        $(gallery).append("<div class='galleryTab'>Take a tour</div>");

                        var slidesHolder = $("<div id='slidesHolder'></div>");
                        $(gallery).append(slidesHolder);

                        // Fill the slides container with the map's slides
                        var slides = visualsController.map.presentation.slides;
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
                            $(slideObj).append("<img id='image_" + slideNum + "' title='" + slide.title.text
                                + "' src='" + slide.thumbnail.url + "' class='slideFrame'>");

                            // Slide click behavior
                            $("#" + slide.id).on("click", function () {
                                visualsController._goToSlide(slideNum);
                            });
                        });

                        // Gallery is ready for use
                        $(gallery).css("visibility", "visible");

                    } else {
                        // Otherwise, add a Home widget
                        require(["esri/widgets/Home"],
                            function (Home) {
                            var homeWidget = new Home({view: visualsController.view, className: "iconContainer"});
                            homeWidget.startup();
                            visualsController.view.ui.add(homeWidget, "top-left");
                        });

                        if (visualsController.map.initialViewProperties) {
                            console.log("// Scene initial view:");
                            console.log("   scale = " + visualsController.map.initialViewProperties.viewpoint.scale + ";");
                            console.log("   camera = "
                                + JSON.stringify(visualsController.map.initialViewProperties.viewpoint.camera) + ";");
                        }
                    }

                    mapParamsReady.resolve();
                });

                // Wire up app
                $.subscribe("goto-response-site", function (ignore, iSite) {
                    visualsController._goToSlide(iSite);
                });

                $.subscribe("goto-camera-pos", function (ignore, cameraOptions) {
                    console.log("goto " + JSON.stringify(cameraOptions.position) + ", "
                        + cameraOptions.heading + "° CW, " + cameraOptions.tilt + "° up");
                    var camera = new Camera(cameraOptions);
                    visualsController.view.goTo(camera);
                    visualsController._updateCurrentSlide(visualsController._getMatchingSlide(camera), true);
                });

                // Save cluster features list when one clicks on a cluster
                $.subscribe("cluster-clicked", function (ignore, clusterClickInfo) {
                    var cluster = visualsController._clusterer.getClusterById(clusterClickInfo.attributes.id);
                    clusterSurveys = cluster.features;
                });

                // Set up some event handlers to intercept navigation via nav widgets and mouse actions on scene
                // canvas. Has to be done during event capturing, which Dojo's 'on' doesn't yet support, hence
                // use of addEventListener. Interception is to prevent navigation if there is a partial survey
                // completed. For mousedown, we have to cancel navigation if there's a partial survey even
                // if the user agrees to cancel the survey because otherwise we don't really have a cancellation.
                // We have an unmatched mousedown event that can only be cleared by another click, but that click
                // is interpreted as a zoom in.

                function checkedUpdate (evt) {
                    if (!visualsController._okToNavigate()) {
                        evt.stopPropagation();
                        evt.preventDefault();
                    } else {
                        visualsController._updateCurrentSlide();
                    }
                }

                function canvasCheckedUpdate (evt) {
                    if (evt.target.nodeName.toLowerCase() === "canvas") {
                        checkedUpdate(evt);
                    }
                }

                $("#viewDiv").each(function (ignore, node) {
                    node.addEventListener(
                        ((typeof PointerEvent !== "undefined")  // W3C recommendation
                            ? "pointerdown"  // IE 11
                            : "mousedown"),  // Chrome, Firefox
                        canvasCheckedUpdate, true);

                    node.addEventListener("wheel", checkedUpdate, true);
                });

                $(".esri-ui-top-left").each(function (ignore, node) {
                    node.addEventListener("click", checkedUpdate, true);
                });
            });
        },

        _fixLayerVisibility: function (slide) {
            // Is the survey layer visible in this slide?  If so, hide it because we'll replace it with a clustered form
            if (slide !== undefined) {
                slide.visibleLayers.items.some(function (visibleLayer, iVisibleLayer) {
                    if (visualsController._prepareAppConfigInfo.featureSvcParams.id === visibleLayer.id) {
                        slide.visibleLayers.remove(visibleLayer);
                        return true;
                    }
                });

                // Similarly, if the cluster view's graphics layer is not visible, add it to the visible layers
                var clusterViewLayerId = visualsController._clustererView.layerId();
                if (clusterViewLayerId !== null) {
                    var clusterLayerVisible = slide.visibleLayers.some(function (visibleLayer, iVisibleLayer) {
                        if (clusterViewLayerId === visibleLayer.id) {
                            return true;
                        }
                    });
                    if (!clusterLayerVisible) {
                        slide.visibleLayers.add({id: clusterViewLayerId});
                    }
                }
            } else {
                visualsController.map.findLayerById(
                    visualsController._prepareAppConfigInfo.featureSvcParams.id).visible = false;
                var clusterViewLayerId = visualsController._clustererView.layerId();
                if (clusterViewLayerId !== null) {
                    visualsController.map.findLayerById(clusterViewLayerId).visible = true;
                }
            }
        },

        _goToSlide: function (slideNum) {
            if (!visualsController._okToNavigate() || !visualsController._slides
                || visualsController._slides.length === 0) {
                return;
            }
            var slide = visualsController._slides[slideNum];

            // Make sure that the cluster layer is visible and its underlying data layer is not
            visualsController._fixLayerVisibility(slide);

            // Apply a slide's settings to the SceneView.
            slide.applyTo(visualsController.view);

            visualsController._updateCurrentSlide(slideNum);
        },

        _goToNextSlide: function () {
            visualsController._currentSlideNum += 1;
            if (visualsController._currentSlideNum >= visualsController.numResponseSites) {
                visualsController._currentSlideNum = 0;
            }
            visualsController._goToSlide(visualsController._currentSlideNum);
        },

        /**
         * Broadcasts result of trying to match current position with slides in slide gallery.
         * @param {number} slideNum - Zero-based slide number
         * @param {boolean|undefined} isFromCameraMatch - Indicates if slide number was result of
         *      matching by camera location
         * @fires visualsController#current-response-site
         * @memberof visualsController
         * @private
         */
        _updateCurrentSlide: function (slideNum, isFromCameraMatch) {
            if (visualsController.numResponseSites > 0) {
                if (slideNum === undefined) {
                    $.publish("current-response-site");

                } else {
                    visualsController._currentSlideNum = slideNum;
                    $.publish("current-response-site", {
                        set: slideNum,
                        title: visualsController._slides[slideNum].title.text,
                        fromCamera: !!isFromCameraMatch
                    });
                }

                visualsController._highlightSlide(slideNum);
            }
        },

        _highlightSlide: function (slideNum) {
            $("img").removeClass("slideFrameHighlight");

            if (!isNaN(slideNum)) {
                // Set a border to the selected slide to indicate it has been selected
                $("#image_"+slideNum).addClass("slideFrameHighlight");
            }
        },

        _getMatchingSlide: function (camera) {
            var matchingSlideNum;

            // Determine if the view's camera (heading, position, tilt) matches any slides
            array.forEach(visualsController._slides, lang.hitch(visualsController, function (slide, slideNum) {
                var slideCamera = slide.viewpoint.camera;
                if (
                    visualsController._essentiallyEqualNums(slideCamera.heading, camera.heading) &&
                    visualsController._essentiallyEqualPositions(slideCamera.position, camera.position) &&
                    visualsController._essentiallyEqualNums(slideCamera.tilt, camera.tilt)
                ) {
                    matchingSlideNum = slideNum;
                    return true;
                }
            }));

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
                visualsController._essentiallyEqualNums(a.x, b.x) &&
                visualsController._essentiallyEqualNums(a.y, b.y) &&
                visualsController._essentiallyEqualNums(a.z, b.z) &&
                a.spatialReference.wkid === b.spatialReference.wkid;
            return essentiallyEqual;
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return visualsController;
});
