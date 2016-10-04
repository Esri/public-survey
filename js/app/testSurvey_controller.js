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

         // Consumed
         // survey-form-in-progress
         // survey-form-is-empty
         // show-help

        //----- Module variables -------------------------------------------------------------------------------------//

        _logNum: 0,
        _config: {},
        _currentUser: {
            name: "",
            id: "",
            canSubmit: true
        },
        _iCurrentResponseSite: undefined,

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
         * @listens controller#show-help
         * @memberof controller
         */
        launch: function () {
            var controllerComponentsReady = $.Deferred();

            // Display help for app
            require(["app/message"], function (message) {
                $.subscribe("show-help", function () {
                    message.showMessage(controller._config.appParams.helpText,
                        controller._config.appParams.title);
                });
            });

            require(["app/survey", "app/survey_controller"], function(survey, survey_controller) {

                // ----- Testing -------------------------------------------------------------------------------------//
                var num, testButtonsContainer = $("#test_buttons");

                // Supplement config
                controller._config.appParams.headingFieldName = "heading";
                controller._config.appParams.tiltFieldName = "tilt";
                controller._config.appParams.rollFieldName = "roll";

                // Adjust config parameters as needed
                controller._config.appParams.readonly =
                    controller._toBoolean(controller._config.appParams.readonly, false);
                if (controller._config.appParams.showseeresponsesbutton) {
                    controller._config.appParams.showSeeResponsesButton = controller._config.appParams.showseeresponsesbutton;
                }
                if (controller._config.appParams.brandingicon) {
                    controller._config.appParams.brandingIcon = controller._config.appParams.brandingicon;
                }
                controller._config.appParams.numResponseSites =
                    controller._toNumber(controller._config.appParams.numresponsesites, 2);

                // Controls
                controller._activateButton("_nav_reset");
                $.subscribe("_nav_reset", function () {
                    $.publish("clear-survey-form");
                });
                controller._activateButton("_clear_curr_resp");
                $.subscribe("_clear_curr_resp", function () {
                    $.publish("update-current-responses-set", {"responses":[]});
                });

                if (controller._config.appParams.numResponseSites > 0) {
                    function assembleAtSiteButton(num) {
                        var siteNum = num < 0 ? undefined : num;
                        controller._createButton(testButtonsContainer, "_at_site_" + siteNum, "At site " + siteNum);
                        $.subscribe("_at_site_" + siteNum, function () {
                            $.publish("update-current-response-site", siteNum);
                            $("#_at_site_" + siteNum).addClass("highlight-btn").siblings().removeClass("highlight-btn");
                            controller._iCurrentResponseSite = siteNum;
                        });
                        if (siteNum === controller._iCurrentResponseSite) {
                            $("#_at_site_" + siteNum).addClass("highlight-btn");
                        }
                    }
                    for (num = -1; num < controller._config.appParams.numResponseSites; ++num) {
                        assembleAtSiteButton(num);
                    }
                }

                if (controller._config.featureSvcParams.test) {
                    $.each(controller._config.featureSvcParams.test, function (indexInArray, testCase) {
                        num = testCase.responses[0].num;
                        controller._createButton(testButtonsContainer,
                            "_current_responses_set_" + num, "Set " + num + " curr resp.");
                        $.subscribe("_current_responses_set_" + num, function () {
                            $.publish("update-current-responses-set", testCase);
                        });
                    });
                }

                // Monitoring pub/subs
                $.subscribe("goto-response-site", function (evt, siteNum) {
                    controller._logSubscribedEvent(evt, siteNum);
                    $.publish("update-current-response-site", siteNum);
                });
                $.subscribe("update-current-response-site", function (evt, siteNum) {
                    controller._logSubscribedEvent(evt, siteNum);
                    $("#_at_site_" + siteNum).addClass("highlight-btn").siblings().removeClass("highlight-btn");
                });
                $.subscribe("update-current-responses-set", controller._logSubscribedEvent);
                $.subscribe("request-signOut", controller._logSubscribedEvent);
                $.subscribe("submit-survey", controller._logSubscribedEvent);
                $.subscribe("completed-response-site", controller._logSubscribedEvent);
                $.subscribe("goto-camera-pos", controller._logSubscribedEvent);
                $.subscribe("signedIn-user", controller._logSubscribedEvent);
                $.subscribe("signedOut-user", controller._logSubscribedEvent);
                $.subscribe("survey-form-in-progress", controller._logSubscribedEvent);
                $.subscribe("survey-form-is-empty", controller._logSubscribedEvent);
                $.subscribe("survey-form-policy-not-satisfied", controller._logSubscribedEvent);
                $.subscribe("survey-form-policy-satisfied", controller._logSubscribedEvent);
                // -----------------------------------------------------------------------------------------------//

                // Prepare the survey
                controller._config.appParams._surveyDefinition = survey.createSurveyDefinition(
                    controller._config.featureSvcParams.popupDescription,
                    controller._config.featureSvcParams.fields,
                    controller._config.appParams.policy, i18n.tooltips.importantQuestion
                );
                controller._prependToLog("Survey definition created");

                // Prepare and start the survey controller
                controller._loadCSS("css/" + controller._config.appParams.appName + "_styles.css");

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

        _createButton: function (container, id, label, tooltip, data) {
            $(container).append("<button id='" + id + "' type='button' class='btn'></button>");
            controller._activateButton(id, label, tooltip, data);
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

            if (logEntry.length > 50) {
                logEntry = logEntry.substr(0, 100) + "...";
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
