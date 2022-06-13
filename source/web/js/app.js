/**
  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  
  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  A copy of the License is located at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  or in the "license" file accompanying this file. This file is distributed 
  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either 
  express or implied. See the License for the specific language governing 
  permissions and limitations under the License.
*/

/**
 * Router Declaration
 */
var router = null;

/**
 * Global site config object
 */
var siteConfig = null;

/**
 * Global video player
 */
var player = null;

/**
 * Cached compiled templates loaded once
 */
var homeTemplate = null;
var videosTemplate = null;
var videoTemplate = null;
//  var videoTranslatedTemplate = null;
var tweaksTemplate = null;
var vocabularyTemplate = null;

/**
 * Main application div
 */
var appDiv = null;

/**
 * Save cpations timer
 */
var saveCaptionsTimer = null;

/**
 * 2 second time out for toasts
 */
console.log("Default toast time out: " + toastr.options.timeOut);
toastr.options.timeOut = 5;
console.log("New toast time out: " + toastr.options.timeOut);

/**
 * Formats a date for display
 */
function formatDate(date) {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
}

/**
 * Formats a date time for display
 */
function formatDateTime(date) {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear(),
    hours = "" + d.getHours(),
    minutes = "" + d.getMinutes();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;
  if (hours.length < 2) hours = "0" + hours;
  if (minutes.length < 2) minutes = "0" + minutes;

  return [year, month, day].join("-") + " " + [hours, minutes].join(":");
}

/**
 * Saves the tweaks
 */
