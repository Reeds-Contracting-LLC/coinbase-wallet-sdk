"use strict";

var _util = require("./util");

test("uint8ArrayToHex", () => {
  expect((0, _util.uint8ArrayToHex)(new Uint8Array(6))).toEqual("000000000000");
});