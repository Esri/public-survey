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
 * @namespace surveyController
 * @version 0.1
 */
define([
    "lib/i18n.min!nls/testSurvey_resources.js",
    "app/survey",
    "app/diag"
], function (
    i18n,
    survey,
    diag
) {
    "use strict";
    var surveyController = {
        //----- Events -----------------------------------------------------------------------------------------------//

        // Published
        /**
         * Requests to go to a location with its collection of survey responses.
         * @event surveyController#cluster-clicked
         * @property {number} iSite - Zero-based slide number
         */

        /**
         * @typedef {object} CameraPosHash
         * @property {number} position -
         * @property {number} heading -
         * @property {number} tilt -
         * @memberof surveyController
         */
        /**
         * Requests to go to a location with its collection of survey responses.
         * @event surveyController#goto-camera-pos
         * @property {CameraPosHash} -
         */

        /**
         * @typedef {object} ClusterAttrsHash
         * @property {number} attributes -
         * @property {number} mapPoint -
         * @memberof surveyController
         */
        /**
         * Requests to go to a location with its collection of survey responses.
         * @event surveyController#goto-response-site
         * @property {ClusterAttrsHash} -
         */

        //----- Module variables -------------------------------------------------------------------------------------//

        _prepareAppConfigInfo: null,
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

        init: function (prepareAppConfigInfo, container, dataAccess) {
            var surveyControllerReady = $.Deferred();
            surveyController._prepareAppConfigInfo = prepareAppConfigInfo;
            surveyController._dataAccess = dataAccess;
            surveyController._container = container;

            // Provide the i18n strings to the survey
            survey.flagImportantQuestion = i18n.tooltips.flagImportantQuestion;

            // Instantiate the surveyController template
            container.loadTemplate("js/app/surveyController.html", {
            }, {
                prepend: true,
                complete: function () {

                    // Fill in page title, help, branding
                    $("#page-title")[0].innerHTML = surveyController._prepareAppConfigInfo.appParams.title;

                    if (surveyController._prepareAppConfigInfo.appParams.helpText) {
                        $("#helpButton")[0].title = i18n.tooltips.helpTip;
                        $("#helpButton").on("click", function () {
                            $.publish("show-help");
                        });
                        $("#helpButton").removeClass("absent");
                    }

                    if (surveyController._prepareAppConfigInfo.appParams.brandingIcon) {
                        $("#brandingIcon").attr("src", surveyController._prepareAppConfigInfo.appParams.brandingIcon);
                        $("#branding").removeClass("absent");
                    }

                    // Set up a map to keep track of response sites
                    surveyController._responseSitesToDo = new Array(surveyController._prepareAppConfigInfo.appParams.numResponseSites).fill(1);

                    // As soon as the survey form has an answer, the Clear button is relevant; hide Next button until
                    // survey completed or cleared
                    $.subscribe("survey-form-in-progress", function () {
                        var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;
                        surveyController._showDomItem(surveyController._clearBtn, ENABLED);
                        surveyController._showDomItem(surveyController._nextToDoBtn, INVISIBLE);
                    });

                    // As soon as the minimum number of answers has been reached, the Submit button is usable
                    $.subscribe("survey-form-policy-satisfied", function () {
                        var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;
                        surveyController._showDomItem(surveyController._submitBtn, ENABLED);
                    });

                    // Handle actions
                    $.subscribe("signedIn-user", function (ignore, loginInfo) {
                        surveyController._updateUser(loginInfo);
                    });

                    $("#userSignoutSelection").on("click", function () {
                        surveyController._updateUser({
                            name: "",
                            id: "",
                            canSubmit: false
                        });
                        $.publish("request-signOut");
                    });

                    $.subscribe("submit-survey-form", function () {
                        $.publish("submit-survey", survey.getFormAnswers());
                        surveyController._numSubmissions++;

                        // Update our to-do list
                        if (surveyController._iCurrentResponseSite !== undefined) {
                            surveyController._responseSitesToDo[surveyController._iCurrentResponseSite] = 0;
                            $.publish("completed-response-site", surveyController._iCurrentResponseSite);
                        }

                        surveyController._resetSurvey();
                    });

                    $.subscribe("clear-survey-form", function () {
                        surveyController._resetSurvey();
                    });

                    $.subscribe("current-response-site", function (ignore, siteInfo) {
                        if (!siteInfo || siteInfo.set === undefined) {
                            surveyController._iCurrentResponseSite = undefined;
                            surveyController._responses = [];
                            surveyController._resetSurvey();
                        } else {
                            surveyController._iCurrentResponseSite = siteInfo.set;
                            if (!siteInfo.fromCamera) {
                                surveyController._responses = [];
                                surveyController._resetSurvey();
                            }
                        }
                    });

                    $.subscribe("goto-next-todo-response-site", function () {
                        var iToDo;

                        if (surveyController._iCurrentResponseSite !== undefined) {
                            // Check sites after the current one
                            for (iToDo = surveyController._iCurrentResponseSite + 1; iToDo < surveyController._responseSitesToDo.length; ++iToDo) {
                                if(surveyController._responseSitesToDo[iToDo] === 1) {
                                    $.publish("goto-response-site", iToDo)
                                    return;
                                }
                            }

                            // If all sites after the current one are completed, wrap around and start from the beginning
                            for (iToDo = 0; iToDo < surveyController._iCurrentResponseSite; ++iToDo) {
                                if(surveyController._responseSitesToDo[iToDo] === 1) {
                                    $.publish("goto-response-site", iToDo)
                                    return;
                                }
                            }
                        } else {
                            // Start search from beginning of todo list
                            $.each(surveyController._responseSitesToDo, function (iToDo, status) {
                                if (status === 1) {
                                    $.publish("goto-response-site", iToDo)
                                    return false;
                                }
                            })
                        }
                    });

                    $.subscribe("goto-next-response", function () {
                        surveyController._iCurrentResponse += 1;
                        if (surveyController._iCurrentResponse >= surveyController._responses.length) {
                            surveyController._iCurrentResponse = 0;
                        }

                        surveyController._showCurrentResponse();
                    });

                    $.subscribe("see-responses", function () {
                        surveyController._showResponses();
                    });

                    $.subscribe("turn-off-responses", function () {
                        surveyController._resetSurvey();
                    });

                    $.subscribe("finish-survey-form", function () {
                        var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

                        // Hide survey form
                        surveyController._resetSurvey();
                        surveyController._showDomItem(surveyController._container, DISEMBODIED);
                    });





                    $.subscribe("show-newSurvey", surveyController._showNewSurvey);

/*
                    $("#submitBtn").on("click", surveyController._submitSurvey);

                    $("#skipBtn").on("click", function () {
                        surveyController._hideSurvey();
                        $.publish("request:newSurvey");
                    });

                    $.subscribe("show:noSurveys", function () {
                        // Show the profile view & help window
                        $("#profileActionBar").css("display", "none");
                        $.publish("show:profile");
                        message.showMessage(i18n.signin.noMoreSurveys,
                            surveyController._prepareAppConfigInfo.appParams.title)
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
//???                   surveyController._surveyController.gotoLocation(carrier.responses);
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

                    surveyController._submitBtn = activateButton("submit-survey-form", i18n.prompts.submitBtn);
                    surveyController._clearBtn = activateButton("clear-survey-form", i18n.prompts.clearBtn);
                    surveyController._nextToDoBtn = activateButton("goto-next-todo-response-site", i18n.prompts.nextBtn);
                    surveyController._finishBtn = activateButton("finish-survey-form", i18n.prompts.finishBtn);
                    surveyController._seeResponsesBtn = activateButton("see-responses", i18n.prompts.seeResponsesBtn);
                    surveyController._nextResponseBtn = activateButton("goto-next-response", i18n.prompts.nextResponseBtn);
                    surveyController._turnOffResponsesBtn = activateButton("turn-off-responses", i18n.prompts.turnOffResponsesBtn);

                    // Done with setup
                    surveyControllerReady.resolve();
                }
            });

            return surveyControllerReady;
        },

        showSurvey: function (makeVisible, thenDo, thenDoArg) {
            if (makeVisible) {
                $("#survey").fadeIn("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            } else {
                $("#survey").fadeOut("fast", function () {
                    thenDo && thenDo(thenDoArg);
                });
            }
        },

        startSurveying: function () {
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

            // Reinitialize variables in case we're re-entering
            surveyController._responseSitesToDo = new Array(surveyController._prepareAppConfigInfo.appParams.numResponseSites).fill(1);
            surveyController._numSubmissions = 0;

            // Show survey form
            surveyController._resetSurvey();
            surveyController._showDomItem(surveyController._container, ENABLED);
            surveyController.showSurvey(true);
        },

        gotoLocation: function (responses) {
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

            surveyController._responses = responses || [];

            if (surveyController._responses.length > 0) {
                surveyController._iCurrentResponse = 0;
                surveyController._resetSurvey();
                surveyController._showCurrentResponseLocation();
            }
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
            return surveyController._responseSitesToDo.reduce(surveyController._accumulate);
        },

        _resetSurvey: function () {
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

            // Set initial action buttons states
            surveyController._showDomItem(surveyController._submitBtn, (surveyController._prepareAppConfigInfo.appParams.surveyNotificationPolicy === "none" ? ENABLED : DISABLED));
            surveyController._showDomItem(surveyController._clearBtn, DISABLED);

            if (surveyController._prepareAppConfigInfo.appParams.numResponseSites > 0) {
                var remainingToDo = surveyController._numRemainingToDo();
                if (remainingToDo === 0) {
                    surveyController._showDomItem(surveyController._nextToDoBtn, INVISIBLE);
                    surveyController._showDomItem(surveyController._finishBtn, ENABLED);
                } else if (remainingToDo === 1) {
                    if (surveyController._iCurrentResponseSite !== undefined &&
                        surveyController._responseSitesToDo[surveyController._iCurrentResponseSite] === 1) {
                        // Next button not needed: we are at the only site remaining to do
                        surveyController._showDomItem(surveyController._nextToDoBtn, INVISIBLE);
                    } else {
                        // Next button needed: we are either not at a site or are at a completed site
                        surveyController._showDomItem(surveyController._nextToDoBtn, ENABLED);
                    }
                    surveyController._showDomItem(surveyController._finishBtn, INVISIBLE);
                } else {
                    surveyController._showDomItem(surveyController._nextToDoBtn, ENABLED);
                    surveyController._showDomItem(surveyController._finishBtn, INVISIBLE);
                }
            } else {
                surveyController._showDomItem(surveyController._finishBtn, (surveyController._numSubmissions > 0 ? ENABLED : INVISIBLE));
            }

            surveyController._showDomItem(surveyController._seeResponsesBtn,
                (surveyController._responses.length > 0 && surveyController._prepareAppConfigInfo.appParams.showSeeResponsesButton ? ENABLED : DISEMBODIED));
            surveyController._showDomItem(surveyController._nextResponseBtn, DISEMBODIED);
            surveyController._showDomItem(surveyController._turnOffResponsesBtn, DISEMBODIED);

            survey.setFormReadOnly(false);
            survey.clearForm();
        },

        _showResponses: function () {
            // Set initial action buttons states
            var ENABLED = 3, DISABLED = 2, INVISIBLE = 1, DISEMBODIED = 0;

            surveyController._showDomItem(surveyController._submitBtn, DISEMBODIED);
            surveyController._showDomItem(surveyController._clearBtn, DISEMBODIED);
            surveyController._showDomItem(surveyController._nextToDoBtn, DISEMBODIED);
            surveyController._showDomItem(surveyController._finishBtn, DISEMBODIED);
            surveyController._showDomItem(surveyController._seeResponsesBtn, DISEMBODIED);
            surveyController._showDomItem(surveyController._nextResponseBtn, (surveyController._responses.length > 1 ? ENABLED : DISEMBODIED));
            surveyController._showDomItem(surveyController._turnOffResponsesBtn, ENABLED);

            survey.setFormReadOnly(true);
            survey.clearForm();

            surveyController._iCurrentResponse = 0;
            surveyController._showCurrentResponse();
        },

        _showCurrentResponse: function () {
            var values = surveyController._responses[surveyController._iCurrentResponse];
            survey.fillInForm(values);

            surveyController._showCurrentResponseLocation();
        },

        _showCurrentResponseLocation: function () {
            var values = surveyController._responses[surveyController._iCurrentResponse];
            if (values.attributes && values.geometry) {
                var cameraOptions = {
                    position: values.geometry,
                    heading: values.attributes[surveyController._cameraFields.heading],
                    tilt: values.attributes[surveyController._cameraFields.tilt]
                };
                $.publish("goto-camera-pos", cameraOptions);
            }
        },






        _submitSurvey: function () {
            var firstMissing = survey.validateForm($('#surveyContainer'),
                surveyController._prepareAppConfigInfo.appParams._surveyDefinition, surveyController._currentCandidate.obj.attributes);

            // Submit the survey if it has the important responses
            if (firstMissing === undefined) {
                surveyController._currentCandidate.obj.attributes[
                    surveyController._prepareAppConfigInfo.appParams.surveyorNameField] =
                    surveyController._currentUser.name;
                if (surveyController._iSelectedPhoto >= 0) {
                    surveyController._currentCandidate.obj.attributes[
                        surveyController._prepareAppConfigInfo.appParams.bestPhotoField] =
                        surveyController._currentCandidate.attachments[surveyController._iSelectedPhoto].id;
                }
                diag.appendWithLF("saving survey for property <i>"
                    + JSON.stringify(surveyController._currentCandidate.obj.attributes) + "</i>");  //???
                surveyController._dataAccess.updateCandidate(surveyController._currentCandidate).then(function () {
                    surveyController._completions += 1;
                    surveyController._updateCount();

                    surveyController._hideSurvey();
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
            surveyController._currentCandidate = candidate;

            var isReadOnly = !(surveyController._prepareAppConfigInfo.featureSvcParams.canBeUpdated &&
                surveyController._currentUser.canSubmit);


            // Create survey
            survey.createSurveyForm($("#surveyContainer")[0], surveyController._prepareAppConfigInfo.appParams._surveyDefinition, isReadOnly);

            // Continue the visual feedback for the switch to a new survey
            surveyController._showSurvey(isReadOnly);
        },

        _updateUser: function (loginInfo) {
            surveyController._currentUser = loginInfo;

            // Heading on survey/profile page
            $("#name")[0].innerHTML = loginInfo.name;
        },

        _updateCount: function () {
            $("#score")[0].innerHTML = surveyController._completions;
            $("#score2")[0].innerHTML = surveyController._completions;
            $("#profileCount").fadeIn();

            if (surveyController._prepareAppConfigInfo.appParams.contribLevels.length > 0) {
                // Find the user's level
                var level = surveyController._prepareAppConfigInfo.appParams.contribLevels.length - 1;
                var surveysForNextLevel = -1;
                while (surveyController._prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded >
                    surveyController._completions) {
                    surveysForNextLevel =
                        surveyController._prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded;
                    level -= 1;
                }

                // Show ranking via text and stars
                $("#rankLabel")[0].innerHTML =
                    surveyController._prepareAppConfigInfo.appParams.contribLevels[level].label;
                $("#level")[0].innerHTML = i18n.labels.label_level.replace("${0}", level);
                if (level === 0) {
                    $("div", ".profileRankStars").removeClass("filled-star").addClass("empty-star");
                } else {
                    var stars = $("div:eq(" + (level - 1) + ")", ".profileRankStars");
                    stars.prevAll().andSelf().removeClass("empty-star").addClass("filled-star");
                    stars.nextAll().removeClass("filled-star").addClass("empty-star");
                }

                // If below top level, show how far to next level
                var doneThisLevel = surveyController._completions -
                    surveyController._prepareAppConfigInfo.appParams.contribLevels[level].minimumSurveysNeeded;
                var remainingToNextLevel = Math.max(0, surveysForNextLevel - surveyController._completions);
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
    return surveyController;
});

