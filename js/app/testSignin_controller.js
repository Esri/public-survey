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
 * Manages the display of a sign-in feature.
 * @namespace controller
 * @version 0.1
 */
define(["lib/i18n.min!nls/resources.js", "lib/testing_functions"],
    function (i18n, testing) {
        "use strict";
        var controller;
        controller = {
            //----- Events -------------------------------------------------------------------------------------------//

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
                        // Adjust config parameters as needed
                        config.appParams.allowGuestSubmissions =
                            testing.toBoolean(controller._config.appParams.cansubmit, true);

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
                testing.activateButton("request-signOut", i18n.labels.signOut);

                // Monitoring in test window
                $.subscribe("signedIn-user", testing.logSubscribedEvent);
                $.subscribe("signedOut-user", testing.logSubscribedEvent);

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
                return ["cansubmit"];
            }

            //----- Procedures meant for internal module use only ----------------------------------------------------//

            //--------------------------------------------------------------------------------------------------------//
        };
        return controller;
    });
