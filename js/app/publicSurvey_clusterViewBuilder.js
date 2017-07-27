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

/**
 * Manages the display of a survey form.
 * @namespace testing
 * @version 0.1
 */
define(["lib/i18n.min!nls/resources.js"],
    function (i18n) {
        "use strict";
        var clusterViewBuilder;
        clusterViewBuilder = {
            //----- Events -------------------------------------------------------------------------------------------//

            // Published

            // Consumed

            //----- Module variables ---------------------------------------------------------------------------------//

            _config: {},
            _averagingFieldValues: null,
            _clusterer: null,
            _clustererView: null,
            _featureLayerOptions: null,
            _multipleChoiceQuestions: null,

            //----- Procedures available for external access ---------------------------------------------------------//

            builder: function (view, config) {
                var clusterViewReady = $.Deferred();
                clusterViewBuilder._config = config;

                require([
                    "dojo/_base/array",
                    "dojo/_base/lang",
                    "dojo/dom",
                    "dojo/dom-class",
                    "dojox/charting/SimpleTheme",
                    "app/Clusterer",
                    "app/ClustererView",
                    "esri/Graphic",
                    "esri/symbols/IconSymbol3DLayer",
                    "esri/layers/support/LabelClass",
                    "esri/symbols/LabelSymbol3D",
                    "esri/symbols/PointSymbol3D",
                    "esri/PopupTemplate",
                    "esri/renderers/SimpleRenderer",
                    "esri/symbols/TextSymbol3DLayer",
                    "lib/popupLabelsThemes_4.2_min"
                ], function (
                    array,
                    lang,
                    dom,
                    domClass,
                    Theme,
                    Clusterer,
                    ClustererView,
                    Graphic,
                    IconSymbol3DLayer,
                    LabelClass,
                    LabelSymbol3D,
                    PointSymbol3D,
                    PopupTemplate,
                    SimpleRenderer,
                    TextSymbol3DLayer
                ) {

                    // Extract the multiple-choice questions from the survey for displaying
                    // in cluster popups
                    clusterViewBuilder._multipleChoiceQuestions = $.map(clusterViewBuilder._config.appParams._surveyDefinition,
                        function (questionInfo) {
                            if (questionInfo.style === "button" ||
                                questionInfo.style === "list" ||
                                questionInfo.style === "dropdown") {

                                var answerDomain = questionInfo.domain.split("|");
                                var domainIndexLookup = {};
                                array.forEach(answerDomain, function (answer, i) {
                                    domainIndexLookup[answer] = i;
                                });

                                if (questionInfo.field ===
                                    clusterViewBuilder._config.appParams.clusterSymDisplay.averagingFieldName) {
                                    clusterViewBuilder._averagingFieldValues = {};
                                    array.forEach(answerDomain, function (answer, i) {
                                        clusterViewBuilder._averagingFieldValues[answer] = i;
                                    });
                                }

                                return {
                                    question: questionInfo.question,
                                    field: questionInfo.field,
                                    domain: answerDomain,
                                    domainIndexLookup: domainIndexLookup,
                                    responses: {}
                                };
                            }
                        });

                    // Create a feature layer to hold the clusters
                    // 1. Its renderer will use the count of features and the average feature score
                    var labelClass, clusterRenderer;

                    labelClass = new LabelClass({
                        labelExpressionInfo: {
                            value: "{count}" // Text for labels comes from 'count' field
                        },
                        labelPlacement: "center-center",
                        symbol: new LabelSymbol3D({
                            symbolLayers: [new TextSymbol3DLayer({
                                material: {
                                    color: "black"
                                },
                                font: { // autocast as esri/symbols/Font
                                    family: "sans-serif",
                                    weight: "bolder"
                                }
                            })]
                        })
                    });

                    clusterRenderer = new SimpleRenderer({
                        symbol: new PointSymbol3D({
                            symbolLayers: [
                                new IconSymbol3DLayer({
                                    resource: {
                                        href: "images/cluster.png"
                                    },
                                    outline: {
                                        color: "black",
                                        size: "0px"
                                    }
                                })
                            ]
                        }),
                        visualVariables: [{
                            type: "size",
                            field: "count", // number of features in cluster
                            stops: clusterViewBuilder._config.appParams.clusterSymDisplay.featureCountSizeStops
                        }, {
                            type: "color",
                            field: "average", // average score of features in cluster
                            stops: clusterViewBuilder._config.appParams.clusterSymDisplay.averagingColorStops
                        }]
                    });

                    // 2. Its popup template will create a pie chart for each question
                    var clusterPopupTemplateDefn = {
                        // Title for whole popup
                        title: i18n.labels.multipleResponsesHere,

                        // Labels for pie chart tooltips
                        fieldInfos: [], // Placeholder; we'll create one for each question below

                        // Popup content: a pie chart for each question
                        content: [{
                            type: "media",
                            mediaInfos: [] // Placeholder; we'll create one for each question below
                        }]
                    };

                    var clusterLayerFields = [{
                        name: "ObjectID",
                        type: "oid"
                    }, {
                        name: "id",
                        type: "integer"
                    }, {
                        name: "count",
                        type: "integer"
                    }, {
                        name: "average",
                        type: "double"
                    }];

                    $.each(clusterViewBuilder._multipleChoiceQuestions, function (iQuestion, mcQuestionInfo) {

                        var pieChartFields = [];

                        $.each(mcQuestionInfo.domain, function (iChoice, choiceText) {
                            // Create a fieldname for the field to hold the count for this answer choice
                            // for the question
                            var questionChoiceCountField = "q" + iQuestion + "c" + iChoice;

                            // Define the feature layer field for the question/choice count and add it to the
                            // feature layer's fields list
                            var clusterLayerQuestionField = {
                                name: questionChoiceCountField,
                                type: "integer"
                            };
                            clusterLayerFields.push(clusterLayerQuestionField);

                            // Add question/choice count field's name to this question's pie chart
                            pieChartFields.push(questionChoiceCountField);

                            // Define the tooltip for the question/choice count and add it to this question's pie chart
                            var pieChartTooltip = {
                                fieldName: questionChoiceCountField,
                                label: choiceText
                            };
                            clusterPopupTemplateDefn.fieldInfos.push(pieChartTooltip);
                        });

                        // Define this question's pie chart and add it to the popup template
                        var theme = clusterViewBuilder._config.appParams.pieChartColors[mcQuestionInfo.field];
                        if (!theme) {
                            theme = "GreySkies";
                        }
                        if (Array.isArray(theme)) {
                            theme = new Theme({
                                colors: theme
                            });
                        }

                        var pieChart = {
                            title: mcQuestionInfo.question,
                            type: "pie-chart",
                            caption: "",
                            chartOptions: {
                                showLabels: true,
                                labelOffset: 50,
                                useTooltipAsLabel: true
                            },
                            value: {
                                theme: theme,
                                fields: pieChartFields,
                                normalizeField: null
                            }
                        };
                        clusterPopupTemplateDefn.content[0].mediaInfos.push(pieChart);
                    });

                    var clusterPopupTemplate = new PopupTemplate(clusterPopupTemplateDefn);

                    // 3. Finally, create FeatureLayer options structure using renderer and popup template
                    clusterViewBuilder._featureLayerOptions = {
                        fields: clusterLayerFields,
                        objectIdField: "ObjectID",
                        geometryType: "point",
                        spatialReference: {
                            wkid: 4326
                        },
                        //source: graphics,  // Filled in in ClustererView
                        popupTemplate: clusterPopupTemplate,
                        renderer: clusterRenderer,
                        outFields: ["*"]
                    };

                    // Create the clusterer for the survey layer data and its view
                    clusterViewBuilder._clusterer = new Clusterer({
                        url: clusterViewBuilder._config.featureSvcParams.url,
                        spatialReference: view.spatialReference,
                        tolerance: 10,
                        useZ: true
                    });

                    var clustererViewOptions = {
                        view: view,
                        clusterer: clusterViewBuilder._clusterer,
                        symbolConstructionCallback: lang.hitch(clusterViewBuilder, _createSymbol)
                    };

                    clustererViewOptions.featureLayerOptions = clusterViewBuilder._featureLayerOptions;
                    clustererViewOptions.featureLayerLabelingInfo = labelClass;

                    clusterViewBuilder._clustererView = new ClustererView(clustererViewOptions);

                    clusterViewBuilder._clustererView.refresh().then(function () {
                        clusterViewReady.resolve({
                            clusterer: clusterViewBuilder._clusterer,
                            clustererView: clusterViewBuilder._clustererView
                        });
                    });

                    $.subscribe("refresh-clusters", clusterViewBuilder._clustererView.refresh);

                    //------------------------------------------------------------------------------------------------//

                    function _createSymbol(geometry, attributes, clusterSurveys) {
                        var symComponent, numQuestions = clusterViewBuilder._multipleChoiceQuestions.length,
                            i, j, numChoices, numScores = 0,
                            scoreSum = 0,
                            averageScore = Number.NaN;

                        for (i = 0; i < numQuestions; ++i) {
                            numChoices = clusterViewBuilder._multipleChoiceQuestions[i].domain.length;
                            for (j = 0; j < numChoices; ++j) {
                                // Create a fieldname for the field that holds the count for this answer choice
                                // for the question
                                var questionChoiceCountField = "q" + i + "c" + j;

                                // Initialize the field for this question/choice
                                attributes[questionChoiceCountField] = 0;
                            }
                        }

                        // Populate the cluster symbol's question/choice fields
                        array.forEach(clusterSurveys, function (survey) {
                            $.each(survey.attributes, function (questionField, questionAnswer) {
                                if (questionAnswer !== null && typeof questionAnswer !== "object") {
                                    $.each(clusterViewBuilder._multipleChoiceQuestions, function (iQuestion, mcQuestionInfo) {
                                        if (questionField === mcQuestionInfo.field) {
                                            var iChoice = mcQuestionInfo.domainIndexLookup[questionAnswer];

                                            // Create a fieldname for the field that holds the count
                                            // for this answer choice for the question
                                            var questionChoiceCountField = "q" + iQuestion + "c" + iChoice;

                                            // Update the cluster count field
                                            attributes[questionChoiceCountField] += 1;

                                            // Responses display for smart symbol emulation popups
                                            if (mcQuestionInfo.responses.hasOwnProperty(questionAnswer)) {
                                                mcQuestionInfo.responses[questionAnswer] += 1;
                                            }
                                            else {
                                                mcQuestionInfo.responses[questionAnswer] = 1;
                                            }

                                            // Accumulate the average score of the clusterSurveys
                                            // if this is the averaging field
                                            if (questionField ===
                                                clusterViewBuilder._config.appParams.clusterSymDisplay.averagingFieldName) {
                                                numScores += 1;
                                                scoreSum += iChoice;
                                            }

                                            return true;
                                        }
                                    });
                                }
                            });
                        });

                        if (numScores > 0) {
                            averageScore = scoreSum / numScores;
                        }
                        attributes.average = averageScore;
                        attributes.count = clusterSurveys.length;

                        // Create symbol
                        symComponent = new Graphic({
                            geometry: geometry,
                            attributes: attributes
                        });

                        return symComponent;
                    }

                });

                return clusterViewReady;
            },

            refresh: function () {
                if (clusterViewBuilder._clustererView) {
                    clusterViewBuilder._clustererView.refresh();
                }
            }

            //----- Procedures meant for internal module use only ----------------------------------------------------//

            //--------------------------------------------------------------------------------------------------------//
        };
        return clusterViewBuilder;
    });
