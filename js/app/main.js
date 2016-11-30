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
define(["lib/i18n.min!nls/resources.js", "app/config", "app/splash", "app/diag"],
    function (i18n, config, splash, diag) {
        "use strict";
        var main = {
            //--------------------------------------------------------------------------------------------------------//

            init: function () {
                // Config tells us app specifics in addition to app's parameters
                config.init().then(
                    function () {
                        document.title = config.appParams.titleText;
                        if (config.appParams.diag !== undefined) {
                            diag.init();
                        }

                        // Show the splash and check if we meet proxy and minimum browser requirements;
                        // if OK, launch app
                        splash.init(config).then(
                            main._launch,
                            function () {
                                splash.replacePrompt(i18n.messages.unsupportedBrowser);
                            }
                        );
                    },
                    main._showMessageError
                );
            },

            //--------------------------------------------------------------------------------------------------------//

            _launch: function () {
                // Load the app specifics
                splash.replacePrompt(i18n.messages.loadingApp);
                config.loadController().then(
                    function (appController) {
                        var details, appReady, signinReady, appControllerName;

                        if (appController) {
                            signinReady = $.Deferred();

                            // Prepare app components
                            require(["app/user"], function (user) {
                                signinReady.resolve(user);
                            });

                            appReady = appController.init(config, $("body"));

                            // Wire up coordination between splash/signin and rest of app
                            $.subscribe("signedIn-user", function (ignore, loginInfo) {
                                diag.appendWithLF("signed in user: " + JSON.stringify(loginInfo)); //???
                                splash.show(false, appController.show, true);
                            });

                            $.subscribe("signedOut-user", function () {
                                diag.appendWithLF("signed out"); //???
                                appController.show(false, splash.show, true);
                            });

                            // Run app components
                            $.when(signinReady, appReady).then(
                                function (user) {
                                    $.subscribe("request-signOut", function (ignore, isFinished) {
                                        user.signout();
                                        if (isFinished) {
                                            splash.replacePrompt(config.appParams.finishText);
                                        }
                                    });

                                    appController.launch().then(
                                        function () {
                                            // Show sign-in
                                            user.launch(config, splash);
                                        },
                                        function (info) {
                                            splash.replacePrompt(info);
                                        }
                                    );
                                },
                                main._showSplashError
                            );
                        }
                        else {
                            appControllerName = "app/" + config.appParams.app + "_controller";
                            details = i18n.messages.notFound.replace("{item}", appControllerName);
                            main._showSplashError(details);
                        }
                    },
                    main._showSplashError
                );
            },

            _showMessageError: function (error) {
                require(["app/message"], function (message) {
                    message.showMessage(i18n.messages.unableToStartApp + "<br>" + main._getErrorDetails(error));
                });
            },

            _showSplashError: function (error) {
                splash.replacePrompt(i18n.messages.unableToStartApp + "<br>" + main._getErrorDetails(error));
            },

            _getErrorDetails: function (error) {
                var details = "";
                if (error) {
                    details = (error && error.statusText) || (error && error.message) ||
                        (typeof error === "string" && error) || "";
                }
                return details;
            }

            //--------------------------------------------------------------------------------------------------------//
        };
        main.init();
    });
