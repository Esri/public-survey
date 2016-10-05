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
define(["lib/i18n.min!nls/testSurveyForm_resources.js"],
    function (i18n) {
    "use strict";
    var controller;
    controller = {
        //----- Events -----------------------------------------------------------------------------------------------//

        // Published

         // Consumed
         // signedIn-user

        //----- Module variables -------------------------------------------------------------------------------------//

        _config: {},
        _logNum: 0,

        //----- Procedures available for external access -------------------------------------------------------------//

        /**
         * Initializes the controller.
         * @param {object} config - App config info
         * @memberof controller
         */
        init: function (config, container) {
            var controllerReady = $.Deferred();
            controller._config = config;

            // Instantiate the splash template
            container.loadTemplate("js/app/" + controller._config.appParams.appName + "_controller.html", {
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

            require(["app/survey"], function(survey) {

                // ----- Testing -------------------------------------------------------------------------------------//
                // Adjust config parameters as needed
                controller._config.appParams.readonly =
                    controller._toBoolean(controller._config.appParams.readonly, false);

                // Controls
                controller._activateButton("request-signOut");

                controller._activateButton("_clear-form");
                $.subscribe("_clear-form", function () {
                    survey.clearForm();
                });

                if (controller._config.featureSvcParams.test) {
                    $("#_fill-form").removeClass("absent");
                    controller._activateButton("_fill-form");
                    $.subscribe("_fill-form", function () {
                        survey.fillInForm(controller._config.featureSvcParams.test);
                    });

                    $("#_get-form-answers").removeClass("absent");
                    controller._activateButton("_get-form-answers");
                    $.subscribe("_get-form-answers", function (evt) {
                        controller._logSubscribedEvent(evt, survey.getFormAnswers());
                    });
                }

                controller._activateButton("_set-form-readOnly");
                $.subscribe("_set-form-readOnly", function () {
                    controller._config.appParams.readonly = !controller._config.appParams.readonly;
                    controller._echoReadOnlyState();
                    survey.setFormReadOnly(controller._config.appParams.readonly);
                });

                // Monitoring pub/subs
                $.subscribe("survey-form-in-progress", controller._logSubscribedEvent);
                $.subscribe("survey-form-policy-not-satisfied", controller._logSubscribedEvent);
                $.subscribe("survey-form-policy-satisfied", controller._logSubscribedEvent);
                $.subscribe("survey-form-is-empty", controller._logSubscribedEvent);
                $.subscribe("signedIn-user", controller._logSubscribedEvent);
                $.subscribe("signedOut-user", controller._logSubscribedEvent);
                // ---------------------------------------------------------------------------------------------------//

                // Prepare the survey
                controller._config.appParams._surveyDefinition = survey.createSurveyDefinition(
                    controller._config.featureSvcParams.popupDescription,
                    controller._config.featureSvcParams.fields,
                    controller._config.appParams.policy, i18n.tooltips.importantQuestion
                );
                controller._prependToLog("Survey definition created");
                controller._logSubscribedEvent("Survey question policy:", controller._config.appParams.policy);

                controller._loadCSS("css/" + controller._config.appParams.appName + "_styles.css");

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
            } else {
                $("#content").fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        },

        //----- Procedures meant for internal module use only --------------------------------------------------------//

        _echoReadOnlyState: function () {
            if (controller._config.appParams.readonly) {
                $("#_set-form-readOnly").addClass("highlight-btn");
            } else {
                $("#_set-form-readOnly").removeClass("highlight-btn");
            }
        },

        _loadCSS: function (url) {
            var stylesheet = document.createElement("link");
            stylesheet.href = url;
            stylesheet.rel = "stylesheet";
            stylesheet.type = "text/css";
            document.getElementsByTagName("head")[0].appendChild(stylesheet);
        },

        /** Normalizes a boolean value to true or false.
         * @param {boolean|string} boolValue A true or false value that is returned directly or a string
         * "true", "t", "yes", "y", "false", "f", "no", "n" (case-insensitive) or a number (0 for false; non-zero
         * for true) that is interpreted and returned; if neither a boolean nor a usable string nor a number, falls
         * back to defaultValue
         * @param {boolean} [defaultValue] A true or false that is returned if boolValue can't be used; if not
         * defined, true is returned
         * @private
         */
        _toBoolean: function (boolValue, defaultValue) {
            var lowercaseValue;

            // Shortcut true|false
            if (boolValue === true) {
                return true;
            }
            if (boolValue === false) {
                return false;
            }

            // Handle a true|false string
            if (typeof boolValue === "string") {
                lowercaseValue = boolValue.toLowerCase();
                if (lowercaseValue === "true" || lowercaseValue === "t" || lowercaseValue === "yes"
                    || lowercaseValue === "y" || lowercaseValue === "1") {
                    return true;
                }
                if (lowercaseValue === "false" || lowercaseValue === "f" || lowercaseValue === "no"
                    || lowercaseValue === "n" || lowercaseValue === "0") {
                    return false;
                }
            } else if (typeof boolValue === "number") {
                return boolValue !== 0;
            }
            // Fall back to default
            if (defaultValue === undefined) {
                return true;
            }
            return defaultValue;
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
         * Initializes the controller.
         * @param {object} config - App config info
         * @memberof controller
         * @private
         */
        _logSubscribedEvent: function (evt, data) {
            var logEntry, dataAsString = data !== undefined ? JSON.stringify(data) : "";
            logEntry = ((evt && evt.type) || evt || "") + " " + dataAsString;
            console.log(logEntry);

            if (logEntry.length > 256) {
                logEntry = logEntry.substr(0, 253) + "...";
            }
            controller._prependToLog(logEntry);
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
