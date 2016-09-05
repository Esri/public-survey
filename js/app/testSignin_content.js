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
define(["lib/i18n.min!nls/testSignin_resources.js"],
    function (i18n) {
    "use strict";
    var content;
    content = {
        //------------------------------------------------------------------------------------------------------------//

        _config: {},

        //------------------------------------------------------------------------------------------------------------//

        init: function (config) {
            var contentReady = $.Deferred();

            content._config = config;

            contentReady.resolve();

            return contentReady;
        },

        launch: function () {
            var contentReady = $.Deferred();

            // Instantiate the splash template
            $("body").loadTemplate("js/app/" + content._config.appParams.appName + "_content.html", {
            }, {
                prepend: true,
                complete: function () {

                    content._activateButton("request-signOut", i18n.labels.signOut, i18n.tooltips.signOut);

                    contentReady.resolve();
                }
            });

            return contentReady;
        },

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

        //------------------------------------------------------------------------------------------------------------//

        _activateButton: function (id, label, tooltip) {
            var btn = $("#" + id);
            btn.on("click", content._buttonPublish);

            btn = btn[0];
            if (label) {
                btn.innerHTML = label;
            }
            if (tooltip) {
                btn.title = tooltip;
            }

            return btn;
        },

        _buttonPublish: function (evt) {
            var btn = evt.currentTarget;
            btn.blur();  // Allow button to be defocused without clicking elsewhere
            $.publish(btn.id);
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return content;
});
