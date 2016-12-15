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
 * Manages sign-in and sign-out to a set of authentication providers.
 * @namespace user
 * @version 0.1
 */
define(["lib/i18n.min!nls/resources.js", "app/handleUserSignin", "app/diag"],
    function (i18n, handleUserSignin, diag) {
        "use strict";
        var user = {
            //----- Events -------------------------------------------------------------------------------------------//

            // Published
            /**
             * @typedef {object} UserInfoHash
             * @property {string} name - User name reported by provider
             * @property {string} id - User id reported by provider
             * @property {string} org - Social media name
             * @property {boolean} canSubmit - Indicates if user has submit privileges
             * @memberof user
             */
            /**
             * Provides information about the currently-signed-in user.
             * @event user#signedIn-user
             * @property {UserInfoHash} - User info
             */

            /**
             * Informs that a user has signed out.
             * @event user#signedOut-user
             */

            /**
             * Informs about the availability of an avatar image.
             * @event user#avatar-update
             */

            // Consumed

            //----- Module variables ---------------------------------------------------------------------------------//

            //----- Procedures available for external access ---------------------------------------------------------//

            launch: function (config, splash) {
                splash.replacePrompt(i18n.messages.signinFetching);

                // Start up the social media connections
                var userSigninReady = handleUserSignin.init(config.appParams, function (notificationType) {
                    // Callback from current social medium
                    switch (notificationType) {
                        case handleUserSignin.notificationSignIn:
                            $.publish("signedIn-user", handleUserSignin.getUser());
                            break;
                        case handleUserSignin.notificationSignOut:
                            $.publish("signedOut-user");
                            break;
                        case handleUserSignin.notificationAvatarUpdate:
                            $.publish("avatar-update", handleUserSignin.getUser().avatar);
                            break;
                    }
                });

                // When the social media connections are ready, we can enable the social-media sign-in buttons
                userSigninReady.then(function () {
                    // Add the sign-in buttons
                    handleUserSignin.initUI(splash.getActionsContainer());

                    // Switch to the sign-in prompt
                    splash.replacePrompt(i18n.prompts.signIn, splash.showActions);

                }, function () {
                    // Switch to the no-logins message
                    splash.replacePrompt(i18n.messages.noSigninsAvailable);
                });
            },

            signout: function () {
                handleUserSignin.signOut();
            }

            //----- Procedures meant for internal module use only ----------------------------------------------------//

            //--------------------------------------------------------------------------------------------------------//
        };
        return user;
    });
