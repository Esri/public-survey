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
 * Manages the display of a survey controller.
 * @namespace controller
 * @version 0.1
 */
define(["lib/i18n.min!nls/testScene_resources.js"],
    function (i18n) {
        "use strict";
        var controller;
        controller = {
            //----- Events -----------------------------------------------------------------------------------------------//

            // Published

            // Consumed
            // survey-form-in-progress
            // survey-form-is-empty
            // show-help

            //----- Module variables -------------------------------------------------------------------------------------//

            _logNum: 0,
            _config: {},
            _averagingFieldValues: null,
            _clusterer: null,
            _clustererView: null,
            _featureLayerOptions: null,
            _multipleChoiceQuestions: null,
            _pieChartTheme: "GreySkies",
            _surveyInProgress: false,


            //----- Procedures available for external access -------------------------------------------------------------//

            /**
             * Initializes the controller.
             * @param {object} config - App config info
             * @memberof controller
             */
            init: function (config, container) {
                var controllerReady = $.Deferred();
                controller._config = config;

                // Instantiate the splash template
                container.loadTemplate("js/app/" + controller._config.appParams.appName + "_controller.html", {
                    // Template parameters
                }, {
                    // Template options
                    prepend: true,
                    complete: function () {

                        // When the feature service and survey are ready, we can set up the module that reads from and
                        // writes to the service
                        controller._config.featureSvcParams.surveyFeatureLayerReady.then(function () {
                            controllerReady.resolve();
                        }, function () {
                            // As a backup, attempt to load the survey form description
                            if (controller._config.appParams.surveydesc) {
                                $.getJSON(controller._config.appParams.surveydesc + ".json",
                                    function (surveyDesc) {
                                        controller._config.featureSvcParams.canBeUpdated = surveyDesc.canBeUpdated;
                                        controller._config.featureSvcParams.popupDescription = surveyDesc.description;
                                        controller._config.featureSvcParams.fields = surveyDesc.fields;
                                        controller._config.featureSvcParams.test = surveyDesc.test;
                                        controllerReady.resolve();
                                    }
                                ).fail(
                                    function (error) {
                                        if (error) {
                                            console.log(JSON.stringify(error));
                                        }
                                        controllerReady.reject(i18n.messages.unableToStartApp);
                                    }
                                );
                            }
                        });
                    }
                });

                return controllerReady;
            },

            /**
             * Launches the controller.
             * @listens controller#show-help
             * @memberof controller
             */
            launch: function () {
                var controllerComponentsReady = $.Deferred();

                // Display help for app
                require(["app/message"], function (message) {
                    $.subscribe("show-help", function () {
                        message.showMessage(controller._config.appParams.helpText,
                            controller._config.appParams.titleText);
                    });
                });

                require(["app/survey", "app/scene_controller"], function (survey, scene_controller) {

                    // ----- Testing -------------------------------------------------------------------------------------//

                    // Supplement config

                    // Adjust config parameters as needed
                    controller._config.appParams.surveyNotificationPolicy =
                        controller._config.appParams.policy || controller._config.appParams.surveyNotificationPolicy;

                    // Controls
                    controller._activateButton("_survey_form_in_progress", "Fill in survey");
                    $.subscribe("_survey_form_in_progress", function () {
                        controller._surveyInProgress = true;
                        console.log("survey in progress: " + controller._surveyInProgress);
                    });

                    controller._activateButton("_survey_form_is_empty", "Clear survey");
                    $.subscribe("_survey_form_is_empty", function () {
                        controller._surveyInProgress = false;
                        console.log("survey in progress: " + controller._surveyInProgress);
                    });

                    controller._activateButton("request-signOut", i18n.labels.signOut);
                    controller._activateButton("show-help", "Show help", i18n.tooltips.helpTip);

                    // Monitoring pub/subs
                    $.subscribe("signedIn-user", controller._logSubscribedEvent);
                    $.subscribe("request-signOut", controller._logSubscribedEvent);
                    $.subscribe("signedOut-user", controller._logSubscribedEvent);
                    $.subscribe("goto-response-site", controller._logSubscribedEvent);
                    $.subscribe("update-current-response-site", controller._logSubscribedEvent);
                    $.subscribe("update-current-responses-set", controller._logSubscribedEvent);
                    $.subscribe("clear-survey-form", controller._logSubscribedEvent);

                    // -----------------------------------------------------------------------------------------------//

                    // Prepare the survey
                    controller._config.appParams._surveyDefinition = survey.createSurveyDefinition(
                        controller._config.featureSvcParams.popupDescription,
                        controller._config.featureSvcParams.fields,
                        controller._config.appParams.surveyNotificationPolicy, i18n.tooltips.importantQuestion
                    );
                    controller._prependToLog("Survey definition created");
                    controller._logSubscribedEvent("Survey question policy:",
                        controller._config.appParams.surveyNotificationPolicy);

                    // Prepare and start the scene controller
                    controller._loadCSS("//js.arcgis.com/4.0/esri/css/main.css");
                    controller._loadCSS("//js.arcgis.com/4.0/dijit/themes/claro/claro.css");
                    controller._loadCSS("css/" + controller._config.appParams.appName + "_styles.css");

                    scene_controller.init(controller._config, "mainContent",
                            controller._clusterViewBuilder, controller._okToNavigate)
                        .then(controllerComponentsReady.resolve);
                });

                return controllerComponentsReady;
            },

            /**
             * Shows or hides the DOM container managed by the controller.
             * @param {boolean} makeVisible - Visibility to set for container
             * @param {?function} thenDo - Function to execute after show/hide animation completes
             * @param {?object} thenDoArg - Argument for thenDo function
             * @memberof controller
             */
            show: function (makeVisible, thenDo, thenDoArg) {
                if (makeVisible) {
                    $("#content").fadeIn("fast", function () {
                        thenDo && thenDo(thenDoArg);
                    });
                }
                else {
                    $("#content").fadeOut("fast", function () {
                        thenDo && thenDo(thenDoArg);
                    });
                }
            },

            //----- Procedures meant for internal module use only --------------------------------------------------------//

            _loadCSS: function (url) {
                var stylesheet = document.createElement("link");
                stylesheet.href = url;
                stylesheet.rel = "stylesheet";
                stylesheet.type = "text/css";
                document.getElementsByTagName("head")[0].appendChild(stylesheet);
            },

            /**
             * Prompts user if he/she is about to do something that will invalidate an in-progress survey.
             * @fires controller#clear-survey-form
             * @memberof controller
             * @private
             */
            _okToNavigate: function () {
                var ok = true;
                if (controller._surveyInProgress) {
                    if (confirm(i18n.prompts.currentResponsesWillBeCleared)) {
                        controller._surveyInProgress = false;
                        $.publish("clear-survey-form");
                    }
                    else {
                        ok = false;
                    }
                }
                return ok;
            },

            /**
             * Completes text setup of a button and sets its click event to publish the id of the button.
             * @param {string} id - Id of button to modify
             * @param {?string} label - Text to display in button display
             * @param {?string} tooltip - Text to display in button tooltip
             * @param {?object} data - Data to pass to event handler
             * @memberof controller
             * @private
             */
            _activateButton: function (id, label, tooltip, data) {
                var btn = $("#" + id);
                btn.on("click", data, controller._buttonPublish);

                btn = btn[0];
                if (label) {
                    btn.innerHTML = label;
                }
                if (tooltip) {
                    btn.title = tooltip;
                }

                return btn;
            },

            /**
             * Click event function to publish the id of the target.
             * @param {object} evt - Click event
             * @memberof controller
             * @private
             */
            _buttonPublish: function (evt) {
                var btn = evt.currentTarget;
                btn.blur(); // Allow button to be defocused without clicking elsewhere
                $.publish(btn.id, evt.data);
            },

            /**
             * Initializes the controller.
             * @param {object} config - App config info
             * @memberof controller
             * @private
             */
            _logSubscribedEvent: function (evt, data) {
                var logEntry, dataAsString = data !== undefined ? JSON.stringify(data) : "";
                logEntry = ((evt && evt.type) || evt || "") + " " + dataAsString;
                console.log(logEntry);

                if (logEntry.length > 256) {
                    logEntry = logEntry.substr(0, 253) + "...";
                }
                controller._prependToLog(logEntry);
            },

            /**
             * Prepends sequence number and supplied text to #logText item.
             * <br>
             * Note: does not work while controller page is not displayed
             * @param {string} text - Text to prepend
             * @memberof controller
             * @private
             */
            _prependToLog: function (text) {
                $("#logText").prepend(++controller._logNum + ": " + text + "\n");
            },

            _clusterViewBuilder: function (view) {
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

                                if (questionInfo.field === controller._config.appParams.clusterSymDisplay.averagingFieldName) {
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
                            value: "{count}" // Text for labels comes from 'count' field
                        },
                        sizeInfo: {
                            field: "count",
                            minDataValue: controller._config.appParams.clusterSymDisplay.featureCountSizeStops[0].value,
                            minSize: controller._config.appParams.clusterSymDisplay.featureCountSizeStops[0].size,
                            maxDataValue: controller._config.appParams.clusterSymDisplay.featureCountSizeStops[
                                controller._config.appParams.clusterSymDisplay.featureCountSizeStops.length - 1].value,
                            maxSize: controller._config.appParams.clusterSymDisplay.featureCountSizeStops[
                                controller._config.appParams.clusterSymDisplay.featureCountSizeStops.length - 1].size
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
                        }),
                        visualVariables: [{
                            type: "size",
                            field: "count", // number of features in cluster
                            stops: controller._config.appParams.clusterSymDisplay.featureCountSizeStops
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
                            field: "count", // number of features in cluster
                            stops: controller._config.appParams.clusterSymDisplay.featureCountSizeStops
                        }, {
                            type: "color",
                            field: "average", // average score of features in cluster
                            stops: controller._config.appParams.clusterSymDisplay.averagingColorStops
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
                        spatialReference: {
                            wkid: 4326
                        },
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

                    function _createSymbol(geometry, attributes, clusterSurveys) {
                        var symComponent, numQuestions = controller._multipleChoiceQuestions.length,
                            i, j, numChoices, numScores = 0,
                            scoreSum = 0,
                            averageScore = Number.NaN;

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
                                            }
                                            else {
                                                mcQuestionInfo.responses[questionAnswer] = 1;
                                            }

                                            // Accumulate the average score of the clusterSurveys if this is the averaging field
                                            if (questionField === controller._config.appParams.clusterSymDisplay.averagingFieldName) {
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
