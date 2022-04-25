"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Snackbar = void 0;

var _clsx = _interopRequireDefault(require("clsx"));

var _preact = require("preact");

var _hooks = require("preact/hooks");

var _SnackbarCss = _interopRequireDefault(require("./Snackbar-css"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const cblogo = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEuNDkyIDEwLjQxOWE4LjkzIDguOTMgMCAwMTguOTMtOC45M2gxMS4xNjNhOC45MyA4LjkzIDAgMDE4LjkzIDguOTN2MTEuMTYzYTguOTMgOC45MyAwIDAxLTguOTMgOC45M0gxMC40MjJhOC45MyA4LjkzIDAgMDEtOC45My04LjkzVjEwLjQxOXoiIGZpbGw9IiMxNjUyRjAiLz48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTEwLjQxOSAwSDIxLjU4QzI3LjMzNSAwIDMyIDQuNjY1IDMyIDEwLjQxOVYyMS41OEMzMiAyNy4zMzUgMjcuMzM1IDMyIDIxLjU4MSAzMkgxMC40MkM0LjY2NSAzMiAwIDI3LjMzNSAwIDIxLjU4MVYxMC40MkMwIDQuNjY1IDQuNjY1IDAgMTAuNDE5IDB6bTAgMS40ODhhOC45MyA4LjkzIDAgMDAtOC45MyA4LjkzdjExLjE2M2E4LjkzIDguOTMgMCAwMDguOTMgOC45M0gyMS41OGE4LjkzIDguOTMgMCAwMDguOTMtOC45M1YxMC40MmE4LjkzIDguOTMgMCAwMC04LjkzLTguOTNIMTAuNDJ6IiBmaWxsPSIjZmZmIi8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNS45OTggMjYuMDQ5Yy01LjU0OSAwLTEwLjA0Ny00LjQ5OC0xMC4wNDctMTAuMDQ3IDAtNS41NDggNC40OTgtMTAuMDQ2IDEwLjA0Ny0xMC4wNDYgNS41NDggMCAxMC4wNDYgNC40OTggMTAuMDQ2IDEwLjA0NiAwIDUuNTQ5LTQuNDk4IDEwLjA0Ny0xMC4wNDYgMTAuMDQ3eiIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0xMi43NjIgMTQuMjU0YzAtLjgyMi42NjctMS40ODkgMS40ODktMS40ODloMy40OTdjLjgyMiAwIDEuNDg4LjY2NiAxLjQ4OCAxLjQ4OXYzLjQ5N2MwIC44MjItLjY2NiAxLjQ4OC0xLjQ4OCAxLjQ4OGgtMy40OTdhMS40ODggMS40ODggMCAwMS0xLjQ4OS0xLjQ4OHYtMy40OTh6IiBmaWxsPSIjMTY1MkYwIi8+PC9zdmc+`;
const gearIcon = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEyIDYuNzV2LTEuNWwtMS43Mi0uNTdjLS4wOC0uMjctLjE5LS41Mi0uMzItLjc3bC44MS0xLjYyLTEuMDYtMS4wNi0xLjYyLjgxYy0uMjQtLjEzLS41LS4yNC0uNzctLjMyTDYuNzUgMGgtMS41bC0uNTcgMS43MmMtLjI3LjA4LS41My4xOS0uNzcuMzJsLTEuNjItLjgxLTEuMDYgMS4wNi44MSAxLjYyYy0uMTMuMjQtLjI0LjUtLjMyLjc3TDAgNS4yNXYxLjVsMS43Mi41N2MuMDguMjcuMTkuNTMuMzIuNzdsLS44MSAxLjYyIDEuMDYgMS4wNiAxLjYyLS44MWMuMjQuMTMuNS4yMy43Ny4zMkw1LjI1IDEyaDEuNWwuNTctMS43MmMuMjctLjA4LjUyLS4xOS43Ny0uMzJsMS42Mi44MSAxLjA2LTEuMDYtLjgxLTEuNjJjLjEzLS4yNC4yMy0uNS4zMi0uNzdMMTIgNi43NXpNNiA4LjVhMi41IDIuNSAwIDAxMC01IDIuNSAyLjUgMCAwMTAgNXoiIGZpbGw9IiMwNTBGMTkiLz48L3N2Zz4=`;

class Snackbar {
  constructor(options) {
    _defineProperty(this, "items", new Map());

    _defineProperty(this, "nextItemKey", 0);

    _defineProperty(this, "root", null);

    this.darkMode = options.darkMode;
  }

  attach(el) {
    this.root = document.createElement("div");
    this.root.className = "-cbwsdk-snackbar-root";
    el.appendChild(this.root);
    this.render();
  }

  presentItem(itemProps) {
    const key = this.nextItemKey++;
    this.items.set(key, itemProps);
    this.render();
    return () => {
      this.items.delete(key);
      this.render();
    };
  }

  clear() {
    this.items.clear();
    this.render();
  }

  render() {
    if (!this.root) {
      return;
    }

    (0, _preact.render)(h("div", null, h(SnackbarContainer, {
      darkMode: this.darkMode
    }, Array.from(this.items.entries()).map(([key, itemProps]) => h(SnackbarInstance, _extends({}, itemProps, {
      key: key
    }))))), this.root);
  }

}

exports.Snackbar = Snackbar;

const SnackbarContainer = props => h("div", {
  class: (0, _clsx.default)("-cbwsdk-snackbar-container")
}, h("style", null, _SnackbarCss.default), h("div", {
  class: "-cbwsdk-snackbar"
}, props.children));

const SnackbarInstance = ({
  autoExpand,
  message,
  menuItems
}) => {
  const [hidden, setHidden] = (0, _hooks.useState)(true);
  const [expanded, setExpanded] = (0, _hooks.useState)(autoExpand !== null && autoExpand !== void 0 ? autoExpand : false);
  (0, _hooks.useEffect)(() => {
    const timers = [window.setTimeout(() => {
      setHidden(false);
    }, 1), window.setTimeout(() => {
      setExpanded(true);
    }, 10000)];
    return () => {
      timers.forEach(window.clearTimeout);
    };
  });

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return h("div", {
    class: (0, _clsx.default)("-cbwsdk-snackbar-instance", hidden && "-cbwsdk-snackbar-instance-hidden", expanded && "-cbwsdk-snackbar-instance-expanded")
  }, h("div", {
    class: "-cbwsdk-snackbar-instance-header",
    onClick: toggleExpanded
  }, h("img", {
    src: cblogo,
    class: "-cbwsdk-snackbar-instance-header-cblogo"
  }), h("div", {
    class: "-cbwsdk-snackbar-instance-header-message"
  }, message), h("div", {
    class: "-gear-container"
  }, !expanded && h("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg"
  }, h("circle", {
    cx: "12",
    cy: "12",
    r: "12",
    fill: "#F5F7F8"
  })), h("img", {
    src: gearIcon,
    class: "-gear-icon",
    title: "Expand"
  }))), menuItems && menuItems.length > 0 && h("div", {
    class: "-cbwsdk-snackbar-instance-menu"
  }, menuItems.map((action, i) => h("div", {
    class: (0, _clsx.default)("-cbwsdk-snackbar-instance-menu-item", action.isRed && "-cbwsdk-snackbar-instance-menu-item-is-red"),
    onClick: action.onClick,
    key: i
  }, h("svg", {
    width: action.svgWidth,
    height: action.svgHeight,
    viewBox: "0 0 10 11",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg"
  }, h("path", {
    "fill-rule": action.defaultFillRule,
    "clip-rule": action.defaultClipRule,
    d: action.path,
    fill: "#AAAAAA"
  })), h("span", {
    class: (0, _clsx.default)("-cbwsdk-snackbar-instance-menu-item-info", action.isRed && "-cbwsdk-snackbar-instance-menu-item-info-is-red")
  }, action.info)))));
};