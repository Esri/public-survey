/*global $ */
/* jshint -W098 */
/* 'ENABLED'/'DISABLED'/'INVISIBLE'/'DISEMBODIED' is defined but never used */
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
 * @namespace survey_controller
 * @version 0.1
 */
define([
    "lib/i18n.min!nls/resources.js",
    "app/survey",
    "app/diag"
], function (
    i18n,
    survey,
    diag
) {
    "use strict";
    var survey_controller = {
        //----- Events -----------------------------------------------------------------------------------------------//

        // Published
        /**
         * Requests to go to a location with its collection of survey responses.
         * @event survey_controller#cluster-clicked
         * @property {number} iSite - Zero-based slide number
         */

        /**
         * Forwards request for help display.
         * @event survey_controller#show-help
         */

        /**
         * Forwards request to sign out.
         * @event survey_controller#request-signOut
         */

        /**
         * @typedef {object} SurveyAnswers
         * @property {string} <surveyFieldName> -
         * @property {string|number} <surveyFieldValue> -
         * @memberof survey_controller
         */
        /**
         * Forwards request to submit survey.
         * @event survey_controller#submit-survey
         * @property {SurveyAnswers} -
         */

        /**
         * Informs that a site on the to-do list has been completed.
         * @event survey_controller#completed-response-site
         * @property {number} - Zero-based site offset
         */

        /**
         * Forwards request for new survey.
         * @event survey_controller#request-new-survey
         */

        /**
         * @typedef {object} CameraPosHash
         * @property {number} position -
         * @property {number} heading -
         * @property {number} tilt -
         * @memberof survey_controller
         */
        /**
         * Forwards request to go to a location with its collection of survey responses.
         * @event survey_controller#goto-camera-pos
         * @property {CameraPosHash} -
         */

        /**
         * @typedef {object} ClusterAttrsHash
         * @property {number} attributes -
         * @property {number} mapPoint -
         * @memberof survey_controller
         */
        /**
         * Forwards request to go to a location with its collection of survey responses.
         * @event survey_controller#goto-response-site
         * @property {ClusterAttrsHash} -
         */

        // Consumed
        // survey#survey-form-policy-not-satisfied
        // survey#survey-form-policy-satisfied


        //----- Module variables -------------------------------------------------------------------------------------//

        _config: null,
        _dataAccess: null,
        _currentUser: {
            name: "",
            id: "",
            canSubmit: false
        },
        _currentCandidate: null,

        _surveyFrame: null,
        _surveyForm: null,
        _cameraFields: null,
        _responseSitesToDo: [],
        _iCurrentResponseSite: undefined,
        _initialized: false,
        _current_responses: [],
        _iCurrentResponse: 0,
        _numSubmissions: 0,
        _surveyInProgress: false,
        _policySatisfied: false,
        _currentPage: 1,

        //----- Procedures available for external access -------------------------------------------------------------//

        init: function (config, containerName) {
            var surveyControllerReady = $.Deferred();
            survey_controller._config = config;
            survey_controller._container = $("#" + containerName + "");

            // Instantiate the survey_controller template
            survey_controller._container.loadTemplate("js/app/survey_controller.html", {}, {
                prepend: true,
                complete: function () {

                    //----- UI setup: page title, help, branding -----------------------------------------------------//
                    $("#page-title")[0].innerHTML = survey_controller._config.appParams.titleText;
                    $("#userSignoutSelection")[0].innerHTML = i18n.labels.exit;
                    $("#action-bar-message")[0].innerHTML = i18n.messages.surveySubmitted;

                    if (survey_controller._config.appParams.helpText) {
                        $("#helpButton")[0].title = i18n.tooltips.helpTip;
                        $("#helpButton").on("click", function () {
                            $.publish("show-help");
                        });
                        $("#helpButton").removeClass("absent");
                    }

                    if (survey_controller._config.appParams.brandingIconUrl) {
                        $("#brandingIcon").attr("src", survey_controller._config.appParams.brandingIconUrl);
                        $("#branding").removeClass("absent");
                    }

                    //----- Action buttons ---------------------------------------------------------------------------//
                    survey_controller._submitBtn = activateButton("_submit_survey_form", i18n.prompts.submitBtn);
                    $.subscribe("_submit_survey_form", function () {
                        var submission = {};
                        submission[survey_controller._config.appParams.surveyorFieldName] =
                            survey_controller._currentUser.name;
                        submission[survey_controller._config.appParams.socialMediaFieldName] =
                            survey_controller._currentUser.org;
                        $.extend(submission, survey.getFormAnswers());
                        $.publish("submit-survey", submission);
                        survey_controller._numSubmissions++;

                        // Update our to-do list
                        if (survey_controller._iCurrentResponseSite !== undefined) {
                            survey_controller._responseSitesToDo[survey_controller._iCurrentResponseSite] = 0;
                            $.publish("completed-response-site", survey_controller._iCurrentResponseSite);
                        }

                        survey.clearForm();

                        // Provide a message that the survey has been submitted
                        survey_controller._showItem($("#action-group-1"), false, function () {
                            survey_controller._showItem($("#action-bar-message"), true);
                            setTimeout(function () {
                                survey_controller._showItem($("#action-bar-message"), false,
                                    survey_controller._showItem, [$("#action-group-1"), true]);
                            }, 2000);
                        });
                    });

                    survey_controller._clearBtn = activateButton("_clear_survey_form", i18n.prompts.clearBtn);
                    $.subscribe("_clear_survey_form", function () {
                        survey.clearForm();
                    });

                    survey_controller._nextToDoBtn =
                        activateButton("_goto_next_todo_response_site", i18n.prompts.nextBtn);
                    $.subscribe("_goto_next_todo_response_site", function () {
                        var iToDo;

                        // Provide some feedback for the switch
                        survey_controller.clearSurveyForm();

                        if (survey_controller._iCurrentResponseSite !== undefined) {
                            // Check sites after the current one
                            for (iToDo = survey_controller._iCurrentResponseSite + 1; iToDo < survey_controller._responseSitesToDo.length; ++iToDo) {
                                if (survey_controller._responseSitesToDo[iToDo] === 1) {
                                    $.publish("goto-response-site", iToDo);
                                    return;
                                }
                            }

                            // If all sites after the current one are completed, wrap around
                            // and start from the beginning
                            for (iToDo = 0; iToDo < survey_controller._iCurrentResponseSite; ++iToDo) {
                                if (survey_controller._responseSitesToDo[iToDo] === 1) {
                                    $.publish("goto-response-site", iToDo);
                                    return;
                                }
                            }
                        }
                        else {
                            // Use first uncompleted site starting from beginning of todo list
                            $.each(survey_controller._responseSitesToDo, function (iToDo, status) {
                                if (status === 1) {
                                    $.publish("goto-response-site", iToDo);
                                    return false;
                                }
                            });
                        }
                    });

                    survey_controller._finishBtn = activateButton("_finish_survey_form", i18n.prompts.finishBtn);
                    $.subscribe("_finish_survey_form", function () {
                        survey_controller._requestSignout(true);
                    });

                    survey_controller._seeResponsesBtn = activateButton("_see_current_responses",
                        i18n.prompts.seeResponsesBtn);
                    $.subscribe("_see_current_responses", survey_controller._showPageTwo);

                    survey_controller._nextResponseBtn = activateButton("_goto_next_response",
                        i18n.prompts.nextResponseBtn);
                    $.subscribe("_goto_next_response", function () {
                        survey_controller._iCurrentResponse += 1;
                        if (survey_controller._iCurrentResponse >= survey_controller._current_responses.length) {
                            survey_controller._iCurrentResponse = 0;
                        }

                        survey_controller._showCurrentResponse();
                    });

                    survey_controller._turnOffResponsesBtn = activateButton("_turn_off_current_responses",
                        i18n.prompts.turnOffResponsesBtn);
                    $.subscribe("_turn_off_current_responses", function () {
                        survey_controller._current_responses = [];
                        survey_controller._iCurrentResponse = 0;
                        survey_controller._showPageOne();
                    });

                    //----- UI and information updating --------------------------------------------------------------//
                    $.subscribe("signedIn-user", function (ignore, loginInfo) {
                        survey_controller._updateUser(loginInfo);

                        if (survey_controller._initialized) {
                            survey_controller._startSurveying();
                        }
                    });

                    $("#userSignoutSelection").on("click", survey_controller._requestSignout);

                    $.subscribe("clear-survey-form", survey_controller.clearSurveyForm);

                    // As soon as the survey form has an answer, the Clear button is relevant; hide Next button until
                    // survey completed or cleared
                    $.subscribe("survey-form-in-progress", function () {
                        survey_controller._surveyInProgress = true;
                        survey_controller._updatePageOneActions();
                    });

                    $.subscribe("survey-form-is-empty", function () {
                        survey_controller._surveyInProgress = false;
                        survey_controller._updatePageOneActions();
                    });

                    // As soon as the minimum number of answers has been reached, the Submit button is usable
                    $.subscribe("survey-form-policy-satisfied", function () {
                        survey_controller._policySatisfied = true;
                        survey_controller._updatePageOneActions();
                    });

                    $.subscribe("survey-form-policy-not-satisfied", function () {
                        survey_controller._policySatisfied = false;
                        survey_controller._updatePageOneActions();
                    });

                    // Update what we know about the current response site (for submitting surveys),
                    // current responses set (for viewing survey results)
                    $.subscribe("update-current-response-site", function (ignore, responseSite) {
                        if (responseSite && (responseSite.slide !== undefined)) {
                            survey_controller._iCurrentResponseSite = responseSite.slide;
                        }
                        else {
                            survey_controller._iCurrentResponseSite = undefined;
                        }
                        survey_controller._updatePageOneActions();
                    });

                    $.subscribe("update-current-responses-set", function (ignore, carrier) {
                        survey_controller._current_responses = carrier.responses;
                        survey_controller._iCurrentResponse = 0;

                        // Publish a request to go to camera position matching this response
                        survey_controller._showCurrentResponseLocation();

                        // Update the survey control buttons
                        if (survey_controller._currentPage === 1) {
                            survey_controller._updatePageOneActions();
                        }
                        else if (survey_controller._currentPage === 2) {
                            survey_controller._updatePageTwoActions();
                            survey_controller._showCurrentResponse();
                        }
                    });

                    // Activate the action-bar buttons
                    function buttonPublish(evt) {
                        var btn = evt.currentTarget;
                        btn.blur(); // Allow button to be defocused without clicking elsewhere
                        $.publish(btn.id);
                    }

                    function activateButton(id, label) {
                        var btn = $("#" + id);
                        btn.on("click", buttonPublish);

                        btn = btn[0];
                        btn.innerHTML = label;

                        return btn;
                    }

                    // Create survey form
                    survey.createSurveyForm($("#surveyContainer")[0],
                        survey_controller._config.appParams._surveyDefinition);

                    //------------------------------------------------------------------------------------------------//
                    // Done with setup
                    surveyControllerReady.resolve();
                }
            });

            return surveyControllerReady;
        },

        /**
         * Launches the controller.
         * @listens controller#show-help
         * @memberof controller
         */
        launch: function () {
            if (survey_controller._config.appParams.numResponseSites === undefined) {
                survey_controller._config.appParams.numResponseSites = 0;
                survey_controller._iCurrentResponseSite = undefined;
            }
            else {
                survey_controller._iCurrentResponseSite = 0;
            }
            survey_controller._initialized = true;

            survey_controller._startSurveying();
        },

        clearSurveyForm: function () {
            if (survey_controller._currentPage === 1) {
                survey.clearForm();
            }
        },

        //----- Procedures meant for internal module use only --------------------------------------------------------//

        _startSurveying: function () {
            var ENABLED = 3,
                DISABLED = 2,
                INVISIBLE = 1,
                DISEMBODIED = 0;

            // Set up a map to keep track of response sites; indicate that none has a survey completed for it
            survey_controller._responseSitesToDo =
                new Array(survey_controller._config.appParams.numResponseSites).fill(1);

            // Clear user-specific status
            survey_controller._current_responses = [];
            survey_controller._iCurrentResponse = 0;
            survey_controller._numSubmissions = 0;
            survey_controller._surveyInProgress = false;
            survey_controller._policySatisfied = false;

            // Show the survey page and action buttons
            survey_controller._showItem([$("#survey"), true]);
            survey_controller._showPageOne();
        },

        _requestSignout: function (isFinished) {
            survey_controller._updateUser({
                name: "",
                id: "",
                canSubmit: false
            });
            survey.clearForm();
            $.publish("request-signOut", isFinished);
        },

        _updateUser: function (loginInfo) {
            survey_controller._currentUser = loginInfo;

            // Heading and how to label signout on survey/profile page
            $("#name")[0].innerHTML = loginInfo.name;
            $("#userSignoutSelection")[0].innerHTML = survey_controller._currentUser.org === "_guest_" ?
                i18n.labels.exit : i18n.labels.signOut;
        },

        _showPageOne: function () {
            survey_controller._currentPage = 1;

            survey.clearForm();
            survey.setFormReadOnly(!(survey_controller._config.featureSvcParams.canBeUpdated &&
                survey_controller._currentUser.canSubmit));
            survey_controller._showItem($("#action-group-2"), false,
                survey_controller._showItem, [$("#action-group-1"), true]);

            // Set initial action buttons states
            survey_controller._updatePageOneActions();
        },

        _updatePageOneActions: function () {
            var ENABLED = 3,
                DISABLED = 2,
                INVISIBLE = 1,
                DISEMBODIED = 0,
                enableIfNotInProgress;

            // Submit button
            survey_controller._showState(survey_controller._submitBtn,
                (survey_controller._policySatisfied ? ENABLED : DISABLED));

            // Clear button
            survey_controller._showState(survey_controller._clearBtn,
                (survey_controller._surveyInProgress ? ENABLED : DISABLED));

            // Next [site] and Finish buttons
            enableIfNotInProgress = survey_controller._surveyInProgress ? DISABLED : ENABLED;
            if (survey_controller._config.appParams.numResponseSites > 0) {
                var remainingToDo = survey_controller._numRemainingToDo();
                if (remainingToDo === 0) {
                    survey_controller._showState(survey_controller._nextToDoBtn, DISEMBODIED);
                    survey_controller._showState(survey_controller._finishBtn, enableIfNotInProgress);
                }
                else if (remainingToDo === 1) {
                    if (survey_controller._iCurrentResponseSite !== undefined &&
                        survey_controller._responseSitesToDo[survey_controller._iCurrentResponseSite] === 1) {
                        // Next button not needed: we are at the only site remaining to do
                        survey_controller._showState(survey_controller._nextToDoBtn, DISEMBODIED);
                    }
                    else {
                        // Next button needed: we are either not at a site or are at a completed site
                        survey_controller._showState(survey_controller._nextToDoBtn, enableIfNotInProgress);
                    }
                    survey_controller._showState(survey_controller._finishBtn, DISEMBODIED);
                }
                else {
                    survey_controller._showState(survey_controller._nextToDoBtn, enableIfNotInProgress);
                    survey_controller._showState(survey_controller._finishBtn, DISEMBODIED);
                }
            }
            else {
                survey_controller._showState(survey_controller._nextToDoBtn, DISEMBODIED);
                survey_controller._showState(survey_controller._finishBtn,
                    (survey_controller._numSubmissions > 0 ? enableIfNotInProgress : DISEMBODIED));
            }

            // See responses button
            survey_controller._showState(survey_controller._seeResponsesBtn,
                (survey_controller._current_responses.length > 0 &&
                    survey_controller._config.appParams.showSeeResponsesButton ?
                    enableIfNotInProgress : DISEMBODIED));
        },

        _showPageTwo: function () {
            survey_controller._currentPage = 2;

            survey.clearForm();
            survey.setFormReadOnly(true);
            survey_controller._showItem($("#action-group-1"), false,
                survey_controller._showItem, [$("#action-group-2"), true]);

            // Set initial action buttons states
            survey_controller._updatePageTwoActions();

            // Show the first response
            survey_controller._showCurrentResponse();
        },

        _updatePageTwoActions: function () {
            var ENABLED = 3,
                DISABLED = 2,
                INVISIBLE = 1,
                DISEMBODIED = 0;

            // Next response button
            survey_controller._showState(survey_controller._nextResponseBtn,
                (survey_controller._current_responses.length > 1 ? ENABLED : DISEMBODIED));
        },

        /**
         * Shows or hides a jQuery item.
         * @param {object} item - jQuery item to change
         * @param {boolean} makeVisible - Visibility to set for container
         * @param {?function} thenDo - Function to execute after show/hide animation completes
         * @param {?object} thenDoArg - Argument for thenDo function; if thenDo is _showItem() and
         * thenDoArg is an array, thenDoArg is treated as the arguments to _showItem()
         * @memberof survey_controller
         */
        _showItem: function (item, makeVisible, thenDo, thenDoArg) {
            if (item.length > 1) {
                thenDoArg = item[3];
                thenDo = item[2];
                makeVisible = item[1];
                item = item[0];
            }
            if (makeVisible) {
                item.fadeIn("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
            else {
                item.fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        },

        /**
         * Shows or hides and enables or disables a DOM item.
         * @param {object} item - DOM item to change
         * @param {?function} level - Visibility level:
         * ENABLED = 3 (visibility: visible; display: inline-block; disabled: false),
         * DISABLED = 2 (visibility: visible; display: inline-block; disabled: true),
         * INVISIBLE = 1 (visibility: hidden; display: inline-block; disabled: true),
         * DISEMBODIED = 0 (visibility: hidden; display: none; disabled: true)
         * @memberof survey_controller
         */
        _showState: function (item, level) {
            var ENABLED = 3,
                DISABLED = 2,
                INVISIBLE = 1,
                DISEMBODIED = 0;

            switch (level) {
                case ENABLED:
                    // visibility: visible; display: inline-block; disabled: false
                    $(item).removeClass("invisible").addClass("visible");
                    $(item).removeClass("absent").addClass("present");
                    item.disabled = false;
                    break;
                case DISABLED:
                    // visibility: visible; display: inline-block; disabled: true
                    $(item).removeClass("invisible").addClass("visible");
                    $(item).removeClass("absent").addClass("present");
                    item.disabled = true;
                    break;
                case INVISIBLE:
                    // visibility: hidden; display: inline-block; disabled: true
                    $(item).removeClass("visible").addClass("invisible");
                    $(item).removeClass("absent").addClass("present");
                    item.disabled = true;
                    break;
                default: // DISEMBODIED
                    // visibility: hidden; display: none; disabled: true
                    $(item).removeClass("visible").addClass("invisible");
                    $(item).removeClass("present").addClass("absent");
                    item.disabled = true;
                    break;
            }
        },

        /**
         * Fills in the survey form with the current response.
         */
        _showCurrentResponse: function () {
            var response = survey_controller._current_responses[survey_controller._iCurrentResponse];
            if (response && response.attributes) {
                survey.fillInForm(response.attributes);

                // Publish a request to go to camera position matching this response
                survey_controller._showCurrentResponseLocation();
            }
        },

        /**
         * Publishes request to go to camera position matching current response.
         */
        _showCurrentResponseLocation: function () {
            var response = survey_controller._current_responses[survey_controller._iCurrentResponse];
            if (response.attributes && response.geometry) {
                var cameraOptions = {
                    position: response.geometry,
                    heading: response.attributes[survey_controller._config.appParams.headingFieldName],
                    tilt: response.attributes[survey_controller._config.appParams.tiltFieldName]
                };
                $.publish("goto-camera-pos", cameraOptions);
            }
        },

        _accumulate: function (sum, num) {
            return sum + num;
        },

        _numRemainingToDo: function () {
            return survey_controller._responseSitesToDo.length === 0 ? 0 :
                survey_controller._responseSitesToDo.reduce(survey_controller._accumulate);
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return survey_controller;
});
