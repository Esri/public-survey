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
    "lib/i18n.min!nls/survey_resources.js",
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
        _responses: [],
        _iCurrentResponse: 0,
        _numSubmissions: 0,

        //----- Procedures available for external access -------------------------------------------------------------//

        init: function (config, container) {
            var surveyControllerReady = $.Deferred();
            survey_controller._config = config;
            survey_controller._container = container;

            // Instantiate the survey_controller template
            container.loadTemplate("js/app/survey_controller.html", {
            }, {
                prepend: true,
                complete: function () {

                    // Fill in page title, help, branding
                    $("#page-title")[0].innerHTML = survey_controller._config.appParams.title;

                    if (survey_controller._config.appParams.helpText) {
                        $("#helpButton")[0].title = i18n.tooltips.helpTip;
                        $("#helpButton").on("click", function () {
                            $.publish("show-help");
                        });
                        $("#helpButton").removeClass("absent");
                    }

                    if (survey_controller._config.appParams.brandingIcon) {
                        $("#brandingIcon").attr("src", survey_controller._config.appParams.brandingIcon);
                        $("#branding").removeClass("absent");
                    }

                    // Set up a map to keep track of response sites
                    survey_controller._responseSitesToDo = new Array(survey_controller._config.appParams.numResponseSites).fill(1);

                    // As soon as the survey form has an answer, the Clear button is relevant; hide Next button until
                    // survey completed or cleared
                    $.subscribe("survey-form-in-progress", function () {
                        var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;
                        survey_controller._showDomItem(survey_controller._clearBtn, ENABLED);
                        survey_controller._showDomItem(survey_controller._nextToDoBtn, DISEMBODIED);
                    });

                    // As soon as the minimum number of answers has been reached, the Submit button is usable
                    $.subscribe("survey-form-policy-satisfied", function () {
                        var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;
                        survey_controller._showDomItem(survey_controller._submitBtn, ENABLED);
                    });

                    $.subscribe("survey-form-policy-not-satisfied", function () {
                        var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;
                        survey_controller._showDomItem(survey_controller._submitBtn, DISABLED);
                    });

                    // Handle actions
                    $.subscribe("signedIn-user", function (ignore, loginInfo) {
                        survey_controller._updateUser(loginInfo);
                    });

                    $("#userSignoutSelection").on("click", function () {
                        survey_controller._updateUser({
                            name: "",
                            id: "",
                            canSubmit: false
                        });
                        $.publish("request-signOut");
                    });

                    $.subscribe("_submit-survey-form", function () {
                        $.publish("submit-survey", survey.getFormAnswers());
                        survey_controller._numSubmissions++;

                        // Update our to-do list
                        if (survey_controller._iCurrentResponseSite !== undefined) {
                            survey_controller._responseSitesToDo[survey_controller._iCurrentResponseSite] = 0;
                            $.publish("completed-response-site", survey_controller._iCurrentResponseSite);
                        }

                        survey_controller.resetSurvey();
                    });

                    $.subscribe("_clear-survey-form", function () {
                        survey_controller.resetSurvey();
                    });

                    $.subscribe("current-response-site", function (ignore, siteInfo) {
                        if (!siteInfo || siteInfo.set === undefined) {
                            survey_controller._iCurrentResponseSite = undefined;
                            survey_controller._responses = [];
                            survey_controller.resetSurvey();
                        } else {
                            survey_controller._iCurrentResponseSite = siteInfo.set;
                            if (!siteInfo.fromCamera) {
                                survey_controller._responses = [];
                                survey_controller.resetSurvey();
                            }
                        }
                    });

                    $.subscribe("_goto-next-todo-response-site", function () {
                        var iToDo;

                        if (survey_controller._iCurrentResponseSite !== undefined) {
                            // Check sites after the current one
                            for (iToDo = survey_controller._iCurrentResponseSite + 1; iToDo < survey_controller._responseSitesToDo.length; ++iToDo) {
                                if(survey_controller._responseSitesToDo[iToDo] === 1) {
                                    $.publish("goto-response-site", iToDo)
                                    return;
                                }
                            }

                            // If all sites after the current one are completed, wrap around and start from the beginning
                            for (iToDo = 0; iToDo < survey_controller._iCurrentResponseSite; ++iToDo) {
                                if(survey_controller._responseSitesToDo[iToDo] === 1) {
                                    $.publish("goto-response-site", iToDo)
                                    return;
                                }
                            }
                        } else {
                            // Start search from beginning of todo list
                            $.each(survey_controller._responseSitesToDo, function (iToDo, status) {
                                if (status === 1) {
                                    $.publish("goto-response-site", iToDo)
                                    return false;
                                }
                            })
                        }
                    });

                    $.subscribe("_goto-next-response", function () {
                        survey_controller._iCurrentResponse += 1;
                        if (survey_controller._iCurrentResponse >= survey_controller._responses.length) {
                            survey_controller._iCurrentResponse = 0;
                        }

                        survey_controller._showCurrentResponse();
                    });

                    $.subscribe("_see-responses", function () {
                        survey_controller._showResponses();
                    });

                    $.subscribe("_turn-off-responses", function () {
                        survey_controller.resetSurvey();
                    });

                    $.subscribe("_finish-survey-form", function () {
                        var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

                        // Hide survey form
                        survey_controller.resetSurvey();
                        survey_controller._showDomItem(survey_controller._container, DISEMBODIED);
                    });





                    $.subscribe("show-newSurvey", survey_controller._showNewSurvey);

/*
                    $("#submitBtn").on("click", survey_controller._submitSurvey);

                    $("#skipBtn").on("click", function () {
                        survey_controller._hideSurvey();
                        $.publish("request-new-survey");
                    });

                    $.subscribe("show:noSurveys", function () {
                        // Show the profile view & help window
                        $("#profileActionBar").css("display", "none");
                        $.publish("show:profile");
                        message.showMessage(i18n.signin.noMoreSurveys,
                            survey_controller._config.appParams.title)
                    });

                    $.subscribe("show:profile", function () {
                        $("#survey").fadeOut("fast", function () {
                            $("#profile").fadeIn("fast");
                        });
                    });

                    $.subscribe("hide:profile", function () {
                        $("#profile").fadeOut("fast", function () {
                            $("#survey").fadeIn("fast");
                        });
                    });

                    $.subscribe("goto_location", function (ignore, carrier) {
                        // Start the responses display
//???                   survey_controller._surveyController.gotoLocation(carrier.responses);
                    });
*/

                    // Activate the action-bar buttons
                    function buttonPublish (evt) {
                        var btn = evt.currentTarget;
                        btn.blur();  // Allow button to be defocused without clicking elsewhere
                        $.publish(btn.id);
                    }

                    function activateButton (id, label) {
                        var btn = $("#" + id);
                        btn.on("click", buttonPublish);

                        btn = btn[0];
                        btn.innerHTML = label;

                        return btn;
                    }

                    survey_controller._submitBtn = activateButton("_submit-survey-form", i18n.prompts.submitBtn);
                    survey_controller._clearBtn = activateButton("_clear-survey-form", i18n.prompts.clearBtn);
                    survey_controller._nextToDoBtn = activateButton("_goto-next-todo-response-site", i18n.prompts.nextBtn);
                    survey_controller._finishBtn = activateButton("_finish-survey-form", i18n.prompts.finishBtn);
                    survey_controller._seeResponsesBtn = activateButton("_see-responses", i18n.prompts.seeResponsesBtn);
                    survey_controller._nextResponseBtn = activateButton("_goto-next-response", i18n.prompts.nextResponseBtn);
                    survey_controller._turnOffResponsesBtn = activateButton("_turn-off-responses", i18n.prompts.turnOffResponsesBtn);

                    // Done with setup
                    surveyControllerReady.resolve();
                }
            });

            return surveyControllerReady;
        },

        launch: function () {
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

            // Show survey form
            survey_controller.resetSurvey();
            survey_controller._showDomItem(survey_controller._container, ENABLED);
            survey_controller._showSurvey(true);
        },

        gotoLocation: function (responses) {
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

            survey_controller._responses = responses || [];

            if (survey_controller._responses.length > 0) {
                survey_controller._iCurrentResponse = 0;
                survey_controller.resetSurvey();
                survey_controller._showCurrentResponseLocation();
            }
        },

        resetSurvey: function () {
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

            // Set initial action buttons states
            survey_controller._showDomItem(survey_controller._submitBtn, (survey_controller._config.appParams.surveyNotificationPolicy === "none" ? ENABLED : DISABLED));
            survey_controller._showDomItem(survey_controller._clearBtn, DISABLED);

            if (survey_controller._config.appParams.numResponseSites > 0) {
                var remainingToDo = survey_controller._numRemainingToDo();
                if (remainingToDo === 0) {
                    survey_controller._showDomItem(survey_controller._nextToDoBtn, DISEMBODIED);
                    survey_controller._showDomItem(survey_controller._finishBtn, ENABLED);
                } else if (remainingToDo === 1) {
                    if (survey_controller._iCurrentResponseSite !== undefined &&
                        survey_controller._responseSitesToDo[survey_controller._iCurrentResponseSite] === 1) {
                        // Next button not needed: we are at the only site remaining to do
                        survey_controller._showDomItem(survey_controller._nextToDoBtn, DISEMBODIED);
                    } else {
                        // Next button needed: we are either not at a site or are at a completed site
                        survey_controller._showDomItem(survey_controller._nextToDoBtn, ENABLED);
                    }
                    survey_controller._showDomItem(survey_controller._finishBtn, DISEMBODIED);
                } else {
                    survey_controller._showDomItem(survey_controller._nextToDoBtn, ENABLED);
                    survey_controller._showDomItem(survey_controller._finishBtn, DISEMBODIED);
                }
            } else {
                survey_controller._showDomItem(survey_controller._finishBtn, (survey_controller._numSubmissions > 0 ? ENABLED : DISEMBODIED));
            }

            survey_controller._showDomItem(survey_controller._seeResponsesBtn,
                (survey_controller._responses.length > 0 && survey_controller._config.appParams.showSeeResponsesButton ? ENABLED : DISEMBODIED));
            survey_controller._showDomItem(survey_controller._nextResponseBtn, DISEMBODIED);
            survey_controller._showDomItem(survey_controller._turnOffResponsesBtn, DISEMBODIED);

            survey.setFormReadOnly(false);
            survey.clearForm();
        },

        //----- Procedures meant for internal module use only --------------------------------------------------------//

        _hideSurvey: function () {
            $("#skipBtn").fadeTo(100, 0.0).blur();
            $("#submitBtn").fadeTo(100, 0.0).blur();
            $("#surveyContainer").fadeTo(100, 0.0);
        },

        _showSurvey: function (isReadOnly) {
            $("#surveyContainer").fadeTo(500, (isReadOnly
                ? 0.75
                : 1.0));
            $("#skipBtn").fadeTo(500, 1.0);
            if (!isReadOnly) {
                $("#submitBtn").fadeTo(500, 1.0);
            }
        },

        _accumulate: function(sum, num) {
            return sum + num;
        },

        _numRemainingToDo: function () {
            return survey_controller._responseSitesToDo.reduce(survey_controller._accumulate);
        },

        _showResponses: function () {
            // Set initial action buttons states
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

            survey_controller._showDomItem(survey_controller._submitBtn, DISEMBODIED);
            survey_controller._showDomItem(survey_controller._clearBtn, DISEMBODIED);
            survey_controller._showDomItem(survey_controller._nextToDoBtn, DISEMBODIED);
            survey_controller._showDomItem(survey_controller._finishBtn, DISEMBODIED);
            survey_controller._showDomItem(survey_controller._seeResponsesBtn, DISEMBODIED);
            survey_controller._showDomItem(survey_controller._nextResponseBtn, (survey_controller._responses.length > 1 ? ENABLED : DISEMBODIED));
            survey_controller._showDomItem(survey_controller._turnOffResponsesBtn, ENABLED);

            survey.setFormReadOnly(true);
            survey.clearForm();

            survey_controller._iCurrentResponse = 0;
            survey_controller._showCurrentResponse();
        },

        _showCurrentResponse: function () {
            var values = survey_controller._responses[survey_controller._iCurrentResponse];
            survey.fillInForm(values);

            survey_controller._showCurrentResponseLocation();
        },

        _showCurrentResponseLocation: function () {
            var values = survey_controller._responses[survey_controller._iCurrentResponse];
            if (values.attributes && values.geometry) {
                var cameraOptions = {
                    position: values.geometry,
                    heading: values.attributes[survey_controller._cameraFields.heading],
                    tilt: values.attributes[survey_controller._cameraFields.tilt]
                };
                $.publish("goto-camera-pos", cameraOptions);
            }
        },






        _submitSurvey: function () {
            var firstMissing = survey.validateForm($('#surveyContainer'),
                survey_controller._config.appParams._surveyDefinition, survey_controller._currentCandidate.obj.attributes);

            // Submit the survey if it has the important responses
            if (firstMissing === undefined) {
                survey_controller._currentCandidate.obj.attributes[
                    survey_controller._config.appParams.surveyorNameField] =
                    survey_controller._currentUser.name;
                if (survey_controller._iSelectedPhoto >= 0) {
                    survey_controller._currentCandidate.obj.attributes[
                        survey_controller._config.appParams.bestPhotoField] =
                        survey_controller._currentCandidate.attachments[survey_controller._iSelectedPhoto].id;
                }
                diag.appendWithLF("saving survey for property <i>"
                    + JSON.stringify(survey_controller._currentCandidate.obj.attributes) + "</i>");  //???
                survey_controller._dataAccess.updateCandidate(survey_controller._currentCandidate).then(function () {
                    survey_controller._completions += 1;
                    survey_controller._updateCount();

                    survey_controller._hideSurvey();
                    $.publish("request-newSurvey");
                });

            // Jump to the first missing important question otherwise
            // From http://stackoverflow.com/a/6677069
            } else {
                $("#sidebarContent").animate({
                    scrollTop: firstMissing.offsetTop - 5
                }, 500);
            }
        },

        _showNewSurvey: function (ignore, candidate) {
            // id:num
            // obj:feature{}
            // numPhotos:num
            // attachments:[{id,url},...]
            survey_controller._currentCandidate = candidate;

            var isReadOnly = !(survey_controller._config.featureSvcParams.canBeUpdated &&
                survey_controller._currentUser.canSubmit);


            // Create survey
            survey.createSurveyForm($("#surveyContainer")[0], survey_controller._config.appParams._surveyDefinition, isReadOnly);

            // Continue the visual feedback for the switch to a new survey
            survey_controller._showSurvey(isReadOnly);
        },

        _updateUser: function (loginInfo) {
            survey_controller._currentUser = loginInfo;

            // Heading on survey/profile page
            $("#name")[0].innerHTML = loginInfo.name;
        },

        _updateCount: function () {
            $("#score")[0].innerHTML = survey_controller._completions;
            $("#score2")[0].innerHTML = survey_controller._completions;
            $("#profileCount").fadeIn();

            if (survey_controller._config.appParams.contribLevels.length > 0) {
                // Find the user's level
                var level = survey_controller._config.appParams.contribLevels.length - 1;
                var surveysForNextLevel = -1;
                while (survey_controller._config.appParams.contribLevels[level].minimumSurveysNeeded >
                    survey_controller._completions) {
                    surveysForNextLevel =
                        survey_controller._config.appParams.contribLevels[level].minimumSurveysNeeded;
                    level -= 1;
                }

                // Show ranking via text and stars
                $("#rankLabel")[0].innerHTML =
                    survey_controller._config.appParams.contribLevels[level].label;
                $("#level")[0].innerHTML = i18n.labels.label_level.replace("${0}", level);
                if (level === 0) {
                    $("div", ".profileRankStars").removeClass("filled-star").addClass("empty-star");
                } else {
                    var stars = $("div:eq(" + (level - 1) + ")", ".profileRankStars");
                    stars.prevAll().andSelf().removeClass("empty-star").addClass("filled-star");
                    stars.nextAll().removeClass("filled-star").addClass("empty-star");
                }

                // If below top level, show how far to next level
                var doneThisLevel = survey_controller._completions -
                    survey_controller._config.appParams.contribLevels[level].minimumSurveysNeeded;
                var remainingToNextLevel = Math.max(0, surveysForNextLevel - survey_controller._completions);
                var surveysThisLevel = doneThisLevel + remainingToNextLevel;
                if (surveysForNextLevel >= 0 && surveysThisLevel > 0) {
                    var cRankBarWidthPx = 170;
                    $("#profileRankBarFill")[0].style.width =
                        (cRankBarWidthPx * doneThisLevel / surveysThisLevel) + "px";
                    $("#profileRankBar").css("display", "block");

                    $("#remainingToNextLevel")[0].innerHTML =
                            i18n.labels.label_remaining_surveys.replace("${0}", remainingToNextLevel);
                } else {
                    $("#remainingToNextLevel")[0].innerHTML = "";
                    $("#profileRankBar").css("display", "none");
                }

                $("#ranking").fadeIn();
            } else {
                $("#ranking").css("display", "none");
            }
        },

        _showDomItem: function (item, level) {
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

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
            default:  // DISEMBODIED
                // visibility: hidden; display: none; disabled: true
                $(item).removeClass("visible").addClass("invisible");
                $(item).removeClass("present").addClass("absent");
                item.disabled = true;
                break;
            }
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return survey_controller;
});

