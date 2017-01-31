/*global $,FB,gapi */
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
define(["lib/i18n.min!nls/resources.js"], function (i18n) {
    "use strict";
    var handleUserSignin;
    handleUserSignin = {

        // Constants for callback to app
        notificationSignIn: 0,
        notificationSignOut: 1,
        notificationAvatarUpdate: 2,

        //------------------------------------------------------------------------------------------------------------//

        loggedIn: null,
        user: null,
        statusCallback: null,
        currentProvider: null,
        availabilities: {
            guest: false,
            facebook: false,
            googleplus: false,
            twitter: false
        },
        googleAuth: null,

        //------------------------------------------------------------------------------------------------------------//

        /**
         * Initializes the module by initializing each of the supported and selected social medium providers.
         * @param {object} appParams Application parameters to control and facilitate social-media setup; module uses
         * the facebookAppId, googleplusClientId, showFacebook, showGooglePlus, showTwitter,
         * twitterCallbackUrl, twitterSigninUrl, and twitterUserUrl properties
         * @param {function} statusCallback Function to call with social-media status events; function receives one
         * of the constants notificationSignIn, notificationSignOut, notificationAvatarUpdate (above)
         */
        init: function (appParams, statusCallback) {
            var deferred, facebookDeferred, googlePlusDeferred, twitterDeferred;

            deferred = $.Deferred();
            handleUserSignin.statusCallback = statusCallback;
            handleUserSignin.appParams = appParams;

            if (/Edge/i.test(navigator.userAgent)) {
                appParams.showFacebook = appParams.showGooglePlus = appParams.showTwitter = false;
            }

            //........................................................................................................//

            // Do we offer guest access?
            handleUserSignin.availabilities.guest = appParams.showGuest;

            //........................................................................................................//

            // Attempt to initialize Facebook if wanted
            facebookDeferred = $.Deferred();
            setTimeout(function () {
                if (appParams.showFacebook && appParams.facebookAppId) {
                    $.ajaxSetup({
                        cache: true
                    });
                    $.getScript("//connect.facebook.net/en_US/sdk.js", function () {
                        FB.Event.subscribe("auth.login", handleUserSignin.updateFacebookUser);
                        FB.Event.subscribe("auth.statusChange", handleUserSignin.updateFacebookUser);
                        FB.Event.subscribe("auth.logout", handleUserSignin.updateFacebookUser);

                        FB.init({
                            appId: handleUserSignin.appParams.facebookAppId,
                            cookie: true, // enable cookies to allow the server to access the session
                            xfbml: false, // parse social plugins on this page such as Login
                            status: true, // check login status on every page load
                            version: "v2.7"
                        });

                        // Update UI based on whether or not the user is currently logged in to FB
                        FB.getLoginStatus(handleUserSignin.updateFacebookUser);
                    });

                    handleUserSignin.availabilities.facebook = true;
                    facebookDeferred.resolve(true);
                }
                else {
                    facebookDeferred.resolve(false);
                }
            });

            //........................................................................................................//

            // Attempt to initialize Google+ if wanted
            googlePlusDeferred = $.Deferred();
            setTimeout(function () {
                if (appParams.showGooglePlus && appParams.googleplusClientId) {
                    // Load the SDK asynchronously; it calls window.ggAsyncInit when done
                    (function () {
                        // Don't have Google+ API scan page for button
                        window.___gcfg = {
                            parsetags: "explicit"
                        };

                        $.getScript("https://apis.google.com/js/platform.js")
                            .done(function () {
                                gapi.load("auth2", function () {
                                    handleUserSignin.googleAuth = gapi.auth2.init({
                                        "client_id": handleUserSignin.appParams.googleplusClientId,
                                        "scope": "profile"
                                    });
                                    handleUserSignin.googleAuth.then(function () {
                                        handleUserSignin.googleAuth.isSignedIn.listen(
                                            handleUserSignin.updateGooglePlusUser);
                                        handleUserSignin.availabilities.googleplus = true;
                                        googlePlusDeferred.resolve(true);
                                    }, function () {
                                        googlePlusDeferred.resolve(false);
                                    });
                                });
                            })
                            .fail(function () {
                                googlePlusDeferred.resolve(false);
                            });
                    }());
                }
                else {
                    googlePlusDeferred.resolve(false);
                }
            });

            //........................................................................................................//

            // Attempt to initialize Twitter if wanted
            twitterDeferred = $.Deferred();
            setTimeout(function () {
                if (appParams.showTwitter) {
                    handleUserSignin.availabilities.twitter = true;
                    twitterDeferred.resolve(true);
                }
                else {
                    twitterDeferred.resolve(false);
                }
            });

            //........................................................................................................//

            // Test if we have any initialized providers
            $.when(facebookDeferred, googlePlusDeferred, twitterDeferred)
                .done(function (facebookAvail, googlePlusAvail, twitterAvail) {
                    if (handleUserSignin.availabilities.guest || facebookAvail || googlePlusAvail || twitterAvail) {
                        deferred.resolve();
                    }
                    else {
                        deferred.reject();
                    }
                });

            return deferred;
        },

        initUI: function (actionButtonContainer) {

            if (handleUserSignin.availabilities.guest) {
                $("<div id='guestSignin' class='splashInfoActionButton guestOfficialColor'>" +
                    "<span class='socialMediaIcon sprites guest-user_29'></span>" +
                    i18n.labels.guestName + "</div>").appendTo(actionButtonContainer);
                $("#guestSignin").on("click", function () {
                    handleUserSignin.loggedIn = true;
                    handleUserSignin.currentProvider = "guest";

                    handleUserSignin.user = {
                        name: i18n.labels.guestName,
                        id: "",
                        org: "_guest_",
                        canSubmit: handleUserSignin.appParams.allowGuestSubmissions
                    };

                    // Update the calling app
                    handleUserSignin.statusCallback(handleUserSignin.notificationSignIn);
                });
            }

            if (handleUserSignin.availabilities.facebook) {
                $("<div id='facebookSignin' class='splashInfoActionButton facebookOfficialColor'>" +
                    "<span class='socialMediaIcon sprites FB-f-Logo__blue_29'></span>" +
                    "Facebook</div>").appendTo(actionButtonContainer);
                $("#facebookSignin").on("click", function () {
                    // Force reauthorization. FB says, "Apps should build their own mechanisms for allowing switching
                    // between different Facebook user accounts using log out functions and should not rely upon
                    // re-authentication for this."  (https://developers.facebook.com/docs/facebook-login/reauthentication),
                    // but doesn't seem to provide a working logout function that clears its cookies if third-party
                    // cookies are blocked.
                    FB.login(function () {
                        return null;
                    }, {
                        auth_type: "reauthenticate"
                    });
                });
            }

            if (handleUserSignin.availabilities.googleplus) {
                $("<div id='googlePlusSignin' class='splashInfoActionButton googlePlusOfficialColor'>" +
                    "<span class='socialMediaIcon sprites gp-29'></span>Google+</div>").appendTo(actionButtonContainer);
                $("#googlePlusSignin").on("click", function () {
                    if (handleUserSignin.googleAuth.isSignedIn.get()) {
                        handleUserSignin.updateGooglePlusUser(true);
                    }
                    else {
                        handleUserSignin.googleAuth.signIn();
                    }
                });
            }

            if (handleUserSignin.availabilities.twitter) {
                $("<div id='twitterSignin' class='splashInfoActionButton twitterOfficialColor'>" +
                    "<span class='socialMediaIcon sprites Twitter_logo_blue_29'></span>" +
                    "Twitter</div>").appendTo(actionButtonContainer);
                $("#twitterSignin").on("click", function () {
                    handleUserSignin.showTwitterLoginWin(false);
                });
            }

        },

        /**
         * Returns the signed-in state.
         * @return {boolean} Logged in or not
         */
        isSignedIn: function () {
            return handleUserSignin.loggedIn;
        },

        /**
         * Returns the currently signed-in user name and service id.
         * @return {object} Structure containing "name" and "id" parameters if a user is
         * logged in, an empty structure if a user is not logged in, and null if the
         * service is not available due to browser incompatibility or startup failure
         */
        getUser: function () {
            return handleUserSignin.user;
        },

        /**
         * Signs the user out of the currently-active social medium provider.
         */
        signOut: function () {
            if (handleUserSignin.isSignedIn()) {
                switch (handleUserSignin.currentProvider) {

                    case "guest":
                        handleUserSignin.user = {};

                        // Update the calling app
                        handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
                        break;

                    case "facebook":
                        // Log the user out of the app; known FB issue is that cookies are not cleared as promised if
                        // browser set to block third-party cookies
                        // (https://developers.facebook.com/bugs/406554842852890/)
                        FB.logout();
                        break;

                    case "googlePlus":
                        // Log the user out of the app
                        handleUserSignin.googleAuth.signOut();
                        break;

                    case "twitter":
                        // Update the calling app
                        handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);

                        // Log the user out of the app
                        handleUserSignin.showTwitterLoginWin(true);
                        break;
                }
            }
            handleUserSignin.currentProvider = "none";
        },

        //------------------------------------------------------------------------------------------------------------//

        /**
         * Updates the information held about the signed-in Facebook user.
         * @param {object} [response] Service-specific response object
         * @private
         */
        updateFacebookUser: function (response) {
            // Events & FB.getLoginStatus return an updated authResponse object
            // {
            //     status: "connected",
            //     authResponse: {
            //         accessToken: "...",
            //         expiresIn:"...",
            //         signedRequest:"...",
            //         userID:"..."
            //     }
            // }

            // that response may not be true; we'll find out for sure when we call FB.api
            handleUserSignin.loggedIn = response && response.status === "connected";
            handleUserSignin.currentProvider = handleUserSignin.loggedIn ?
                "facebook" :
                "";

            // If logged in, update info from the account
            handleUserSignin.user = {};
            if (handleUserSignin.loggedIn) {
                FB.api("/me", {
                    fields: "name,id"
                }, function (apiResponse) {
                    handleUserSignin.loggedIn = apiResponse.name !== undefined;
                    if (handleUserSignin.loggedIn) {
                        handleUserSignin.user = {
                            name: apiResponse.name,
                            id: apiResponse.id,
                            org: "Facebook",
                            canSubmit: true
                        };
                        // Update the calling app
                        handleUserSignin.statusCallback(handleUserSignin.notificationSignIn);

                        // Update the avatar
                        FB.api("/" + handleUserSignin.user.id + "/picture", function (picResponse) {
                            if (picResponse && !picResponse.error && picResponse.data &&
                                !picResponse.data.is_silhouette && picResponse.data.url) {
                                handleUserSignin.user.avatar = picResponse.data.url;
                            }
                            // Update the calling app
                            handleUserSignin.statusCallback(handleUserSignin.notificationAvatarUpdate);
                        });
                    }
                    handleUserSignin.statusCallback(handleUserSignin.notificationAvatarUpdate);
                });

            }
            else {
                // Update the calling app
                handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
            }
        },

        //------------------------------------------------------------------------------------------------------------//

        /**
         * Updates the information held about the signed-in Google+ user.
         * @param {object} [response] Service-specific response object
         * @private
         */
        updateGooglePlusUser: function (response) {
            var GoogleUser, BasicProfile, avatarUrl;
            handleUserSignin.loggedIn = response; //&& response.status && response.status.signed_in;
            handleUserSignin.currentProvider = handleUserSignin.loggedIn ?
                "googlePlus" :
                "";

            // If logged in, update info from the account
            handleUserSignin.user = {};
            if (handleUserSignin.loggedIn) {
                GoogleUser = handleUserSignin.googleAuth.currentUser.get();
                BasicProfile = GoogleUser.getBasicProfile();
                handleUserSignin.user = {
                    name: BasicProfile.getName(),
                    id: BasicProfile.getId(),
                    org: "Google+",
                    canSubmit: true
                };

                // Update the calling app
                handleUserSignin.statusCallback(handleUserSignin.notificationSignIn);

                // Update the avatar
                avatarUrl = BasicProfile.getImageUrl();
                if (avatarUrl) {
                    handleUserSignin.user.avatar = avatarUrl;
                    handleUserSignin.statusCallback(handleUserSignin.notificationAvatarUpdate);
                }

                // Report not-logged-in state
            }
            else {
                handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
            }
        },

        //------------------------------------------------------------------------------------------------------------//

        /**
         * Displays the Twitter login window.
         * @param {boolean} [forceLogin] If false or omitted, sets up for login; if true, sets up for logout
         * @private
         */
        showTwitterLoginWin: function (forceLogin) {
            var baseUrl, package_path, redirect_uri, left, top, w, h;

            baseUrl = handleUserSignin.appParams.twitterSigninUrl;
            package_path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));
            redirect_uri = encodeURIComponent(location.protocol + "//" + location.host +
                package_path + handleUserSignin.appParams.twitterCallbackUrl);
            left = (screen.width / 2) - (w / 2);
            top = (screen.height / 2) - (h / 2);
            w = screen.width / 2;
            h = screen.height / 1.5;

            baseUrl += "?";
            if (forceLogin) {
                baseUrl += "force_login=true";
                if (redirect_uri) {
                    baseUrl += "&";
                }
            }
            if (redirect_uri) {
                baseUrl += "redirect_uri=" + redirect_uri;
            }

            window.open(baseUrl, "twoAuth", "scrollbars=yes, resizable=yes, left=" + left +
                ", top=" + top + ", width=" + w + ", height=" + h, true);
            window.oAuthCallback = function () {
                handleUserSignin.updateTwitterUser();
            };
        },

        /**
         * Updates the information held about the signed-in Twitter user.
         * @param {object} [response] Service-specific response object
         * @private
         */
        updateTwitterUser: function () {
            var query = {
                include_entities: true,
                skip_status: true
            };
            $.ajax({
                url: handleUserSignin.appParams.twitterUserUrl,
                data: query,
                dataType: "jsonp",
                timeout: 10000,
                success: function (data) {

                    handleUserSignin.loggedIn = data && !data.hasOwnProperty("signedIn") && !data.signedIn;
                    handleUserSignin.currentProvider = handleUserSignin.loggedIn ?
                        "twitter" :
                        "";

                    if (handleUserSignin.loggedIn) {
                        handleUserSignin.user = {
                            name: data.name,
                            id: data.id_str,
                            org: "Twitter",
                            canSubmit: true
                        };

                        // Update the calling app
                        handleUserSignin.statusCallback(handleUserSignin.notificationSignIn);

                        // Update the avatar
                        if (!data.default_profile_image && data.profile_image_url_https) {
                            handleUserSignin.user.avatar = data.profile_image_url_https;
                            handleUserSignin.statusCallback(handleUserSignin.notificationAvatarUpdate);
                        }
                    }
                    else {
                        handleUserSignin.user = {};

                        // Update the calling app
                        handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
                    }
                },
                error: function () {
                    // handle an error condition
                    handleUserSignin.loggedIn = false;

                    // Update the calling app
                    handleUserSignin.statusCallback(handleUserSignin.notificationSignOut);
                }
            }, "json");
        }

    };
    return handleUserSignin;
    //----------------------------------------------------------------------------------------------------------------//
});
