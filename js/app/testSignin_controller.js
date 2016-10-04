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
 * Manages the display of a sign-in feature.
 * @namespace controller
 * @version 0.1
 */
define(["lib/i18n.min!nls/testSignin_resources.js"],
    function (i18n) {
    "use strict";
    var controller;
    controller = {
        //----- Events -----------------------------------------------------------------------------------------------//

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
                    // Adjust config parameters as needed
                    config.appParams.allowGuestSubmissions =
                        controller._toBoolean(controller._config.appParams.cansubmit, true);

                    controllerReady.resolve();
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
            controller._activateButton("request-signOut", i18n.labels.signOut, i18n.tooltips.signOut);

            // Monitoring in test window
            $.subscribe("signedIn-user", controller._logSubscribedEvent);
            $.subscribe("signedOut-user", controller._logSubscribedEvent);

            controller._loadCSS("css/" + controller._config.appParams.appName + "_styles.css");

            controllerComponentsReady.resolve();

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

            if (logEntry.length > 100) {
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
