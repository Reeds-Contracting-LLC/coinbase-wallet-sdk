"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Session = void 0;

var _jsSha = require("js-sha256");

var _rxjs = require("rxjs");

var _operators = require("rxjs/operators");

var _util = require("../util");

// Copyright (c) 2018-2022 Coinbase, Inc. <https://www.coinbase.com/>
// Licensed under the Apache License, version 2.0
const STORAGE_KEY_SESSION_ID = "session:id";
const STORAGE_KEY_SESSION_SECRET = "session:secret";
const STORAGE_KEY_SESSION_LINKED = "session:linked";

class Session {
  constructor(storage, id, secret, linked) {
    this._storage = storage;
    this._id = id || (0, _util.randomBytesHex)(16);
    this._secret = secret || (0, _util.randomBytesHex)(32);

    const hash = _jsSha.sha256.create();

    hash.update(`${this._id}, ${this._secret} WalletLink`); // ensure old sessions stay connected

    this._key = hash.hex();
    this._linked = !!linked;
  }

  static load(storage) {
    const id = storage.getItem(STORAGE_KEY_SESSION_ID);
    const linked = storage.getItem(STORAGE_KEY_SESSION_LINKED);
    const secret = storage.getItem(STORAGE_KEY_SESSION_SECRET);

    if (id && secret) {
      return new Session(storage, id, secret, linked === "1");
    }

    return null;
  }

  static get persistedSessionIdChange$() {
    return (0, _rxjs.fromEvent)(window, "storage").pipe((0, _operators.filter)(evt => evt.key === STORAGE_KEY_SESSION_ID), (0, _operators.map)(evt => ({
      oldValue: evt.oldValue || null,
      newValue: evt.newValue || null
    })));
  }
  /**
   * Takes in a session ID and returns the sha256 hash of it.
   * @param sessionId session ID
   */


  static hash(sessionId) {
    const hash = _jsSha.sha256.create();

    return hash.update(sessionId).hex();
  }

  get id() {
    return this._id;
  }

  get secret() {
    return this._secret;
  }

  get key() {
    return this._key;
  }

  get linked() {
    return this._linked;
  }

  set linked(val) {
    this._linked = val;
    this.persistLinked();
  }

  save() {
    this._storage.setItem(STORAGE_KEY_SESSION_ID, this._id);

    this._storage.setItem(STORAGE_KEY_SESSION_SECRET, this._secret);

    this.persistLinked();
    return this;
  }

  persistLinked() {
    this._storage.setItem(STORAGE_KEY_SESSION_LINKED, this._linked ? "1" : "0");
  }

}

exports.Session = Session;