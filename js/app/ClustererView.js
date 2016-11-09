/*global $ */
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
 * Manages the display of clustered feature layer.
 * @namespace ClustererView
 * @version 0.1
 */
define([
    "dojo/_base/array",
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/Deferred",
    "esri/layers/FeatureLayer",
    "esri/layers/GraphicsLayer"
], function (
    array,
    declare,
    lang,
    Deferred,
    FeatureLayer,
    GraphicsLayer
) {
    return declare([], {
        //----- Events -----------------------------------------------------------------------------------------------//

        // Published
        /**
         * @typedef {object} ClusterSelectionHash
         * @property {object} attributes -
         * @property {object} mapPoint -
         * @memberof ClustererView
         */
        /**
         * Provides information about selected cluster.
         * @event ClustererView#cluster-clicked
         * @property {ClusterSelectionHash} - Info about cluster
         */

        // Consumed

        //----- Module variables -------------------------------------------------------------------------------------//

        //----- Procedures available for external access -------------------------------------------------------------//

        constructor: function (options) {
            // options:
            //     view: View
            //        View in which the graphics will appear
            //     clusterer: Clusterer
            //        Companion object that provides graphics to display
            //     symbolConstructionCallback: function
            //        Function for creating symbol graphics
            //        Signature: function (geometry, attributes)
            //        attributes contains id of cluster
            //     featureLayerOptions?: options structure for a FeatureLayer minus its source;
            //        object adds layer to view's map
            //     featureLayerLabelingInfo?

            if (!options || !options.view || !options.clusterer) {
                return;
            }
            this._view = options.view;
            this._clusterer = options.clusterer;
            this._symbolConstructionCallback = options.symbolConstructionCallback;

            this._featureLayerOptions = options.featureLayerOptions;
            this._featureLayerLabelingInfo = options.featureLayerLabelingInfo;

            // Object manages its graphics layer in map
            if (!this._featureLayerOptions) {
                this._graphicsLayer = new GraphicsLayer();
                this._view.map.add(this._graphicsLayer);
            }

            // Search at click location and report if we find a cluster
            this._view.on("click", lang.hitch(this, function (evt) {
                if (evt.screenPoint != null) {
                    // Try a hit-test with the screen; the test will return 0 or 1 graphics
                    this._view.hitTest(evt.screenPoint).then(lang.hitch(this, function (hit) {
                        if (hit.results.length > 0 && hit.results[0].graphic != null) {

                            // Is the returned graphic in the desired layer?
                            var clusterSym = hit.results[0].graphic;
                            var gotClusterLayer =
                                (this._graphicsLayer && clusterSym.layer.id === this._graphicsLayer.id) ||
                                (this._featureLayer && clusterSym.layer.id === this._featureLayer.id);

                            if (gotClusterLayer) {
                                // Got a cluster
                                $.publish("cluster-clicked", {
                                    attributes: clusterSym.attributes,
                                    mapPoint: evt.mapPoint
                                });
                            }
                        }
                    }));
                }
            }));
        },

        /**
         * Replaces the cluster graphics with the set currently held by the affiliated Clusterer.
         */
        refresh: function () {
            var deferred = new Deferred();

            // Object manages its graphics layer in map. Because the API does not yet support adding and removing
            // features from a FeatureLayer, we have to replace it.
            if (this._graphicsLayer) {
                this._graphicsLayer.removeAll();
            }
            else if (this._featureLayer) {
                this._view.map.remove(this._featureLayer);
                this._featureLayer = null;
            }


            // Get the clusters and create a graphic for each
            var clusterGraphics = [];
            this._clusterer.getClusters().then(lang.hitch(this, function (clusterFeatures) {
                if (clusterFeatures.length > 0) {

                    // Alternate the features with their labels so that all of the labels are
                    // not on top of all of the features
                    array.forEach(clusterFeatures, lang.hitch(this, function (cluster) {
                        clusterGraphics.push(this._symbolConstructionCallback(cluster.geometry, {
                            id: cluster.id
                        }, cluster.features));
                    }));

                    if (this._graphicsLayer) {
                        this._graphicsLayer.addMany(clusterGraphics);
                    }
                    else {
                        // Create a FeatureLayer with the cluster points
                        this._featureLayerOptions.source = clusterGraphics;
                        this._featureLayer = new FeatureLayer(this._featureLayerOptions);
                        if (this._featureLayerLabelingInfo) {
                            this._featureLayer.labelsVisible = true;
                            this._featureLayer.labelingInfo = [this._featureLayerLabelingInfo];
                        }

                        this._view.map.add(this._featureLayer);
                    }

                    deferred.resolve();

                }
                else {
                    console.warn("No features found");
                    deferred.resolve();
                }

            }), function () {
                console.warn("No features returned");
                deferred.resolve();
            });

            return deferred;
        },

        /**
         * Returns the layer id of the graphics layer used by the object.
         * @return {String} layer id
         */
        layerId: function () {
            return this._featureLayer ? this._featureLayer.id : this._graphicsLayer ? this._graphicsLayer.id : null;
        }

        //----- Procedures meant for internal module use only --------------------------------------------------------//

        //------------------------------------------------------------------------------------------------------------//
    });
});
