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
//============================================================================================================================//

/**
 * Manages the display of a survey form.
 * @namespace survey
 * @version 0.1
 */
define([], function () {
    'use strict';
    var survey;
    survey = {
        //----- Events -----------------------------------------------------------------------------------------------//

        //----- Module variables -------------------------------------------------------------------------------------//

        _questions: [],
        _questionLookup: [],
        _notificationPolicy: ">=1",  // must answer ">=1", "allImportant", "all"
        _importantQuestionTooltip: "Please answer this question",  // backup for missing argument
        _requiredFieldsMask: 0,     // N.B.: Form is restricted to a maximum of 31 required fields because of
        _requiredFieldsStatus: 0,   // the way that required fields are tracked.
        _idPrefix: "",
        _inProgress: false,
        _isReadOnly: false,

        flagImportantQuestion: "Please answer this question",

        //----- Procedures available for external access -------------------------------------------------------------//

        /**
         * Parses HTML text such as appears in a webmap's feature layer's popup to generate a set of survey questions.
         * @param {string} source Text from source
         * @param {array} featureSvcFields List of fields such as the one supplied by a feature service
         * @return {array} List of survey question objects, each of which contains question, field, style, domain, important
         * properties
         */
        createSurveyDefinition: function (surveyDescription, featureSvcFields) {
            // Patch older browsers
            survey._installPolyfills();

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
            // Remove children and their events
            $(surveyContainer).children().remove();

            // Create the questions
            $.each(surveyDefinition, function (indexInArray, questionInfo) {
                var question = survey._addQuestion(surveyContainer, indexInArray, questionInfo, isReadOnly);
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

            // Render any radiobutton groups
            $(".btn-group").trigger('create');
        },

        setFormReadOnly: function (isReadOnly) {
            $.each(survey._questions, function (iQuestion, question) {
                if (question.surveyFieldStyle === "button") {
                    $.each(question.surveyValues, function (i, uiValue) {
                        $("#q" + (iQuestion + 1) + ">:nth-child(" + (i + 1) + ")").attr("disabled", isReadOnly);
                    });

                } else if (question.surveyFieldStyle === "list") {
                    $.each(question.surveyValues, function (i, uiValue) {
                        $("input[name=q" + (iQuestion + 1) + "][value=" + i + "]").attr("disabled", isReadOnly);
                    });

                } else {
                    $("#q" + (iQuestion + 1)).attr("disabled", isReadOnly);
                }
            });
        },

        clearForm: function () {},
        fillInForm: function (values) {},
        getFormAnswers: function () {},

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
                    iQuestionResult = $('#q' + iQuestion + ' .active', surveyContainer).val();
                } else if (questionInfo.style === "list") {
                    iQuestionResult = $('input[name=q' + iQuestion + ']:checked', surveyContainer).val();
                } else if (questionInfo.style === "dropdown") {
                    iQuestionResult = $('#q' + iQuestion, surveyContainer).val();
                } else if (questionInfo.style === "number") {
                    iQuestionResult = $('#q' + iQuestion, surveyContainer).val();
                } else if (questionInfo.style === "text") {
                    iQuestionResult = $('#q' + iQuestion, surveyContainer).val();
                }

                if (iQuestionResult) {
                    if (questionInfo.style === "number") {
                        objAttributes[questionInfo.field] = parseFloat(iQuestionResult);
                    } else if (questionInfo.style === "text" || questionInfo.style === "dropdown") {
                        objAttributes[questionInfo.field] = iQuestionResult;
                    } else {  // "button" or "list"
                        objAttributes[questionInfo.field] = questionInfo.values[iQuestionResult];
                    }
                }

                // Flag missing importants
                if (questionInfo.important) {
                    if (iQuestionResult) {
                        $("#qg" + iQuestion).removeClass("flag-error");
                    } else {
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

        _installPolyfills: function () {
            // source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
            if (!String.prototype.startsWith) {
                String.prototype.startsWith = function(searchString, position){
                    position = position || 0;
                    return survey.substr(position, searchString.length) === searchString;
                };
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
                var domain = null, value = null;
                if (field.domain && field.domain.codedValues) {
                    domain = $.map(field.domain.codedValues, function (item) {
                        return item.name;
                    }).join("|");
                    value = $.map(field.domain.codedValues, function (item) {
                        return item.code;
                    });
                } else if (field.length) {
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
         * @return {array} List of survey question objects, each of which contains question, field, style, domain, important
         * properties
         * @private
         */
        _parseSurvey: function (source, fieldDomains) {
            // Survey is written as a series of lines in the popup. Each line is expected to have arbitrary text followed by
            // a feature layer field name in braces followed by a question style flag also in braces.
            // Here is a sample source:
            //  <p>Is there a Structure on the Property? <b>{<font color='#0000ff'>Structure</font>} </b><b>{<span
            //  style='background-color:rgb(255, 0, 0);'>button</span>}</b></p><p><ul><li>Is the lot overgrown? <b>{Lot}
            //  </b><b>{button}</b><br /></li><li>Foundation type: <b>{<font color='#ffff00' style='background-color:
            //  rgb(255, 69, 0);'>FoundationType</font>} </b><b>{radio}</b><br /></li></ul></p><p><b><br /></b></p><p>Is
            //  there roof damage? <b>{RoofDamage} </b><b>{button}</b></p><p>Is the exterior damaged? <b>{ExteriorDamage}
            //  </b><b>{button}</b></p><p></p><ol><li>Is there graffiti? <b>{Graffiti} </b><b>{button}</b><br /></li><li>
            //  Are there boarded windows/doors? <b>{Boarded} </b><b>{button}</b><br /></li></ol>
            var surveyQuestions = [], descriptionSplit1, descriptionSplit2, descriptionSplit3, taggedSurveyLines,
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
                            } else if (part2.startsWith("image=")) {
                                surveyQuestion.startsWithImage = true;
                                surveyQuestion.style = part3;
                                surveyQuestion.image = part2.substring(6);
                            }
                        }

                        surveyQuestions.push(surveyQuestion);
                    }
                }
            });
            return surveyQuestions;
        },

        /**
         * Creates a survey form in the specified element.
         * @param {div} surveyContainer Element containing survey form
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @private
         */
        _addQuestion: function (surveyContainer, iQuestion, questionInfo, isReadOnly) {
            var question = survey._startQuestion(iQuestion, questionInfo);
            if (questionInfo.style === "button") {
                question += survey._createButtonChoice(iQuestion, questionInfo, isReadOnly);
            } else if (questionInfo.style === "list") {
                question += survey._createListChoice(iQuestion, questionInfo, isReadOnly);
            } else if (questionInfo.style === "dropdown") {
                question += survey._createDropdownChoice(iQuestion, questionInfo, isReadOnly);
            } else if (questionInfo.style === "number") {
                question += survey._createNumberInput(iQuestion, questionInfo, isReadOnly);
            } else if (questionInfo.style === "text") {
                question += survey._createTextLineInput(iQuestion, questionInfo, isReadOnly);
            }
            question += survey._wrapupQuestion(iQuestion, questionInfo, isReadOnly);
            $(surveyContainer).append(question);

            // Fix radio-button toggling
            if (questionInfo.style === "button") {
                $('#q' + iQuestion + ' button').click(function (evt) {
                    $(evt.currentTarget).addClass('active').siblings().removeClass('active');
                    $("#qg" + iQuestion).removeClass("flag-error");
                });

            } else if (questionInfo.style === "list") {
                $("[name=q" + iQuestion + "]").click(function (evt) {
                    $("#qg" + iQuestion).removeClass("flag-error");
                });

            } else {
                // Start with nothing selected in dropdown
                if (questionInfo.style === "dropdown") {
                    $("#q" + iQuestion).each(function (indexInArray, input) {
                        input.selectedIndex = -1;
                    });
                }

                $('#q' + iQuestion).change(function (evt) {
                    $("#qg" + iQuestion).removeClass("flag-error");
                });
            }
        },

        /**
         * Starts the HTML for a survey question with its label.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @return {string} HTML for question's label and the start of its div
         * @private
         */
        _startQuestion: function (iQuestion, questionInfo) {
            // <div class='form-group'>
            //   <label for='q1'>Is there a structure on the property? <span class='glyphicon glyphicon-star'></span></label><br>
            var start =
                "<div id='qg" + iQuestion + "' class='form-group'>"
                + "<label for='q" + iQuestion + "'>" + questionInfo.question + (questionInfo.important
                ? "&nbsp;<div class='importantQuestion sprites star' title=\""
                + survey.flagImportantQuestion + "\"></div>"
                : "")
                    + "</label><br>";
            if (questionInfo.image && questionInfo.image.length > 0 && questionInfo.startsWithImage) {
                start += "<img src='" + questionInfo.image + "' class='image-before'/><br>";
            }
            return start;
        },

        /**
         * Creates a survey question's response item's HTML: a set of button-style radio buttons.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {string} HTML for radio buttons
         * @private
         */
        _createButtonChoice: function (iQuestion, questionInfo, isReadOnly) {
            // <div id='q1' class='btn-group'>
            //   <button type='button' class='btn'>Yes</button>
            //   <button type='button' class='btn'>No</button>
            //   <button type='button' class='btn'>Not sure</button>
            // </div>
            var buttons = "<div id='q" + iQuestion + "' class='btn-group'>";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                buttons += "<button type='button' class='btn' value='" + i + "' " + (isReadOnly
                    ? "disabled"
                    : "") + ">" + choice + "</button>";
            });
            buttons += "</div>";
            return buttons;
        },

        /**
         * Creates a survey question's response response item's HTML: a set of list-style radio buttons.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {string} HTML for radio buttons
         * @private
         */
        _createListChoice: function (iQuestion, questionInfo, isReadOnly) {
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound1' value='0'>Crawlspace</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound2' value='1'>Raised</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound3' value='2'>Elevated</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound4' value='3'>Slab on grade</label></div>
            // <div class='radio'><label><input type='radio' name='q1' id='optionFound0' value='4'>Not sure</label></div>
            var list = "";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                list += "<div class='radio'><label><input type='radio' name='q" + iQuestion + "' value='" + i
                    + "' " + (isReadOnly
                    ? "disabled"
                    : "") + ">" + choice + "</label></div>";
            });
            return list;
        },

        /**
         * Creates a survey question's response response item's HTML: a dropdown list of options.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {object} HTML for radio buttons
         * @private
         */
        _createDropdownChoice: function (iQuestion, questionInfo, isReadOnly) {
            // <select id='q1' class='dropdown-group'>
            //   <option value='Yes'>Yes</option>
            //   <option value='No'>No</option>
            //   <option value='Notsure'>Not sure</option>
            // </select>
            var list = "<select id='q" + iQuestion + "' class='dropdown-group'>";
            var domain = questionInfo.domain.split('|');
            $.each(domain, function (i, choice) {
                list += "<option value='" + questionInfo.values[i] + "'" + (isReadOnly
                    ? " disabled"
                    : "") + ">" + choice + "</option>";
            });
            list += "</select>";
            return list;
        },

        /**
         * Creates a survey question's response response item's HTML: a number input field.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {object} HTML for radio buttons
         * @private
         */
        _createNumberInput: function (iQuestion, questionInfo, isReadOnly) {
            // <input id='q1' type='number' class='number-input'>
            var list = "<input id='q" + iQuestion + "' type='number' class='number-input'"
                + (isReadOnly
                    ? " disabled"
                    : "") + ">";
            return list;
        },

        /**
         * Creates a survey question's response response item's HTML: a single-line text input field.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {object} HTML for radio buttons
         * @private
         */
        _createTextLineInput: function (iQuestion, questionInfo, isReadOnly) {
            // <input id='q1' type='text' class='text-input'>
            var list;
            if (questionInfo.domain < 32) {
                // <input id='q1' type='text' class='text-input'>
                list = "<input type='text'";
            } else {
                // <textarea id='q1' rows='4' class='text-input'></textarea>
                list = "<textarea rows='4'";
            }
            list += " id='q" + iQuestion + "' class='text-input' maxlength='" + questionInfo.domain + "' "
                + (isReadOnly
                    ? "disabled"
                    : "") + ">";
            if (questionInfo.domain >= 32) {
                list += "</textarea>";
            }
            return list;
        },

        /**
         * Completes the HTML for a survey question.
         * @param {number} iQuestion Zero-based question number
         * @param {object} questionInfo Survey question, which contains question, field, style, domain, important
         * @param {boolean} isReadOnly Indicates if survey form elements are read-only
         * @return {string} HTML for the end of its div
         * @private
         */
        _wrapupQuestion: function (iQuestion, questionInfo, isReadOnly) {
            // </div>
            // <div class='clearfix'></div>
            var wrap = "";
            if (questionInfo.image && questionInfo.image.length > 0 && !questionInfo.startsWithImage) {
                wrap += "<img src='" + questionInfo.image + "' class='image-after'/><br>";
            }
            wrap += "</div><div class='clearfix'></div>";
            return wrap;
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

    };
    return survey;
});
