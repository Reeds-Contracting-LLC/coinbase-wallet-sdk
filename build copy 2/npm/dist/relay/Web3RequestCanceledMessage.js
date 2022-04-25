"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Web3RequestCanceledMessage = Web3RequestCanceledMessage;

var _RelayMessage = require("./RelayMessage");

// Copyright (c) 2018-2022 Coinbase, Inc. <https://www.coinbase.com/>
// Licensed under the Apache License, version 2.0
function Web3RequestCanceledMessage(id) {
  return {
    type: _RelayMessage.RelayMessageType.WEB3_REQUEST_CANCELED,
    id
  };
}