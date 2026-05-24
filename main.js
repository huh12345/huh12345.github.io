var Module = (function() {
    var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;

    return (function(Module) {
        Module = Module || {};

        var readyPromiseResolve, readyPromiseReject;
        Module['ready'] = new Promise(function(resolve, reject) {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject;
        });

        var wasmBinaryFile = 'main.wasm';

        function fetchWasm(url) {
            return fetch(url).then(function(response) {
                if (!response.ok) {
                    throw new Error("Failed to load WASM: " + url);
                }
                return response.arrayBuffer();
            });
        }

        function createWasm() {
            return fetchWasm(wasmBinaryFile).then(function(binary) {
                return WebAssembly.instantiate(binary, {
                    env: {
                        abort: function() { console.error("abort"); },
                        emscripten_memcpy_big: function(dest, src, num) {
                            Module.HEAPU8.copyWithin(dest, src, src + num);
                        }
                    }
                });
            }).then(function(result) {
                Module['wasmInstance'] = result.instance;
                Module['wasmMemory'] = result.instance.exports.memory;
                Module['HEAPU8'] = new Uint8Array(Module['wasmMemory'].buffer);
                Module['HEAP32'] = new Int32Array(Module['wasmMemory'].buffer);
                Module['HEAPF32'] = new Float32Array(Module['wasmMemory'].buffer);

                Module['_run'] = result.instance.exports.run;

                readyPromiseResolve(Module);
                return Module;
            });
        }

        Module['ccall'] = function(ident, returnType, argTypes, args) {
            var toC = {
                'string': function(str) {
                    var len = (str.length + 1);
                    var ptr = Module._malloc(len);
                    Module.stringToUTF8(str, ptr, len);
                    return ptr;
                },
                'number': function(num) { return num; }
            };

            var cArgs = [];
            for (var i = 0; i < args.length; i++) {
                var converter = toC[argTypes[i]];
                cArgs[i] = converter(args[i]);
            }

            var ret = Module['_run'].apply(null, cArgs);

            return Module.UTF8ToString(ret);
        };

        Module['stringToUTF8'] = function(str, outPtr, maxBytesToWrite) {
            return Module['writeAsciiToMemory'](str, outPtr, false);
        };

        Module['writeAsciiToMemory'] = function(str, buffer, dontAddNull) {
            for (var i = 0; i < str.length; i++) {
                Module.HEAPU8[buffer++] = str.charCodeAt(i);
            }
            if (!dontAddNull) Module.HEAPU8[buffer] = 0;
        };

        Module['UTF8ToString'] = function(ptr) {
            var str = "";
            while (Module.HEAPU8[ptr] !== 0) {
                str += String.fromCharCode(Module.HEAPU8[ptr++]);
            }
            return str;
        };

        Module['_malloc'] = function(size) {
            var ptr = Module._malloc_impl(size);
            return ptr;
        };

        // メモリ確保（簡易版）
        Module._malloc_impl = function(size) {
            if (!Module._malloc_ptr) Module._malloc_ptr = 1024 * 1024; // 1MB から開始
            var ptr = Module._malloc_ptr;
            Module._malloc_ptr += size;
            return ptr;
        };

        createWasm();

        return Module;
    })({});
})();
