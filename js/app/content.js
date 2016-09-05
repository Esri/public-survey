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
define([],
    function () {
    "use strict";
    var content;
    content = {
        //------------------------------------------------------------------------------------------------------------//

        //------------------------------------------------------------------------------------------------------------//

        init: function (config) {
            var contentReady = $.Deferred();

            contentReady.resolve();

            return contentReady;
        },

        launch: function () {
            var contentReady = $.Deferred();

            // Instantiate the splash template
            $("body").loadTemplate("js/app/content.html", {
            }, {
                prepend: true,
                complete: function () {
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
        }

        //------------------------------------------------------------------------------------------------------------//


        //------------------------------------------------------------------------------------------------------------//
    };
    return content;
});
