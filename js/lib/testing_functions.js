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
 * @namespace testing
 * @version 0.1
 */
define([],
    function () {
        "use strict";
        var testing;
        testing = {
            //----- Events -------------------------------------------------------------------------------------------//

            // Published

            // Consumed

            //----- Module variables ---------------------------------------------------------------------------------//

            _logNum: 0,

            //----- Procedures available for external access ---------------------------------------------------------//

            /** Normalizes a boolean value to true or false.
             * @param {boolean|string} boolValue A true or false value that is returned directly or a string
             * "true", "t", "yes", "y", "false", "f", "no", "n" (case-insensitive) or a number (0 for false; non-zero
             * for true) that is interpreted and returned; if neither a boolean nor a usable string nor a number, falls
             * back to defaultValue
             * @param {boolean} [defaultValue] A true or false that is returned if boolValue can't be used; if not
             * defined, true is returned
             * @private
             */
            toBoolean: function (boolValue, defaultValue) {
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
                    if (lowercaseValue === "true" || lowercaseValue === "t" || lowercaseValue === "yes" ||
                        lowercaseValue === "y" || lowercaseValue === "1") {
                        return true;
                    }
                    if (lowercaseValue === "false" || lowercaseValue === "f" || lowercaseValue === "no" ||
                        lowercaseValue === "n" || lowercaseValue === "0") {
                        return false;
                    }
                }
                else if (typeof boolValue === "number") {
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
            toNumber: function (numValue, defaultValue) {
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

            createButton: function (container, id, label, tooltip, data) {
                $(container).append("<button id='" + id + "' type='button' class='btn'></button>");
                testing.activateButton(id, label, tooltip, data);
            },

            /**
             * Completes text setup of a button and sets its click event to publish the id of the button.
             * @param {string} id - Id of button to modify
             * @param {?string} label - Text to display in button display
             * @param {?string} tooltip - Text to display in button tooltip
             * @param {?object} data - Data to pass to event handler
             * @memberof testing
             * @private
             */
            activateButton: function (id, label, tooltip, data) {
                var btn = $("#" + id);
                btn.on("click", data, testing._buttonPublish);

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
             * Logs an event.
             * @param {object} evt - Event to log
             * @param {?object} data - Data to add to log; trimmed to 253 characters for onscreen display; full
             * content written to console
             * @memberof testing
             * @private
             */
            logSubscribedEvent: function (evt, data) {
                var logEntry, dataAsString = data !== undefined ? JSON.stringify(data) : "";
                logEntry = ((evt && evt.type) || evt || "") + " " + dataAsString;
                console.log(logEntry);

                if (logEntry.length > 256) {
                    logEntry = logEntry.substr(0, 253) + "...";
                }
                testing.prependToLog(logEntry);
            },

            /**
             * Prepends sequence number and supplied text to #logText item.
             * <br>
             * Note: does not work while controller page is not displayed
             * @param {string} text - Text to prepend
             * @memberof testing
             * @private
             */
            prependToLog: function (text) {
                $("#logText").prepend(++testing._logNum + ": " + text + "\n");
            },

            //----- Procedures meant for internal module use only ----------------------------------------------------//

            /**
             * Click event function to publish the id of the target.
             * @param {object} evt - Click event
             * @memberof testing
             * @private
             */
            _buttonPublish: function (evt) {
                var btn = evt.currentTarget;
                btn.blur(); // Allow button to be defocused without clicking elsewhere
                $.publish(btn.id, evt.data);
            }

            //--------------------------------------------------------------------------------------------------------//
        };
        return testing;
    });
