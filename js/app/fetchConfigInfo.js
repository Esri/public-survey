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
define(["lib/i18n.min!nls/resources.js"], function (i18n) {
    "use strict";
    var fetchConfigInfo;
    fetchConfigInfo = {
        //------------------------------------------------------------------------------------------------------------//

        /**
         * Extracts parameters from app's location URL.
         * @return {object} Parameters and values; a value is null if the parameter does not have a value assignment
         * in the URL
         */
        getParamsFromUrl: function () {
            var params = {},
                paramsString = window.location.search;
            if (paramsString.length > 0 && paramsString[0] === "?") {
                paramsString = paramsString.substring(1).split("&");
                $.map(paramsString, function (item) {
                    var paramParts = item.split("=");
                    params[paramParts[0].toLowerCase()] = paramParts[1] || null;
                });
            }
            return params;
        },

        /**
         * Extracts parameters from app's configuration file.
         * @param {string} filename Path to JSON configuration file, e.g., "js/configuration.json"
         * @param {object} [deferred] Deferred to use for fetch notification; if not supplied, function creates one
         * @return {object} Deferred indicating when parameters are ready; successful resolution includes object with
         * file's contents
         */
        getParamsFromConfigFile: function (filename, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            $.getJSON(filename, deferred.resolve).fail(deferred.reject);

            return deferred;
        },

        /**
         * Extracts parameters from webmap.
         * @param {string} arcgisUrl URL to arcgis items, e.g., "http://www.arcgis.com/sharing/content/items/"
         * @param {string} webmapId Id of webmap
         * @param {object} [paramsDeferred] Deferred to use for parameters fetch notification; if not supplied, function
         * creates one
         * @param {object} [origImageUrlDeferred] Deferred to use for original-size version of the webmap's thumbnail
         * fetch notification; if not supplied, function creates one
         * @return {object} Object with properties params and origImageUrl that contain the supplied (or created)
         * paramsDeferred and origImageUrlDeferred Deferreds, respectively, for when the app's configuration parameters
         * are ready to use and when the original-size version of the webmap's thumbnail has been checked and is ready
         * to use; successful resolution of 'params' includes object with title, splashText, helpText, contribLevels,
         * surveyorNameField, bestPhotoField; successful resolution of 'origImageUrl' contains the URL of the
         * original-size image.
         */
        getParamsFromWebmap: function (arcgisUrl, webmapId, paramsDeferred, origImageUrlDeferred) {
            var deferreds = {};
            deferreds.params = paramsDeferred || $.Deferred();
            deferreds.origImageUrl = origImageUrlDeferred || $.Deferred();

            if (fetchConfigInfo._isUsableString(webmapId)) {
                $.getJSON(arcgisUrl + webmapId + "?f=json", function (data) {
                    var normalizedData = {},
                        imageUrl, iExt, details;

                    if (!data || data.error) {
                        if (data.error) {
                            details = webmapId + "<br>" + data.error.message;
                        }
                        else {
                            details = i18n.messages.notFound.replace("{item}", webmapId);
                        }
                        deferreds.params.reject(details);
                        deferreds.origImageUrl.resolve();
                        return;
                    }

                    if (fetchConfigInfo._isUsableString(data.title)) {
                        normalizedData.titleText = data.title;
                    }
                    if (fetchConfigInfo._isUsableString(data.snippet)) {
                        normalizedData.splashText = data.snippet;
                    }
                    if (fetchConfigInfo._isUsableString(data.description)) {
                        normalizedData.helpText = data.description;
                    }
                    if (fetchConfigInfo._isUsableString(data.licenseInfo)) {
                        normalizedData.licenseInfo = data.licenseInfo;
                    }

                    deferreds.params.resolve(normalizedData);

                    // See if we can get an original-size image
                    imageUrl = data.thumbnail;
                    if (imageUrl) {
                        iExt = imageUrl.lastIndexOf(".");
                        if (iExt >= 0) {
                            imageUrl = imageUrl.substring(0, iExt) + "_orig" + imageUrl.substr(iExt);
                        }
                        else {
                            imageUrl = imageUrl + "_orig";
                        }
                        imageUrl = arcgisUrl + webmapId + "/info/" + imageUrl;

                        // Test that this URL is valid
                        fetchConfigInfo._testURL(imageUrl, function (isOK) {
                            deferreds.origImageUrl.resolve(isOK ?
                                imageUrl :
                                null);
                        });
                    }
                    else {
                        deferreds.origImageUrl.resolve();
                    }
                }).fail(function (error) {
                    error.message = webmapId + "<br>" + error.message;
                    deferreds.params.reject(error);
                });
            }
            else {
                deferreds.params.resolve({});
                deferreds.origImageUrl.resolve();
            }

            return deferreds;
        },

        /**
         * Gets operational layer and feature service information from parameters in webmap's data section.
         * @param {string} arcgisUrl URL to arcgis items, e.g., "http://www.arcgis.com/sharing/content/items/"
         * @param {string} webmapId Id of webmap
         * @param {string} [featureLayerTitle] Name of operational layer to use; if null, first layer is selected
         * @param {object} [deferred] Deferred to use for fetch notification; if not supplied, function
         * creates one
         * @return {object} Deferred indicating when service information is ready; successful resolution includes
         * object with opLayerParams and featureSvcParams
         */
        getWebmapData: function (arcgisUrl, webmapId, featureLayerTitle, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            if (fetchConfigInfo._isUsableString(webmapId)) {
                $.getJSON(arcgisUrl + webmapId + "/data?f=json", function (data) {
                    var featureSvcData = {},
                        iOpLayer = 0,
                        details;

                    if (data && data.operationalLayers && data.operationalLayers.length > 0) {
                        // If we have a feature layer title, find it in the operational layers; otherwise, use first
                        // operational layer
                        if (featureLayerTitle) {
                            iOpLayer = -1;
                            $.each(data.operationalLayers, function (i, opLayer) {
                                if (opLayer.title === featureLayerTitle) {
                                    iOpLayer = i;
                                    return false;
                                }
                                return true;
                            });
                        }
                        if (iOpLayer < 0) {
                            details = i18n.messages.notFound.replace("{item}", featureLayerTitle);
                            deferred.reject(details);
                            return;
                        }
                        else {
                            console.log("Survey responses will be written into layer \"" + featureLayerTitle + "\"");
                        }
                        featureSvcData.opLayerParams = data.operationalLayers[iOpLayer];

                        // Get the app's webmap's feature service's data
                        fetchConfigInfo.getFeatureSvcData(featureSvcData.opLayerParams.url).done(function (data) {
                            if (!data || data.error) {
                                deferred.reject(data && data.error);
                                return;
                            }
                            featureSvcData.featureSvcParams = data;

                            if (data.serviceItemId) {
                                $.getJSON(arcgisUrl + data.serviceItemId + "/data?f=json",
                                    function (serviceData) {
                                        featureSvcData.serviceData = serviceData;
                                        deferred.resolve(featureSvcData);
                                    }).fail(deferred.reject);
                            }
                            else {
                                deferred.resolve(featureSvcData);
                            }
                        }).fail(function (error) {
                            error.message = webmapId + "<br>" + error.message;
                            deferred.reject(error);
                        });
                    }
                    else {
                        deferred.resolve({});
                    }
                }).fail(function (error) {
                    error.message = webmapId + "<br>" + error.message;
                    deferred.reject(error);
                });
            }
            else {
                deferred.resolve({});
            }

            return deferred;
        },


        /**
         * Gets feature service information.
         * @param {string} featureSvcUrl URL to feature service
         * @param {object} [deferred] Deferred to use for fetch notification; if not supplied, function
         * creates one
         * @return {object} Deferred indicating when service information is ready; successful resolution includes
         * object with data from feature service's main section
         */
        getFeatureSvcData: function (featureSvcUrl, deferred) {
            if (!deferred) {
                deferred = $.Deferred();
            }

            if (fetchConfigInfo._isUsableString(featureSvcUrl)) {
                $.getJSON(featureSvcUrl + "?f=json", function (data) {
                    data.canBeUpdated = data.capabilities && data.capabilities.indexOf("Update") >= 0;
                    deferred.resolve(data);
                }).fail(deferred.reject);
            }
            else {
                deferred.resolve({});
            }

            return deferred;
        },

        //------------------------------------------------------------------------------------------------------------//

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
         * Makes a HEAD call to a URL to see if it is a valid URL.
         * @param {string} url URL to test
         * @param {function} callback Function to call upon response from test; function gets boolean parameter
         * indicating if the HEAD call succeeded or not
         * @private
         */
        _testURL: function (url, callback) {
            // Shield the call--a cross-domain call in IE9 sporadically breaks with "Access refused"
            try {
                $.ajax({
                    type: "HEAD",
                    url: url,
                    success: function () {
                        callback(true);
                    },
                    error: function () {
                        callback(false);
                    }
                });
            }
            catch (ignore) {
                callback(false);
            }
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return fetchConfigInfo;
});
