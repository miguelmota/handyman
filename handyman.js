(function(root) {
  var __slice = Function.prototype.call.bind([].slice);
  var __hasOwn = Function.prototype.call.bind({}.hasOwnProperty);

  var __isFunction = function(v) {
    return typeof v === 'function' || v instanceof Function;
  };

  var __isString = function(v) {
    return typeof v === 'string' || v instanceof String;
  };

  var PENDING = 0;
  var FULFILLED = 1;
  var REJECTED = 2;

  function Promise(fn) {
    var state = PENDING;
    var value = null;
    var handlers = [];

    function fulfill(result) {
      state = FULFILLED;
      value = result;
      handlers.forEach(handle);
      handlers = null;
    }

    function reject(error) {
      state = REJECTED;
      value = error;
      handlers.forEach(handle);
      handlers = null;
    }

    function resolve(result) {
      try {
        var then = getThen(result);
        if (then) {
          doResolve(then.bind(result), resolve, reject);
          return;
        }
        fulfill(result);
      } catch (e) {
        reject(e);
      }
    }

    function handle(handler) {
      if (state === PENDING) {
        handlers.push(handler);
      } else {
        if (state === FULFILLED &&
          typeof handler.onFulfilled === 'function') {
          handler.onFulfilled(value);
        }
        if (state === REJECTED &&
          typeof handler.onRejected === 'function') {
          handler.onRejected(value);
        }
      }
    }

    this.done = function (onFulfilled, onRejected) {
      setTimeout(function () {
        handle({
          onFulfilled: onFulfilled,
          onRejected: onRejected
        });
      }, 0);
    };

    this.then = function (onFulfilled, onRejected) {
      var self = this;
      return new Promise(function (resolve, reject) {
        return self.done(function (result) {
          if (typeof onFulfilled === 'function') {
            try {
              return resolve(onFulfilled(result));
            } catch (ex) {
              return reject(ex);
            }
          } else {
            return resolve(result);
          }
        }, function (error) {
          if (typeof onRejected === 'function') {
            try {
              return resolve(onRejected(error));
            } catch (ex) {
              return reject(ex);
            }
          } else {
            return reject(error);
          }
        });
      });
    };

    doResolve(fn, resolve, reject);
  }

  function getThen(value) {
    var t = typeof value;
    if (value && (t === 'object' || t === 'function')) {
      var then = value.then;
      if (typeof then === 'function') {
        return then;
      }
    }
    return null;
  }

  function doResolve(fn, onFulfilled, onRejected) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        onFulfilled(value);
      }, function (reason) {
        if (done) return;
        done = true;
        onRejected(reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      onRejected(ex);
    }
  }

  // blob: Chrome 8+, Firefox 6+, Safari 6.0+, Opera 15+
  // data: application/javascript for Opera 10.60 - 12
  // eval otherwise (IE 10+)

  function makeBlobURI(script) {
    var blob;
    try {
      blob = new Blob([script], {type: 'application/javascript'});
    } catch(e) {
      window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
      blob = new BlobBuilder();
      blob.append(script);
      blob = blob.getBlob();
    }
    return URL.createObjectURL(blob);
  }

  if (typeof window === 'undefined' && self.importScripts) {
    workerBoilerScript();
    return;
  }

  var scripts = document.getElementsByTagName('script');
  var opScript = scripts[scripts.length - 1];
  var opScriptURL = /handyman/.test(opScript.src) && opScript.src;

  var baseURL = (
    location.protocol + '//' +
      location.hostname +
      (location.port?':'+location.port:'') +
      location.pathname
  ).replace(/[^\/]+$/, '');

  var URL = window.URL || window.webkitURL;
  var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;

  var workerBlobSupport = (function() {
    try {
      new Worker(makeBlobURI(';'));
    } catch(e) {
      return false;
    }
    return true;
  }());

  // Indicates whether handymans will run within workers:
  handyman.hasWorkerSupport = !!window.Worker;

  handyman.Promise = Promise;

  handyman.setSelfURL = function(url) {
    opScriptURL = url;
  };

  handyman.setBaseURL = function(base) {
    baseURL = base;
  };

  handyman.getBaseURL = function() {
    return baseURL;
  };

  /**
  * Handyman: Exposed Handyman Constructor
  * @param {Object} module Object containing methods/properties
  */
  function Handyman(module, dependencies) {

    var _this = this;

    module.get = module.get || function(prop) {
      return this[prop];
    };

    module.set = module.set || function(prop, value) {
      this[prop] = value;
      return this[prop];
    };

    this._curToken = 0;
    this._queue = [];

    this.isDestroyed = false;
    this.isContextReady = false;

    this.module = module;
    this.dependencies = dependencies || [];

    this.dataProperties = {};
    this.api = {};
    this.callbacks = {};
    this.deferreds = {};

    this._fixDependencyURLs();
    this._setup();

    for (var methodName in module) {
      if (__hasOwn(module, methodName)) {
        this._createExposedMethod(methodName);
      }
    }

    this.api.__handyman__ = this;

    // Provide the instance's destroy method on the exposed API:
    this.api.destroy = this.api.terminate = function() {
      return _this.destroy();
    };

  }

  Handyman.prototype = {

    _marshal: function(v) {
      return v;
    },

    _demarshal: function(v) {
      return v;
    },

    _enqueue: function(fn) {
      this._queue.push(fn);
    },

    _fixDependencyURLs: function() {
      var deps = this.dependencies;
      for (var i = 0, l = deps.length; i < l; ++i) {
        var dep = deps[i];
        if (!/\/\//.test(dep)) {
          deps[i] = dep.replace(/^\/?/, baseURL);
        }
      }
    },

    _dequeueAll: function() {
      for (var i = 0, l = this._queue.length; i < l; ++i) {
        this._queue[i].call(this);
      }
      this._queue = [];
    },

    _buildContextScript: function(boilerScript) {

      var script = [];
      var module = this.module;
      var dataProperties = this.dataProperties;
      var property;

      for (var i in module) {
        property = module[i];
        if (__isFunction(property))  {
          script.push('   self["' + i.replace(/"/g, '\\"') + '"] = ' + property.toString() + ';');
        } else {
          dataProperties[i] = property;
        }
      }

      return script.join('\n') + (
        boilerScript ? '\n(' + boilerScript.toString() + '());' : ''
      );

    },

    _createExposedMethod: function(methodName) {

      var _this = this;

      // modified function that actually gets called
      this.api[methodName] = function() {

        if (_this.isDestroyed) {
          throw new Error('Handyman: Cannot run method. Handyman has already been destroyed');
        }

        var token = ++_this._curToken;
        var args = __slice(arguments);
        var cb = __isFunction(args[args.length - 1]) && args.pop();

        if (!cb && !handyman.Promise) {
          throw new Error(
            'Handyman: No callback has been passed. Assumed that you want a promise.'
          );
        }

        if (cb) {

          _this.callbacks[token] = cb;

          // Ensure either context runs the method async:
          setTimeout(function() {
            runMethod();
          }, 0);

        } else if (handyman.Promise) {

          return new handyman.Promise(function(resolve, reject) {
            var deferred = {
              resolve: resolve,
              reject: reject
            };

            _this.deferreds[token] = deferred;
            runMethod();
          });

        }

        function runMethod() {
          if (_this.isContextReady) {
            _this._runMethod(methodName, token, args);
          } else {
            _this._enqueue(runMethod);
          }
        }

      };

    },

    destroy: function() {
      this.isDestroyed = true;
    }
  };

  Handyman.Worker = function Worker(/* obj, deps */) {
    this._msgQueue = [];
    Handyman.apply(this, arguments);
  };

  var WorkerProto = Handyman.Worker.prototype = Object.create(Handyman.prototype);

  WorkerProto._onWorkerMessage = function(e) {
    var data = e.data;

    if (__isString(data) && data.indexOf('pingback') === 0) {
      if (data === 'pingback:structuredCloningSupport=NO') {
        this._marshal = function(o) { return JSON.stringify(o); };
        this._demarshal = function(o) { return JSON.parse(o); };
      }

      this.isContextReady = true;
      this._postMessage({
        definitions: this.dataProperties
      });
      this._dequeueAll();
      return;

    }

    data = this._demarshal(data);

    switch (data.cmd) {
      case 'console':
        window.console && window.console[data.method].apply(window.console, data.args);
        break;
      case 'result':

        var callback = this.callbacks[data.token];
        var deferred = this.deferreds[data.token];

        delete this.callbacks[data.token];
        delete this.deferreds[data.token];

        var deferredAction = data.result && data.result.isDeferred && data.result.action;

        if (deferred && deferredAction) {
          deferred[deferredAction](data.result.args[0]);
        } else if (callback) {
          callback.apply(this, data.result.args);
        }

        break;
    }
  };

  WorkerProto._setup = function() {
    var _this = this;

    var worker;
    var script = this._buildContextScript(workerBlobSupport ? workerBoilerScript : '');

    if (this.dependencies.length) {
      script = 'importScripts("' + this.dependencies.join('", "') + '");\n' + script;
    }

    if (workerBlobSupport) {
      worker = this.worker = new Worker(makeBlobURI(script));
    }  else {
      if (!opScriptURL) {
        throw new Error('Operaritve: No handyman.js URL available. Please set via handyman.setSelfURL(...)');
      }
      worker = this.worker = new Worker( opScriptURL );
      // Marshal-agnostic initial message is boiler-code:
      // (We don't yet know if structured-cloning is supported so we send a string)
      worker.postMessage('EVAL|' + script);
    }

    worker.postMessage(['PING']); // initial ping

    worker.addEventListener('message', function(e) {
      _this._onWorkerMessage(e);
    });
  };

  WorkerProto._postMessage = function(msg) {
    return this.worker.postMessage(this._marshal(msg));
  };

  // send method name and args to worker for invocation
  WorkerProto._runMethod = function(methodName, token, args) {
    this._postMessage({
      method: methodName,
      args: args,
      token: token
    });
  };

  WorkerProto.destroy = function() {
    this.worker.terminate();
    Handyman.prototype.destroy.call(this);
  };

  handyman.Handyman = Handyman;

  /**
  * Exposed handyman factory
  */
  function handyman(module, dependencies) {

    var HandymanContext = Handyman.Worker;

    if (__isFunction(module)) {
      // Allow a single function to be passed.
      var o = new HandymanContext({ main: module }, dependencies);
      var singularHandyman = function() {
        return o.api.main.apply(o, arguments);
      };
      // Copy across exposable API to the returned function:
      for (var i in o.api) {
        if (__hasOwn(o.api, i)) {
          singularHandyman[i] = o.api[i];
        }
      }
      return singularHandyman;
    }

    return new HandymanContext(module, dependencies).api;
  }

  /**
  * The boilerplate for the Worker Blob
  */
  function workerBoilerScript() {
    var __slice = Function.prototype.call.bind([].slice);
    var __hasOwn = Function.prototype.call.bind({}.hasOwnProperty);

    var __isFunction = function(v) {
      return typeof v === 'function' || v instanceof Function;
    };

    var __isString = function(v) {
      return typeof v === 'string' || v instanceof String;
    };

    var postMessage = self.postMessage;
    var structuredCloningSupport = null;

    self.console = {};
    self.isWorker = true;

    ['log', 'debug', 'error', 'info', 'warn', 'time', 'timeEnd'].forEach(function(method) {
      self.console[method] = function() {
        postMessage({
          cmd: 'console',
          method: method,
          args: __slice(arguments)
        });
      };
    });

    self.addEventListener('message', function(e) {
      var data = e.data;

      if (__isString(data) && data.indexOf('EVAL|') === 0) {
        eval(data.substring(5));
        return;
      }

      if (structuredCloningSupport == null) {

        // e.data of ['PING'] (An array) indicates transferrableObjSupport
        // e.data of '"PING"' (A string) indicates no support (Array has been serialized)
        structuredCloningSupport = e.data[0] === 'PING';

        // Pingback to parent page:
        self.postMessage(
          structuredCloningSupport ?
          'pingback:structuredCloningSupport=YES' :
          'pingback:structuredCloningSupport=NO'
        );

        if (!structuredCloningSupport) {
          postMessage = function(msg) {
            // Marshal before sending
            return self.postMessage(JSON.stringify(msg));
          };
        }

        return;
      }

      if (!structuredCloningSupport) {
        // Demarshal:
        data = JSON.parse(data);
      }

      var defs = data.definitions;
      var isDeferred = false;
      var args = data.args;

      if (defs) {
        // Initial definitions:
        for (var i in defs) {
          self[i] = defs[i];
        }
        return;
      }

      function returnResult(res) {
        postMessage({
          cmd: 'result',
          token: data.token,
          result: res
        });
        returnResult = function() {
          throw new Error('Handyman: You have already returned.');
        };
      }

      args.push(function() {
        // Callback function to be passed to handyman method
        returnResult({
          args: __slice(arguments)
        });
      });

      self.defer = function() {
        isDeferred = true;
        function resolve(r) {
          returnResult({
            isDeferred: true,
            action: 'resolve',
            args: [r]
          });
          return def;
        }
        function reject(r) {
          returnResult({
            isDeferred: true,
            action: 'reject',
            args: [r]
          });
        }
        var def = {
          resolve: resolve,
          reject: reject
        };
        return def;
      };

      // Call actual handyman method:
      var result = self[data.method].apply(self, args);

      if (!isDeferred && result !== void 0) {
        returnResult({
          args: [result]
        });
      }

      self.deferred = function() {
        throw new Error('Handyman: deferred() called at odd time');
      };

    });
  }

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = handyman;
    }
    exports.handyman = handyman;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return handyman;
    });
  } else {
    root.handyman = handyman;
  }

})(this);
