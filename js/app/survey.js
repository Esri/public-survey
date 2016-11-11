/*global $ */
/* jshint -W016 */
/* "Unexpected use of '&='/'~'/'|=' */
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
 * @namespace survey
 * @version 0.1
 */
define([], function () {
    "use strict";
    var survey;
    survey = {
        //----- Events -----------------------------------------------------------------------------------------------//

        // Published
        /**
         * Informs that at least one question has an answer completed.
         * @event survey#survey-form-in-progress
         */

        /**
         * Informs that the survey has not satisfied the notification policy.
         * @event survey#survey-form-policy-not-satisfied
         */

        /**
         * Informs that the survey has satisfied the notification policy.
         * @event survey#survey-form-policy-satisfied
         */

        /**
         * Informs that the survey has no answers completed.
         * @event survey#survey-form-is-empty
         */

        // Consumed

        //----- Module variables -------------------------------------------------------------------------------------//

        _containerId: null,
        _questions: [],
        _questionLookup: [],
        _notificationPolicy: ">=1", // options: ">=1", "allImportant", "all"
        _importantQuestionTooltip: "Please answer this question", // backup for missing argument
        _requiredFieldsMask: 0, // N.B.: Form is restricted to a maximum of 31 required fields because of
        _requiredFieldsStatus: 0, // the way that required fields are tracked.
        _inProgress: false,
        _policySatisfied: false,
        _hasUneraseableValue: false,
        _isReadOnly: false,

        //----- Procedures available for external access -------------------------------------------------------------//

        /**
         * Parses HTML text such as appears in a webmap's feature layer's popup to generate a set of survey questions.
         * @param {string} source Text from source
         * @param {array} featureSvcFields List of fields such as the one supplied by a feature service
         * @return {array} List of survey question objects, each of which contains question, field, style, domain,
         * important properties
         */
        createSurveyDefinition: function (surveyDescription, featureSvcFields, notificationPolicy,
            importantQuestionTooltip) {
            // Adjust parameters as needed
            if (notificationPolicy !== "allImportant" &&
                notificationPolicy !== "all") {
                notificationPolicy = ">=1";
            }
            survey._notificationPolicy = notificationPolicy || survey._notificationPolicy;

            survey._importantQuestionTooltip = importantQuestionTooltip || survey._importantQuestionTooltip;

            // Create dictionary of domains
            var dictionary = survey._createSurveyDictionary(featureSvcFields);

            // Parse survey
            return survey._parseSurvey(surveyDescription, dictionary);
        },

        /**
         * Creates a survey form in the specified element.
         * @param {div} surveyContainer Element to receive survey form; its contents are completely replaced by the
         * new survey
         * @param {array} surveyDefinition List of survey question objects, each of which contains question, field,
         * style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         */
        createSurveyForm: function (surveyContainer, surveyDefinition, isReadOnly) {
            var nextReqFldStatusFlag = 1; // first slot for required fields mask

            // Remove children and their events
            $(surveyContainer).children().remove();

            // Resets
            survey._inProgress = false;
            survey._policySatisfied = false;
            survey._hasUneraseableValue = false;
            survey._isReadOnly = !!isReadOnly;

            // Create the questions
            $.each(surveyDefinition, function (indexInArray, questionInfo) {
                var question = survey._addQuestion(surveyContainer, indexInArray, questionInfo);
                if (question) {
                    // Save question for later answer retrieval
                    survey._questionLookup[question.surveyField] = survey._questions.length;
                    survey._questions.push(question);

                    // Set flag for field in mask, save its offset with the question, and set up for next field
                    if (question.surveyImportant || survey._notificationPolicy === "all") {
                        survey._requiredFieldsMask |= (nextReqFldStatusFlag);
                        question.requiredFieldFlag = nextReqFldStatusFlag;
                        nextReqFldStatusFlag *= 2;
                    }
                }
            });

            // Retroactively apply read-only state to include controls not handled by bootstrap
            survey.setFormReadOnly(isReadOnly);

            // Reset the required-questions tracking
            survey._requiredFieldsStatus = survey._requiredFieldsMask;

            // Render any radiobutton groups
            survey._containerId = surveyContainer.id;
            $("#" + survey._containerId + " .btn-group").trigger("create");
        },

        setFormReadOnly: function (isReadOnly) {
            $.each(survey._questions, function (iQuestion, question) {
                var value;
                if (question.surveyFieldStyle === "button") {
                    $.each(question.surveyValues, function (i, uiValue) {
                        $("#" + question.surveyId + ">:nth-child(" + (i + 1) + ")").attr("disabled", isReadOnly);
                    });

                }
                else if (question.surveyFieldStyle === "list") {
                    $.each(question.surveyValues, function (i, uiValue) {
                        $("input[name=" + question.surveyId + "][value=" + i + "]").attr("disabled", isReadOnly);
                    });

                }
                else {
                    value = $("#" + question.surveyId).attr("disabled", isReadOnly);

                    // Emulate disabled appearance; bootstrap does this for buttons and lists
                    if (isReadOnly) {
                        value.addClass("disabled-appearance");
                    }
                    else {
                        value.removeClass("disabled-appearance");
                    }
                }
            });
        },

        clearForm: function () {
            $("#surveyContainer").fadeOut();

            // Clear button-style radio buttons, which are flagged as selected by having the "active" class
            $("#" + survey._containerId + " .active").removeClass("active").blur();

            // Clear radio buttons, which are flagged as selected by having the "checked" attribute
            $("#" + survey._containerId + " input:checked").removeAttr("checked").blur();

            // Clear dropdown-style inputs
            $("#" + survey._containerId + " .dropdown-group").each(function (indexInArray, input) {
                input.selectedIndex = -1;
            });

            // Clear number-style inputs
            $("#" + survey._containerId + " .number-input").each(function (indexInArray, input) {
                input.value = "";
            });

            // Clear text-style inputs
            $("#" + survey._containerId + " .text-input").each(function (indexInArray, input) {
                input.value = "";
            });

            // Reset the required-questions tracking
            survey._requiredFieldsStatus = survey._requiredFieldsMask;
            survey._hasUneraseableValue = false;

            survey._notifyAboutSurveyStatus(false);
            survey._notifyAboutSurveyPolicy(false);

            $("#surveyContainer").fadeIn();
        },

        fillInForm: function (values, monitorNotificationPolicy) {
            survey.clearForm();

            if (values) {
                // Set the value for each question in the survey for which we have an answer
                $.each(values, function (property, value) {
                    var iQuestion = survey._questionLookup[property];
                    if (typeof iQuestion === "number") {
                        var question = survey._questions[iQuestion];

                        //console.log("#" + question.surveyId + " field " + property + ": " + JSON.stringify(value));//???
                        if (question.surveyFieldStyle === "button") {
                            $.each(question.surveyValues, function (i, uiValue) {
                                if (value === uiValue) {
                                    $("#" + question.surveyId + ">:nth-child(" + (i + 1) + ")").addClass("active");
                                    return false;
                                }
                            });

                        }
                        else if (question.surveyFieldStyle === "list") {
                            $.each(question.surveyValues, function (i, uiValue) {
                                if (value === uiValue) {
                                    $("input[name=" + question.surveyId + "][value=" + i + "]").prop("checked", true);
                                    return false;
                                }
                            });

                        }
                        else if (question.surveyFieldStyle === "dropdown") {
                            $.each(question.surveyValues, function (i, uiValue) {
                                if (value === uiValue) {
                                    $("#" + question.surveyId)[0].selectedIndex = i;
                                    return false;
                                }
                            });

                        }
                        else {
                            $("#" + question.surveyId).val(value);
                        }

                        if (monitorNotificationPolicy) {
                            // Update the policy status for this question
                            survey._checkNotificationPolicy(question, true);
                        }
                    }
                });
            }
        },

        getFormAnswers: function () {
            var answers = {};

            $.each(survey._questions, function (indexInArray, question) {
                var answer = $(question.surveyAnswerQuery);
                if (answer.length > 0) {
                    // coded-value item: button, list, dropdown
                    if (question.surveyValues) {
                        if (question.surveyFieldStyle === "dropdown") {
                            if (answer[0].selectedIndex >= 0) {
                                answers[question.surveyField] = question.surveyValues[answer[0].selectedIndex];
                            }
                        }
                        else {
                            answers[question.surveyField] = question.surveyValues[answer[0].value];
                        }

                        // free-text item: text, number
                    }
                    else if (answer[0].value.length > 0) {
                        // Escape newlines because REST endpoint treats them as the end of the string
                        answers[question.surveyField] =
                            answer[0].value.replace(/[\n]/g, "\\n").replace(/[\r]/g, "\\r").trim();
                    }
                }
            });

            return answers;
        },

        /**
         * Validates a survey form in the specified element.
         * @param {div} surveyContainer Element containing survey form
         * @param {array} surveyDefinition List of survey question objects, each of which contains question, field,
         * style, domain, important
         * @param {object} objAttributes Attributes of item being surveyed; attributes are updated with the values
         * in the form
         */
        validateForm: function (surveyContainer, surveyDefinition, objAttributes) {
            var iQuestionResult, firstMissing;

            $.each(surveyDefinition, function (iQuestion, questionInfo) {
                // Extract the value from the item
                if (questionInfo.style === "button") {
                    iQuestionResult = $("#q" + iQuestion + " .active", surveyContainer).val();
                }
                else if (questionInfo.style === "list") {
                    iQuestionResult = $("input[name=q" + iQuestion + "]:checked", surveyContainer).val();
                }
                else if (questionInfo.style === "dropdown") {
                    iQuestionResult = $("#q" + iQuestion, surveyContainer).val();
                }
                else if (questionInfo.style === "number") {
                    iQuestionResult = $("#q" + iQuestion, surveyContainer).val();
                }
                else if (questionInfo.style === "text") {
                    iQuestionResult = $("#q" + iQuestion, surveyContainer).val();
                }

                if (iQuestionResult) {
                    if (questionInfo.style === "number") {
                        objAttributes[questionInfo.field] = parseFloat(iQuestionResult);
                    }
                    else if (questionInfo.style === "text" || questionInfo.style === "dropdown") {
                        objAttributes[questionInfo.field] = iQuestionResult;
                    }
                    else { // "button" or "list"
                        objAttributes[questionInfo.field] = questionInfo.values[iQuestionResult];
                    }
                }

                // Flag missing importants
                if (questionInfo.important) {
                    if (iQuestionResult) {
                        $("#qg" + iQuestion).removeClass("flag-error");
                    }
                    else {
                        $("#qg" + iQuestion).addClass("flag-error");
                        if (firstMissing === undefined) {
                            firstMissing = $("#qg" + iQuestion)[0];
                        }
                    }
                }
            });

            // Return the first missing important (if any)
            return firstMissing;
        },

        //----- Procedures meant for internal module use only --------------------------------------------------------//

        _notifyAboutSurveyStatus: function (inProgress) {
            if (survey._inProgress != inProgress) {
                survey._inProgress = inProgress;
                $.publish(inProgress ? "survey-form-in-progress" : "survey-form-is-empty");
            }
        },

        _notifyAboutSurveyPolicy: function (satisfied) {
            if (survey._policySatisfied != satisfied) {
                survey._policySatisfied = satisfied;
                $.publish(satisfied ? "survey-form-policy-satisfied" : "survey-form-policy-not-satisfied");
            }
        },

        /**
         * Converts a list of feature service fields into a dictionary of fields with their domains and nullability;
         * skips fields without coded-value domains.
         * @param {array} featureSvcFields List of fields such as the one supplied by a feature service
         * @return {object} Object containing the field names as its properties; each property's value consists of the
         * '|'-separated coded values in the field's domain and a flag indicating if the field is flagged as important;
         * if field is not coded, then its length is returned
         * @private
         */
        _createSurveyDictionary: function (featureSvcFields) {
            var fieldDomains = {};

            $.each(featureSvcFields, function (ignore, field) {
                var domain = null,
                    value = null;
                if (field.domain && field.domain.codedValues) {
                    domain = $.map(field.domain.codedValues, function (item) {
                        return item.name;
                    }).join("|");
                    value = $.map(field.domain.codedValues, function (item) {
                        return item.code;
                    });
                }
                else if (field.length) {
                    domain = field.length;
                }

                fieldDomains[field.name] = {
                    domain: domain,
                    values: value,
                    important: !field.nullable
                };
            });

            return fieldDomains;
        },

        /**
         * Parses HTML text such as appears in a webmap's feature layer's popup to generate a set of survey questions.
         * @param {string} source Text from source
         * @param {object} fieldDomains List of field domains and field required/optional state as created by function
         * createSurveyDictionary using the 'fields' property of a feature service
         * @return {array} List of survey question objects, each of which contains question, field, style, domain,
         * important properties
         * @private
         */
        _parseSurvey: function (source, fieldDomains) {
            // Survey is written as a series of lines in the popup. Each line is expected to have arbitrary text
            // followed by a feature layer field name in braces followed by a question style flag also in braces.
            // Here is a sample source:
            //  <p>Is there a Structure on the Property? <b>{<font color='#0000ff'>Structure</font>} </b><b>{<span
            //  style='background-color:rgb(255, 0, 0);'>button</span>}</b></p><p><ul><li>Is the lot overgrown? <b>{Lot}
            //  </b><b>{button}</b><br /></li><li>Foundation type: <b>{<font color='#ffff00' style='background-color:
            //  rgb(255, 69, 0);'>FoundationType</font>} </b><b>{radio}</b><br /></li></ul></p><p><b><br /></b></p><p>Is
            //  there roof damage? <b>{RoofDamage} </b><b>{button}</b></p><p>Is the exterior damaged?<b>
            //  {ExteriorDamage}</b><b>{button}</b></p><p></p><ol><li>Is there graffiti? <b>{Graffiti} </b><b>{button}
            //  </b><br /></li><li>Are there boarded windows/doors? <b>{Boarded} </b><b>{button}</b><br /></li></ol>
            var surveyQuestions = [],
                descriptionSplit1, descriptionSplit2, descriptionSplit3, taggedSurveyLines,
                surveyLines;

            // 1. split on <div>, <p>, <br />, and <li>, all of which could be used to separate lines
            descriptionSplit2 = [];
            descriptionSplit3 = [];
            taggedSurveyLines = [];
            descriptionSplit1 = source.split("<div>");
            $.each(descriptionSplit1, function (ignore, line) {
                $.merge(descriptionSplit2, line.split("<p>"));
            });
            $.each(descriptionSplit2, function (ignore, line) {
                $.merge(descriptionSplit3, line.split("<br />"));
            });
            $.each(descriptionSplit3, function (ignore, line) {
                $.merge(taggedSurveyLines, line.split("<li>"));
            });

            // 2. remove all html tags (could have <b>, <i>, <u>, <ol>, <ul>, <li>, <a>, <font>, <span>, <br>,
            // and their closures included or explicit)
            surveyLines = [];
            $.each(taggedSurveyLines, function (ignore, line) {
                var cleanedLine = survey._textOnly(line).trim();
                if (cleanedLine.length > 0) {
                    surveyLines.push(cleanedLine);
                }
            });

            // 3. Separate into question, field, and style
            // e.g., "Is there a Structure on the Property? {Structure} {button}"
            $.each(surveyLines, function (ignore, line) {
                var paramParts, trimmedParts, fieldName, surveyQuestion, part2, part3;

                paramParts = line.split("{");
                trimmedParts = [];
                $.each(paramParts, function (ignore, part) {
                    var trimmed = part.replace("}", "").trim();
                    if (trimmed.length > 0) {
                        trimmedParts.push(trimmed);
                    }
                });

                // Should have three parts now: question, field, style; we can add in the question's
                // domain and importance from the fieldDomain dictionary created just above
                if (trimmedParts.length >= 3) {
                    fieldName = trimmedParts[1];
                    if (fieldDomains[fieldName]) {
                        surveyQuestion = {
                            question: trimmedParts[0],
                            field: fieldName,
                            domain: fieldDomains[fieldName].domain,
                            values: fieldDomains[fieldName].values,
                            important: fieldDomains[fieldName].important
                        };

                        part2 = trimmedParts[2];
                        surveyQuestion.style = part2;
                        if (trimmedParts.length > 3) {
                            part3 = trimmedParts[3];
                            if (part3.startsWith("image=")) {
                                surveyQuestion.startsWithImage = false;
                                surveyQuestion.image = part3.substring(6);
                            }
                            else if (part2.startsWith("image=")) {
                                surveyQuestion.startsWithImage = true;
                                surveyQuestion.style = part3;
                                surveyQuestion.image = part2.substring(6);
                            }
                        }

                        surveyQuestions.push(surveyQuestion);
                    }

                    // Otherwise, just echo line
                }
                else {
                    surveyQuestion = {
                        question: line,
                        style: "heading"
                    };
                    surveyQuestions.push(surveyQuestion);
                }
            });
            return surveyQuestions;
        },

        /**
         * Creates a survey form in the specified element.
         * @param {div} surveyContainer Element containing survey form
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @private
         */
        _addQuestion: function (surveyContainer, iQuestion, questionInfo) {
            var watchImportant, questionHTML, question, eventQuery;

            if (questionInfo.style === "heading") {
                questionHTML = survey._createHeading(questionInfo);
                $(surveyContainer).append(questionHTML);

            }
            else {
                watchImportant = questionInfo.important && survey._notificationPolicy === "allImportant";
                questionHTML = survey._startQuestion(iQuestion, questionInfo, watchImportant);

                if (questionInfo.style === "button") {
                    questionHTML += survey._createButtonChoice(iQuestion, questionInfo);
                }
                else if (questionInfo.style === "list") {
                    questionHTML += survey._createListChoice(iQuestion, questionInfo);
                }
                else if (questionInfo.style === "dropdown") {
                    questionHTML += survey._createDropdownChoice(iQuestion, questionInfo);
                }
                else if (questionInfo.style === "number") {
                    questionHTML += survey._createNumberInput(iQuestion, questionInfo);
                }
                else if (questionInfo.style === "text") {
                    questionHTML += survey._createTextLineInput(iQuestion, questionInfo);
                }
                questionHTML += survey._wrapupQuestion(iQuestion, questionInfo);
                $(surveyContainer).append(questionHTML);

                // Fetch question block for returning and save its importance
                question = $("#q" + iQuestion)[0];
                question.surveyField = questionInfo.field;
                question.surveyFieldStyle = questionInfo.style;
                question.surveyImportant = watchImportant;
                question.surveyValues = questionInfo.values;
                question.surveyId = "q" + iQuestion;

                // Fix radio-button toggling for both styles of radio button
                if (questionInfo.style === "button") {
                    eventQuery = "#q" + iQuestion + " button";
                    $(eventQuery).click(function (evt) {
                        $(evt.currentTarget).addClass("active").siblings().removeClass("active");
                        survey._handleButtonClick(evt);
                    });
                    question.surveyAnswerQuery = eventQuery + ".active";

                }
                else if (questionInfo.style === "dropdown") {
                    eventQuery = "#q" + iQuestion;
                    question.surveyAnswerQuery = eventQuery;
                    $(eventQuery)[0].selectedIndex = -1;
                    $(eventQuery).on("change", survey._handleDropdownClick);

                }
                else if (questionInfo.style === "list") {
                    eventQuery = "[name=q" + iQuestion + "]";
                    $(eventQuery).on("click", survey._handleRadiobuttonClick);
                    question.surveyAnswerQuery = eventQuery + ":checked";

                }
                else if (questionInfo.style === "number") {
                    eventQuery = "#q" + iQuestion;
                    $(eventQuery).on("keyup", survey._handleInputKeyup);
                    $(eventQuery).on("click", survey._handleInputKeyup);
                    question.surveyAnswerQuery = eventQuery;

                }
                else {
                    eventQuery = "#q" + iQuestion;
                    $(eventQuery).on("keyup", survey._handleInputKeyup);
                    question.surveyAnswerQuery = eventQuery;
                }
            }
            return question;
        },

        _createHeading: function (questionInfo) {
            var heading = "<div class='form-heading'>" + questionInfo.question + "</div>";
            return heading;
        },

        /**
         * Starts the HTML for a survey question with its label.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} flagAsImportant Should the question be flagged as important
         * @return {string} HTML for question's label and the start of its div
         * @private
         */
        _startQuestion: function (iQuestion, questionInfo, flagAsImportant) {
            // <div class='form-group'>
            //   <label for='q1'>Is there a structure on the property? <span class='glyphicon glyphicon-star'>
            //   </span></label><br>
            var start =
                "<div id='q" + "g" + iQuestion + "' class='form-group'>" +
                "<label for='q" + iQuestion + "'>" + questionInfo.question +
                (flagAsImportant ? "&nbsp;<div class='importantQuestion sprites star' title=\"" +
                    survey._importantQuestionTooltip + "\"></div>" :
                    "") +
                "</label><br>";
            if (questionInfo.image && questionInfo.image.length > 0 && questionInfo.startsWithImage) {
                start += "<img src='" + questionInfo.image + "' class='image-before'/><br>";
            }
            return start;
        },

        /**
         * Creates a survey question's response item's HTML: a set of button-style radio buttons.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @return {string} HTML for radio buttons
         * @private
         */
        _createButtonChoice: function (iQuestion, questionInfo) {
            // <div id='q1' class='btn-group'>
            //   <button type='button' class='btn'>Yes</button>
            //   <button type='button' class='btn'>No</button>
            //   <button type='button' class='btn'>Not sure</button>
            // </div>
            var buttons = "<div id='q" + iQuestion + "' class='btn-group'>";
            var domain = questionInfo.domain.split("|");
            $.each(domain, function (i, choice) {
                buttons += "<button type='button' id='q" + iQuestion + "_" + i +
                    "' class='btn' value='" + i + "'>" + choice + "</button>";
            });
            buttons += "</div>";
            return buttons;
        },

        /**
         * Creates a survey question's response item's HTML: a set of list-style radio buttons.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @return {string} HTML for radio buttons
         * @private
         */
        _createListChoice: function (iQuestion, questionInfo) {
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound1' value='0'>
            //   Crawlspace</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound2' value='1'>
            //   Raised</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound3' value='2'>
            //   Elevated</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound4' value='3'>
            //   Slab on grade</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound0' value='4'>
            //   Not sure</label></div>
            var list = "<div id='q" + iQuestion + "' class='radio-group'>";
            var domain = questionInfo.domain.split("|");
            $.each(domain, function (i, choice) {
                list += "<div class='radio'><label><input type='radio' name='q" + iQuestion + "' value='" + i +
                    "'>" + choice + "</label></div>";
            });
            list += "</div>";
            return list;
        },

        /**
         * Creates a survey question's response item's HTML: a dropdown list of options.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @return {object} HTML for radio buttons
         * @private
         */
        _createDropdownChoice: function (iQuestion, questionInfo) {
            // <select id='q1' class='dropdown-group'>
            //   <option value='Yes'>Yes</option>
            //   <option value='No'>No</option>
            //   <option value='Notsure'>Not sure</option>
            // </select>
            var list = "<select id='q" + iQuestion + "' class='dropdown-group'>";
            var domain = questionInfo.domain.split("|");
            $.each(domain, function (i, choice) {
                list += "<option value='" + choice + "'>" + choice + "</option>";
            });
            list += "</select>";
            return list;
        },

        /**
         * Creates a survey question's response item's HTML: a number input field.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @return {object} HTML for radio buttons
         * @private
         */
        _createNumberInput: function (iQuestion, questionInfo) {
            // <input id='q1' type='number' class='number-input'>
            var list = "<input id='q" + iQuestion + "' type='number' class='number-input'>";
            return list;
        },

        /**
         * Creates a survey question's response item's HTML: a single-line text input field.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @return {object} HTML for radio buttons
         * @private
         */
        _createTextLineInput: function (iQuestion, questionInfo) {
            var list;
            if (questionInfo.domain < 32) {
                // <input id='q1' type='text' class='text-input'>
                list = "<input type='text'";
            }
            else {
                // <textarea id='q1' rows='4' class='text-input'></textarea>
                list = "<textarea rows='4'";
            }
            list += " id='q" + iQuestion + "' class='text-input' maxlength='" + questionInfo.domain + "'>";
            if (questionInfo.domain >= 32) {
                list += "</textarea>";
            }
            return list;
        },

        /**
         * Completes the HTML for a survey question.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @return {string} HTML for the end of its div
         * @private
         */
        _wrapupQuestion: function (iQuestion, questionInfo) {
            // </div>
            // <div class='clearfix'></div>
            var wrap = "";
            if (questionInfo.image && questionInfo.image.length > 0 && !questionInfo.startsWithImage) {
                wrap += "<img src='" + questionInfo.image + "' class='image-after'/><br>";
            }
            wrap += "</div><div class='clearfix'></div>";
            return wrap;
        },

        _handleButtonClick: function (evt) {
            var question = evt.target.parentElement;
            survey._checkNotificationPolicy(question, true);
        },

        _handleRadiobuttonClick: function (evt) {
            var question = evt.target.parentElement.parentElement.parentElement;
            survey._checkNotificationPolicy(question, true);
        },

        _handleDropdownClick: function (evt) {
            var question = evt.target;
            survey._checkNotificationPolicy(question, true);
        },

        _handleInputKeyup: function (evt) {
            var question = evt.target;
            survey._checkNotificationPolicy(question, question.value.length > 0);
        },

        _checkNotificationPolicy: function (question, hasValue) {
            if (hasValue) {
                survey._notifyAboutSurveyStatus(true);
            }

            // All questions are required
            if (survey._notificationPolicy === "all") {
                if (hasValue) {
                    // Clear flag for question
                    survey._requiredFieldsStatus &= ~(question.requiredFieldFlag);
                }
                else {
                    // Set flag for question
                    survey._requiredFieldsStatus |= (question.requiredFieldFlag);
                }

                // Notify survey controller if all questions have been answered
                survey._notifyAboutSurveyPolicy(survey._requiredFieldsStatus === 0);

                // Some questions are required
            }
            else if (survey._notificationPolicy === "allImportant") {
                if (question.surveyImportant) {
                    if (hasValue) {
                        // Clear flag for question
                        survey._requiredFieldsStatus &= ~(question.requiredFieldFlag);
                    }
                    else {
                        // Set flag for question
                        survey._requiredFieldsStatus |= (question.requiredFieldFlag);
                    }
                }

                // Notify survey controller if all important questions have been answered
                survey._notifyAboutSurveyPolicy(survey._requiredFieldsStatus === 0);

                // At least one question is required
            }
            else {
                if (hasValue && (question.surveyFieldStyle === "button" || question.surveyFieldStyle === "dropdown" ||
                        question.surveyFieldStyle === "list")) {
                    survey._hasUneraseableValue = true;
                }

                // Notify survey controller because at least one question has been answered
                survey._notifyAboutSurveyPolicy(hasValue || survey._hasUneraseableValue);
            }
        },

        /**
         * Extracts the text from an HTML passage.
         * @param {string} original Text which may contain HTML
         * @return {string} Text-only version of original
         * @private
         */
        _textOnly: function (original) {
            return $("<div>" + original + "</div>").text();
        }

        //------------------------------------------------------------------------------------------------------------//
    };
    return survey;
});
