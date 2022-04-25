"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LinkFlow = void 0;

var _preact = require("preact");

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _LinkDialog = require("./LinkDialog");

var _TryExtensionLinkDialog = require("./TryExtensionLinkDialog");

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class LinkFlow {
  // if true, hide QR code in LinkFlow (which happens if no jsonRpcUrl is provided)
  constructor(options) {
    _defineProperty(this, "extensionUI$", new _rxjs.BehaviorSubject({}));

    _defineProperty(this, "subscriptions", new _rxjs.Subscription());

    _defineProperty(this, "isConnected", false);

    _defineProperty(this, "isOpen", false);

    _defineProperty(this, "onCancel", null);

    _defineProperty(this, "root", null);

    _defineProperty(this, "connectDisabled", false);

    this.darkMode = options.darkMode;
    this.version = options.version;
    this.sessionId = options.sessionId;
    this.sessionSecret = options.sessionSecret;
    this.linkAPIUrl = options.linkAPIUrl;
    this.isParentConnection = options.isParentConnection;
    this.connected$ = options.connected$; // Check if extension UI is enabled

    fetch("https://api.wallet.coinbase.com/rpc/v2/getFeatureFlags").then(res => res.json()).then(json => {
      const enabled = json.result.desktop.extension_ui;

      if (typeof enabled === "undefined") {
        this.extensionUI$.next({
          value: false
        });
      } else {
        this.extensionUI$.next({
          value: enabled
        });
      }
    }).catch(err => {
      console.error("Couldn't fetch feature flags - ", err);
      this.extensionUI$.next({
        value: false
      });
    });
  }

  attach(el) {
    this.root = document.createElement("div");
    this.root.className = "-cbwsdk-link-flow-root";
    el.appendChild(this.root);
    this.render();
    this.subscriptions.add(this.connected$.subscribe(v => {
      if (this.isConnected !== v) {
        this.isConnected = v;
        this.render();
      }
    }));
  }

  detach() {
    var _this$root$parentElem;

    if (!this.root) {
      return;
    }

    this.subscriptions.unsubscribe();
    (0, _preact.render)(null, this.root);
    (_this$root$parentElem = this.root.parentElement) === null || _this$root$parentElem === void 0 ? void 0 : _this$root$parentElem.removeChild(this.root);
  }

  setConnectDisabled(connectDisabled) {
    this.connectDisabled = connectDisabled;
  }

  open(options) {
    this.isOpen = true;
    this.onCancel = options.onCancel;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.onCancel = null;
    this.render();
  }

  render() {
    if (!this.root) {
      return;
    }

    const subscription = this.extensionUI$.pipe((0, _operators.first)(enabled => enabled.value !== undefined)) // wait for a valid value before rendering
    .subscribe(enabled => {
      if (!this.root) {
        return;
      }

      (0, _preact.render)(enabled.value ? h(_TryExtensionLinkDialog.TryExtensionLinkDialog, {
        darkMode: this.darkMode,
        version: this.version,
        sessionId: this.sessionId,
        sessionSecret: this.sessionSecret,
        linkAPIUrl: this.linkAPIUrl,
        isOpen: this.isOpen,
        isConnected: this.isConnected,
        isParentConnection: this.isParentConnection,
        onCancel: this.onCancel,
        connectDisabled: this.connectDisabled
      }) : h(_LinkDialog.LinkDialog, {
        darkMode: this.darkMode,
        version: this.version,
        sessionId: this.sessionId,
        sessionSecret: this.sessionSecret,
        linkAPIUrl: this.linkAPIUrl,
        isOpen: this.isOpen,
        isConnected: this.isConnected,
        isParentConnection: this.isParentConnection,
        onCancel: this.onCancel
      }), this.root);
    });
    this.subscriptions.add(subscription);
  }

}

exports.LinkFlow = LinkFlow;