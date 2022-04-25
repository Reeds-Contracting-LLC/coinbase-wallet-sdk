"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CoinbaseWalletProvider = void 0;

var _safeEventEmitter = _interopRequireDefault(require("@metamask/safe-event-emitter"));

var _bn = _interopRequireDefault(require("bn.js"));

var _ethRpcErrors = require("eth-rpc-errors");

var _EventListener = require("../connection/EventListener");

var _Session = require("../relay/Session");

var _WalletSDKRelayAbstract = require("../relay/WalletSDKRelayAbstract");

var _util = require("../util");

var _ethEip712Util = _interopRequireDefault(require("../vendor-js/eth-eip712-util"));

var _FilterPolyfill = require("./FilterPolyfill");

var _JSONRPC = require("./JSONRPC");

var _SubscriptionManager = require("./SubscriptionManager");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const DEFAULT_CHAIN_ID_KEY = "DefaultChainId";
const DEFAULT_JSON_RPC_URL = "DefaultJsonRpcUrl"; // Indicates chain has been switched by switchEthereumChain or addEthereumChain request

const HAS_CHAIN_BEEN_SWITCHED_KEY = "HasChainBeenSwitched";
const HAS_CHAIN_OVERRIDDEN_FROM_RELAY = "HasChainOverriddenFromRelay";

class CoinbaseWalletProvider extends _safeEventEmitter.default {
  // So dapps can easily identify Coinbase Wallet for enabling features like 3085 network switcher menus
  constructor(options) {
    var _options$overrideIsCo;

    super();

    _defineProperty(this, "_filterPolyfill", new _FilterPolyfill.FilterPolyfill(this));

    _defineProperty(this, "_subscriptionManager", new _SubscriptionManager.SubscriptionManager(this));

    _defineProperty(this, "_relay", null);

    _defineProperty(this, "_addresses", []);

    _defineProperty(this, "hasMadeFirstChainChangedEmission", false);

    _defineProperty(this, "_send", this.send.bind(this));

    _defineProperty(this, "_sendAsync", this.sendAsync.bind(this));

    this.setProviderInfo = this.setProviderInfo.bind(this);
    this.updateProviderInfo = this.updateProviderInfo.bind(this);
    this.getChainId = this.getChainId.bind(this);
    this.setAppInfo = this.setAppInfo.bind(this);
    this.enable = this.enable.bind(this);
    this.close = this.close.bind(this);
    this.send = this.send.bind(this);
    this.sendAsync = this.sendAsync.bind(this);
    this.request = this.request.bind(this);
    this._setAddresses = this._setAddresses.bind(this);
    this.scanQRCode = this.scanQRCode.bind(this);
    this.genericRequest = this.genericRequest.bind(this);
    this._jsonRpcUrlFromOpts = options.jsonRpcUrl;
    this._overrideIsMetaMask = options.overrideIsMetaMask;
    this._relayProvider = options.relayProvider;
    this._storage = options.storage;
    this._relayEventManager = options.relayEventManager;
    this._eventListener = options.eventListener;
    this.isCoinbaseWallet = (_options$overrideIsCo = options.overrideIsCoinbaseWallet) !== null && _options$overrideIsCo !== void 0 ? _options$overrideIsCo : true;
    this.qrUrl = options.qrUrl;
    this.supportsAddressSwitching = options.supportsAddressSwitching;
    const chainId = this.getChainId();
    const chainIdStr = (0, _util.prepend0x)(chainId.toString(16)); // indicate that we've connected, for EIP-1193 compliance

    this.emit("connect", {
      chainIdStr
    });

    const cachedAddresses = this._storage.getItem(_WalletSDKRelayAbstract.LOCAL_STORAGE_ADDRESSES_KEY);

    if (cachedAddresses) {
      const addresses = cachedAddresses.split(" ");

      if (addresses[0] !== "") {
        this._addresses = addresses.map(address => (0, _util.ensureAddressString)(address));
        this.emit("accountsChanged", addresses);
      }
    }

    this._subscriptionManager.events.on("notification", notification => {
      this.emit("message", {
        type: notification.method,
        data: notification.params
      });
    });

    if (this._addresses.length > 0) {
      void this.initializeRelay();
    }

    window.addEventListener("message", event => {
      if (event.data.type !== "walletLinkMessage") return; // compatibility with CBW extension

      if (event.data.data.action === "defaultChainChanged") {
        var _event$data$data$json;

        const _chainId = event.data.data.chainId;
        const jsonRpcUrl = (_event$data$data$json = event.data.data.jsonRpcUrl) !== null && _event$data$data$json !== void 0 ? _event$data$data$json : this.jsonRpcUrl;
        this.updateProviderInfo(jsonRpcUrl, Number(_chainId), true);
      }
    });
  }

