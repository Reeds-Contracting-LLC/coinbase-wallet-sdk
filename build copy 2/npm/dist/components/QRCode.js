"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.QRCode = void 0;

var _hooks = require("preact/hooks");

var _qrcodeSvg = _interopRequireDefault(require("../vendor-js/qrcode-svg"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Copyright (c) 2018-2022 Coinbase, Inc. <https://www.coinbase.com/>
// Licensed under the Apache License, version 2.0
const QRCode = props => {
  const [svg, setSvg] = (0, _hooks.useState)("");
  (0, _hooks.useEffect)(() => {
    var _props$width, _props$height;

    const qrcode = new _qrcodeSvg.default({
      content: props.content,
      background: props.bgColor || "#ffffff",
      color: props.fgColor || "#000000",
      container: "svg",
      ecl: "M",
      width: (_props$width = props.width) !== null && _props$width !== void 0 ? _props$width : 256,
      height: (_props$height = props.height) !== null && _props$height !== void 0 ? _props$height : 256,
      padding: 0,
      image: props.image
    });
    const base64 = Buffer.from(qrcode.svg(), "utf8").toString("base64");
    setSvg(`data:image/svg+xml;base64,${base64}`);
  });
  return svg ? h("img", {
    src: svg,
    alt: "QR Code"
  }) : null;
};

exports.QRCode = QRCode;