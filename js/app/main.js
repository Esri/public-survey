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
define(["lib/i18n.min!nls/resources.js"],
    function (i18n) {
    "use strict";
    var main = {
        //------------------------------------------------------------------------------------------------------------//

        init: function () {


            main._launch();

        },

        //------------------------------------------------------------------------------------------------------------//

        _launch: function () {
            $("body")[0].innerHTML = i18n.labels.ready;
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    main.init();
});
