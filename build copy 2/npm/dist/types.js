"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HexString = exports.BigIntString = exports.AddressString = void 0;
exports.IntNumber = IntNumber;
exports.OpaqueType = OpaqueType;
exports.RegExpString = void 0;

// Copyright (c) 2018-2022 Coinbase, Inc. <https://www.coinbase.com/>
// Licensed under the Apache License, version 2.0
function OpaqueType() {
  return value => value;
}

const HexString = OpaqueType();
exports.HexString = HexString;
const AddressString = OpaqueType();
exports.AddressString = AddressString;
const BigIntString = OpaqueType();
exports.BigIntString = BigIntString;

function IntNumber(num) {
  return Math.floor(num);
}

const RegExpString = OpaqueType();
exports.RegExpString = RegExpString;