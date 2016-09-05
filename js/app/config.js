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
define(["app/fetchConfigInfo"],
    function (fetchConfigInfo) {
    "use strict";
    var config;
    config = {
        //------------------------------------------------------------------------------------------------------------//

        main_params: {
            // Parameters not in main_config.json
            diag: false,
            webmapOrigImageUrlReady: $.Deferred(),


            allowGuestSubmissions: true,
            proxyProgram: "proxy/proxy.ashx",
            splashBackgroundUrl: "images/splash.jpg",
            splashText: "Public survey is used to gather comments from various perspectives",
            title: "Public Survey",
            useWebmapOrigImg: false
        },

        //------------------------------------------------------------------------------------------------------------//

        /**
         * Initializes the module by fetching parameters from the URL, the configuration file, and the webmap.
         * @return {object} Object with object properties parametersReady, surveyFeatureLayerReady,
         * webmapOrigImageUrlReady that contain Deferreds for when the app's configuration parameters are ready to use,
         * when the survey's feature layer is ready to use, and when the original-size version of the webmap's
         * thumbnail has been checked and is ready to use, respectively.
         */
        init: function () {
            var parametersReady = $.Deferred();

            fetchConfigInfo.getParamsFromConfigFile("config/main_config.json").then(
                function (paramsFromFile) {
                    parametersReady.resolve();
                },
                function (error) {
                    parametersReady.reject(error);
                }
            );



            return parametersReady;
        },

        loadController: function () {
            var controllerReady = $.Deferred();

            config._loadCSS("css/content_styles.css");

            var appControllerName = "app/content";
            require([appControllerName], function (appController) {
                controllerReady.resolve(appController);
            });

            return controllerReady;
        },

        //------------------------------------------------------------------------------------------------------------//

        _loadCSS: function (url) {
            var stylesheet = document.createElement("link");
            stylesheet.href = url;
            stylesheet.rel = "stylesheet";
            stylesheet.type = "text/css";
            document.getElementsByTagName("head")[0].appendChild(stylesheet);
        },

        /**
         * Tests that an item is a string of length greater than zero.
         * @param {string} item Item to test
         * @return {boolean} True if the item is a string with length greater than zero
         * @private
         */
        _isUsableString: function (item) {
            return typeof item === "string" && item.length > 0;
        },

        /**
         * Copies and returns only specified properties of the supplied object.
         * @param {array} supportedProperties List of properties to return
         * @param {object} objectToFilter Source of property data
         * @return {object} Object composed of properties from the supportedProperties list
         * with values assigned from the objectToFilter object; supportedProperties not
         * found in objectToFilter are assigned 'null'
         * @private
         */
        _filterProperties: function (supportedProperties, objectToFilter) {
            var filteredObject = {};

            $.each(supportedProperties, function (ignore, param) {
                if (objectToFilter.hasOwnProperty(param)) {
                    filteredObject[param] = decodeURIComponent(objectToFilter[param]);
                }
            });
            return filteredObject;
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return config;
});
