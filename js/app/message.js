/*global define,$ */
/*jslint browser:true */
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
        var message = {
            //--------------------------------------------------------------------------------------------------------//

            _initialized: false,
            _messagePanelReady: $.Deferred(),

            //--------------------------------------------------------------------------------------------------------//

            showMessage: function (body, title) {
                if (message._initialized) {
                    message._showMessage(body, title);
                }
                else {
                    message._init().then(function () {
                        message._initialized = true;
                        message._showMessage(body, title);
                    });
                }
            },

            dismiss: function () {
                message._messagePanelReady.then(message._dismiss);
            },

            //--------------------------------------------------------------------------------------------------------//

            _showMessage: function (body, title) {
                $("#messageTitle")[0].innerHTML = title || "";
                $("#messageBody")[0].innerHTML = body;
                $("#messagePanel").modal("show");
            },

            _dismiss: function () {
                $("#messagePanel").modal("hide");
                $("#messageTitle")[0].innerHTML = "";
                $("#messageBody")[0].innerHTML = "";
            },

            _init: function () {
                // When the DOM is ready, we can start adjusting the UI
                $().ready(function () {
                    // Instantiate the message template
                    $("body").loadTemplate("js/app/message.html", {}, {
                        prepend: true,
                        complete: function () {
                            // i18n-ize content
                            $("#modalCloseBtn1")[0].title = i18n.tooltips.closeBtn;
                            $("#modalCloseBtn2")[0].title = i18n.tooltips.closeBtn;
                            $("#modalCloseBtn2")[0].innerHTML = i18n.labels.closeBtn;

                            message._messagePanelReady.resolve();
                        }
                    });
                });

                return message._messagePanelReady;
            }

            //--------------------------------------------------------------------------------------------------------//
        };
        return message;
    });
