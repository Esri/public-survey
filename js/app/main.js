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
define(["lib/i18n.min!nls/main_resources.js", "app/config", "app/splash", "app/diag"],
    function (i18n, config, splash, diag) {
    "use strict";
    var main = {
        //------------------------------------------------------------------------------------------------------------//

        init: function () {
            // Config tells us app specifics in addition to app's parameters
            config.init().then(
                function () {
                    document.title = config.main_params.title;
                    if (config.main_params.diag !== undefined) {
                        diag.init();
                    }

                    // Show the splash and check if we meet proxy and minimum browser requirements; if OK, launch app
                    splash.init(config).then(
                        main._launch,
                        function (error) {
                            // If unsupported browser or proxy problem, tell the user and proceed no further
                            if (error === "Unsupported browser") {
                                splash.replacePrompt(i18n.messages.unsupportedBrowser);
                            } else {
                                splash.replacePrompt(i18n.messages.needProxy);
                            }
                        }
                    );
                }
            );
        },

        //------------------------------------------------------------------------------------------------------------//

        _launch: function (fred) {
            // Load the app specifics
            splash.replacePrompt(i18n.messages.loadingApp);
            config.loadController().then(
                function (appController) {
                    if (appController) {
                        var appReady, signinReady = $.Deferred();

                        appReady = appController.init(config);
                        require(["app/user_guest"], function (user) {
                            signinReady.resolve(user);
                        });

                        $.when(signinReady, appReady).then(
                            function (user) {
/*
                                require(["app/message"], function (message) {
                                    message.init().then(
                                        function () {
                                            $.subscribe("show-help", function () {
                                                message.showMessage(appController._prepareAppConfigInfo.appParams.helpText,
                                                    appController._prepareAppConfigInfo.appParams.title);
                                            });
                                        }
                                    );
                                });
*/

                                // Wire up coordination between splash/signin and rest of app
                                $.subscribe("signedIn:user", function (ignore, loginInfo) {
                                    diag.appendWithLF("signed in user: " + JSON.stringify(loginInfo));  //???
                                    console.log();
                                    splash.show(false, appController.show, true);
                                });

                                $.subscribe("request:signOut", function () {
                                    user.signout();
                                });

                                $.subscribe("signedOut:user", function () {
                                    diag.appendWithLF("signed out");  //???
                                    appController.show(false, splash.show, true);
                                });

                                // Able to run app; continue appController initialization
                                appController.launch().then(
                                    function () {
                                        // Show sign-in
                                        user.launch(config, splash);
                                    }
                                );
                            },
                            function () {
                                splash.replacePrompt(i18n.messages.unableToStartApp);
                            }
                        );
                    } else {
                        splash.replacePrompt(i18n.messages.unableToStartApp);
                    }
                }
            );
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    main.init();
});
