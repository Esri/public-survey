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
define(["lib/i18n.min!nls/testSurvey_resources.js"],
    function (i18n) {
    "use strict";
    var controller;
    controller = {
        //----- Events -----------------------------------------------------------------------------------------------//

        // Published
        /**
         * Requests that a new survey be started.
         * @event controller#show-newSurvey
         */

         // Consumed
         // survey-form-in-progress
         // survey-form-is-empty
         // show-help

        //----- Module variables -------------------------------------------------------------------------------------//

        _config: {},
        _logNum: 0,
        _currentUser: {
            name: "",
            id: "",
            canSubmit: true
        },

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
                        // Attempt to load the survey form description
                        if (controller._config.appParams.surveydesc) {
                            $.getJSON(controller._config.appParams.surveydesc + ".json",
                                function (surveyDesc) {
                                    controller._config.featureSvcParams.popupDescription = surveyDesc.description;
                                    controller._config.featureSvcParams.fields = surveyDesc.fields;
                                    controller._config.featureSvcParams.canBeUpdated = surveyDesc.canBeUpdated;
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
         * @listens controller#show-help
         * @memberof controller
         */
        launch: function () {
            var controllerComponentsReady = $.Deferred();

            // Controls in test window
            controller._activateButton("_goto_location_1", i18n.prompts.goToResponses + " with 1");
            $.subscribe("_goto_location_1", function () {
                $.publish("goto_location",
                    {responses: [{"geometry":{"x":-9812685,"y":5127560,"z":214,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":153,"surveyor":null,"slidename":"","heading":200,"tilt":71,"roll":0,"question1":"No","question2":"Disagree","z":null,"elevation":null,"comments":"Too built-up","z_m":null,"globalid":"{2B0FDE20-786A-4BFE-AFF0-87BA3602DCFF}"},"popupTemplate":null}]}
                );
            });
            controller._activateButton("_goto_location_2", i18n.prompts.goToResponses + " with 2");
            $.subscribe("_goto_location_2", function () {
                $.publish("goto_location",
                    {responses: [{"geometry":{"x":-9813047,"y":5126974,"z":218,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":122,"surveyor":null,"slidename":"","heading":51,"tilt":82,"roll":0,"question1":"No","question2":"Totally Disagree","z":null,"elevation":null,"comments":null,"z_m":null,"globalid":"{6F0AADCF-0DF4-47AE-89BE-CB81FF73483F}"},"popupTemplate":null},{"geometry":{"x":-9813040,"y":5126958,"z":218,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":129,"surveyor":null,"slidename":"","heading":31,"tilt":90,"roll":0,"question1":"No","question2":"Totally Disagree","z":null,"elevation":null,"comments":"blocks my view of the mountains","z_m":null,"globalid":"{D271BDF7-A337-4881-89E1-E1939358E271}"},"popupTemplate":null}]}
                );
            });
            controller._activateButton("_goto_location_7", i18n.prompts.goToResponses + " with 7");
            $.subscribe("_goto_location_7", function () {
                $.publish("goto_location",
                    {responses: [{"geometry":{"x":-9813257,"y":5126969,"z":268,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":159,"surveyor":null,"slidename":"Slide 2","heading":82,"tilt":71,"roll":0,"question1":"Not sure","question2":"Indifferent","z":null,"elevation":null,"comments":null,"z_m":null,"globalid":"{007CDE47-D579-4CA4-BBF6-9A83A8BF0E72}"},"popupTemplate":null},{"geometry":{"x":-9813257,"y":5126969,"z":268,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":105,"surveyor":null,"slidename":"Slide 2","heading":82,"tilt":71,"roll":0,"question1":"Yes","question2":"Totally agree","z":null,"elevation":null,"comments":"ok","z_m":null,"globalid":"{C830C706-8E69-409D-8722-C8A5D5E8C217}"},"popupTemplate":null},{"geometry":{"x":-9813257,"y":5126969,"z":268,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":139,"surveyor":null,"slidename":"Slide 2","heading":82,"tilt":71,"roll":0,"question1":"No","question2":"Indifferent","z":null,"elevation":null,"comments":null,"z_m":null,"globalid":"{B0714EF1-C161-4593-9510-B6D47F5A5189}"},"popupTemplate":null},{"geometry":{"x":-9813257,"y":5126969,"z":268,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":142,"surveyor":null,"slidename":"Slide 2","heading":82,"tilt":71,"roll":0,"question1":"Not sure","question2":"Indifferent","z":null,"elevation":null,"comments":null,"z_m":null,"globalid":"{2D857B95-70FC-4BA1-A1CF-27A7B8E4F9EB}"},"popupTemplate":null},{"geometry":{"x":-9813257,"y":5126969,"z":268,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":152,"surveyor":null,"slidename":"Slide 2","heading":82,"tilt":71,"roll":0,"question1":"Yes","question2":"Agree","z":null,"elevation":null,"comments":"good corridor","z_m":null,"globalid":"{27843509-5845-4338-A1CC-25BBEDB8E0A2}"},"popupTemplate":null},{"geometry":{"x":-9813257,"y":5126969,"z":268,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":156,"surveyor":null,"slidename":"Slide 2","heading":82,"tilt":71,"roll":0,"question1":"No","question2":"Agree","z":null,"elevation":null,"comments":";laksdfj;","z_m":null,"globalid":"{A279AA9F-E9C8-4136-B257-74450E4EBA81}"},"popupTemplate":null},{"geometry":{"x":-9813257,"y":5126969,"z":268,"spatialReference":{"wkid":102100,"latestWkid":3857}},"symbol":null,"attributes":{"objectid":163,"surveyor":null,"slidename":"Slide 2","heading":82,"tilt":71,"roll":0,"question1":"Yes","question2":null,"z":null,"elevation":null,"comments":null,"z_m":null,"globalid":"{EB9A5738-EFE1-4677-87E3-7CD300DACA3E}"},"popupTemplate":null}]}
                );
            });

            // Monitoring in test window
            $.subscribe("request-signOut", controller._logSubscribedEvent);
            $.subscribe("_submit-survey-form", controller._logSubscribedEvent);
            $.subscribe("_clear-survey-form", controller._logSubscribedEvent);
            $.subscribe("_goto-next-todo-response-site", controller._logSubscribedEvent);
            $.subscribe("_finish-survey-form", controller._logSubscribedEvent);
            $.subscribe("_see-responses", controller._logSubscribedEvent);
            $.subscribe("_goto-next-response", controller._logSubscribedEvent);
            $.subscribe("_turn-off-responses", controller._logSubscribedEvent);

            $.subscribe("goto_location", controller._logSubscribedEvent);
            $.subscribe("signedIn-user", controller._logSubscribedEvent);
            $.subscribe("signedOut-user", controller._logSubscribedEvent);
            $.subscribe("show-noSurveys", controller._logSubscribedEvent);
            $.subscribe("show-newSurvey", controller._logSubscribedEvent);
            $.subscribe("survey-form-in-progress", controller._logSubscribedEvent);
            $.subscribe("survey-form-policy-not-satisfied", controller._logSubscribedEvent);
            $.subscribe("survey-form-policy-satisfied", controller._logSubscribedEvent);
            $.subscribe("survey-form-is-empty", controller._logSubscribedEvent);

            // Display help for app
            require(["app/message"], function (message) {
                $.subscribe("show-help", function () {
                    message.showMessage(controller._config.appParams.helpText,
                        controller._config.appParams.title);
                });
            });

            require(["app/survey", "app/survey_controller"], function(survey, survey_controller) {
                // Adjust config parameters as needed
                controller._config.appParams.readonly =
                    controller._toBoolean(controller._config.appParams.readonly,
                    !controller._config.featureSvcParams.canBeUpdated);
                controller._config.appParams.numResponseSites =
                    controller._toNumber(controller._config.appParams.numresponsesites, 2);

                // Prepare the survey
                controller._config.appParams._surveyDefinition = survey.createSurveyDefinition(
                    controller._config.featureSvcParams.popupDescription,
                    controller._config.featureSvcParams.fields,
                    controller._config.appParams.policy, i18n.tooltips.importantQuestion
                );
                controller._prependToLog("Survey definition created");

                controller._loadCSS("css/" + controller._config.appParams.appName + "_styles.css");

                // Prepare and start the survey controller
                survey_controller.init(controller._config, $("#sidebarContent")).then(function () {

                    $.subscribe("signedIn-user", function () {
                        survey_controller.launch();
                        $.publish("show-newSurvey");
                    });

                    controller._activateButton("_nav_clear", "Nav clear");
                    $.subscribe("_nav_clear", function () {
                        survey_controller.resetSurvey();
                    });

                    // Done with setup
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
            } else {
                $("#content").fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        },

        //----- Procedures meant for internal module use only --------------------------------------------------------//

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

        /** Normalizes a number value.
         * @param {number|string} numValue A number that is
         *        returned directly or a string that is
         *        attempted as a number; if neither a
         *        a number or a usable string, falls back to
         *        defaultValue
         * @param {boolean} [defaultValue] A number
         *        that is returned if numValue can't be
         *        used; if not defined, 0 is returned
         * @memberOf js.LGObject#
         */
        _toNumber: function (numValue, defaultValue) {
            // Shortcut number
            if (typeof numValue === "number") {
                return numValue;
            }

            // Handle a non-number
            numValue = parseFloat(numValue);
            if (!isNaN(numValue)) {
                return numValue;
            }

            // Fall back to default
            if (defaultValue === undefined) {
                return 0;
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
            var dataAsString = data ? JSON.stringify(data) : "";
            if (dataAsString.length > 50) {
                dataAsString = dataAsString.substr(0, 100) + "...";
            }
            controller._prependToLog(evt.type + " " + dataAsString);
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