  get selectedAddress() {
    return this._addresses[0] || undefined;
  }

  get networkVersion() {
    return this.getChainId().toString(10);
  }

  get chainId() {
    return (0, _util.prepend0x)(this.getChainId().toString(16));
  }

  get isWalletLink() {
    // backward compatibility
    return true;
  }
  /**
   * Some DApps (i.e. Alpha Homora) seem to require the window.ethereum object return
   * true for this method.
   */


  get isMetaMask() {
    return this._overrideIsMetaMask;
  }

  get host() {
    return this.jsonRpcUrl;
  }

  get connected() {
    return true;
  }

  isConnected() {
    return true;
  }

  get jsonRpcUrl() {
    var _this$_storage$getIte;

    return (_this$_storage$getIte = this._storage.getItem(DEFAULT_JSON_RPC_URL)) !== null && _this$_storage$getIte !== void 0 ? _this$_storage$getIte : this._jsonRpcUrlFromOpts;
  }

  set jsonRpcUrl(value) {
    this._storage.setItem(DEFAULT_JSON_RPC_URL, value);
  }

  get isChainOverridden() {
    return this._storage.getItem(HAS_CHAIN_OVERRIDDEN_FROM_RELAY) === "true";
  }

  set isChainOverridden(value) {
    this._storage.setItem(HAS_CHAIN_OVERRIDDEN_FROM_RELAY, value.toString());
  } // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore


  setProviderInfo(jsonRpcUrl, chainId) {
    if (this.isChainOverridden) return;
    this.updateProviderInfo(jsonRpcUrl, this.getChainId(), false);
  }

  updateProviderInfo(jsonRpcUrl, chainId, fromRelay) {
    const hasChainSwitched = this._storage.getItem(HAS_CHAIN_BEEN_SWITCHED_KEY) === "true";
    if (hasChainSwitched && fromRelay) return;

    if (fromRelay) {
      this.isChainOverridden = true;
    }

    this.jsonRpcUrl = jsonRpcUrl; // emit chainChanged event if necessary

    const originalChainId = this.getChainId();

    this._storage.setItem(DEFAULT_CHAIN_ID_KEY, chainId.toString(10));

    const chainChanged = (0, _util.ensureIntNumber)(chainId) !== originalChainId;

    if (chainChanged || !this.hasMadeFirstChainChangedEmission) {
      this.emit("chainChanged", this.getChainId());
      this.hasMadeFirstChainChangedEmission = true;
    }
  }

  async watchAsset(type, address, symbol, decimals, image, chainId) {
    const relay = await this.initializeRelay();
    const result = await relay.watchAsset(type, address, symbol, decimals, image, chainId === null || chainId === void 0 ? void 0 : chainId.toString()).promise;
    return !!result.result;
  }

  async addEthereumChain(chainId, rpcUrls, blockExplorerUrls, chainName, iconUrls, nativeCurrency) {
    var _res$result, _res$result2;

    if ((0, _util.ensureIntNumber)(chainId) === this.getChainId()) {
      return false;
    }

    const relay = await this.initializeRelay();
    const isWhitelistedNetworkOrStandalone = relay.inlineAddEthereumChain(chainId.toString());

    if (!this._isAuthorized() && !isWhitelistedNetworkOrStandalone) {
      await relay.requestEthereumAccounts().promise;
    }

    const res = await relay.addEthereumChain(chainId.toString(), rpcUrls, iconUrls, blockExplorerUrls, chainName, nativeCurrency).promise;

    if (((_res$result = res.result) === null || _res$result === void 0 ? void 0 : _res$result.isApproved) === true) {
      this._storage.setItem(HAS_CHAIN_BEEN_SWITCHED_KEY, "true");

      this.updateProviderInfo(rpcUrls[0], chainId, false);
    }

    return ((_res$result2 = res.result) === null || _res$result2 === void 0 ? void 0 : _res$result2.isApproved) === true;
  }

