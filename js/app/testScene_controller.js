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
 * Manages the display of a survey controller.
 * @namespace controller
 * @version 0.1
 */
define(["lib/i18n.min!nls/resources.js", "app/publicSurvey_clusterViewBuilder", "lib/testing_functions"],
    function (i18n, clusterViewBuilder, testing) {
        "use strict";
        var controller;
        controller = {
            //----- Events -------------------------------------------------------------------------------------------//

            // Published

            // Consumed
            // survey-form-in-progress
            // survey-form-is-empty
            // show-help

            //----- Module variables ---------------------------------------------------------------------------------//

            _config: {},
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
                            controllerReady.resolve,
                            function (error) {
                                // Attempt to load the survey form description
                                if (controller._config.appParams.surveydesc) {
                                    $.getJSON(controller._config.appParams.surveydesc + ".json",
                                        function (surveyDesc) {
                                            controller._config.featureSvcParams.popupDescription = surveyDesc.description;
                                            controller._config.featureSvcParams.fields = surveyDesc.fields;
                                            controller._config.featureSvcParams.canBeUpdated = surveyDesc.canBeUpdated;
                                            controller._config.featureSvcParams.test = surveyDesc.test;
                                            controllerReady.resolve();
                                        }
                                    ).fail(
                                        function () {
                                            controllerReady.reject(i18n.messages.unableToFindSurvey);
                                        }
                                    );
                                }
                                else {
                                    controllerReady.reject(error);
                                }
                            }
                        );
                    }
                });

                return controllerReady;
            },

            /**
             * Launches the controller.
             * @listens controller#show-help
             * @memberof controller
             */
            launch: function () {
                var controllerComponentsReady = $.Deferred();

                // Display help for app
                require(["app/message"], function (message) {
                    $.subscribe("show-help", function () {
                        message.showMessage(controller._config.appParams.helpText,
                            controller._config.appParams.titleText);
                    });
                });

                require(["app/survey", "app/scene_controller"], function (survey, scene_controller) {

                    // ----- Testing ---------------------------------------------------------------------------------//

                    // Supplement config

                    // Adjust config parameters as needed
                    controller._config.appParams.surveyNotificationPolicy =
                        controller._config.appParams.policy || controller._config.appParams.surveyNotificationPolicy;

                    // Controls
                    testing.activateButton("_survey_form_in_progress", "Fill in survey");
                    $.subscribe("_survey_form_in_progress", function () {
                        controller._surveyInProgress = true;
                        console.log("survey in progress: " + controller._surveyInProgress);
                        controller._echoFormState();
                    });

                    testing.activateButton("_survey_form_is_empty", "Clear survey");
                    $.subscribe("_survey_form_is_empty", function () {
                        controller._surveyInProgress = false;
                        console.log("survey in progress: " + controller._surveyInProgress);
                        controller._echoFormState();
                    });

                    testing.activateButton("request-signOut", i18n.labels.signOut);
                    testing.activateButton("show-help", "Show help", i18n.tooltips.helpTip);

                    // Monitoring pub/subs
                    $.subscribe("signedIn-user", testing.logSubscribedEvent);
                    $.subscribe("request-signOut", function () {
                        controller._surveyInProgress = false;
                        controller._echoFormState();
                        testing.logSubscribedEvent();
                    });
                    $.subscribe("signedOut-user", testing.logSubscribedEvent);
                    $.subscribe("goto-response-site", testing.logSubscribedEvent);
                    $.subscribe("update-current-response-site", testing.logSubscribedEvent);
                    $.subscribe("update-current-responses-set", testing.logSubscribedEvent);
                    $.subscribe("clear-survey-form", testing.logSubscribedEvent);

                    // -----------------------------------------------------------------------------------------------//

                    // Prepare the survey
                    controller._config.appParams._surveyDefinition = survey.createSurveyDefinition(
                        controller._config.featureSvcParams.popupDescription,
                        controller._config.featureSvcParams.fields,
                        controller._config.appParams.surveyNotificationPolicy, i18n.tooltips.importantQuestion
                    );
                    testing.prependToLog("Survey definition created");
                    testing.logSubscribedEvent("Survey question policy:",
                        controller._config.appParams.surveyNotificationPolicy);

                    // Prepare and start the scene controller
                    controller._loadCSS(controller._config.appParams.jsapi + "esri/css/main.css");
                    controller._loadCSS(controller._config.appParams.jsapi + "dijit/themes/claro/claro.css");
                    controller._loadCSS("css/override_styles.css");

                    scene_controller.init(controller._config, "mainContent",
                            clusterViewBuilder.builder, controller._okToNavigate)
                        .then(function () {
                            $("#scrim").fadeOut("fast");
                            console.log("webscene ready");

                            controllerComponentsReady.resolve();
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

            _echoFormState: function () {
                if (controller._surveyInProgress) {
                    $("#_survey_form_in_progress").addClass("highlight-btn");
                }
                else {
                    $("#_survey_form_in_progress").removeClass("highlight-btn");
                }
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
                        controller._echoFormState();
                        $.publish("clear-survey-form");
                    }
                    else {
                        ok = false;
                    }
                }
                return ok;
            }

            //--------------------------------------------------------------------------------------------------------//
        };
        return controller;
    });
