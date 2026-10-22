(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // firebase-init.js
  var import_app = __require("firebase/app");
  var import_analytics = __require("firebase/analytics");
  var firebaseConfig = {
    apiKey: "AIzaSyATq_fequYbJtaiWFrzAfikiPKvfr8QAP8",
    authDomain: "sahaysetu-6023a.firebaseapp.com",
    projectId: "sahaysetu-6023a",
    storageBucket: "sahaysetu-6023a.firebasestorage.app",
    messagingSenderId: "561191257105",
    appId: "1:561191257105:web:c6d48382c52d03473fddb0",
    measurementId: "G-WVXTYEV3PS"
  };
  var app = (0, import_app.initializeApp)(firebaseConfig);
  window.firebaseApp = app;
  (0, import_analytics.isSupported)().then((supported) => {
    if (supported) window.firebaseAnalytics = (0, import_analytics.getAnalytics)(app);
  }).catch((error) => console.warn("Firebase Analytics is unavailable in this browser:", error));
})();
