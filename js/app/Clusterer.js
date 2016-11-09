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
define([
    "dojo/_base/array",
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/Deferred",
    "esri/tasks/QueryTask",
    "esri/tasks/support/Query"
], function (
    array,
    declare,
    lang,
    Deferred,
    QueryTask,
    Query
) {
    return declare([], {

        _clusters: [],
        _maxClusterSize: 0,
        _clusterId: 0,

        /**
         * @param {Object} options Parameters for construction object
         * @constructor
         */
        constructor: function (options) {
            // options:
            //     url: String
            //         URL string. Will generate clusters based on point features returned from map service
            //     spatialReference: SpatialReference
            //         Spatial reference to use for comparing features
            //     tolerance: Number?
            //         The max number of map units between points to group points in the same cluster
            //         Default value is 10.
            //     useZ: Boolean?
            //         Indicates if the z coordinate should be used in the clustering; defaults to false

            if (!options.url || options.url.length === 0 || !options.spatialReference) {
                return;
            }

            this._spatialReference = options.spatialReference;
            this._tolerance = (options.hasOwnProperty("tolerance")) ? options.tolerance : 10;
            options.useZ = options.useZ || false;

            this._queryTask = new QueryTask({
                url: options.url
            });

            this._query = new Query({
                returnGeometry: true,
                returnZ: options.useZ,
                outFields: ["*"],
                where: "1=1",
                outSpatialReference: this._spatialReference
            });

            // Polyfill cube root function if needed
            // Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/cbrt
            Math.cbrt = Math.cbrt || function (x) {
                var y = Math.pow(Math.abs(x), 1 / 3);
                return x < 0 ? -y : y;
            };
        },

        /**
         * Gets the features and returns them in clusters.
         * @return {Deferred} Deferred that resolves to array of clusters or an error. Clusters contain its geometry
         * and an array of its features
         */
        getClusters: function () {
            var deferred = new Deferred();
            this._maxClusterSize = 0;

            // When resolved, returns features and graphics that satisfy the query.
            this._queryTask.execute(this._query).then(lang.hitch(this, function (results) {
                if (!results || !results.features) {
                    deferred.reject();
                }
                this._clusters = [];
                array.forEach(results.features, lang.hitch(this, function (feature) {
                    var wasAddedToCluster = array.some(this._clusters, lang.hitch(this, function (cluster) {
                        if (this._clusterProximityTest(cluster, feature)) {
                            this._addFeatureToCluster(cluster, feature);
                            if (this._maxClusterSize < cluster.features.length) {
                                this._maxClusterSize = cluster.features.length;
                            }
                            return true;
                        }
                        return false;
                    }));

                    // If feature didn't fit into any cluster, make it the nucleus of its own clusterCount
                    if (!wasAddedToCluster) {
                        this._clusters.push(this._createClusterFromFeature(feature));
                        if (this._maxClusterSize === 0) {
                            this._maxClusterSize = 1;
                        }
                    }

                }));
                deferred.resolve(this._clusters);

            }), function (err) {
                deferred.reject();
            });

            return deferred.promise;
        },

        /**
         * Returns the cluster with the specified id.
         * @param {Number} id Id to find
         * @return {Object|null} Matching cluster
         */
        getClusterById: function (id) {
            var desiredCluster;

            array.some(this._clusters, lang.hitch(this, function (cluster) {
                if (cluster.id === id) {
                    desiredCluster = cluster;
                    return true;
                }
                return false;
            }));

            return desiredCluster;
        },

        /**
         * Returns the count of the largest number of features in a cluster.
         * @return {Number} Largest cluster size
         */
        getMaxClusterSize: function () {
            return this._maxClusterSize;
        },

        //------------------------------------------------------------------------------------------------------------//

        /**
         * Tests a feature to see if it is within the tolerance distance from a cluster.
         * @param {Object} cluster The cluster to test
         * @param {Object} feature The feature to test
         * @return {Boolean} Whether or not feature is within tolerance radius; tolerance is defined in constructor;
         * distance is calculated in 3D if the feature has Z coordinates
         */
        _clusterProximityTest: function (cluster, feature) {
            var distance;

            if (feature.geometry.hasZ) {
                distance = Math.cbrt(
                    Math.pow((cluster.geometry.x - feature.geometry.x), 2) +
                    Math.pow((cluster.geometry.y - feature.geometry.y), 2) +
                    Math.pow((cluster.geometry.z - feature.geometry.z), 2)
                );
            }
            else {
                distance = Math.sqrt(
                    Math.pow((cluster.geometry.x - feature.geometry.x), 2) +
                    Math.pow((cluster.geometry.y - feature.geometry.y), 2)
                );
            }

            return (distance <= this._tolerance);
        },

        /**
         * Creates a new cluster using a seed feature.
         * @param {Object} feature Feature to add to cluster
         * @return {Object} Created cluster
         */
        _createClusterFromFeature: function (feature) {
            var newCluster = {
                id: this._clusterId++,
                geometry: feature.geometry,
                features: [feature]
            };
            return newCluster;
        },

        /**
         * Adds a feature to a cluster and updates the cluster's average score.
         * @param {Object} cluster Cluster to update
         * @param {Object} feature Feature to add to cluster
         * @return {Object} Updated cluster
         */
        _addFeatureToCluster: function (cluster, feature) {
            cluster.features.push(feature);
        }

    });
});
