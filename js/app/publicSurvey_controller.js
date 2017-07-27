/*global $ */
/** @license
 | Copyright 2015 Esri
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
 * Manages the display of a pair of visuals and survey controllers.
 * @namespace controller
 * @version 0.1
 */
define(["lib/i18n.min!nls/resources.js", "app/publicSurvey_clusterViewBuilder"],
    function (i18n, clusterViewBuilder) {
        "use strict";
        var controller;
        controller = {
            //----- Events -------------------------------------------------------------------------------------------//

            // Published
            /**
             * Requests that the survey be reset.
             * @event controller#clear-survey-form
             */

            // Consumed
            // survey-form-in-progress
            // survey-form-is-empty
            // show-help

            //----- Module variables ---------------------------------------------------------------------------------//

            _config: {},
            _currentSlideTitle: "",
            _surveyInProgress: false,

            //----- Procedures available for external access ---------------------------------------------------------//

            /**
             * Initializes the controller.
             * @param {object} config - App config info
             * @memberof controller
             */
            init: function (config, container) {
                var controllerReady = $.Deferred();
                controller._config = config;

                // Instantiate the controller template
                container.loadTemplate("js/app/" + controller._config.appParams.app + "_controller.html", {
                    // Template parameters
                }, {
                    // Template options
                    prepend: true,
                    complete: function () {
                        // When the feature service and survey are ready, we can set up the module that reads from and
                        // writes to the service
                        controller._config.featureSvcParams.surveyFeatureLayerReady.then(
                            controllerReady.resolve, controllerReady.reject);
                    }
                });

                return controllerReady;
            },

            /**
             * Launches the controller.
             * @listens controller#survey-form-in-progress
             * @listens controller#survey-form-is-empty
             * @listens controller#show-help
             * @memberof controller
             */
            launch: function () {
                var controllerComponentsReady = $.Deferred();

                $("#scrim").fadeIn("fast");

                // Monitor survey messages for coordination between visuals and survey
                $.subscribe("survey-form-in-progress", function () {
                    controller._surveyInProgress = true;
                });

                $.subscribe("survey-form-is-empty", function () {
                    controller._surveyInProgress = false;
                });

                require(["app/survey", "app/survey_controller", "app/scene_controller", "app/message"],
                    function (survey, survey_controller, scene_controller, message) {
                        // Prepare the survey
                        controller._config.appParams._surveyDefinition = survey.createSurveyDefinition(
                            controller._config.featureSvcParams.popupDescription,
                            controller._config.featureSvcParams.fields,
                            controller._config.appParams.surveyNotificationPolicy, i18n.tooltips.importantQuestion
                        );

                        // Prepare and start the scene controller
                        controller._loadCSS("//js.arcgis.com/4.2/esri/css/main.css");
                        controller._loadCSS("//js.arcgis.com/4.2/dijit/themes/claro/claro.css");
                        controller._loadCSS("css/override_styles.css");

                        scene_controller.init(controller._config, "mainContent",
                                clusterViewBuilder.builder, controller._okToNavigate)
                            .then(function () {
                                // Prepare  the survey controller
                                survey_controller.init(controller._config, "sidebarContent");

                                scene_controller.mapParamsReady.then(function () {
                                    controller._waitForBrowserQuiescence(12, 200).then(function () {
                                        // Start the controllers
                                        survey_controller.launch();
                                        scene_controller.launch();

                                        $("#scrim").fadeOut("fast");
                                        console.log("webscene ready");
                                    });
                                });

                                controllerComponentsReady.resolve();
                            });

                        // Display help for app
                        $.subscribe("show-help", function () {
                            message.showMessage(controller._config.appParams.helpText,
                                controller._config.appParams.titleText);
                        });

                        // Combine survey form answers with camera position for submission
                        $.subscribe("submit-survey", function (ignore, answers) {
                            controller._surveyInProgress = false;

                            // Combine the current camera position with the survey answers, must
                            // transform camera position from scene coordinates to answer feature
                            // layer coordinates if they're different
                            scene_controller.getCurrentCameraPos(
                                    controller._config.featureSvcParams.spatialReference.wkid)
                                .then(function (surveyPoint) {
                                    // Mix in camera orientation and current webscene slide name
                                    var viewpointDesc = {};
                                    viewpointDesc[controller._config.appParams.headingFieldName] =
                                        surveyPoint.attributes.heading;
                                    viewpointDesc[controller._config.appParams.tiltFieldName] =
                                        surveyPoint.attributes.tilt;
                                    viewpointDesc[controller._config.appParams.rollFieldName] =
                                        surveyPoint.attributes.roll;
                                    viewpointDesc[controller._config.appParams.slidenameFieldName] =
                                        scene_controller._currentSlideTitle;
                                    $.extend(answers, viewpointDesc);

                                    surveyPoint.attributes = answers;
                                    controller._postSurvey(surveyPoint);
                                });
                        });

                        $.subscribe("update-current-response-site", function (ignore, responseSite) {
                            if (responseSite && (responseSite.title !== undefined)) {
                                controller._currentSlideTitle = responseSite.title;
                            }
                            else {
                                controller._currentSlideTitle = "";
                            }
                        });
                    });

                return controllerComponentsReady;
            },

            /**
             * Shows or hides the DOM container managed by the controller.
             * @param {boolean} makeVisible - Visibility to set for container
             * @param {?function} thenDo - Function to execute after show/hide animation completes
             * @param {?object} thenDoArg - Argument for thenDo function
             * @memberof controller
             */
            show: function (makeVisible, thenDo, thenDoArg) {
                if (makeVisible) {
                    $("#content").fadeIn("fast", function () {
                        thenDo && thenDo(thenDoArg);
                    });
                }
                else {
                    $("#content").fadeOut("fast", function () {
                        thenDo && thenDo(thenDoArg);
                    });
                }
            },

            /**
             * Returns a list of additional supported URL parameters.
             * @return {array} List of additional URL parameter names or an empty list
             * @memberof controller
             */
            getAdditionalUrlParamsFilter: function () {
                return [];
            },

            //----- Procedures meant for internal module use only ----------------------------------------------------//

            _waitForBrowserQuiescence: function (pulseMillisecondGapForQuiescence, averagingBufferSize) {
                // Adapted from an idea how to monitor the active/idle state of the browser
                // by Maks Nemisj, https://nemisj.com/activity-monitor-in-js/
                // A 200-count averaging buffer helps to get past lull in Firefox around
                // time that the 3D processors start up
                var browserProbablyQuiescent = $.Deferred(),
                    millisecondsAllSamples = pulseMillisecondGapForQuiescence * averagingBufferSize;

                (function start() {
                    var timer_start = (+new Date()),
                        timer_end, stack = [],
                        averagingSampleSum = 0,
                        timespan;

                    (function collect() {
                        timer_end = (+new Date());
                        timespan = timer_end - timer_start;
                        stack.push(timespan);
                        averagingSampleSum += timespan;

                        timer_start = timer_end;
                        if (stack.length > averagingBufferSize) {
                            // Remove oldest from sum and stack
                            averagingSampleSum -= stack[0];
                            stack.shift();

                            // If we're averaging less than pulseMillisecondGapForQuiescence
                            // milliseconds between calls, we're probably quiescent
                            if (averagingSampleSum < millisecondsAllSamples) {
                                browserProbablyQuiescent.resolve();
                            }
                            else {
                                setTimeout(collect, 0);
                            }
                        }
                        else {
                            setTimeout(collect, 0);
                        }
                    })();

                    return stack;
                })();

                return browserProbablyQuiescent;
            },

            _loadCSS: function (url) {
                var stylesheet = document.createElement("link");
                stylesheet.href = url;
                stylesheet.rel = "stylesheet";
                stylesheet.type = "text/css";
                document.getElementsByTagName("head")[0].appendChild(stylesheet);
            },

            /**
             * Prompts user if he/she is about to do something that will invalidate an in-progress survey.
             * @fires controller#clear-survey-form
             * @memberof controller
             * @private
             */
            _okToNavigate: function () {
                var ok = true;
                if (controller._surveyInProgress) {
                    if (confirm(i18n.prompts.currentResponsesWillBeCleared)) {
                        controller._surveyInProgress = false;
                        $.publish("clear-survey-form");
                    }
                    else {
                        ok = false;
                    }
                }
                return ok;
            },

            _postSurvey: function (surveyPoint) {
                var url, update;

                // Post the packet
                url = controller._config.featureSvcParams.url + "/applyEdits";
                update = "f=json&id=" + controller._config.featureSvcParams.id +
                    "&adds=%5B" + controller._stringifyForApplyEdits(surveyPoint) + "%5D";

                console.log("*** Submit " + JSON.stringify(surveyPoint) + " ***");
                $.post(url, update, function (results, status) {
                    console.log("*** POST status: " + status + "; " + JSON.stringify(results) + " ***");

                    // Update the response clusters
                    clusterViewBuilder.refresh();
                });
            },

            _stringifyForApplyEdits: function (value) {
                var isFirst = true,
                    result = "";

                if (value === null) {
                    result += "null";
                }
                else if (typeof value === "string") {
                    result += "%22" + value + "%22";
                }
                else if (typeof value === "object") {
                    result += "%7B";
                    $.each(value, function (part) {
                        if (value.hasOwnProperty(part)) {
                            result += (isFirst ?
                                "" :
                                "%2C") + part + "%3A" + controller._stringifyForApplyEdits(value[part]);
                            isFirst = false;
                        }
                    });
                    result += "%7D";
                }
                else {
                    result += value;
                }
                return result;
            }

            //--------------------------------------------------------------------------------------------------------//
        };
        return controller;
    });
