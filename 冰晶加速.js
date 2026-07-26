(function () {
    'use strict';

    var _origSetTimeout = window.setTimeout;
    var _origClearTimeout = window.clearTimeout;
    var _origSetInterval = window.setInterval;
    var _origClearInterval = window.clearInterval;
    var _origDate = window.Date;
    var _origDateNow = _origDate.now.bind ? _origDate.now.bind(_origDate) : function () { return _origDate.now(); };
    var _origDateParse = _origDate.parse;
    var _origDateUTC = _origDate.UTC;

    var _percentage = 1.0;
    var _invPercentage = 1.0;
    var _timeoutIds = {};
    var _intervalIds = {};
    var _autoUniqueId = 1;
    var _hooksInstalled = false;

    var _lastRealTime = _origDateNow();
    var _lastVirtualTime = _origDateNow();

    function genUniqueId() { return _autoUniqueId++; }

    function notifyExec(uniqueId) {
        if (!uniqueId) return;
        for (var id in _timeoutIds) {
            var info = _timeoutIds[id];
            if (info.uniqueId === uniqueId) {
                _origClearTimeout.call(window, info.nowId);
                delete _timeoutIds[info.originId];
                break;
            }
        }
    }

    function hookedSetTimeout() {
        var uniqueId = genUniqueId();
        var callback = arguments[0];
        if (typeof callback === 'function') {
            var _cb = callback;
            arguments[0] = function () {
                var ret = _cb.apply(this, arguments);
                notifyExec(uniqueId);
                return ret;
            };
        }
        var originMS = arguments[1];
        arguments[1] = (originMS || 0) * _percentage;
        var resultId = _origSetTimeout.apply(window, arguments);
        _timeoutIds[resultId] = {
            args: arguments, originMS: originMS, originId: resultId,
            nowId: resultId, uniqueId: uniqueId, oldPercentage: _percentage,
            exceptNextFireTime: _origDateNow() + (originMS || 0)
        };
        return resultId;
    }

    function hookedSetInterval() {
        var uniqueId = genUniqueId();
        var callback = arguments[0];
        if (typeof callback === 'function') {
            var _cb = callback;
            arguments[0] = function () {
                var ret = _cb.apply(this, arguments);
                notifyExec(uniqueId);
                return ret;
            };
        }
        var originMS = arguments[1];
        arguments[1] = (originMS || 0) * _percentage;
        var resultId = _origSetInterval.apply(window, arguments);
        _intervalIds[resultId] = {
            args: arguments, originMS: originMS, originId: resultId,
            nowId: resultId, uniqueId: uniqueId, oldPercentage: _percentage,
            exceptNextFireTime: _origDateNow() + (originMS || 0)
        };
        return resultId;
    }

    function hookedClearTimeout() {
        var id = arguments[0];
        if (_timeoutIds[id]) { arguments[0] = _timeoutIds[id].nowId; delete _timeoutIds[id]; }
        return _origClearTimeout.apply(window, arguments);
    }

    function hookedClearInterval() {
        var id = arguments[0];
        if (_intervalIds[id]) { arguments[0] = _intervalIds[id].nowId; delete _intervalIds[id]; }
        return _origClearInterval.apply(window, arguments);
    }

    function percentageChangeHandler(newPercentage) {
        var now = _origDateNow();
        var intKeys = Object.keys(_intervalIds);
        for (var i = 0; i < intKeys.length; i++) {
            var idObj = _intervalIds[intKeys[i]];
            idObj.args[1] = Math.floor((idObj.originMS || 1) * newPercentage);
            _origClearInterval.call(window, idObj.nowId);
            idObj.nowId = _origSetInterval.apply(window, idObj.args);
        }
        var toutKeys = Object.keys(_timeoutIds);
        for (var j = 0; j < toutKeys.length; j++) {
            var idObj2 = _timeoutIds[toutKeys[j]];
            var exceptTime = idObj2.exceptNextFireTime;
            var oldPercentage = idObj2.oldPercentage;
            var time = exceptTime - now;
            if (time < 0) time = 0;
            var changedTime = Math.floor(newPercentage / oldPercentage * time);
            idObj2.args[1] = changedTime;
            idObj2.exceptNextFireTime = now + changedTime;
            idObj2.oldPercentage = newPercentage;
            _origClearTimeout.call(window, idObj2.nowId);
            idObj2.nowId = _origSetTimeout.apply(window, idObj2.args);
        }
    }

    function _HookedDate() {
        var n = arguments.length;
        if (n === 0) return new _origDate(Date.now());
        if (n === 1) return new _origDate(arguments[0]);
        if (n === 2) return new _origDate(arguments[0], arguments[1]);
        if (n === 3) return new _origDate(arguments[0], arguments[1], arguments[2]);
        if (n === 4) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3]);
        if (n === 5) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4]);
        if (n === 6) return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5]);
        return new _origDate(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6]);
    }

    function _hookedDateNow() {
        var realNow = _origDateNow();
        return _lastVirtualTime + (realNow - _lastRealTime) * _invPercentage;
    }

    function installHooks() {
        if (_hooksInstalled) return;
        _hooksInstalled = true;
        window.setTimeout = hookedSetTimeout;
        window.setInterval = hookedSetInterval;
        window.clearTimeout = hookedClearTimeout;
        window.clearInterval = hookedClearInterval;
        window.Date = _HookedDate;
        _HookedDate.now = _hookedDateNow;
        _HookedDate.parse = _origDateParse;
        _HookedDate.UTC = _origDateUTC;
    }

    function removeHooks() {
        if (!_hooksInstalled) return;
        _hooksInstalled = false;
        window.setTimeout = _origSetTimeout;
        window.setInterval = _origSetInterval;
        window.clearTimeout = _origClearTimeout;
        window.clearInterval = _origClearInterval;
        window.Date = _origDate;
        _intervalIds = {};
        _timeoutIds = {};
    }

    function _applySpeed(speed) {
        var realNow = _origDateNow();
        if (speed === 1) {
            _lastVirtualTime = _hookedDateNow();
            _lastRealTime = realNow;
            _percentage = 1.0;
            _invPercentage = 1.0;
            percentageChangeHandler(1.0);
            return;
        }
        installHooks();
        _lastVirtualTime = _hookedDateNow();
        _lastRealTime = realNow;
        var newPercentage = 1 / speed;
        percentageChangeHandler(newPercentage);
        _percentage = newPercentage;
        _invPercentage = speed;
    }

    window.$hookTimer = {
        setSpeed: function (speed) {
            if (typeof speed !== 'number' || speed <= 0) return;
            _applySpeed(speed);
        },
        getSpeed: function () { return 1 / _percentage; },
        getPercentage: function () { return _percentage; }
    };

    // ===================== Ice Crystal UI =====================
    var _jsq_value = 1;
    var _isPersistent = false;
    var _iceOffX = 0, _iceOffY = 0;

    var _cssText = [
        ':root{--bg:#0a0e1a;--ice1:#a8d8ea;--ice2:#c8e6f5;--ice3:#e8f4fd;--frost:#7ec8e3;--deep:#1a3a5c;--glow:rgba(168,216,234,0.4)}',
        '.frost-particles{position:fixed;inset:0;pointer-events:none;z-index:2147483646;overflow:hidden}',
        '.frost-particle{position:absolute;width:4px;height:4px;background:var(--ice1);border-radius:50%;opacity:0;animation:iceFall linear infinite;pointer-events:none}',
        '@keyframes iceFall{0%{opacity:0;transform:translateY(-10px)}10%{opacity:.6}90%{opacity:.6}100%{opacity:0;transform:translateY(100vh) rotate(360deg)}}',
        '@keyframes icePulse{0%,100%{filter:drop-shadow(0 4px 14px rgba(126,200,227,0.4))}50%{filter:drop-shadow(0 4px 28px rgba(126,200,227,0.8))}}',
        '#ice-stamp{position:fixed;top:25px;left:20px;z-index:2147483647;width:52px;height:52px;background:linear-gradient(135deg,rgba(168,216,234,0.12),rgba(126,200,227,0.06));border:1.5px solid rgba(168,216,234,0.3);border-radius:12px;color:var(--ice1);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;user-select:none;font-weight:900;line-height:1;box-shadow:0 4px 14px rgba(90,164,201,0.15);transition:all .3s ease;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);touch-action:none;will-change:transform;transform:translateZ(0)}',
        '#ice-stamp:hover{box-shadow:0 6px 20px rgba(90,164,201,0.3);transform:translateY(-1px)}',
        '#ice-stamp .stamp-icon{font-size:18px;filter:drop-shadow(0 0 4px var(--glow))}',
        '#ice-stamp .stamp-speed{font-size:11px;color:var(--ice3);margin-top:1px}',
        '#ice-panel{position:fixed;z-index:2147483647;width:190px;max-width:calc(100vw - 30px);visibility:hidden;opacity:0;transform:translateY(-8px) scale(0.95);transition:all .3s cubic-bezier(.4,0,.2,1);pointer-events:none}',
        '#ice-panel.open{visibility:visible;opacity:1;transform:translateY(0) scale(1);pointer-events:auto}',
        '.panel-body{background:linear-gradient(180deg,rgba(16,24,42,0.96),rgba(10,14,26,0.98));border:1px solid rgba(168,216,234,0.18);border-radius:14px;padding:16px 14px;box-shadow:0 10px 36px rgba(0,0,0,0.5),0 0 1px rgba(168,216,234,0.2);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}',
        '.panel-body::before{content:"";display:block;height:2px;background:linear-gradient(90deg,transparent,var(--frost),transparent);border-radius:14px 14px 0 0;margin:0 -14px 14px}',
        '.panel-title{text-align:center;font-size:14px;font-weight:800;color:var(--ice1);letter-spacing:3px;margin-bottom:12px}',
        '.panel-close{position:absolute;top:12px;right:10px;width:22px;height:22px;border:1px solid rgba(168,216,234,0.15);background:rgba(168,216,234,0.04);color:var(--ice1);font-size:13px;cursor:pointer;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s}',
        '.panel-close:hover{background:rgba(91,164,201,0.25);border-color:var(--frost)}',
        '.speed-readout{text-align:center;margin-bottom:12px;padding:8px 0;border-bottom:1px solid rgba(168,216,234,0.08)}',
        '.speed-readout .num{font-size:34px;font-weight:900;color:var(--ice3);font-family:"Courier New",monospace;text-shadow:0 0 16px var(--glow);line-height:1}',
        '.speed-readout .unit{font-size:11px;color:rgba(168,216,234,0.4);margin-top:2px}',
        '.ice-slider-wrap{display:flex;justify-content:center;margin-bottom:12px;padding:8px 0}',
        '.ice-slider-track{position:relative;width:28px;height:160px;background:rgba(168,216,234,0.06);border:1px solid rgba(168,216,234,0.12);border-radius:14px;overflow:visible;cursor:pointer}',
        '.ice-fill{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(0deg,rgba(126,200,227,0.5),rgba(168,216,234,0.15));border-radius:0 0 13px 13px;transition:height .15s ease;box-shadow:0 0 12px rgba(126,200,227,0.2)}',
        '.ice-marks{position:absolute;inset:0;pointer-events:none}',
        '.ice-mark{position:absolute;left:3px;right:3px;height:1px;background:rgba(168,216,234,0.15)}',
        '.ice-thumb{position:absolute;left:50%;transform:translate(-50%,0);width:34px;height:12px;background:linear-gradient(135deg,var(--frost),var(--ice3));border:1.5px solid var(--ice2);border-radius:6px;box-shadow:0 0 10px var(--glow),0 2px 6px rgba(0,0,0,0.3);cursor:grab;z-index:2;transition:box-shadow .2s}',
        '.ice-thumb:active{cursor:grabbing;box-shadow:0 0 18px var(--glow),0 2px 8px rgba(0,0,0,0.4)}',
        '.ice-thumb::after{content:attr(data-val);position:absolute;right:calc(100% + 8px);top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--ice3);white-space:nowrap;background:rgba(10,14,26,0.9);padding:2px 6px;border-radius:4px;border:1px solid rgba(168,216,234,0.2);pointer-events:none;opacity:0;transition:opacity .2s}',
        '.ice-slider-track:hover .ice-thumb::after,.ice-thumb:active::after{opacity:1}',
        '.preset-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}',
        '.preset-btn{height:30px;border:1px solid rgba(168,216,234,0.12);background:rgba(168,216,234,0.04);color:var(--ice2);font-size:11px;font-weight:700;cursor:pointer;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;user-select:none}',
        '.preset-btn:hover{background:rgba(168,216,234,0.1);border-color:rgba(168,216,234,0.25)}',
        '.preset-btn.active{background:linear-gradient(135deg,rgba(91,164,201,0.3),rgba(126,200,227,0.15));border-color:var(--frost);color:var(--ice3);box-shadow:0 0 10px rgba(126,200,227,0.2)}',
        '.panel-bottom{display:flex;gap:6px}',
        '.ctrl-btn{flex:1;height:32px;border:1px solid rgba(168,216,234,0.12);background:rgba(168,216,234,0.04);color:var(--ice2);font-size:11px;font-weight:600;cursor:pointer;border-radius:6px;transition:all .15s;letter-spacing:1px;user-select:none}',
        '.ctrl-btn:hover{background:rgba(168,216,234,0.1);border-color:rgba(168,216,234,0.25)}',
        '.ctrl-btn.on{background:rgba(91,164,201,0.2);border-color:var(--frost);color:var(--ice3)}',
        '.ice-status-indicator{position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateZ(0);z-index:2147483646;background:rgba(16,24,42,0.95);color:var(--ice2);padding:8px 16px;border-radius:20px;font-size:12px;font-weight:bold;border:1px solid rgba(168,216,234,0.2);pointer-events:none;opacity:0;transition:opacity 0.3s}',
        '.ice-status-indicator.visible{opacity:1}',
        '.ice-error-toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(220,53,69,0.95);color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:bold;z-index:2147483647;opacity:0;pointer-events:none;transition:opacity 0.3s;box-shadow:0 4px 12px rgba(0,0,0,0.3);text-align:center;max-width:80%}',
        '.ice-error-toast.visible{opacity:1}',
        '@media(max-width:767px){#ice-stamp{width:44px;height:44px}#ice-stamp .stamp-icon{font-size:15px}#ice-panel{width:170px}.speed-readout .num{font-size:28px}.ice-slider-track{height:140px}}',
        '@media(prefers-reduced-motion:reduce){.frost-particle{animation:none}#ice-panel{transition:none}.ice-status-indicator,.ice-error-toast{transition:none}}'
    ];

    var _styleNode = document.createElement('style');
    _styleNode.textContent = _cssText.join('');

    var _presetValues = [0.5, 1, 2, 5, 10, 50];
    var _sliderMin = 0.1, _sliderMax = 200;
    var _logMin = Math.log(_sliderMin), _logMax = Math.log(_sliderMax);

    function _speedToPos(s) { return (Math.log(s) - _logMin) / (_logMax - _logMin); }
    function _posToSpeed(p) { return Math.exp(_logMin + p * (_logMax - _logMin)); }
    function _snapToPreset(s) {
        for (var i = 0; i < _presetValues.length; i++) {
            if (Math.abs(_presetValues[i] - s) / s < 0.08) return _presetValues[i];
        }
        return Math.round(s * 100) / 100;
    }

    var _stamp = document.createElement('div');
    _stamp.id = 'ice-stamp';
    _stamp.setAttribute('role', 'button');
    _stamp.setAttribute('aria-label', '\u51b0\u6676\u52a0\u901f\u5668');
    _stamp.setAttribute('tabindex', '0');
    _stamp.innerHTML = '<span class="stamp-icon">\u2744</span><span class="stamp-speed" id="iceStampSpeed">1x</span>';

    var _panel = document.createElement('div');
    _panel.id = 'ice-panel';
    _panel.setAttribute('role', 'dialog');
    _panel.setAttribute('aria-label', '\u52a0\u901f\u63a7\u5236\u9762\u677f');
    _panel.setAttribute('tabindex', '-1');

    var _presetHtml = '';
    for (var _pi = 0; _pi < _presetValues.length; _pi++) {
        var pv = _presetValues[_pi];
        _presetHtml += '<button class="preset-btn" data-speed="' + pv + '">' + pv + 'x</button>';
    }

    _panel.innerHTML = [
        '<div class="panel-body">',
        '<button class="panel-close" id="icePanelClose" aria-label="\u5173\u95ed">\u00d7</button>',
        '<div class="panel-title">\u51b0\u6676\u52a0\u901f</div>',
        '<div class="speed-readout"><div class="num" id="iceSpeedNum">1</div><div class="unit">\u500d\u901f</div></div>',
        '<div class="ice-slider-wrap">',
        '<div class="ice-slider-track" id="iceTrack">',
        '<div class="ice-fill" id="iceFill"></div>',
        '<div class="ice-marks" id="iceMarks"></div>',
        '<div class="ice-thumb" id="iceThumb" data-val="1x"></div>',
        '</div></div>',
        '<div class="preset-row">', _presetHtml, '</div>',
        '<div class="panel-bottom">',
        '<button class="ctrl-btn" id="iceBtnPersist">\u6301\u4e45</button>',
        '<button class="ctrl-btn" id="iceBtnReset">\u5f52\u4e00</button>',
        '</div></div>'
    ].join('');

    var _frostContainer = document.createElement('div');
    _frostContainer.className = 'frost-particles';
    _frostContainer.id = 'iceFrostParticles';

    var _statusIndicator = document.createElement('div');
    _statusIndicator.className = 'ice-status-indicator';
    _statusIndicator.setAttribute('aria-live', 'polite');

    var _errorToast = document.createElement('div');
    _errorToast.className = 'ice-error-toast';

    function _mountUI() {
        if (window.__iceRendered) return;
        window.__iceRendered = true;

        document.head.appendChild(_styleNode);

        var _frag = document.createDocumentFragment();
        _frag.appendChild(_frostContainer);
        _frag.appendChild(_stamp);
        _frag.appendChild(_statusIndicator);
        _frag.appendChild(_errorToast);
        _frag.appendChild(_panel);
        document.body.appendChild(_frag);

        // Frost particles
        for (var _fp = 0; _fp < 25; _fp++) {
            var _p = document.createElement('div');
            _p.className = 'frost-particle';
            _p.style.left = Math.random() * 100 + '%';
            _p.style.animationDuration = (5 + Math.random() * 8) + 's';
            _p.style.animationDelay = Math.random() * 10 + 's';
            _p.style.width = _p.style.height = (2 + Math.random() * 3) + 'px';
            _frostContainer.appendChild(_p);
        }

        // Slider marks
        var _ticks = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
        var _marksEl = document.getElementById('iceMarks');
        for (var _tm = 0; _tm < _ticks.length; _tm++) {
            var _pct = _speedToPos(_ticks[_tm]) * 100;
            var _m = document.createElement('div');
            _m.className = 'ice-mark';
            _m.style.bottom = _pct + '%';
            _marksEl.appendChild(_m);
        }

        var _stampSpeed = document.getElementById('iceStampSpeed');
        var _speedNum = document.getElementById('iceSpeedNum');
        var _track = document.getElementById('iceTrack');
        var _fill = document.getElementById('iceFill');
        var _thumb = document.getElementById('iceThumb');
        var _presetBtns = _panel.querySelectorAll('.preset-btn');
        var _btnPersist = document.getElementById('iceBtnPersist');
        var _btnReset = document.getElementById('iceBtnReset');
        var _panelClose = document.getElementById('icePanelClose');

        var _panelOpen = false;

        function _showError(msg) {
            _errorToast.textContent = msg;
            _errorToast.classList.add('visible');
            _origSetTimeout.call(window, function () { _errorToast.classList.remove('visible'); }, 2000);
        }

        function _showStatus(speed) {
            _statusIndicator.textContent = speed !== 1 ? '\u52a0\u901f\u5df2\u542f\u7528: ' + speed + 'x' : '\u901f\u5ea6\u5df2\u91cd\u7f6e';
            _statusIndicator.classList.add('visible');
            _origSetTimeout.call(window, function () { _statusIndicator.classList.remove('visible'); }, speed !== 1 ? 2000 : 1000);
        }

        function _setSpeedUI(v) {
            _jsq_value = v;
            var label = v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10);
            _stampSpeed.textContent = label + 'x';
            _speedNum.textContent = label;

            var pos = _speedToPos(v);
            var pct = pos * 100;
            _fill.style.height = pct + '%';
            _thumb.style.bottom = pct + '%';
            _thumb.setAttribute('data-val', label + 'x');

            for (var _b = 0; _b < _presetBtns.length; _b++) {
                _presetBtns[_b].classList.toggle('active', Math.abs(parseFloat(_presetBtns[_b].dataset.speed) - v) < 0.01);
            }

            try {
                _applySpeed(v);
                _showStatus(v);
            } catch (error) {
                _showError('\u52a0\u901f\u5931\u8d25: ' + error.message);
            }

            if (_isPersistent) {
                try { localStorage.setItem('iceSpeed', v); } catch (e) { }
            }
        }

        function _togglePersist() {
            _isPersistent = !_isPersistent;
            if (_isPersistent) {
                try {
                    localStorage.setItem('icePersist', 'true');
                    localStorage.setItem('iceSpeed', _jsq_value);
                } catch (e) { }
            } else {
                try {
                    localStorage.removeItem('iceSpeed');
                    localStorage.removeItem('icePersist');
                } catch (e) { }
            }
            _btnPersist.classList.toggle('on', _isPersistent);
            _btnPersist.textContent = _isPersistent ? '\u5df2\u6301' : '\u6301\u4e45';
        }

        function _togglePanel(open) {
            _panelOpen = typeof open === 'boolean' ? open : !_panelOpen;
            if (_panelOpen) {
                var stampRect = _stamp.getBoundingClientRect();
                var vpW = window.innerWidth;
                var vpH = window.innerHeight;
                var pLeft = stampRect.left;
                if (pLeft + _panel.offsetWidth > vpW - 10) pLeft = Math.max(10, vpW - _panel.offsetWidth - 10);
                if (pLeft < 10) pLeft = 10;
                var pTop = stampRect.bottom + 8;
                _panel.style.left = pLeft + 'px';
                _panel.style.top = pTop + 'px';
            }
            _panel.classList.toggle('open', _panelOpen);
        }

        // --- Slider drag ---
        (function () {
            var _dragging = false;
            function _getPos(e) {
                var rect = _track.getBoundingClientRect();
                var ev = e.touches ? e.touches[0] : e;
                var y = rect.bottom - ev.clientY;
                return Math.max(0, Math.min(1, y / rect.height));
            }
            function _onDown(e) {
                _dragging = true;
                _setSpeedUI(_snapToPreset(_posToSpeed(_getPos(e))));
                e.preventDefault();
            }
            function _onMove(e) {
                if (!_dragging) return;
                _setSpeedUI(_snapToPreset(_posToSpeed(_getPos(e))));
                e.preventDefault();
            }
            function _onUp() { _dragging = false; }
            _thumb.addEventListener('mousedown', _onDown);
            document.addEventListener('mousemove', _onMove);
            document.addEventListener('mouseup', _onUp);
            _thumb.addEventListener('touchstart', _onDown, { passive: false });
            document.addEventListener('touchmove', _onMove, { passive: false });
            document.addEventListener('touchend', _onUp);
            _track.addEventListener('mousedown', _onDown);
            _track.addEventListener('touchstart', _onDown, { passive: false });
        })();

        // Preset buttons
        for (var _k = 0; _k < _presetBtns.length; _k++) {
            _presetBtns[_k].addEventListener('click', function () {
                _setSpeedUI(parseFloat(this.getAttribute('data-speed')));
            });
        }

        // Panel events
        _panelClose.addEventListener('click', function () { _togglePanel(false); });
        _btnReset.addEventListener('click', function () { _setSpeedUI(1); });
        _btnPersist.addEventListener('click', _togglePersist);

        // Stamp click
        (function () {
            var _clickTimer = 0;
            _stamp.addEventListener('click', function (e) {
                if (_stamp._dragged) { _stamp._dragged = false; return; }
                if (_clickTimer) {
                    _origClearTimeout.call(window, _clickTimer);
                    _clickTimer = 0;
                    _setSpeedUI(1);
                    return;
                }
                _clickTimer = _origSetTimeout.call(window, function () {
                    _clickTimer = 0;
                    _togglePanel();
                }, 250);
            }, false);
        })();

        // Click outside to close
        document.addEventListener('mousedown', function (e) {
            if (_panelOpen && !_panel.contains(e.target) && !_stamp.contains(e.target)) _togglePanel(false);
        });

        // Stamp drag
        (function (el) {
            var _dragging = false, _sx = null, _sy = null, _moved = false;
            function _onDown(e) {
                _dragging = true; _moved = false;
                var t = e.touches ? e.touches[0] : e;
                _sx = t.clientX; _sy = t.clientY;
                _iceOffX = el.offsetLeft; _iceOffY = el.offsetTop;
                el.classList.add('dragging');
                if (!e.touches) e.preventDefault();
            }
            function _onMove(e) {
                if (!_dragging || _sx === null) return;
                var t = e.touches ? e.touches[0] : e;
                var dx = t.clientX - _sx, dy = t.clientY - _sy;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _moved = true;
                _iceOffX = Math.max(0, Math.min(window.innerWidth - 52, _iceOffX + dx));
                _iceOffY = Math.max(0, Math.min(window.innerHeight - 52, _iceOffY + dy));
                el.style.left = _iceOffX + 'px';
                el.style.top = _iceOffY + 'px';
                _panel.style.left = _iceOffX + 'px';
                _panel.style.top = (_iceOffY + 60) + 'px';
                _sx = t.clientX; _sy = t.clientY;
                e.preventDefault();
            }
            function _onUp() {
                if (!_dragging) return;
                _dragging = false;
                el.classList.remove('dragging');
                el._dragged = _moved;
                _sx = null;
            }
            el.addEventListener('mousedown', _onDown);
            document.addEventListener('mousemove', _onMove);
            document.addEventListener('mouseup', _onUp);
            el.addEventListener('touchstart', _onDown, { passive: false });
            document.addEventListener('touchmove', _onMove, { passive: false });
            document.addEventListener('touchend', _onUp);
        })(_stamp);

        // Keyboard shortcuts
        _panel.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { _togglePanel(false); return; }
            if (e.key !== 'Tab') return;
            var focusable = _panel.querySelectorAll('.preset-btn, #icePanelClose, #iceBtnPersist, #iceBtnReset');
            if (focusable.length === 0) return;
            var first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });

        // Initialize from storage
        try {
            var _savedPersist = localStorage.getItem('icePersist');
            var _savedSpeed = localStorage.getItem('iceSpeed');
            if (_savedPersist === 'true' && _savedSpeed) {
                var _spd = parseFloat(_savedSpeed);
                if (!isNaN(_spd) && _spd > 0) {
                    _isPersistent = true;
                    _btnPersist.classList.toggle('on', true);
                    _btnPersist.textContent = '\u5df2\u6301';
                    _origSetTimeout.call(window, function () { _setSpeedUI(_spd); }, 500);
                }
            }
        } catch (e) { }

        if (!_isPersistent) {
            _setSpeedUI(1);
        }

        // Global keyboard
        window.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            var currentSpeed = _invPercentage;
            if (e.key === '9' && (e.ctrlKey || e.altKey)) {
                var t = prompt('\u8f93\u5165\u6b32\u6539\u53d8\u7684\u500d\u7387\uff08\u5f53\u524d\uff1a' + currentSpeed.toFixed(2) + '\uff09');
                if (t == null) return;
                if (isNaN(parseFloat(t))) return;
                if (parseFloat(t) <= 0) return;
                _setSpeedUI(parseFloat(t));
            } else if ((e.key === '=' || e.key === '.') && e.ctrlKey) {
                _setSpeedUI(Math.min(200, currentSpeed + 2));
            } else if ((e.key === '=' || e.key === '.') && e.altKey) {
                _setSpeedUI(Math.min(200, currentSpeed * 2));
            } else if ((e.key === '-' || e.key === ',') && e.ctrlKey) {
                _setSpeedUI(Math.max(0.1, currentSpeed - 2));
            } else if ((e.key === '-' || e.key === ',') && e.altKey) {
                _setSpeedUI(Math.max(0.1, currentSpeed / 2));
            } else if (e.key === '0' && (e.ctrlKey || e.altKey)) {
                _setSpeedUI(1);
            }
            if (e.key === '[' || e.key === '\u3010') {
                var idx = _presetValues.indexOf(currentSpeed);
                if (idx < 0) idx = _presetValues.indexOf(1);
                if (idx > 0) _setSpeedUI(_presetValues[idx - 1]);
            } else if (e.key === ']' || e.key === '\u3011') {
                var idx2 = _presetValues.indexOf(currentSpeed);
                if (idx2 < 0) idx2 = _presetValues.indexOf(1);
                if (idx2 < _presetValues.length - 1) _setSpeedUI(_presetValues[idx2 + 1]);
            } else if (e.key === 'p' || e.key === 'P') {
                _togglePersist();
            }
        });
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        _mountUI();
    } else {
        document.addEventListener('readystatechange', function () {
            if ((document.readyState === 'interactive' || document.readyState === 'complete') && !window.__iceRendered) {
                _mountUI();
            }
        });
    }
})();
