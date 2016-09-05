﻿/** @license
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
define(["lib/i18n.min!nls/main_resources.js", "app/diag"],
    function (i18n, diag) {
    "use strict";
    var user = {
        //------------------------------------------------------------------------------------------------------------//

        launch: function (config, splash) {
            $("<div id='guestSignin' class='splashInfoActionButton guestOfficialColor'><span class='socialMediaIcon main_sprites guest-user_29'></span>"
                + i18n.labels.guestName + "</div>").appendTo(splash.getActionsContainer());
            $("#guestSignin").on("click", function () {
                $.publish("signedIn-user", {
                    name: i18n.labels.guestName,
                    id: "",
                    canSubmit: config.appParams.allowGuestSubmissions
                });
            });
            splash.replacePrompt(i18n.prompts.signIn, splash.showActions);
        },

        signout: function () {
            $.publish("signedOut-user");
        },

        //------------------------------------------------------------------------------------------------------------//
    };
    return user;
});