  async switchEthereumChain(chainId) {
    if ((0, _util.ensureIntNumber)(chainId) === this.getChainId()) {
      return;
    }

    const relay = await this.initializeRelay();
    const res = await relay.switchEthereumChain(chainId.toString(10)).promise;

    if (res.errorCode) {
      throw _ethRpcErrors.ethErrors.provider.custom({
        code: res.errorCode
      });
    }

    const switchResponse = res.result;

    if (switchResponse.isApproved && switchResponse.rpcUrl.length > 0) {
      this._storage.setItem(HAS_CHAIN_BEEN_SWITCHED_KEY, "true");

      this.updateProviderInfo(switchResponse.rpcUrl, chainId, false);
    }
  }

  setAppInfo(appName, appLogoUrl) {
    void this.initializeRelay().then(relay => relay.setAppInfo(appName, appLogoUrl));
  }

  async enable() {
    var _this$_eventListener;

    (_this$_eventListener = this._eventListener) === null || _this$_eventListener === void 0 ? void 0 : _this$_eventListener.onEvent(_EventListener.EVENTS.ETH_ACCOUNTS_STATE, {
      method: "provider::enable",
      addresses_length: this._addresses.length,
      sessionIdHash: this._relay ? _Session.Session.hash(this._relay.session.id) : null
    });

    if (this._addresses.length > 0) {
      return [...this._addresses];
    }

    return await this._send(_JSONRPC.JSONRPCMethod.eth_requestAccounts);
  }

  close() {
    void this.initializeRelay().then(relay => relay.resetAndReload());
  }

  send(requestOrMethod, callbackOrParams) {
    // send<T>(method, params): Promise<T>
    if (typeof requestOrMethod === "string") {
      const method = requestOrMethod;
      const params = Array.isArray(callbackOrParams) ? callbackOrParams : callbackOrParams !== undefined ? [callbackOrParams] : [];
      const request = {
        jsonrpc: "2.0",
        id: 0,
        method,
        params
      };
      return this._sendRequestAsync(request).then(res => res.result);
    } // send(JSONRPCRequest | JSONRPCRequest[], callback): void


    if (typeof callbackOrParams === "function") {
      const request = requestOrMethod;
      const callback = callbackOrParams;
      return this._sendAsync(request, callback);
    } // send(JSONRPCRequest[]): JSONRPCResponse[]


    if (Array.isArray(requestOrMethod)) {
      const requests = requestOrMethod;
      return requests.map(r => this._sendRequest(r));
    } // send(JSONRPCRequest): JSONRPCResponse


    const req = requestOrMethod;
    return this._sendRequest(req);
  }

  sendAsync(request, callback) {
    if (typeof callback !== "function") {
      throw new Error("callback is required");
    } // send(JSONRPCRequest[], callback): void


    if (Array.isArray(request)) {
      const arrayCb = callback;

      this._sendMultipleRequestsAsync(request).then(responses => arrayCb(null, responses)).catch(err => arrayCb(err, null));

      return;
    } // send(JSONRPCRequest, callback): void


    const cb = callback;

    this._sendRequestAsync(request).then(response => cb(null, response)).catch(err => cb(err, null));
  }

  async request(args) {
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      throw _ethRpcErrors.ethErrors.rpc.invalidRequest({
        message: "Expected a single, non-array, object argument.",
        data: args
      });
    }

    const {
      method,
      params
    } = args;

    if (typeof method !== "string" || method.length === 0) {
      throw _ethRpcErrors.ethErrors.rpc.invalidRequest({
        message: "'args.method' must be a non-empty string.",
        data: args
      });
    }

    if (params !== undefined && !Array.isArray(params) && (typeof params !== "object" || params === null)) {
      throw _ethRpcErrors.ethErrors.rpc.invalidRequest({
        message: "'args.params' must be an object or array if provided.",
        data: args
      });
    }

    const newParams = params === undefined ? [] : params; // Coinbase Wallet Requests

    const id = this._relayEventManager.makeRequestId();

