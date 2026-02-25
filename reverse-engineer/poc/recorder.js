/**
 * Etendo Lite — Session Recorder
 *
 * Paste in DevTools console. A floating panel will appear on the page.
 * Files download automatically on Stop.
 */
(function () {

  // ─── Config ────────────────────────────────────────────────────────────────

  let DEBUG_MODE = false;

  const NOISE_PATTERNS = [
    /\.(js|css|png|jpg|gif|svg|ico|woff|woff2|ttf|map)(\?|$)/i,
    /\/heartbeat/i, /\/keepalive/i, /\/status\.html/i,
    /jsdbg/i, /favicon/i,
  ];

  const API_PATTERNS = [
    /\/etendo\//i, /\/openbravo\//i, /jsonrest/i,
    /\/sws\//i, /\/ws\//i, /\/ad_/i, /\/org\./i,
    /com\.etendo/i, /com\.openbravo/i,
  ];

  // ─── State ─────────────────────────────────────────────────────────────────

  const state = {
    recording: false,
    currentSession: null,
    sessions: [],
  };

  function shouldCapture(url) {
    if (DEBUG_MODE) return true;
    if (NOISE_PATTERNS.some(p => p.test(url))) return false;
    return API_PATTERNS.some(p => p.test(url));
  }

  // ─── XHR Interceptor ───────────────────────────────────────────────────────

  const _OriginalXHR = window.XMLHttpRequest;

  function PatchedXHR() {
    const xhr = new _OriginalXHR();
    let _method, _url, _requestBody, _startTime;

    xhr.open = function (method, url, ...rest) {
      _method = method.toUpperCase();
      _url = url;
      return _OriginalXHR.prototype.open.apply(xhr, [method, url, ...rest]);
    };

    xhr.send = function (body) {
      _startTime = Date.now();
      _requestBody = body;

      xhr.addEventListener('loadend', function () {
        if (!state.recording || !state.currentSession) return;
        if (!shouldCapture(_url)) return;

        let requestPayload = null;
        try { requestPayload = _requestBody ? JSON.parse(_requestBody) : null; }
        catch (_) { requestPayload = _requestBody || null; }

        let responseBody = null;
        try { responseBody = xhr.responseText ? JSON.parse(xhr.responseText) : null; }
        catch (_) { responseBody = xhr.responseText || null; }

        pushCall({
          seq: state.currentSession.calls.length + 1,
          transport: 'xhr',
          method: _method,
          url: _url,
          request_payload: requestPayload,
          response_status: xhr.status,
          response_body: responseBody,
          duration_ms: Date.now() - _startTime,
          timestamp: new Date(_startTime).toISOString(),
        });
      });

      return _OriginalXHR.prototype.send.apply(xhr, [body]);
    };

    return xhr;
  }
  Object.keys(_OriginalXHR).forEach(k => { try { PatchedXHR[k] = _OriginalXHR[k]; } catch (_) {} });
  PatchedXHR.prototype = _OriginalXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  // ─── Fetch Interceptor ─────────────────────────────────────────────────────

  const _originalFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url;
    const method = (init?.method || input?.method || 'GET').toUpperCase();
    const startTime = Date.now();
    const response = await _originalFetch.apply(this, arguments);
    if (!state.recording || !state.currentSession || !shouldCapture(url)) return response;

    const clone = response.clone();
    let requestPayload = null;
    try { if (init?.body) requestPayload = JSON.parse(init.body); } catch (_) { requestPayload = init?.body || null; }
    let responseBody = null;
    try { responseBody = JSON.parse(await clone.text()); } catch (_) {}

    pushCall({
      seq: state.currentSession.calls.length + 1,
      transport: 'fetch', method, url,
      request_payload: requestPayload,
      response_status: response.status,
      response_body: responseBody,
      duration_ms: Date.now() - startTime,
      timestamp: new Date(startTime).toISOString(),
    });
    return response;
  };

  // ─── Core Logic ────────────────────────────────────────────────────────────

  function pushCall(call) {
    state.currentSession.calls.push(call);
    ui.updateCounter(state.currentSession.calls.length);
  }

  function startRecording(operationName, phase = 'execution') {
    if (state.recording) return;
    state.currentSession = {
      operation: operationName,
      phase,
      etendo_version: '26Q1',
      recorded_at: new Date().toISOString(),
      calls: [],
    };
    state.recording = true;
    ui.setRecording(true, operationName);
    console.log(`%c[recorder] ● ${operationName}`, 'color:#e74c3c;font-weight:bold');
  }

  function stopAndSave() {
    if (!state.recording) return;
    state.recording = false;
    const session = state.currentSession;
    state.sessions.push(session);
    state.currentSession = null;
    ui.setRecording(false, null);
    ui.addSessionRow(session);
    downloadSession(session);
    console.log(`%c[recorder] ■ Saved: ${session.operation} (${session.calls.length} calls)`, 'color:#27ae60;font-weight:bold');
    return session;
  }

  function downloadSession(session) {
    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.operation}.session.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Floating UI ───────────────────────────────────────────────────────────

  const ui = (() => {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #etlite-recorder {
        position: fixed; bottom: 20px; right: 20px; z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; width: 280px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        border-radius: 10px; overflow: hidden;
        user-select: none;
      }
      #etlite-recorder * { box-sizing: border-box; margin: 0; padding: 0; }
      #etlite-header {
        background: #1a1a2e; color: #fff;
        padding: 10px 14px; display: flex; align-items: center;
        justify-content: space-between; cursor: move;
      }
      #etlite-header-title { font-weight: 600; font-size: 12px; letter-spacing: 0.5px; }
      #etlite-status-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #555; display: inline-block; margin-right: 6px;
        transition: background 0.3s;
      }
      #etlite-status-dot.recording {
        background: #e74c3c;
        box-shadow: 0 0 0 3px rgba(231,76,60,0.3);
        animation: pulse 1s infinite;
      }
      @keyframes pulse {
        0%,100% { box-shadow: 0 0 0 3px rgba(231,76,60,0.3); }
        50%      { box-shadow: 0 0 0 6px rgba(231,76,60,0.1); }
      }
      #etlite-body { background: #fff; padding: 12px; }
      #etlite-op-input {
        width: 100%; padding: 7px 10px; border: 1px solid #ddd;
        border-radius: 6px; font-size: 12px; margin-bottom: 8px;
        outline: none; transition: border 0.2s;
      }
      #etlite-op-input:focus { border-color: #3498db; }
      #etlite-phase-select {
        width: 100%; padding: 6px 10px; border: 1px solid #ddd;
        border-radius: 6px; font-size: 12px; margin-bottom: 10px;
        outline: none; background: #fff;
      }
      .etlite-btn {
        width: 100%; padding: 8px; border: none; border-radius: 6px;
        font-size: 12px; font-weight: 600; cursor: pointer;
        transition: opacity 0.2s, transform 0.1s;
        margin-bottom: 6px;
      }
      .etlite-btn:active { transform: scale(0.98); }
      .etlite-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      #etlite-btn-start  { background: #e74c3c; color: #fff; }
      #etlite-btn-stop   { background: #27ae60; color: #fff; }
      #etlite-counter {
        text-align: center; font-size: 11px; color: #888;
        padding: 4px 0; min-height: 20px;
      }
      #etlite-counter span { color: #e74c3c; font-weight: bold; }
      #etlite-sessions { max-height: 110px; overflow-y: auto; margin-top: 8px; }
      .etlite-session-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 5px 8px; background: #f8f8f8; border-radius: 5px;
        margin-bottom: 4px; font-size: 11px;
      }
      .etlite-session-row .name { color: #333; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .etlite-session-row .count { color: #27ae60; font-weight: bold; margin: 0 6px; }
      .etlite-session-row .dl-btn {
        background: none; border: 1px solid #3498db; color: #3498db;
        border-radius: 4px; padding: 2px 7px; font-size: 10px;
        cursor: pointer; font-weight: 600;
      }
      .etlite-session-row .dl-btn:hover { background: #3498db; color: #fff; }
      #etlite-debug-row {
        display: flex; align-items: center; gap: 6px;
        padding-top: 8px; border-top: 1px solid #eee; margin-top: 6px;
        font-size: 11px; color: #888;
      }
      #etlite-debug-toggle {
        width: 32px; height: 16px; background: #ccc; border-radius: 8px;
        position: relative; cursor: pointer; transition: background 0.2s;
        border: none;
      }
      #etlite-debug-toggle.on { background: #e67e22; }
      #etlite-debug-toggle::after {
        content: ''; position: absolute; top: 2px; left: 2px;
        width: 12px; height: 12px; background: #fff; border-radius: 50%;
        transition: transform 0.2s;
      }
      #etlite-debug-toggle.on::after { transform: translateX(16px); }
      #etlite-minimize {
        background: none; border: none; color: #aaa; cursor: pointer;
        font-size: 14px; padding: 0 4px; line-height: 1;
      }
      #etlite-minimize:hover { color: #fff; }
      #etlite-body.collapsed { display: none; }
    `;
    document.head.appendChild(style);

    // Build panel
    const panel = document.createElement('div');
    panel.id = 'etlite-recorder';
    panel.innerHTML = `
      <div id="etlite-header">
        <div>
          <span id="etlite-status-dot"></span>
          <span id="etlite-header-title">ETENDO RECORDER</span>
        </div>
        <button id="etlite-minimize" title="Minimize">─</button>
      </div>
      <div id="etlite-body">
        <input id="etlite-op-input" type="text" placeholder="Operation name (e.g. create_sales_order)" />
        <select id="etlite-phase-select">
          <option value="execution">Phase B — Execution</option>
          <option value="setup">Phase A — Setup</option>
        </select>
        <button class="etlite-btn" id="etlite-btn-start">● Start Recording</button>
        <button class="etlite-btn" id="etlite-btn-stop" disabled>■ Stop &amp; Save</button>
        <div id="etlite-counter">Ready</div>
        <div id="etlite-sessions"></div>
        <div id="etlite-debug-row">
          <button id="etlite-debug-toggle" title="Debug mode: capture all calls"></button>
          <span>Debug mode (capture all)</span>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // ── Refs
    const dot       = panel.querySelector('#etlite-status-dot');
    const opInput   = panel.querySelector('#etlite-op-input');
    const phaseSelect = panel.querySelector('#etlite-phase-select');
    const btnStart  = panel.querySelector('#etlite-btn-start');
    const btnStop   = panel.querySelector('#etlite-btn-stop');
    const counter   = panel.querySelector('#etlite-counter');
    const sessions  = panel.querySelector('#etlite-sessions');
    const debugBtn  = panel.querySelector('#etlite-debug-toggle');
    const minBtn    = panel.querySelector('#etlite-minimize');
    const body      = panel.querySelector('#etlite-body');

    // ── Events
    btnStart.addEventListener('click', () => {
      const name = opInput.value.trim().replace(/\s+/g, '_') || 'operation';
      const phase = phaseSelect.value;
      startRecording(name, phase);
    });

    btnStop.addEventListener('click', stopAndSave);

    debugBtn.addEventListener('click', () => {
      DEBUG_MODE = !DEBUG_MODE;
      debugBtn.classList.toggle('on', DEBUG_MODE);
    });

    minBtn.addEventListener('click', () => {
      body.classList.toggle('collapsed');
      minBtn.textContent = body.classList.contains('collapsed') ? '+' : '─';
    });

    // ── Draggable header
    let dragging = false, ox = 0, oy = 0;
    const header = panel.querySelector('#etlite-header');
    header.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      ox = e.clientX - panel.offsetLeft;
      oy = e.clientY - panel.offsetTop;
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = (e.clientX - ox) + 'px';
      panel.style.top  = (e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });

    // ── Public interface
    return {
      setRecording(active, name) {
        dot.classList.toggle('recording', active);
        btnStart.disabled = active;
        btnStop.disabled  = !active;
        opInput.disabled  = active;
        phaseSelect.disabled = active;
        if (active) {
          counter.innerHTML = `Recording <span>0</span> calls…`;
        } else {
          counter.textContent = 'Ready';
        }
      },
      updateCounter(n) {
        counter.innerHTML = `Recording <span>${n}</span> calls…`;
      },
      addSessionRow(session) {
        const row = document.createElement('div');
        row.className = 'etlite-session-row';
        row.innerHTML = `
          <span class="name" title="${session.operation}">${session.operation}</span>
          <span class="count">${session.calls.length}</span>
          <button class="dl-btn">↓</button>
        `;
        row.querySelector('.dl-btn').addEventListener('click', () => downloadSession(session));
        sessions.prepend(row);
      },
    };
  })();

  // ─── Console API (still available) ────────────────────────────────────────

  window.recorder = {
    start: (name, phase) => startRecording(name, phase),
    stop:  () => stopAndSave(),
    debug: (v = true) => { DEBUG_MODE = v; console.log(`[recorder] debug ${v ? 'ON' : 'OFF'}`); },
    get sessions() { return state.sessions; },
    status: () => console.log({ recording: state.recording, debug: DEBUG_MODE, calls: state.currentSession?.calls.length ?? 0 }),
  };

  console.log('%c[recorder] Panel injected. Use the button or recorder.start("name") in console.', 'color:#2980b9;font-weight:bold');

})();
