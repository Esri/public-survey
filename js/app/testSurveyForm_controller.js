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
 * Manages the display of a survey form.
 * @namespace controller
 * @version 0.1
 */
define(["lib/i18n.min!nls/resources.js", "lib/testing_functions"],
    function (i18n, testing) {
        "use strict";
        var controller;
        controller = {
            //----- Events -------------------------------------------------------------------------------------------//

            // Published

            // Consumed
            // signedIn-user

            //----- Module variables ---------------------------------------------------------------------------------//

            _config: {},

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
                        controller._config.featureSvcParams.surveyFeatureLayerReady.then(function () {
                            controllerReady.resolve();
                        }, function () {
                            // As a backup, attempt to load the survey form description
                            if (controller._config.appParams.surveydesc) {
                                $.getJSON(controller._config.appParams.surveydesc + ".json",
                                    function (surveyDesc) {
                                        controller._config.featureSvcParams.canBeUpdated = surveyDesc.canBeUpdated;
                                        controller._config.featureSvcParams.popupDescription = surveyDesc.description;
                                        controller._config.featureSvcParams.fields = surveyDesc.fields;
                                        controller._config.featureSvcParams.test = surveyDesc.test;
                                        controllerReady.resolve();
                                    }
                                ).fail(
                                    function (error) {
                                        if (error) {
                                            console.log(JSON.stringify(error));
                                        }
                                        controllerReady.reject(i18n.messages.unableToStartApp);
                                    }
                                );
                            }
                        });
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

                require(["app/survey"], function (survey) {

                    // ----- Testing ---------------------------------------------------------------------------------//
                    // Adjust config parameters as needed
                    controller._config.appParams.readonly =
                        testing.toBoolean(controller._config.appParams.readonly, false);
                    controller._config.appParams.surveyNotificationPolicy =
                        controller._config.appParams.policy || controller._config.appParams.surveyNotificationPolicy;

                    // Controls
                    testing.activateButton("request-signOut");

                    testing.activateButton("_clear-form");
                    $.subscribe("_clear-form", function () {
                        survey.clearForm();
                    });

                    if (controller._config.featureSvcParams.test) {
                        $("#_fill-form").removeClass("absent");
                        testing.activateButton("_fill-form");
                        $.subscribe("_fill-form", function () {
                            survey.fillInForm(controller._config.featureSvcParams.test);
                        });

                        $("#_get-form-answers").removeClass("absent");
                        testing.activateButton("_get-form-answers");
                        $.subscribe("_get-form-answers", function (evt) {
                            testing.logSubscribedEvent(evt, survey.getFormAnswers());
                        });
                    }

                    testing.activateButton("_set-form-readOnly");
                    $.subscribe("_set-form-readOnly", function () {
                        controller._config.appParams.readonly = !controller._config.appParams.readonly;
                        controller._echoReadOnlyState();
                        survey.setFormReadOnly(controller._config.appParams.readonly);
                    });

                    // Monitoring pub/subs
                    $.subscribe("survey-form-in-progress", testing.logSubscribedEvent);
                    $.subscribe("survey-form-policy-not-satisfied", testing.logSubscribedEvent);
                    $.subscribe("survey-form-policy-satisfied", testing.logSubscribedEvent);
                    $.subscribe("survey-form-is-empty", testing.logSubscribedEvent);
                    $.subscribe("signedIn-user", testing.logSubscribedEvent);
                    $.subscribe("signedOut-user", testing.logSubscribedEvent);
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

                    // Start with a fresh survey form for newly-signed-in user
                    $.subscribe("signedIn-user", function () {
                        controller._echoReadOnlyState();
                        survey.createSurveyForm($("#surveyContainer")[0],
                            controller._config.appParams._surveyDefinition, controller._config.appParams.readonly);
                    });

                    // Done with setup
                    controllerComponentsReady.resolve();
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
                return ["policy", "readonly", "surveydesc"];
            },

            //----- Procedures meant for internal module use only ----------------------------------------------------//

            _echoReadOnlyState: function () {
                if (controller._config.appParams.readonly) {
                    $("#_set-form-readOnly").addClass("highlight-btn");
                }
                else {
                    $("#_set-form-readOnly").removeClass("highlight-btn");
                }
            }

            //--------------------------------------------------------------------------------------------------------//
        };
        return controller;
    });
