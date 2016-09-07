﻿/** @license
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
define(["lib/i18n.min!nls/testScene_resources.js"],
    function (i18n) {
    "use strict";
    var controller;
    controller = {
        //------------------------------------------------------------------------------------------------------------//

        _averagingFieldValues: null,
        _clusterer: null,
        _clustererView: null,
        _config: {},
        _featureLayerOptions: null,
        _logNum: 0,
        _multipleChoiceQuestions: null,
        _pieChartTheme: "GreySkies",
        _surveyInProgress: false,

        //------------------------------------------------------------------------------------------------------------//

        init: function (config) {
            var controllerReady = $.Deferred();
            controller._config = config;

            // Instantiate the splash template
            $("body").loadTemplate("js/app/" + controller._config.appParams.appName + "_controller.html", {
            }, {
                prepend: true,
                complete: function () {

                    // Testing support
                    controller._activateButton("request-signOut", i18n.labels.signOut, i18n.tooltips.signOut);
                    controller._activateButton("show-help", "Show help", i18n.tooltips.helpTip);
                    controller._activateButton("survey-form-in-progress", "Survey in progress");
                    controller._activateButton("survey-form-is-empty", "Survey is clear");
                    controller._activateButton("reset-survey", "Reset survey");

                    // When the feature service and survey are ready, we can set up the module that reads from and
                    // writes to the service
                    controller._config.featureSvcParams.surveyFeatureLayerReady.then(function () {
/*  //???
                        dataAccess.init(controller._config.featureSvcParams.url,
                            controller._config.featureSvcParams.id,
                            controller._config.appParams.proxyProgram);
*/
                        controllerReady.resolve();
                    }, function (error) {
                        if (error) {
                            console.log(JSON.stringify(error));
                        }
                        controllerReady.reject(i18n.messages.noMoreSurveys);
                    });
                }
            });

            return controllerReady;
        },

        launch: function () {
            var controllerComponentsReady = $.Deferred();

            // Monitor survey messages for coordination between visuals and survey
            $.subscribe("survey-form-in-progress", function () {
                controller._surveyInProgress = true;
                console.log("survey in progress: " + controller._surveyInProgress);
            });

            $.subscribe("survey-form-is-empty", function () {
                controller._surveyInProgress = false;
                console.log("survey in progress: " + controller._surveyInProgress);
            });

            // Display help for app
            require(["app/message"], function (message) {
                $.subscribe("show-help", function () {
                    message.showMessage(controller._config.appParams.helpText,
                        controller._config.appParams.title);
                });
            });

            $.subscribe("survey-form-in-progress", controller._logSubscribedEvent);
            $.subscribe("survey-form-is-empty", controller._logSubscribedEvent);
            $.subscribe("show-help", controller._logSubscribedEvent);
            $.subscribe("reset-survey", controller._logSubscribedEvent);
            $.subscribe("goto_location", controller._logSubscribedEvent);



            require(["app/survey", "app/visualsController3d"], function(survey, visualsController) {
                // Prepare the survey
                controller._config.appParams._surveyDefinition = survey.createSurvey(
                    controller._config.featureSvcParams.popupDescription,
                    controller._config.featureSvcParams.fields
                );
                controller._prependToLog("Survey definition created");



                controller._config.loadCSS("//js.arcgis.com/4.0/esri/css/main.css");
                controller._config.loadCSS("//js.arcgis.com/4.0/dijit/themes/claro/claro.css");
                controller._config.loadCSS("css/testScene_styles2.css");

                var visualsCtrlr = visualsController.init(controller._config, $("#mainContent"),
                    controller._clusterViewBuilder, controller._okToNavigate);




                controllerComponentsReady.resolve();
            });

            return controllerComponentsReady;
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
        },

        //------------------------------------------------------------------------------------------------------------//

        _logSubscribedEvent: function (evt, data) {
            var dataAsString = data ? JSON.stringify(data) : "";
            if (dataAsString.length > 50) {
                dataAsString = dataAsString.substr(0, 50) + "...";
            }
            controller._prependToLog(evt.type + " " + dataAsString);
        },

        _okToNavigate: function () {
            var ok = true;
            if (controller._surveyInProgress) {
                if (confirm(i18n.prompts.currentResponsesWillBeCleared)) {
                    controller._surveyInProgress = false;
                    $.publish("reset-survey");
                } else {
                    ok = false;
                }
            }
            return ok;
        },

        _activateButton: function (id, label, tooltip) {
            var btn = $("#" + id);
            btn.on("click", controller._buttonPublish);

            btn = btn[0];
            if (label) {
                btn.innerHTML = label;
            }
            if (tooltip) {
                btn.title = tooltip;
            }

            return btn;
        },

        _buttonPublish: function (evt) {
            var btn = evt.currentTarget;
            btn.blur();  // Allow button to be defocused without clicking elsewhere
            $.publish(btn.id);
        },

        // Note: does not work while controller page is not displayed
        _prependToLog: function (text) {
            $("#logText").prepend(++controller._logNum + ": " + text + "\n");
        },





        _clusterViewBuilder: function(view) {
            var clusterViewReady = $.Deferred();

            require([
                "dojo/_base/array",
                "dojo/_base/lang",
                "dojo/dom",
                "dojo/dom-class",
                "app/Clusterer",
                "app/ClustererView",
                "esri/Graphic",
                "esri/symbols/IconSymbol3DLayer",
                "esri/layers/support/LabelClass",
                "esri/symbols/LabelSymbol3D",
                "esri/symbols/PointSymbol3D",
                "esri/PopupTemplate",
                "esri/renderers/SimpleRenderer",
                "esri/symbols/TextSymbol3DLayer"
            ], function (
                    array,
                    lang,
                    dom,
                    domClass,
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
                controller._multipleChoiceQuestions = $.map(controller._config.appParams._surveyDefinition,
                    function (questionInfo) {
                        if (questionInfo.style === "button" ||
                            questionInfo.style === "list" ||
                            questionInfo.style === "dropdown") {

                            var answerDomain = questionInfo.domain.split("|");
                            var domainIndexLookup = {};
                            array.forEach(answerDomain, function (answer, i) {
                                domainIndexLookup[answer] = i;
                            });

                            if (questionInfo.field === controller._config.appParams.averagingFieldName) {
                                controller._averagingFieldValues = {};
                                array.forEach(answerDomain, function (answer, i) {
                                    controller._averagingFieldValues[answer] = i;
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
                        value: "{count}"  // Text for labels comes from 'count' field
                    },
                    sizeInfo: {
                        field: "count",
                        minDataValue: controller._config.appParams.featureCountSizeStops[0].value,
                        minSize: controller._config.appParams.featureCountSizeStops[0].size,
                        maxDataValue: controller._config.appParams.featureCountSizeStops[
                            controller._config.appParams.featureCountSizeStops.length - 1].value,
                        maxSize: controller._config.appParams.featureCountSizeStops[
                            controller._config.appParams.featureCountSizeStops.length - 1].size
                    },
                    labelPlacement: "center-center",
                    symbol: new LabelSymbol3D({
                        symbolLayers: [new TextSymbol3DLayer({
                            material: { color: "black" },
                            font: {  // autocast as esri/symbols/Font
                                family: "sans-serif",
                                weight: "bolder"
                            }
                        })]
                    }),
                    visualVariables: [{
                        type: "size",
                        field: "count",  // number of features in cluster
                        stops: controller._config.appParams.featureCountSizeStops
                    }]
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
                        field: "count",  // number of features in cluster
                        stops: controller._config.appParams.featureCountSizeStops
                    }, {
                        type: "color",
                        field: "average",  // average score of features in cluster
                        stops: controller._config.appParams.averagingColorStops
                    }]
                });

                // 2. Its popup template will create a pie chart for each question
                var clusterPopupTemplateDefn = {
                    // Title for whole popup
                    title: i18n.labels.multipleResponsesHere,

                    // Labels for pie chart tooltips
                    fieldInfos: [],  // Placeholder; we'll create one for each question below

                    // Popup content: a pie chart for each question
                    content: [{
                        type: "media",
                        mediaInfos: []  // Placeholder; we'll create one for each question below
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

                $.each(controller._multipleChoiceQuestions, function (iQuestion, mcQuestionInfo) {

                    var pieChartFields = [];

                    $.each(mcQuestionInfo.domain, function (iChoice, choiceText) {
                        // Create a fieldname for the field to hold the count for this answer choice for the question
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
                    var pieChart = {
                        title: mcQuestionInfo.question,
                        type: "pie-chart",
                        caption: "",
                        value: {
                            theme: controller._pieChartTheme,
                            fields: pieChartFields,
                            normalizeField: null
                        }
                    };
                    clusterPopupTemplateDefn.content[0].mediaInfos.push(pieChart);
                });

                var clusterPopupTemplate = new PopupTemplate(clusterPopupTemplateDefn);

                // 3. Finally, create FeatureLayer options structure using renderer and popup template
                controller._featureLayerOptions = {
                    fields: clusterLayerFields,
                    objectIdField: "ObjectID",
                    geometryType: "point",
                    spatialReference: {wkid: 4326},
                    //source: graphics,  // Filled in in ClustererView
                    popupTemplate: clusterPopupTemplate,
                    renderer: clusterRenderer,
                    outFields: ["*"]
                };

                // Create the clusterer for the survey layer data and its view
                controller._clusterer = new Clusterer({
                    url: controller._config.featureSvcParams.url,
                    spatialReference: view.spatialReference,
                    tolerance: 10,
                    useZ: true
                });

                var clustererViewOptions = {
                    view: view,
                    clusterer: controller._clusterer,
                    symbolConstructionCallback: lang.hitch(controller, _createSymbol)
                };

                clustererViewOptions.featureLayerOptions = controller._featureLayerOptions;
                clustererViewOptions.featureLayerLabelingInfo = labelClass;

                controller._clustererView = new ClustererView(clustererViewOptions);

                controller._clustererView.refresh().then(function () {
                    clusterViewReady.resolve({
                        clusterer: controller._clusterer,
                        clustererView: controller._clustererView
                    });
                });

                $.subscribe("refresh-clusters", controller._clustererView.refresh);

                //----------------------------------------------------------------------------------------------------//

                function _createSymbol (geometry, attributes, clusterSurveys) {
                    var size, backgroundColor, symComponent, numQuestions = controller._multipleChoiceQuestions.length,
                        i, j, numChoices, numScores = 0, scoreSum = 0, averageScore = Number.NaN;

                    for (i = 0; i < numQuestions; ++i) {
                        numChoices = controller._multipleChoiceQuestions[i].domain.length;
                        for (j = 0; j < numChoices; ++j) {
                            // Create a fieldname for the field that holds the count for this answer choice for the question
                            var questionChoiceCountField = "q" + i + "c" + j;

                            // Initialize the field for this question/choice
                            attributes[questionChoiceCountField] = 0;
                        }
                    }

                    // Populate the cluster symbol's question/choice fields
                    array.forEach(clusterSurveys, lang.hitch(controller, function (survey) {
                        $.each(survey.attributes, function (questionField, questionAnswer) {
                            if (questionAnswer !== null && typeof questionAnswer !== "object") {
                                $.each(controller._multipleChoiceQuestions, function (iQuestion, mcQuestionInfo) {
                                    if (questionField === mcQuestionInfo.field) {
                                        var iChoice = mcQuestionInfo.domainIndexLookup[questionAnswer];

                                        // Create a fieldname for the field that holds the count for this answer choice
                                        // for the question
                                        var questionChoiceCountField = "q" + iQuestion + "c" + iChoice;

                                        // Update the cluster count field
                                        attributes[questionChoiceCountField] += 1;

                                        // Responses display for smart symbol emulation popups
                                        if (mcQuestionInfo.responses.hasOwnProperty(questionAnswer)) {
                                            mcQuestionInfo.responses[questionAnswer] += 1;
                                        } else {
                                            mcQuestionInfo.responses[questionAnswer] = 1;
                                        }

                                        // Accumulate the average score of the clusterSurveys if this is the averaging field
                                        if (questionField === controller._config.appParams.averagingFieldName) {
                                            numScores += 1;
                                            scoreSum += iChoice;
                                        }

                                        return true;
                                    }
                                });
                            }
                        });
                    }));

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
        }


        //------------------------------------------------------------------------------------------------------------//
    };
    return controller;
});