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
define(["lib/i18n.min!nls/resources.js", "app/fetchConfigInfo"],
    function (i18n, fetchConfigInfo) {
        "use strict";
        var config;
        config = {
            //--------------------------------------------------------------------------------------------------------//

            appParams: {
                // Parameters not in *_config.json
                app: "",
                arcgisUrl: null,
                webId: null,
                webIdIsWebscene: null,
                webmapOrigImageUrlReady: $.Deferred()
            },
            featureSvcParams: {
                surveyFeatureLayerReady: $.Deferred()
            },

            //--------------------------------------------------------------------------------------------------------//

            /**
             * Initializes the module by fetching parameters from the URL, the configuration file, and the webmap.
             * @return {object} Object with object properties parametersReady, surveyFeatureLayerReady,
             * webmapOrigImageUrlReady that contain Deferreds for when the app's configuration parameters are
             * ready to use, when the survey's feature layer is ready to use, and when the original-size version
             * of the webmap's thumbnail has been checked and is ready to use, respectively.
             */
            init: function () {
                var paramsFromUrl, parametersReady = $.Deferred();

                // Get the config file parameters
                fetchConfigInfo.getParamsFromConfigFile("js/configuration.json").then(
                    function (paramsFromFile) {
                        var webmapParamsFetch = $.Deferred(),
                            webmapDataFetch = $.Deferred();

                        // Mix in params from configuration file and from URL after filtering the latter
                        // using filter from config file
                        paramsFromUrl = config._filterProperties(paramsFromFile.urlParamsFilter || [],
                            fetchConfigInfo.getParamsFromUrl());
                        config.appParams = $.extend(true,
                            config.appParams,
                            paramsFromFile,
                            paramsFromUrl
                        );

                        // Access to webmap and webscene is same
                        if (config._isUsableString(config.appParams.webmap)) {
                            config.appParams.webId = config.appParams.webmap;
                            config.appParams.webIdIsWebscene = false;
                        }
                        else if (config._isUsableString(config.appParams.webscene)) {
                            config.appParams.webId = config.appParams.webscene;
                            config.appParams.webIdIsWebscene = true;
                        }
                        else {
                            // Neither webmap nor webscene is provided; nothing more to init
                            parametersReady.resolve();
                            config.featureSvcParams.surveyFeatureLayerReady.reject();
                            config.appParams.webmapOrigImageUrlReady.reject();
                            return;
                        }

                        // Set up URL to portal items, allowing for case variations in URL param
                        config.appParams.arcgisUrl = config.appParams.portalurl + "/sharing/rest/content/items/";

                        // Fetch webmap or webscene
                        fetchConfigInfo.getParamsFromWebmap(config.appParams.arcgisUrl, config.appParams.webId,
                            webmapParamsFetch, config.appParams.webmapOrigImageUrlReady);
                        fetchConfigInfo.getWebmapData(config.appParams.arcgisUrl, config.appParams.webId,
                            config.appParams.survey, webmapDataFetch);

                        // Once we have the webmap, we can assemble the app parameters
                        webmapParamsFetch.done(function (paramsFromWebmap) {
                            // Mix in params from webmap (reapplying filtered URL params because they're more important)
                            config.appParams = $.extend(true,
                                config.appParams,
                                paramsFromWebmap,
                                paramsFromUrl
                            );

                            parametersReady.resolve();
                        }).fail(function (error) {
                            parametersReady.reject(error);
                        });

                        // Once we have the webmap's data, we can fetch the survey's feature layer
                        webmapDataFetch.done(function (data) {
                            var popupDesc,
                                opLayerParams = data.opLayerParams,
                                featureSvcParams = data.featureSvcParams,
                                serviceData = data.serviceData;

                            // Check the two places for the popup description, which contains the survey
                            if (opLayerParams && featureSvcParams) {
                                if (opLayerParams.popupInfo && opLayerParams.popupInfo.description) {
                                    popupDesc = opLayerParams.popupInfo.description;
                                }
                                else if (serviceData && serviceData.layers && serviceData.layers.length > 0) {
                                    popupDesc = serviceData.layers[0].popupInfo;
                                    if (popupDesc) {
                                        popupDesc = popupDesc.description;
                                    }
                                }
                            }

                            // If we have a popup description
                            if (popupDesc) {
                                config.featureSvcParams.title = opLayerParams.title;
                                config.featureSvcParams.url = opLayerParams.url;
                                config.featureSvcParams.id = opLayerParams.id;
                                config.featureSvcParams.objectIdField = featureSvcParams.objectIdField;
                                config.featureSvcParams.canBeUpdated = featureSvcParams.canBeUpdated;
                                config.featureSvcParams.popupDescription = popupDesc;
                                config.featureSvcParams.fields = featureSvcParams.fields;
                                config.featureSvcParams.spatialReference =
                                    featureSvcParams.spatialReference || featureSvcParams.extent.spatialReference;

                                config.featureSvcParams.surveyFeatureLayerReady.resolve();
                            }
                            else {
                                config.featureSvcParams.surveyFeatureLayerReady.reject(i18n.messages.unableToFindSurveyInPopup);
                            }
                        }).fail(function (error) {
                            config.featureSvcParams.surveyFeatureLayerReady.reject(error);
                        });
                    },
                    function (error) {
                        error.statusText = "js/configuration.json<br>" + error.statusText;
                        parametersReady.reject(error);
                    }
                );

                return parametersReady;
            },

            loadController: function () {
                var appControllerName, controllerReady = $.Deferred();

                appControllerName = "app/" + config.appParams.app + "_controller";
                require([appControllerName], function (appController) {
                    var additionalUrlParamsFilter = appController.getAdditionalUrlParamsFilter();

                    if (additionalUrlParamsFilter.length > 0) {
                        // Mix in additional params from URL after filtering the latter using filter from controller
                        config.appParams = $.extend(true,
                            config.appParams,
                            config._filterProperties(additionalUrlParamsFilter, fetchConfigInfo.getParamsFromUrl())
                        );
                    }

                    controllerReady.resolve(appController);
                }, controllerReady.reject);

                return controllerReady;
            },

            //--------------------------------------------------------------------------------------------------------//

            _toVariableName: function (text) {
                if (text) {
                    return text.replace(/[^\w]+/g, "");
                }
                return "";
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

            //--------------------------------------------------------------------------------------------------------//
        };
        return config;
    });
