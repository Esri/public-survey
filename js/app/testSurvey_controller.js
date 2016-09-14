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
define(["lib/i18n.min!nls/testScene_resources.js"],
    function (i18n) {
    "use strict";
    var controller;
    controller = {
        //----- Published events -------------------------------------------------------------------------------------//

        // Published
        /**
         * Requests that the survey be reset.
         * @event controller#reset-survey
         */

         // Consumed

        //----- Module variables -------------------------------------------------------------------------------------//

        _config: {},
        _logNum: 0,

        //----- Procedures available for external access -------------------------------------------------------------//

        /**
         * Initializes the controller.
         * @param {object} config - App config info
         * @memberof controller
         */
        init: function (config) {
            var controllerReady = $.Deferred();
            controller._config = config;

            // Instantiate the splash template
            $("body").loadTemplate("js/app/" + controller._config.appParams.appName + "_controller.html", {
            }, {
                prepend: true,
                complete: function () {

                    // Controls in test window
                    controller._activateButton("goto_location", i18n.prompts.goToResponses, null, {responses: {a: "a", b: "b"}});

                    // When the feature service and survey are ready, we can set up the module that reads from and
                    // writes to the service
                    controller._config.featureSvcParams.surveyFeatureLayerReady.then(function () {
/*  //???
                        dataAccess.init(controller._config.featureSvcParams.url,
                            controller._config.featureSvcParams.id,
                            controller._config.appParams.proxyProgram);
*/
                        controllerReady.resolve();
                    }, function (error) {
                        if (error) {
                            console.log(JSON.stringify(error));
                        }
                        controllerReady.reject(i18n.messages.noMoreSurveys);
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

            // Monitor survey messages for coordination between visuals and survey
            $.subscribe("survey-form-in-progress", function () {
                controller._surveyInProgress = true;
                console.log("survey in progress: " + controller._surveyInProgress);
            });

            $.subscribe("survey-form-is-empty", function () {
                controller._surveyInProgress = false;
                console.log("survey in progress: " + controller._surveyInProgress);
            });

            // Display help for app
            require(["app/message"], function (message) {
                $.subscribe("show-help", function () {
                    message.showMessage(controller._config.appParams.helpText,
                        controller._config.appParams.title);
                });
            });


            // Monitoring in test window
            $.subscribe("request-signOut", controller._logSubscribedEvent);
            $.subscribe("submit-survey-form", controller._logSubscribedEvent);
            $.subscribe("clear-survey-form", controller._logSubscribedEvent);
            $.subscribe("goto-next-todo-response-site", controller._logSubscribedEvent);
            $.subscribe("finish-survey-form", controller._logSubscribedEvent);
            $.subscribe("see-responses", controller._logSubscribedEvent);
            $.subscribe("goto-next-response", controller._logSubscribedEvent);
            $.subscribe("turn-off-responses", controller._logSubscribedEvent);

            $.subscribe("goto_location", controller._logSubscribedEvent);
            $.subscribe("signedIn-user", controller._logSubscribedEvent);
            $.subscribe("signedOut-user", controller._logSubscribedEvent);


            require(["app/survey", "app/surveyController3d"], function(survey, surveyController) {
                // Prepare the survey
                controller._config.appParams._surveyDefinition = survey.createSurvey(
                    controller._config.featureSvcParams.popupDescription,
                    controller._config.featureSvcParams.fields
                );
                controller._prependToLog("Survey definition created");


                surveyController.init(controller._config, $("#sidebarContent"))
                    .then(controllerComponentsReady.resolve());
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
            } else {
                $("#content").fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        },

        //----- Procedures meant for internal module use only --------------------------------------------------------//

        /**
         * Initializes the controller.
         * @param {object} config - App config info
         * @memberof controller
         * @private
         */
        _logSubscribedEvent: function (evt, data) {
            var dataAsString = data ? JSON.stringify(data) : "";
            if (dataAsString.length > 50) {
                dataAsString = dataAsString.substr(0, 50) + "...";
            }
            controller._prependToLog(evt.type + " " + dataAsString);
        },

        /**
         * Completes text setup of a button and sets its click event to publish the id of the button.
         * @param {string} id - Id of button to modify
         * @param {?string} label - Text to display in button display
         * @param {?string} tooltip - Text to display in button tooltip
         * @param {?object} data - Data to pass to event handler
         * @memberof controller
         * @private
         */
        _activateButton: function (id, label, tooltip, data) {
            var btn = $("#" + id);
            btn.on("click", data, controller._buttonPublish);

            btn = btn[0];
            if (label) {
                btn.innerHTML = label;
            }
            if (tooltip) {
                btn.title = tooltip;
            }

            return btn;
        },

        /**
         * Click event function to publish the id of the target.
         * @param {object} evt - Click event
         * @memberof controller
         * @private
         */
        _buttonPublish: function (evt) {
            var btn = evt.currentTarget;
            btn.blur();  // Allow button to be defocused without clicking elsewhere
            $.publish(btn.id, evt.data);
        },

        /**
         * Prepends sequence number and supplied text to #logText item.
         * <br>
         * Note: does not work while controller page is not displayed
         * @param {string} text - Text to prepend
         * @memberof controller
         * @private
         */
        _prependToLog: function (text) {
            $("#logText").prepend(++controller._logNum + ": " + text + "\n");
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return controller;
});