    const result = await this._sendRequestAsync({
      method,
      params: newParams,
      jsonrpc: "2.0",
      id
    });
    return result.result;
  }

  async scanQRCode(match) {
    const relay = await this.initializeRelay();
    const res = await relay.scanQRCode((0, _util.ensureRegExpString)(match)).promise;

    if (typeof res.result !== "string") {
      throw new Error("result was not a string");
    }

    return res.result;
  }

  async genericRequest(data, action) {
    const relay = await this.initializeRelay();
    const res = await relay.genericRequest(data, action).promise;

    if (typeof res.result !== "string") {
      throw new Error("result was not a string");
    }

    return res.result;
  }

  supportsSubscriptions() {
    return false;
  }

  subscribe() {
    throw new Error("Subscriptions are not supported");
  }

  unsubscribe() {
    throw new Error("Subscriptions are not supported");
  }

  disconnect() {
    return true;
  }

  _sendRequest(request) {
    const response = {
      jsonrpc: "2.0",
      id: request.id
    };
    const {
      method
    } = request;
    response.result = this._handleSynchronousMethods(request);

    if (response.result === undefined) {
      throw new Error(`Coinbase Wallet does not support calling ${method} synchronously without ` + `a callback. Please provide a callback parameter to call ${method} ` + `asynchronously.`);
    }

    return response;
  }

  _setAddresses(addresses) {
    if (!Array.isArray(addresses)) {
      throw new Error("addresses is not an array");
    }

    const newAddresses = addresses.map(address => (0, _util.ensureAddressString)(address));

    if (JSON.stringify(newAddresses) === JSON.stringify(this._addresses)) {
      return;
    }

    if (this._addresses.length > 0 && this.supportsAddressSwitching === false) {
      /**
       * The extension currently doesn't support switching selected wallet index
       * make sure walletlink doesn't update it's address in this case
       */
      return;
    }

    this._addresses = newAddresses;
    this.emit("accountsChanged", this._addresses);

    this._storage.setItem(_WalletSDKRelayAbstract.LOCAL_STORAGE_ADDRESSES_KEY, newAddresses.join(" "));
  }

  _sendRequestAsync(request) {
    return new Promise((resolve, reject) => {
      try {
        const syncResult = this._handleSynchronousMethods(request);

        if (syncResult !== undefined) {
          return resolve({
            jsonrpc: "2.0",
            id: request.id,
            result: syncResult
          });
        }

        const filterPromise = this._handleAsynchronousFilterMethods(request);

        if (filterPromise !== undefined) {
          filterPromise.then(res => resolve({ ...res,
            id: request.id
          })).catch(err => reject(err));
          return;
        }

        const subscriptionPromise = this._handleSubscriptionMethods(request);

        if (subscriptionPromise !== undefined) {
          subscriptionPromise.then(res => resolve({
            jsonrpc: "2.0",
            id: request.id,
            result: res.result
          })).catch(err => reject(err));
          return;
        }
      } catch (err) {
        return reject(err);
      }

      this._handleAsynchronousMethods(request).then(res => res && resolve({ ...res,
        id: request.id
      })).catch(err => reject(err));
    });
  }

  _sendMultipleRequestsAsync(requests) {
    return Promise.all(requests.map(r => this._sendRequestAsync(r)));
  }

  _handleSynchronousMethods(request) {
    const {
      method
    } = request;
    const params = request.params || [];

    switch (method) {
      case _JSONRPC.JSONRPCMethod.eth_accounts:
        return this._eth_accounts();

      case _JSONRPC.JSONRPCMethod.eth_coinbase:
        return this._eth_coinbase();

      case _JSONRPC.JSONRPCMethod.eth_uninstallFilter:
        return this._eth_uninstallFilter(params);

      case _JSONRPC.JSONRPCMethod.net_version:
        return this._net_version();

      case _JSONRPC.JSONRPCMethod.eth_chainId:
        return this._eth_chainId();

      default:
        return undefined;
    }
  }

  async _handleAsynchronousMethods(request) {
    const {
      method
    } = request;
    const params = request.params || [];

    switch (method) {
      case _JSONRPC.JSONRPCMethod.eth_requestAccounts:
        return this._eth_requestAccounts();

      case _JSONRPC.JSONRPCMethod.eth_sign:
        return this._eth_sign(params);

      case _JSONRPC.JSONRPCMethod.eth_ecRecover:
        return this._eth_ecRecover(params);

      case _JSONRPC.JSONRPCMethod.personal_sign:
        return this._personal_sign(params);

      case _JSONRPC.JSONRPCMethod.personal_ecRecover:
        return this._personal_ecRecover(params);

      case _JSONRPC.JSONRPCMethod.eth_signTransaction:
        return this._eth_signTransaction(params);

      case _JSONRPC.JSONRPCMethod.eth_sendRawTransaction:
        return this._eth_sendRawTransaction(params);

      case _JSONRPC.JSONRPCMethod.eth_sendTransaction:
        return this._eth_sendTransaction(params);

      case _JSONRPC.JSONRPCMethod.eth_signTypedData_v1:
        return this._eth_signTypedData_v1(params);

      case _JSONRPC.JSONRPCMethod.eth_signTypedData_v2:
        return this._throwUnsupportedMethodError();

      case _JSONRPC.JSONRPCMethod.eth_signTypedData_v3:
        return this._eth_signTypedData_v3(params);

      case _JSONRPC.JSONRPCMethod.eth_signTypedData_v4:
      case _JSONRPC.JSONRPCMethod.eth_signTypedData:
        return this._eth_signTypedData_v4(params);

      case _JSONRPC.JSONRPCMethod.cbWallet_arbitrary:
        return this._cbwallet_arbitrary(params);

      case _JSONRPC.JSONRPCMethod.wallet_addEthereumChain:
        return this._wallet_addEthereumChain(params);

      case _JSONRPC.JSONRPCMethod.wallet_switchEthereumChain:
        return this._wallet_switchEthereumChain(params);

      case _JSONRPC.JSONRPCMethod.wallet_watchAsset:
        return this._wallet_watchAsset(params);
    }

    const relay = await this.initializeRelay();
    return relay.makeEthereumJSONRPCRequest(request, this.jsonRpcUrl);
  }

  _handleAsynchronousFilterMethods(request) {
    const {
      method
    } = request;
    const params = request.params || [];

    switch (method) {
      case _JSONRPC.JSONRPCMethod.eth_newFilter:
        return this._eth_newFilter(params);

      case _JSONRPC.JSONRPCMethod.eth_newBlockFilter:
        return this._eth_newBlockFilter();

      case _JSONRPC.JSONRPCMethod.eth_newPendingTransactionFilter:
        return this._eth_newPendingTransactionFilter();

      case _JSONRPC.JSONRPCMethod.eth_getFilterChanges:
        return this._eth_getFilterChanges(params);

      case _JSONRPC.JSONRPCMethod.eth_getFilterLogs:
        return this._eth_getFilterLogs(params);
    }

    return undefined;
  }

  _handleSubscriptionMethods(request) {
    switch (request.method) {
      case _JSONRPC.JSONRPCMethod.eth_subscribe:
      case _JSONRPC.JSONRPCMethod.eth_unsubscribe:
        return this._subscriptionManager.handleRequest(request);
    }

    return undefined;
  }

  _isKnownAddress(addressString) {
    try {
      const addressStr = (0, _util.ensureAddressString)(addressString);

      const lowercaseAddresses = this._addresses.map(address => (0, _util.ensureAddressString)(address));

      return lowercaseAddresses.includes(addressStr);
    } catch {}

    return false;
  }

  _ensureKnownAddress(addressString) {
    if (!this._isKnownAddress(addressString)) {
      var _this$_eventListener2;

      (_this$_eventListener2 = this._eventListener) === null || _this$_eventListener2 === void 0 ? void 0 : _this$_eventListener2.onEvent(_EventListener.EVENTS.UNKNOWN_ADDRESS_ENCOUNTERED);
      throw new Error("Unknown Ethereum address");
    }
  }

  _prepareTransactionParams(tx) {
    const fromAddress = tx.from ? (0, _util.ensureAddressString)(tx.from) : this.selectedAddress;

    if (!fromAddress) {
      throw new Error("Ethereum address is unavailable");
    }

    this._ensureKnownAddress(fromAddress);

    const toAddress = tx.to ? (0, _util.ensureAddressString)(tx.to) : null;
    const weiValue = tx.value != null ? (0, _util.ensureBN)(tx.value) : new _bn.default(0);
    const data = tx.data ? (0, _util.ensureBuffer)(tx.data) : Buffer.alloc(0);
    const nonce = tx.nonce != null ? (0, _util.ensureIntNumber)(tx.nonce) : null;
    const gasPriceInWei = tx.gasPrice != null ? (0, _util.ensureBN)(tx.gasPrice) : null;
    const maxFeePerGas = tx.maxFeePerGas != null ? (0, _util.ensureBN)(tx.maxFeePerGas) : null;
    const maxPriorityFeePerGas = tx.maxPriorityFeePerGas != null ? (0, _util.ensureBN)(tx.maxPriorityFeePerGas) : null;
    const gasLimit = tx.gas != null ? (0, _util.ensureBN)(tx.gas) : null;
    const chainId = this.getChainId();
    return {
      fromAddress,
      toAddress,
      weiValue,
      data,
      nonce,
      gasPriceInWei,
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit,
      chainId
    };
  }

  _isAuthorized() {
    return this._addresses.length > 0;
  }

  _requireAuthorization() {
    if (!this._isAuthorized()) {
      throw _ethRpcErrors.ethErrors.provider.unauthorized({});
    }
  }

  _throwUnsupportedMethodError() {
    throw _ethRpcErrors.ethErrors.provider.unsupportedMethod({});
  }

  async _signEthereumMessage(message, address, addPrefix, typedDataJson) {
    this._ensureKnownAddress(address);

    try {
      const relay = await this.initializeRelay();
      const res = await relay.signEthereumMessage(message, address, addPrefix, typedDataJson).promise;
      return {
        jsonrpc: "2.0",
        id: 0,
        result: res.result
      };
    } catch (err) {
      if (typeof err.message === "string" && err.message.match(/(denied|rejected)/i)) {
        throw _ethRpcErrors.ethErrors.provider.userRejectedRequest("User denied message signature");
      }

      throw err;
    }
  }

  async _ethereumAddressFromSignedMessage(message, signature, addPrefix) {
    const relay = await this.initializeRelay();
    const res = await relay.ethereumAddressFromSignedMessage(message, signature, addPrefix).promise;
    return {
      jsonrpc: "2.0",
      id: 0,
      result: res.result
    };
  }

  _eth_accounts() {
    return [...this._addresses];
  }

  _eth_coinbase() {
    return this.selectedAddress || null;
  }

  _net_version() {
    return this.getChainId().toString(10);
  }

  _eth_chainId() {
    return (0, _util.hexStringFromIntNumber)(this.getChainId());
  }

  getChainId() {
    const chainIdStr = this._storage.getItem(DEFAULT_CHAIN_ID_KEY) || "1";
    const chainId = parseInt(chainIdStr, 10);
    return (0, _util.ensureIntNumber)(chainId);
  }

  async _eth_requestAccounts() {
    var _this$_eventListener3;

    (_this$_eventListener3 = this._eventListener) === null || _this$_eventListener3 === void 0 ? void 0 : _this$_eventListener3.onEvent(_EventListener.EVENTS.ETH_ACCOUNTS_STATE, {
      method: "provider::_eth_requestAccounts",
      addresses_length: this._addresses.length,
      sessionIdHash: this._relay ? _Session.Session.hash(this._relay.session.id) : null
    });

    if (this._addresses.length > 0) {
      return Promise.resolve({
        jsonrpc: "2.0",
        id: 0,
        result: this._addresses
      });
    }

    let res;

    try {
      const relay = await this.initializeRelay();
      res = await relay.requestEthereumAccounts().promise;
    } catch (err) {
      if (typeof err.message === "string" && err.message.match(/(denied|rejected)/i)) {
        throw _ethRpcErrors.ethErrors.provider.userRejectedRequest("User denied account authorization");
      }

      throw err;
    }

    if (!res.result) {
      throw new Error("accounts received is empty");
    }

    this._setAddresses(res.result);

    return {
      jsonrpc: "2.0",
      id: 0,
      result: this._addresses
    };
  }

  _eth_sign(params) {
    this._requireAuthorization();

    const address = (0, _util.ensureAddressString)(params[0]);
    const message = (0, _util.ensureBuffer)(params[1]);
    return this._signEthereumMessage(message, address, false);
  }

  _eth_ecRecover(params) {
    const message = (0, _util.ensureBuffer)(params[0]);
    const signature = (0, _util.ensureBuffer)(params[1]);
    return this._ethereumAddressFromSignedMessage(message, signature, false);
  }

  _personal_sign(params) {
    this._requireAuthorization();

    const message = (0, _util.ensureBuffer)(params[0]);
    const address = (0, _util.ensureAddressString)(params[1]);
    return this._signEthereumMessage(message, address, true);
  }

  _personal_ecRecover(params) {
    const message = (0, _util.ensureBuffer)(params[0]);
    const signature = (0, _util.ensureBuffer)(params[1]);
    return this._ethereumAddressFromSignedMessage(message, signature, true);
  }

  async _eth_signTransaction(params) {
    this._requireAuthorization();

    const tx = this._prepareTransactionParams(params[0] || {});

    try {
      const relay = await this.initializeRelay();
      const res = await relay.signEthereumTransaction(tx).promise;
      return {
        jsonrpc: "2.0",
        id: 0,
        result: res.result
      };
    } catch (err) {
      if (typeof err.message === "string" && err.message.match(/(denied|rejected)/i)) {
        throw _ethRpcErrors.ethErrors.provider.userRejectedRequest("User denied transaction signature");
      }

      throw err;
    }
  }

  async _eth_sendRawTransaction(params) {
    const signedTransaction = (0, _util.ensureBuffer)(params[0]);
    const relay = await this.initializeRelay();
    const res = await relay.submitEthereumTransaction(signedTransaction, this.getChainId()).promise;
    return {
      jsonrpc: "2.0",
      id: 0,
      result: res.result
    };
  }

  async _eth_sendTransaction(params) {
    this._requireAuthorization();

    const tx = this._prepareTransactionParams(params[0] || {});

    try {
      const relay = await this.initializeRelay();
      const res = await relay.signAndSubmitEthereumTransaction(tx).promise;
      return {
        jsonrpc: "2.0",
        id: 0,
        result: res.result
      };
    } catch (err) {
      if (typeof err.message === "string" && err.message.match(/(denied|rejected)/i)) {
        throw _ethRpcErrors.ethErrors.provider.userRejectedRequest("User denied transaction signature");
      }

      throw err;
    }
  }

  async _eth_signTypedData_v1(params) {
    this._requireAuthorization();

    const typedData = (0, _util.ensureParsedJSONObject)(params[0]);
    const address = (0, _util.ensureAddressString)(params[1]);

    this._ensureKnownAddress(address);

    const message = _ethEip712Util.default.hashForSignTypedDataLegacy({
      data: typedData
    });

    const typedDataJSON = JSON.stringify(typedData, null, 2);
    return this._signEthereumMessage(message, address, false, typedDataJSON);
  }

  async _eth_signTypedData_v3(params) {
    this._requireAuthorization();

    const address = (0, _util.ensureAddressString)(params[0]);
    const typedData = (0, _util.ensureParsedJSONObject)(params[1]);

    this._ensureKnownAddress(address);

    const message = _ethEip712Util.default.hashForSignTypedData_v3({
      data: typedData
    });

    const typedDataJSON = JSON.stringify(typedData, null, 2);
    return this._signEthereumMessage(message, address, false, typedDataJSON);
  }

  async _eth_signTypedData_v4(params) {
    this._requireAuthorization();

    const address = (0, _util.ensureAddressString)(params[0]);
    const typedData = (0, _util.ensureParsedJSONObject)(params[1]);

    this._ensureKnownAddress(address);

    const message = _ethEip712Util.default.hashForSignTypedData_v4({
      data: typedData
    });

    const typedDataJSON = JSON.stringify(typedData, null, 2);
    return this._signEthereumMessage(message, address, false, typedDataJSON);
  }

  async _cbwallet_arbitrary(params) {
    const action = params[0];
    const data = params[1];

    if (typeof data !== "string") {
      throw new Error("parameter must be a string");
    }

    if (typeof action !== "object" || action === null) {
      throw new Error("parameter must be an object");
    }

    const result = await this.genericRequest(action, data);
    return {
      jsonrpc: "2.0",
      id: 0,
      result
    };
  }

  async _wallet_addEthereumChain(params) {
    var _request$rpcUrls, _request$rpcUrls2, _request$blockExplore, _request$iconUrls;

    const request = params[0];

    if (((_request$rpcUrls = request.rpcUrls) === null || _request$rpcUrls === void 0 ? void 0 : _request$rpcUrls.length) === 0) {
      return {
        jsonrpc: "2.0",
        id: 0,
        error: {
          code: 2,
          message: `please pass in at least 1 rpcUrl`
        }
      };
    }

    if (!request.chainName || request.chainName.trim() === "") {
      throw _ethRpcErrors.ethErrors.provider.custom({
        code: 0,
        message: "chainName is a required field"
      });
    }

    if (!request.nativeCurrency) {
      throw _ethRpcErrors.ethErrors.provider.custom({
        code: 0,
        message: "nativeCurrency is a required field"
      });
    }

    const chainIdNumber = parseInt(request.chainId, 16);
    const success = await this.addEthereumChain(chainIdNumber, (_request$rpcUrls2 = request.rpcUrls) !== null && _request$rpcUrls2 !== void 0 ? _request$rpcUrls2 : [], (_request$blockExplore = request.blockExplorerUrls) !== null && _request$blockExplore !== void 0 ? _request$blockExplore : [], request.chainName, (_request$iconUrls = request.iconUrls) !== null && _request$iconUrls !== void 0 ? _request$iconUrls : [], request.nativeCurrency);

    if (success) {
      return {
        jsonrpc: "2.0",
        id: 0,
        result: null
      };
    } else {
      return {
        jsonrpc: "2.0",
        id: 0,
        error: {
          code: 2,
          message: `unable to add ethereum chain`
        }
      };
    }
  }

  async _wallet_switchEthereumChain(params) {
    const request = params[0];
    await this.switchEthereumChain(parseInt(request.chainId, 16));
    return {
      jsonrpc: "2.0",
      id: 0,
      result: null
    };
  }

  async _wallet_watchAsset(params) {
    var _request$type;

    const request = Array.isArray(params) ? params[0] : params;

    if (((_request$type = request.type) === null || _request$type === void 0 ? void 0 : _request$type.length) === 0) {
      throw _ethRpcErrors.ethErrors.rpc.invalidParams({
        message: "type is a required field"
      });
    }

    if (request.type !== "ERC20") {
      throw _ethRpcErrors.ethErrors.rpc.invalidParams({
        message: `Asset of type '${request.type}' not supported`
      });
    }

    if (!(request !== null && request !== void 0 && request.options)) {
      throw _ethRpcErrors.ethErrors.rpc.invalidParams({
        message: "options is a required field"
      });
    }

    if (!request.options.address) {
      throw _ethRpcErrors.ethErrors.rpc.invalidParams({
        message: "option address is a required option"
      });
    }

    const chainId = this.getChainId();
    const {
      address,
      symbol,
      image,
      decimals
    } = request.options;
    const res = await this.watchAsset(request.type, address, symbol, decimals, image, chainId);
    return {
      jsonrpc: "2.0",
      id: 0,
      result: res
    };
  }

  _eth_uninstallFilter(params) {
    const filterId = (0, _util.ensureHexString)(params[0]);
    return this._filterPolyfill.uninstallFilter(filterId);
  }

  async _eth_newFilter(params) {
    const param = params[0];
    const filterId = await this._filterPolyfill.newFilter(param);
    return {
      jsonrpc: "2.0",
      id: 0,
      result: filterId
    };
  }

  async _eth_newBlockFilter() {
    const filterId = await this._filterPolyfill.newBlockFilter();
    return {
      jsonrpc: "2.0",
      id: 0,
      result: filterId
    };
  }

  async _eth_newPendingTransactionFilter() {
    const filterId = await this._filterPolyfill.newPendingTransactionFilter();
    return {
      jsonrpc: "2.0",
      id: 0,
      result: filterId
    };
  }

  _eth_getFilterChanges(params) {
    const filterId = (0, _util.ensureHexString)(params[0]);
    return this._filterPolyfill.getFilterChanges(filterId);
  }

  _eth_getFilterLogs(params) {
    const filterId = (0, _util.ensureHexString)(params[0]);
    return this._filterPolyfill.getFilterLogs(filterId);
  }

  initializeRelay() {
    if (this._relay) {
      return Promise.resolve(this._relay);
    }

    return this._relayProvider().then(relay => {
      relay.setAccountsCallback(accounts => this._setAddresses(accounts));
      relay.setChainCallback((chainId, jsonRpcUrl) => {
        this.updateProviderInfo(jsonRpcUrl, parseInt(chainId, 10), true);
      });
      this._relay = relay;
      return relay;
    });
  }

}

exports.CoinbaseWalletProvider = CoinbaseWalletProvider;