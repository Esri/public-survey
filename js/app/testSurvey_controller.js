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
define(["lib/i18n.min!nls/resources.js", "lib/testing_functions"],
    function (i18n, testing) {
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
            _currentUser: {
                name: "",
                id: "",
                canSubmit: true
            },
            _iCurrentResponseSite: undefined,

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

                require(["app/survey", "app/survey_controller"], function (survey, survey_controller) {

                    // ----- Testing ---------------------------------------------------------------------------------//
                    var num, testButtonsContainer = $("#test_buttons");

                    function assembleAtSiteButton(num) {
                        var siteNum = num < 0 ? undefined : num;
                        testing.createButton(testButtonsContainer, "_at_site_" + siteNum, "At site " + siteNum);
                        $.subscribe("_at_site_" + siteNum, function () {
                            $.publish("update-current-response-site", {
                                slide: siteNum,
                                title: "",
                                fromCamera: false
                            });
                            $("#_at_site_" + siteNum).addClass("highlight-btn").siblings().removeClass("highlight-btn");
                            controller._iCurrentResponseSite = siteNum;
                        });
                        if (siteNum === controller._iCurrentResponseSite) {
                            $("#_at_site_" + siteNum).addClass("highlight-btn");
                        }
                    }

                    // Supplement config
                    controller._config.appParams.headingFieldName = "heading";
                    controller._config.appParams.tiltFieldName = "tilt";
                    controller._config.appParams.rollFieldName = "roll";

                    // Adjust config parameters as needed
                    controller._config.appParams.readonly =
                        testing.toBoolean(controller._config.appParams.readonly, false);
                    if (controller._config.appParams.showseeresponsesbutton) {
                        controller._config.appParams.showSeeResponsesButton =
                            controller._config.appParams.showseeresponsesbutton;
                    }
                    if (controller._config.appParams.brandingicon) {
                        controller._config.appParams.brandingIconUrl = controller._config.appParams.brandingicon;
                    }
                    controller._config.appParams.numResponseSites =
                        testing.toNumber(controller._config.appParams.numresponsesites, 2);

                    // Controls
                    testing.activateButton("_nav_reset");
                    $.subscribe("_nav_reset", function () {
                        $.publish("clear-survey-form");
                    });
                    testing.activateButton("_clear_curr_resp");
                    $.subscribe("_clear_curr_resp", function () {
                        $.publish("update-current-responses-set", {
                            "responses": []
                        });
                    });

                    if (controller._config.appParams.numResponseSites > 0) {
                        for (num = -1; num < controller._config.appParams.numResponseSites; ++num) {
                            assembleAtSiteButton(num);
                        }
                    }

                    if (controller._config.featureSvcParams.test) {
                        $.each(controller._config.featureSvcParams.test, function (indexInArray, testCase) {
                            num = testCase.responses[0].num;
                            testing.createButton(testButtonsContainer,
                                "_current_responses_set_" + num, "Set " + num + " curr resp.");
                            $.subscribe("_current_responses_set_" + num, function () {
                                $.publish("update-current-responses-set", testCase);
                            });
                        });
                    }

                    // Monitoring pub/subs
                    $.subscribe("goto-response-site", function (evt, siteNum) {
                        testing.logSubscribedEvent(evt, siteNum);
                        $.publish("update-current-response-site", {
                            slide: siteNum,
                            title: "",
                            fromCamera: false
                        });
                    });
                    $.subscribe("update-current-response-site", function (evt, responseSite) {
                        testing.logSubscribedEvent(evt, responseSite.slide);
                        $("#_at_site_" + responseSite.slide).addClass("highlight-btn").siblings()
                            .removeClass("highlight-btn");
                    });
                    $.subscribe("update-current-responses-set", testing.logSubscribedEvent);
                    $.subscribe("request-signOut", testing.logSubscribedEvent);
                    $.subscribe("submit-survey", testing.logSubscribedEvent);
                    $.subscribe("completed-response-site", testing.logSubscribedEvent);
                    $.subscribe("goto-camera-pos", testing.logSubscribedEvent);
                    $.subscribe("signedIn-user", testing.logSubscribedEvent);
                    $.subscribe("signedOut-user", testing.logSubscribedEvent);
                    $.subscribe("survey-form-in-progress", testing.logSubscribedEvent);
                    $.subscribe("survey-form-is-empty", testing.logSubscribedEvent);
                    $.subscribe("survey-form-policy-not-satisfied", testing.logSubscribedEvent);
                    $.subscribe("survey-form-policy-satisfied", testing.logSubscribedEvent);
                    // -----------------------------------------------------------------------------------------------//

                    // Prepare the survey
                    controller._config.appParams._surveyDefinition = survey.createSurveyDefinition(
                        controller._config.featureSvcParams.popupDescription,
                        controller._config.featureSvcParams.fields,
                        controller._config.appParams.surveyNotificationPolicy, i18n.tooltips.importantQuestion
                    );
                    testing.prependToLog("Survey definition created");

                    // Prepare and start the survey controller
                    survey_controller.init(controller._config, "sidebarContent")
                        .then(function () {
                            survey_controller.launch();
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
                return ["brandingicon", "numresponsesites", "policy", "readonly", "showseeresponsesbutton",
                    "surveydesc"
                ];
            }

            //----- Procedures meant for internal module use only ----------------------------------------------------//

            //--------------------------------------------------------------------------------------------------------//
        };
        return controller;
    });