function saveTweaks(tweaksRequest) {
  var api = siteConfig.api_base + siteConfig.api_tweaks;
  console.log("[INFO] saving tweaks: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .put(api, { tweaks: tweaksRequest.split(/\r?\n/) }, axiosConfig)
    .then(function (response) {
      const { tweaks } = response.data;
      tweaks.sort();
      html = tweaksTemplate({ loading: false, tweaks: tweaks });
      appDiv.html(html);
      toastr.success("Saved tweaks");
    })
    .catch(function (error) {
      console.log("[ERROR] error while saving tweaks", error);
      toastr.error("Failed to save tweaks");
    });

  return true;
}

/**
 * Get a signed put URL for this file
 */
function getSignedUrl(file) {
  var api = siteConfig.api_base + siteConfig.api_upload;
  console.log("[INFO] fetching signed url from: " + api);

  var body = {
    fileName: file.name,
  };

  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  return axios.post(api, body, axiosConfig);
}

/**
 * Saves the captions
 */
function saveCaptions(videoId, captionIndex, caption, language) {
  var api = siteConfig.api_base + siteConfig.api_captions + "/" + videoId;
  console.log("[INFO] saving captions: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .put(
      api,
      {
        captionIndex: captionIndex,
        caption: caption,
        language: language,
        type: "SAVE-CAPTION",
      },
      axiosConfig
    )
    .then(function (response) {
      console.log("[INFO] successfully saved captions");
      toastr.success("Saved captions");
    })
    .catch(function (error) {
      console.log('[ERROR] error while saving captions" ' + error);
      toastr.error("Failed to save captions");
    });
}

/**
 * Saves the captions
 */
function updateCaptions(
  videoId,
  captionIndex,
  text,
  wordLength,
  language,
  type,
  translated
) {
  var api = siteConfig.api_base + siteConfig.api_captions + "/" + videoId;
  console.log("[INFO] updating captions: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .put(
      api,
      {
        captionIndex: captionIndex,
        text: text,
        wordLength: wordLength,
        language: language,
        type: type,
        translated: translated,
      },
      axiosConfig
    )
    .then(function (response) {
      console.log("[INFO] successfully saved captions");
      toastr.success("Saved captions");
    })
    .catch(function (error) {
      console.log('[ERROR] error while saving captions" ' + error);
      toastr.error("Failed to save captions");
    });

  return true;
}

/**
 * Saves the captions
 */
function putPreParameters(fileName, language, vocabularyValue) {
  var api = siteConfig.api_base + siteConfig.api_language;
  console.log("[INFO] put language: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  var body = {
    videoName: fileName,
    language: language,
    vocabulary: vocabularyValue,
  };
  axios
    .put(api, body, axiosConfig)
    .then(function (response) {
      console.log("[INFO] successfully put language");
      toastr.success("Put Language");
    })
    .catch(function (error) {
      console.log('[ERROR] error while putting language" ' + error);
      toastr.error("Failed to put language");
    });

  return true;
}

/**
 * Deletes a video
 */
function deleteVideo(videoId) {
  if (
    !confirm(
      "Are you sure you want to delete this video? " +
        "This will remove any existing captions and delete " +
        "all assets associated with this video including the " +
        "input video file. This action cannot be undone."
    )
  ) {
    console.log("[INFO] user cancelled request to delete a video");
    return;
  }

  console.log(
    "[INFO] commencing delete video and associated assets: " + videoId
  );

  var api = siteConfig.api_base + siteConfig.api_video + "/" + videoId;
  console.log("[INFO] deleting video: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .delete(api, axiosConfig)
    .then(function (response) {
      toastr.success("Successfully deleted video");
      console.log("[INFO] successfully deleted video");
      document.location.hash = "#videos?t=" + new Date().getTime();
    })
    .catch(function (error) {
      console.log("[ERROR] failed to delete video", error);
      toastr.error("Failed to delete video, check console logs");
    });
}

/**
 * Reprocesses a video
 */
function reprocessVideo(videoId) {
  if (
    !confirm(
      "Are you sure you want to restart " +
        "processing this video? This will " +
        "overwrite existing captions, This action " +
        "cannot be undone."
    )
  ) {
    console.log("[INFO] user cancelled request to restart processing");
    return;
  }

  console.log("[INFO] commencing reprocessing video: " + videoId);

  var api = siteConfig.api_base + siteConfig.api_video + "/" + videoId;
  console.log("[INFO] reprocessing video: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .patch(api, {}, axiosConfig)
    .then(function (response) {
      console.log("[INFO] successfully reprocessed video");
      toastr.success("Started reprocessing video");
      document.location.hash = "#videos?t=" + new Date().getTime();
    })
    .catch(function (error) {
      console.log("[ERROR] error while reprocessing video", error);
      toastr.error("Failed to reprocess video");
    });
}

/**
 * Burn in captions with uploaded video
 */
function burnCaptions(videoId, language, translated) {
  var api = siteConfig.api_base + siteConfig.api_burn + "/" + videoId;
  console.log("[INFO] Trigger burn in action: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  var body = {
    language: language,
    translated: translated,
  };

  axios
    .put(api, body, axiosConfig)
    .then(function (response) {
      toastr.success("Burn in captions success");
    })
    .catch(function (error) {
      console.log('[ERROR] error while burning captions" ' + error);
      toastr.error("Failed to burn in captions");
    });
}

/**
 * Burn in captions with uploaded video
 */
function translateCaptions(videoId, targetLanguage) {
  var api = siteConfig.api_base + siteConfig.api_translate;
  console.log("[INFO] Trigger translate in action: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  var body = {
    videoId: videoId,
    targetLanguage: targetLanguage,
  };
  axios
    .put(api, body, axiosConfig)
    .then(function (response) {
      toastr.success("Translate in captions success");
    })
    .catch(function (error) {
      console.log('[ERROR] error while translating captions" ' + error);
      toastr.error("Failed to translate in captions");
    });
}

/**
 * Downloads captions in WEBVTT format
 */
function downloadCaptionsVTT(videoId, videoName, language, translated) {
  if (translated == "true") {
    videoId = videoId + "_" + language;
  }
  var api =
    siteConfig.api_base +
    siteConfig.api_captions +
    "/" +
    videoId +
    "?format=webvtt&language=" +
    language;
  console.log("[INFO] downloading WEBVTT captions: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .get(api, axiosConfig)
    .then(function (response) {
      toastr.success("Generated WEBVTT captions");
      var blob = new Blob([response.data], { type: "text/vtt;charset=utf-8" });
      saveAs(blob, videoName + ".vtt");
    })
    .catch(function (error) {
      console.log('[ERROR] error while generating WEBVTT captions" ' + error);
      toastr.error("Failed to generate WEBVTT captions");
    });
}

/**
 * Downloads captions in TEXT format
 */
function downloadCaptionsTEXT(videoId, videoName, language, translated) {
  if (translated == "true") {
    videoId = videoId + "_" + language;
  }
  var api =
    siteConfig.api_base +
    siteConfig.api_captions +
    "/" +
    videoId +
    "?format=text&language=" +
    language;
  console.log("[INFO] downloading TEXT captions: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .get(api, axiosConfig)
    .then(function (response) {
      toastr.success("Generated TEXT captions");
      var blob = new Blob([response.data], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(blob, videoName + ".txt");
    })
    .catch(function (error) {
      console.log('[ERROR] error while generating TEXT captions" ' + error);
      toastr.error("Failed to generate TEXT captions");
    });
}

/**
 * Downloads captions in SRT format
 */
function downloadCaptionsSRT(videoId, videoName, language, translated) {
  if (translated == "true") {
    videoId = videoId + "_" + language;
  }
  var api =
    siteConfig.api_base +
    siteConfig.api_captions +
    "/" +
    videoId +
    "?format=srt&language=" +
    language;
  console.log("[INFO] downloading SRT captions: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .get(api, axiosConfig)
    .then(function (response) {
      toastr.success("Generated SRT captions");
      var blob = new Blob([response.data], { type: "text/srt;charset=utf-8" });
      saveAs(blob, videoName + ".srt");
    })
    .catch(function (error) {
      console.log('[ERROR] error while generating SRT captions" ' + error);
      toastr.error("Failed to generate SRT captions");
    });
}

/**
 * Downloads burned video in SRT format
 */
function downloadBurnedVideo(videoId, videoName, language) {
  if (language != "") {
    videoId = videoId + "_" + language;
  }
  var api = siteConfig.api_base + siteConfig.api_burned_video + "/" + videoId;
  console.log("[INFO] downloading video with captions: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .get(api, axiosConfig)
    .then(function (response) {
      toastr.success("Downloaded Video with Captions");
      console.log("[INFO] download url" + response.data);

      window.open(
        response.data.toString(),
        videoName + ".mp4",
        "noopener,noreferrer"
      );
    })
    .catch(function (error) {
      console.log('[ERROR] error while downloading burned video" ' + error);
      toastr.error("Failed to Download burned video");
    });
}

/**
 * Saves the vocabulary
 */
function saveVocabulary(vocabularyRequest) {
  var api = siteConfig.api_base + siteConfig.api_vocabulary;
  console.log("[INFO] saving vocabulary: " + api);
  let axiosConfig = {
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Api-Key": localStorage.apiKey,
    },
  };
  axios
    .put(api, { vocabulary: vocabularyRequest.split(/\r?\n/) }, axiosConfig)
    .then(function (response) {
      console.log("[INFO] got response: %j", response.data);
      var vocabulary = response.data.vocabulary;
      vocabulary.sort();
      html = vocabularyTemplate({ loading: false, vocabulary: vocabulary });
      appDiv.html(html);
      toastr.success("Saved vocabulary");
    })
    .catch(function (error) {
      console.log("[ERROR] error while saving vocabulary", error);
      toastr.error("Failed to save vocabulary");
    });

  return true;
}

/**
 * Logs in
 */
function login(passwordEdit) {
  window.localStorage.apiKey = passwordEdit.val();
  passwordEdit.val("");
  renderLoginLogout();
  renderNavBar();
  highlightNav("#homeLink");
  console.log("[INFO] saved API key");
  toastr.success("Saved API key");
  return true;
}

/**
 * Logs out
 */
function logout() {
  window.localStorage.removeItem("apiKey");
  renderLoginLogout();
  renderNavBar();
  highlightNav("#homeLink");
  console.log("[INFO] cleared API key");
  toastr.success("Cleared API Key");
  return true;
}

/**
 * Renders the login logout buttons
 */
function renderLoginLogout() {
  if (window.localStorage.apiKey) {
    document.getElementById("loginLogout").innerHTML =
      "<button type='button' class='btn btn-default' onclick='javascript:logout();'><i class='fa fa-key'></i> Clear API Key</button>";
  } else {
    document.getElementById("loginLogout").innerHTML =
      "<p>To transcribe videos you provide the API key specified during deployment:</p>" +
      "<button type='button' class='btn btn-primary' data-toggle='modal' data-target='#loginModalDialog'><i class='fa fa-key'></i> Enter API Key</button>";
  }
}

/**
 * UI function to see if the custom vocabulary is ready to save
 */
function checkVocabularyReady() {
  var api = siteConfig.api_base + siteConfig.api_vocabulary;

  axios
    .head(api, { headers: { "X-Api-Key": localStorage.apiKey } })
    .then(function (response) {
      if (response.status == 200) {
        $("#beingUpdated").hide();
        $("#topButton").show();
        $("#bottomButton").show();
      } else {
        throw new Error("Not ready yet");
      }
    })
    .catch(function (error) {
      $("#beingUpdated").show();
      $("#topButton").hide();
      $("#bottomButton").hide();
      setTimeout(checkVocabularyReady, 5000);
    });
}

/**
 * Highlights the current nav
 */
function highlightNav(navId) {
  $(".nav-link").removeClass("active");
  $(navId).addClass("active");
}

/**
 * Renders the nav bar
 */
function renderNavBar() {
  var nav =
    '<li class="nav-item"><a id="homeLink" class="nav-link" href="#">Home</a></li>';

  if (window.localStorage.apiKey) {
    nav +=
      '<li class="nav-item"><a id="videosLink" class="nav-link" href="#videos">Videos</a></li>';
    //  if (siteConfig.language != 'zh-CN')
    //  {
    // 	nav += '<li class="nav-item"><a id="vocabularyLink" class="nav-link" href="#vocabulary">Vocabulary</a></li>';
    //  }
    nav +=
      '<li class="nav-item"><a id="tweaksLink" class="nav-link" href="#tweaks">Tweaks</a></li>';
  }
  document.getElementById("navBar").innerHTML = nav;
}

/**
 * Sleep for time millis
 */
function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

/**
 * Handles dynamic routing from pages craeted post load
 */
function dynamicRoute(event) {
  event.preventDefault();
  const pathName = event.target.hash;
  console.log("[INFO] navigating dynamically to: " + pathName);
  router.navigateTo(pathName);
}

function escapeHtml(string) {
  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };
  return String(string).replace(/[&<>`=\/]/g, function (s) {
    return entityMap[s];
  });
}

function validateInput(input) {
  var isValid = /^[a-zA-z0-9, !?._-]+$/.test(input);
  return isValid;
}

/**
 * Fired once on page load, sets up the router
 * and navigates to current hash location
 */
window.addEventListener("load", () => {
  /**
   * Set up the vanilla router
   */
  router = new Router({
    mode: "hash",
    root: "/index.html",
    page404: function (path) {
      console.log("[WARN] page not found: " + path);
    },
  });

  /**
   * Get a reference to the application div
   */
  appDiv = $("#app");

  Handlebars.registerHelper("ifeq", function (a, b, options) {
    if (a == b) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  /**
   * Load site configuration and Handlebars templates
   * and compile them after they are all loaded
   */
  $.when(
    $.get("site_config.json"),
    $.get("templates/home.hbs"),
    $.get("templates/videos.hbs"),
    $.get("templates/video.hbs"),
    $.get("templates/tweaks.hbs"),
    $.get("templates/vocabulary.hbs")
  ).done(function (site, home, videos, video, tweaks, vocabulary) {
    siteConfig = site[0];
    console.log(
      "[INFO] loaded site configuration, current version: " + siteConfig.version
    );

    homeTemplate = Handlebars.compile(home[0]);
    videosTemplate = Handlebars.compile(videos[0]);
    //  videoTranslatedTemplate = Handlebars.compile(videotranslated[0]);
    videoTemplate = Handlebars.compile(video[0]);
    tweaksTemplate = Handlebars.compile(tweaks[0]);
    vocabularyTemplate = Handlebars.compile(vocabulary[0]);

    /**
     * Set up home template
     */
    router.add("", () => {
      let html = homeTemplate();
      appDiv.html(html);
      highlightNav("#homeLink");
    });

    /**
     * Set up videos template
     */
    router.add("videos", async () => {
      highlightNav("#videosLink");
      html = videosTemplate({
        loading: true,
        erroredVideos: [],
        processingVideos: [],
        readyVideos: [],
        completedVideos: [],
        enableTranslate: false,
        refreshLink: "#videos?t=" + new Date().getTime(),
      });
      appDiv.html(html);
      var api = siteConfig.api_base + siteConfig.api_videos;
      console.log("[INFO] loading videos from: " + api);
      axios
        .get(api, { headers: { "X-Api-Key": localStorage.apiKey } })
        .then(function (response) {
          var videos = response.data.videos;
          var vocabularyList = response.data.vocabularyList;
          var enableTranslate = response.data.enableTranslate;
          var defaultLanguage = response.data.defaultLanguage;

          for (var i = 0; i < videos.length; i++) {
            var video = videos[i];
            video.formattedDate = formatDate(new Date(video.processedDate));
          }

          /**
           * Filter videos by status
           */
          var erroredVideos = videos.filter(function (video) {
            return video.status === "ERRORED";
          });

          var processingVideos = videos.filter(function (video) {
            return video.status === "PROCESSING";
          });

          var readyVideos = videos.filter(function (video) {
            return video.status === "READY";
          });

          var completedVideos = videos.filter(function (video) {
            return video.status === "COMPLETE";
          });

          html = videosTemplate({
            loading: false,
            erroredVideos: erroredVideos,
            processingVideos: processingVideos,
            readyVideos: readyVideos,
            completedVideos: completedVideos,
            enableTranslate: enableTranslate,
            defaultLanguage: defaultLanguage,
            vocabularyList: vocabularyList,
            refreshLink: "#videos?t=" + new Date().getTime(),
          });
          appDiv.html(html);
        })
        .catch(function (error) {
          console.log("[ERROR] failed to load videos", error);
          alert(
            "Error loading videos, please check your API Key and network status"
          );
        });
    });

    /**
     * Set up video template
     */
    router.add("video/(:any)", (videoId) => {
      highlightNav("#videosLink");
      html = videoTemplate({
        loading: true,
        video: null,
        videoId: "Video_" + videoId,
      });
      appDiv.html(html);
      var api = siteConfig.api_base + siteConfig.api_video + "/" + videoId;
      console.log("[INFO] Loading video from: " + api);
      axios
        .get(api, { headers: { "X-Api-Key": localStorage.apiKey } })
        .then(function (response) {
          const { video } = response.data;
          console.log("[INFO] start to get s3CaptionsSignUrl");
          console.log(
            "[INFO] start to get s3CaptionsSignUrl: " + video.s3CaptionsSignUrl
          );
          var captionSignURL = video.s3CaptionsSignUrl;
          var options = {
            headers: {
              "Content-Type": "application/json",
            },
          };
          axios
            .get(captionSignURL, options)
            .then(function (captionResponse) {
              console.log("get caption successfully");
              console.log("caption response: " + captionResponse);
              video.captions = JSON.stringify(captionResponse.data);
              console.log("set value successfully");
              html = videoTemplate({
                loading: false,
                videoId: "Video_" + videoId,
                video: video,
              });
              appDiv.html(html);
            })
            .catch(function (error) {
              console.log("[ERROR] get caption error", error);
              alert(
                "Error loading video, please check your API Key and network status"
              );
            });
        })
        .catch(function (error) {
          console.log("[ERROR] Failed to load video", error);
          alert(
            "Error loading video, please check your API Key and network status"
          );
        });
    });

    /**
     * Set up tweaks template
     */
    router.add("tweaks", () => {
      highlightNav("#tweaksLink");
      html = tweaksTemplate({ loading: true, tweaks: [] });
      appDiv.html(html);
      var api = siteConfig.api_base + siteConfig.api_tweaks;
      console.log("[INFO] Loading tweaks from: " + api);
      axios
        .get(api, { headers: { "X-Api-Key": localStorage.apiKey } })
        .then(function (response) {
          const { tweaks } = response.data;
          tweaks.sort();
          html = tweaksTemplate({ loading: false, tweaks: tweaks });
          appDiv.html(html);
        })
        .catch(function (error) {
          alert(
            "Error loading tweaks, please check your API Key and network status"
          );
        });
    });

    /**
     * Set up vocabulary template
     */
    router.add("vocabulary", () => {
      highlightNav("#vocabularyLink");
      html = vocabularyTemplate({ loading: true, vocabulary: [] });
      appDiv.html(html);
      var api = siteConfig.api_base + siteConfig.api_vocabulary;
      console.log("[INFO] Loading vocabulary from: " + api);
      axios
        .get(api, { headers: { "X-Api-Key": localStorage.apiKey } })
        .then(function (response) {
          var vocabulary = response.data.vocabulary;
          vocabulary.sort();
          html = vocabularyTemplate({ loading: false, vocabulary: vocabulary });
          appDiv.html(html);
        })
        .catch(function (error) {
          alert(
            "Error loading vocabulary, please check your API Key and network status"
          );
        });
    });

    /**
     * Make hash links work
     */
    router.addUriListener();

    /**
     * Render the navigation bar
     */
    renderNavBar();

    /**
     * Load the current fragment
     */
    router.check();
  });
});
