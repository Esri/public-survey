/** @license
 | Copyright 2016 Esri
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
 * Manages the display of a survey.
 * @namespace surveyController
 * @version 0.1
 */
define([
    "lib/i18n.min!nls/testScene_resources.js",
    "app/diag"
], function (
    i18n,
    diag
) {
    "use strict";
    var surveyController = {


        /**
         * Requests to go to a location with its collection of survey responses.
         * @event surveyController#cluster-clicked
         * @property {number} iSite - Zero-based slide number
         */

        /**
         * @typedef {object} CameraPosHash
         * @property {number} position -
         * @property {number} heading -
         * @property {number} tilt -
         * @memberof surveyController
         */
        /**
         * Requests to go to a location with its collection of survey responses.
         * @event surveyController#goto-camera-pos
         * @property {CameraPosHash} -
         */

        /**
         * @typedef {object} ClusterAttrsHash
         * @property {number} attributes -
         * @property {number} mapPoint -
         * @memberof surveyController
         */
        /**
         * Requests to go to a location with its collection of survey responses.
         * @event surveyController#goto-response-site
         * @property {ClusterAttrsHash} -
         */

        //------------------------------------------------------------------------------------------------------------//
    };
    return surveyController;
});

