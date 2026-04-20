// save as server.js (replace your old file)
// npm install express ws axios fca-mafiya

const fs = require('fs');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');
const axios = require('axios');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 20379;

// Configuration (global defaults only)
let globalConfig = {
  delay: 5
};

// Sessions store: stopKey -> session object
// session = {
//   stopKey, cookiesFilename, threadID, messages:[], currentIndex, loopCount,
//   delay, prefix, running, api, timerId
// }
const sessions = {};

// Utility: generate simple random stop key WITH PREFIX
function genStopKey(len = 8) {
  const prefix = 'RB RIZZU KHAN '; // ADDED PREFIX - KEEPING IN CODE LOGIC
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return prefix + s; // Return prefixed key
}

// Uppercase broadcast wrapper
function broadcastToAll(message) {
  if (!wss) return;
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch (e) { /* ignore */ }
    }
  });
}

// Send to a single ws client (helper used on connection)
function sendToClient(ws, message) {
  try { ws.send(JSON.stringify(message)); } catch (e) { /* ignore */ }
}

// Per-session log (always uppercase)
function sessionLog(stopKey, text) {
  const msg = String(text).toUpperCase();
  // broadcast to all clients for visibility (you can scope to single client if desired)
  broadcastToAll({ type: 'log', message: `[${stopKey}] ${msg}` });
}

// WebSocket server reference
let wss;

// Serve updated control panel (UI modified per request)
const htmlControlPanel = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>RB RIZZU KHAN CONTROL</title>
<style>
  /* Base & Reset */
  *{box-sizing:border-box;font-family:Roboto,Inter,system-ui,Arial,sans-serif}
  html,body{height:100%;margin:0;background:#000;color:#dfefff}
  
  /* 3D HD Background (SCARY, UNLIMITED, 5-second shifting) */
  @keyframes colorShift {
    0% { background: linear-gradient(180deg, #100000 0%, #330000 40%, #1a0a0a 100%); } /* Deep Red/Black */
    16% { background: linear-gradient(180deg, #100010 0%, #330033 40%, #1a0a1a 100%); } /* Deep Purple/Black */
    33% { background: linear-gradient(180deg, #000000 0%, #1a0000 40%, #100000 100%); } /* Pure Black/Dark Red */
    50% { background: linear-gradient(180deg, #1a1a00 0%, #333300 40%, #1a1a0a 100%); } /* Eerie Yellow/Olive */
    66% { background: linear-gradient(180deg, #001000 0%, #003300 40%, #0a1a0a 100%); } /* Dark Green/Black */
    83% { background: linear-gradient(180deg, #1a001a 0%, #330033 40%, #100010 100%); } /* Dark Magenta/Purple */
    100% { background: linear-gradient(180deg, #100000 0%, #330000 40%, #1a0a0a 100%); } 
  }

  body{
    overflow-y:auto;
    padding-bottom:50px;
    font-size: 16px; 
    perspective: 1800px; 
    animation: colorShift 30s infinite alternate ease-in-out; 
  }
  
  /* Header - REMOVED TEXT AND BACKGROUND */
  header{
    padding: 0; 
    display:flex;
    align-items:center;
    gap:20px;
    border-bottom:none; 
    background: transparent;
    backdrop-filter: none;
    box-shadow: none;
    height: 10px; 
  }
  header h1{
    display: none; 
  }
  
  header .sub{
    display: none; 
  }
  
  /* Container & Panel */
  .container{max-width:1100px;margin:30px auto;padding:25px} 
  .panel{
    background: rgba(10,25,40,0.95); 
    border:2px solid rgba(135,206,250,0.3); 
    padding:25px; 
    border-radius:18px; 
    margin-bottom:35px; 
    box-shadow: 0 20px 50px rgba(0,0,0,0.95); 
    transform-style: preserve-3d;
    transform: rotateX(1deg); 
  }
  
  /* Labels & Text (Level Text Green) */
  label{font-size:15px;color:#00ff88;font-weight: 500; transform: translateZ(5px); display: block;} 
  small{display: none;} /* HIDES ALL SMALL TEXT AS REQUESTED */ 
  
  /* Layout Grid */
  .row{display:grid;grid-template-columns:1fr 1fr;gap:25px} 
  .full{grid-column:1/3}
  .input-group > div {margin-bottom: 20px;} 

  /* Custom 3-Input Grouping (Cookie/Thread/Delay/Prefix) */
  .top-input-group {
      display: flex;
      gap: 30px;
      align-items: flex-start;
      flex-wrap: wrap;
  }
  .top-input-group > div:first-child {
      min-width: 350px; /* Cookie options container */
  }
  /* This container holds Thread ID and Delay (stacked) */
  .thread-delay-container {
      flex-grow: 1; 
      min-width: 300px;
      display: flex; 
      flex-direction: column;
      gap: 20px; 
  }
  
  /* Cookie Options on one line */
  .cookie-opts {
    display: flex;
    align-items: center;
    gap: 20px;
    transform: translateZ(5px);
  }
  .cookie-opts label {
    display: flex;
    align-items: center;
    transform: none;
    color: #00ff88; /* Keep label color green */
  }

  /* Inputs & Textarea (3D Raised Effect) */
  input[type="text"], input[type="number"], textarea, input[type=file] {
    height:50px; 
    padding:16px;
    border-radius:12px;
    border:1px solid rgba(60,120,200,0.4);
    background: rgba(4,15,30,0.9);
    color:#dfefff;
    outline:none;
    font-size:17px;
    width: 100%;
    margin-top: 6px; 
    box-shadow: inset 0 3px 8px rgba(0,0,0,0.7), 0 5px 10px rgba(0,0,0,0.5); 
    transition: all 0.3s;
    transform: translateZ(10px); 
  }
  input[type="text"]:focus, input[type="number"]:focus, textarea:focus {
    border-color: #87cefa; 
    box-shadow: inset 0 3px 8px rgba(0,0,0,0.7), 0 0 10px rgba(135,206,250,0.3);
    transform: translateZ(15px); 
  }
  
  textarea{height:120px; padding-top:16px; resize:vertical; transform: translateZ(10px);} 
  .blue-input{background:linear-gradient(180deg,#021020,#000e1a);border:1px solid rgba(30,120,210,0.7)}
  
  /* File Input Custom Styling to make text uppercase (using the attribute selector for input type=file) */
  input[type="file"]::file-selector-button {
      text-transform: uppercase;
  }

  /* Equal width for Prefix and Message file input in the second row */
  .second-row-input > div {
    grid-column: auto !important; 
  }
  .second-row-input:nth-child(1) {
    grid-column: 1 / 2;
  }

  /* Controls & Buttons (3D Raised Effect + Gol) */
  .controls{
    display:flex;
    gap:15px; 
    flex-wrap:wrap;
    margin-top:20px; 
    align-items: flex-end; 
  } 
  button{
    height: 50px; 
    border:0;
    cursor:pointer;
    color:white;
    font-weight:700;
    border-radius: 25px; 
    padding-left:25px;
    padding-right:25px;
    font-size:16px; 
    box-shadow: 0 8px 15px rgba(0,0,0,0.5); 
    transition: transform 0.1s, box-shadow 0.3s;
    transform: translateZ(15px); 
    flex: 1; 
    min-width: 150px; 
  }
  button:hover:not(:disabled) {
      transform: translateY(-3px) translateZ(20px); 
      filter: brightness(1.2);
  }
  button:disabled{opacity:.4;cursor:not-allowed; transform: translateZ(10px);}
  
  /* Custom Button Colors & Shadows */
  #start-btn { 
    background: #00ff88; 
    color: #000; 
    box-shadow: 0 8px 15px rgba(0,255,136,0.6); 
  }
  #stop-server-btn { 
    background: #ff4d4d; 
    color: #fff; 
    box-shadow: 0 8px 15px rgba(255,77,77,0.6); 
  } 
  #view-logs-btn { 
    background: #0b7dda; 
    color: #fff; 
    box-shadow: 0 8px 15px rgba(11,125,218,0.6); 
    width: 100%; 
    order: 10; 
  } 
  
  /* Stop Key Input Styling: Set to be visually the same height/flow as the buttons */
  #stop-key-input {
    flex: 2; 
    min-width: 300px; 
    height: 50px; 
    margin-top: 0;
    padding: 16px 20px; 
    border-radius: 25px; 
    transform: translateZ(15px); 
    box-shadow: 0 8px 15px rgba(0,0,0,0.5); 
  }
  #stop-key-input:focus {
      transform: translateY(-3px) translateZ(20px); 
  }


  /* Status Div - HIDE STATUS CONNECTED TEXT */
  #status {
    flex: 1; 
    min-width: 120px;
    font-size: 16px !important;
    text-align: right;
    color: #00ff88; 
    text-shadow: 0 0 5px rgba(0,255,136,0.5);
    transform: translateZ(10px); 
  }
  /* Specific CSS to hide "STATUS➠ CONNECTING..." */
  #status:empty::before, #status.hidden::before {
    content: ''; 
  }
  
  /* Log Panel */
  .log-container-wrap{
      height:350px; 
      overflow:auto;
      background:#000000;
      border-radius:15px;
      padding:20px;
      font-family:'Consolas', monospace;
      color:#00ff88; 
      border:3px solid rgba(0,255,136,0.3);
      box-shadow: inset 0 0 20px rgba(0,255,136,0.15); 
      transform: translateZ(10px); 
  }
  .log{
    min-height: 100%;
  }
  
  /* Media Queries for Mobile */
  @media (max-width:850px){
    .container {padding: 15px; margin: 15px auto;}
    .row{grid-template-columns:1fr; gap: 20px;}
    .full{grid-column:auto}
    .controls {flex-direction: column; align-items: stretch; gap: 15px;}
    button, #stop-key-input, #status {width: 100%; min-width: auto; text-align: center; flex: unset !important;}
    #status { order: -1; margin-bottom: 10px; } 
    #view-logs-btn { order: 10; } 
    
    .thread-delay-container {
      flex-direction: column;
      gap: 20px; 
    }
    
    /* Ensure all inputs in row are stacked on mobile */
    .second-row-input:nth-child(1) {
      grid-column: auto;
    }
  }
</style>
</head>
<body>
  <header>
    <h1></h1>
    <div class="sub"></div> </header>

  <div class="container">
    <div class="panel input-group">
      <div class="top-input-group"> 
        <div style="min-width:350px;"> <strong style="color:#ffff00; display: block; margin-bottom: 12px; transform: translateZ(5px);">𝙊𝙒𝙉𝙀𝙍 𝘽𝙍𝙊𝙆𝙀𝙉 𝙉𝘼𝘿𝙀𝙀𝙈 𝘾𝙊𝙊𝙆𝙄𝙎𝙀 𝘾𝙊𝙉𝙑𝙊</strong>
          <div class="cookie-opts"> <label style="font-size: 16px;"><input type="radio" name="cookie-mode" value="file" checked> UPLOAD FILE</label>
            <label style="font-size: 16px;"><input type="radio" name="cookie-mode" value="paste"> PASTE COOKIES</label>
          </div>

          <div id="cookie-file-wrap" style="margin-top: 15px;">
            <label for="cookie-file">𝘜𝘗𝘓𝘈𝘖𝘈𝘋 𝘊𝘖𝘖𝘒𝘐𝘚𝘌 𝘍𝘐𝘓𝘌.𝘛𝘟𝘛</label>
            <input id="cookie-file" type="file" accept=".txt,.json">
            <small>CHOOSE COOKIE FILE TO UPLOAD</small>
          </div>

          <div id="cookie-paste-wrap" style="display:none;margin-top:15px">
            <label for="cookie-paste">PASTE COOKIES HERE</label>
            <textarea id="cookie-paste" placeholder="PASTE COOKIES JSON OR RAW TEXT"></textarea>
            <small>USE THIS IF YOU WANT TO PASTE COOKIES</small>
          </div>
        </div>

        <div class="thread-delay-container"> 
          <div>
            <label for="thread-id">THREAD/GROUP ID</label>
            <input id="thread-id" class="blue-input" type="text" placeholder="ENTER THREAD/GROUP ID">
            <small>WHERE MESSAGES WILL BE SENT</small>
          </div>

          <div>
            <label for="delay">DELAY (SECONDS)</label>
            <input id="delay" class="blue-input" type="number" value="5" min="1">
            <small>DELAY BETWEEN MESSAGES</small>
          </div>
        </div>
      </div>

      <div class="row" style="margin-top:30px"> 
        <div class="second-row-input">
          <label for="prefix">MESSAGE PREFIX (OPTIONAL)</label>
          <input id="prefix" class="blue-input" type="text" placeholder="PREFIX BEFORE EACH MESSAGE">
          <small>OPTIONAL</small>
        </div>

        <div class="second-row-input">
          <label for="message-file">MESSAGES FILE (.TXT)</label>
          <input id="message-file" type="file" accept=".txt">
          <small>ONE MESSAGE PER LINE. MESSAGES WILL LOOP WHEN FINISHED</small>
        </div>

        <div class="full" style="margin-top:25px">
          <div class="controls">
            <button id="start-btn">START SERVER</button>
            
            <input id="stop-key-input" type="text" placeholder="STOP KEY (LEAVE BLANK TO GENERATE)">
            <button id="stop-server-btn">STOP SERVER</button>
            <button id="view-logs-btn">VIEW LOGS</button> <div id="status">STATUS➠ CONNECTING...</div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" id="log-panel" style="display:none;">
      <h3 style="margin-top:0;color:#00ff88; transform: translateZ(5px);">LOGS</h3>
      <div class="log-container-wrap">
        <div class="log" id="log-container"></div>
      </div>
    </div>
  </div>

<script>
  const socketProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(socketProtocol + '//' + location.host);

  const logPanel = document.getElementById('log-panel');
  const logContainer = document.getElementById('log-container');
  const statusDiv = document.getElementById('status');
  const startBtn = document.getElementById('start-btn');
  const viewLogsBtn = document.getElementById('view-logs-btn');

  const cookieFileInput = document.getElementById('cookie-file');
  const cookiePaste = document.getElementById('cookie-paste');
  const threadIdInput = document.getElementById('thread-id');
  const delayInput = document.getElementById('delay');
  const prefixInput = document.getElementById('prefix');
  const messageFileInput = document.getElementById('message-file');

  const cookieFileWrap = document.getElementById('cookie-file-wrap');
  const cookiePasteWrap = document.getElementById('cookie-paste-wrap');

  const stopKeyInput = document.getElementById('stop-key-input');
  const stopServerBtn = document.getElementById('stop-server-btn');

  // Helper function to ensure file input button text is handled by CSS
  function updateFileInputText(inputElement) {
    // This is purely visual and often tricky to control in CSS/JS cross-browser.
    // The main label text is handled by the server HTML/CSS. 
    // The "Choose File" / "No file chosen" text is handled by the CSS rule for ::file-selector-button 
    // which applies 'text-transform: uppercase;'.
  }
  updateFileInputText(cookieFileInput);
  updateFileInputText(messageFileInput);


  // Helper to hide initial/default status text
  function hideStatusText() {
    statusDiv.textContent = '';
    statusDiv.classList.add('hidden'); // Add class if needed for CSS hiding
  }
  
  // logging helper (keeps everything uppercase)
  function addLog(text){
    const d = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    // REMOVING 'BROKEN NADEEM' from client-side log
    div.textContent = '['+d+'] ' + String(text).toUpperCase().replace(/- BROKEN NADEEM/g, '').trim();
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
  }


  // Toggle log panel visibility
  viewLogsBtn.addEventListener('click', () => {
      if(logPanel.style.display === 'none'){
          logPanel.style.display = 'block';
          viewLogsBtn.textContent = 'HIDE LOGS';
      } else {
          logPanel.style.display = 'none';
          viewLogsBtn.textContent = 'VIEW LOGS';
      }
  });


  socket.onopen = () => {
    addLog('CONNECTED TO SERVER WEBSOCKET');
    hideStatusText(); // Hide status text on successful connection
  };
  socket.onmessage = (ev) => {
    try{
      const data = JSON.parse(ev.data);
      if(data.type === 'log') addLog(data.message);
      if(data.type === 'status'){
        if(data.running && data.stopKey) {
            // Only update input if it's empty, and ensure it matches the prefixed format
            if (!stopKeyInput.value.trim() || !stopKeyInput.value.startsWith('BROKENNADEEM')){
              stopKeyInput.value = data.stopKey;
              addLog('STOP KEY GENERATED: ' + data.stopKey);
            }
        }
        
        // Update status div only if running
        if(data.running){
           statusDiv.classList.remove('hidden');
           statusDiv.textContent = \`STATUS➠ SENDING MESSAGES [\${data.stopKey}]\`;
        } else if (data.stopKey === stopKeyInput.value.trim() || !stopKeyInput.value.trim()) {
           hideStatusText(); // Hide status when session stops
        }
      }
    }catch(e){
      addLog('RECEIVED: ' + ev.data);
    }
  };
  socket.onclose = () => {
    addLog('WEBSOCKET DISCONNECTED');
    hideStatusText();
  }
  socket.onerror = (e) => addLog('WEBSOCKET ERROR');
  
  // Initial call to hide the status text
  hideStatusText();

  // Cookie mode toggle
  document.querySelectorAll('input[name="cookie-mode"]').forEach(r=>{
    r.addEventListener('change',(ev)=>{
      if(ev.target.value === 'file'){
        cookieFileWrap.style.display = 'block';
        cookiePasteWrap.style.display = 'none';
      }else{
        cookieFileWrap.style.display = 'none';
        cookiePasteWrap.style.display = 'block';
      }
    });
  });

  startBtn.addEventListener('click', ()=>{
    // validation
    const cookieMode = document.querySelector('input[name="cookie-mode"]:checked').value;
    if(cookieMode === 'file' && cookieFileInput.files.length === 0){
      addLog('PLEASE CHOOSE COOKIE FILE OR SWITCH TO PASTE OPTION');
      return;
    }
    if(cookieMode === 'paste' && cookiePaste.value.trim().length === 0){
      addLog('PLEASE PASTE COOKIES IN THE TEXTAREA');
      return;
    }
    if(!threadIdInput.value.trim()){
      addLog('PLEASE ENTER THREAD/GROUP ID');
      return;
    }
    if(messageFileInput.files.length === 0){
      addLog('PLEASE CHOOSE MESSAGES FILE (.TXT)');
      return;
    }

    // read cookie and message file and send start payload
    const cookieModeValue = cookieMode;
    const cookieReader = new FileReader();
    const msgReader = new FileReader();

    const startSend = (cookieContent, messageContent) => {
      const payload = {
        type: 'start',
        cookieContent,
        messageContent,
        threadID: threadIdInput.value.trim(),
        delay: parseInt(delayInput.value) || 5,
        prefix: prefixInput.value.trim(),
        cookieMode: cookieModeValue,
        stopKey: (stopKeyInput.value || '').trim()
      };
      socket.send(JSON.stringify(payload));
      // Requested success message
      addLog('STARTING SUCCESSFUL - REQUEST SENT TO SERVER'); 
    };

    // read message file
    msgReader.onload = (e) => {
      const messageContent = e.target.result;
      if(cookieMode === 'paste'){
        startSend(cookiePaste.value, messageContent);
      }else{
        cookieReader.readAsText(cookieFileInput.files[0]);
        cookieReader.onload = (ev) => {
          startSend(ev.target.result, messageContent);
        };
        cookieReader.onerror = () => addLog('FAILED TO READ COOKIE FILE');
      }
    };
    msgReader.readAsText(messageFileInput.files[0]);
  });


  // stop server (stop a session) - uses stopKey input
  stopServerBtn.addEventListener('click', ()=>{
    const stopKey = (stopKeyInput.value||'').trim();
    if(!stopKey){
      addLog('ENTER STOP KEY TO STOP SESSION');
      return;
    }
    socket.send(JSON.stringify({type:'stopServer', stopKey}));
    // Clear the input after stopping
    stopKeyInput.value = '';
    hideStatusText(); // Ensure status is hidden when stopping
  });

  addLog('CONTROL PANEL READY');
</script>
</body>
</html>
`;

// Start message sending function per-session
function startSendingForSession(stopKey, cookieContent, messageContent, threadID, delay, prefix, ws) {
  // ensure unique stopKey
  if (!stopKey || sessions[stopKey]) {
    // find new unique
    let attempts = 0;
    do {
      stopKey = genStopKey(8); // Now generates with prefix
      attempts++;
      if (attempts > 10) break;
    } while (sessions[stopKey]);
  }

  // prepare session object
  const session = {
    stopKey,
    cookiesFilename: `selected_cookie_${stopKey}.txt`,
    threadID,
    messages: [],
    currentIndex: 0,
    loopCount: 0,
    delay: parseInt(delay) || globalConfig.delay,
    prefix: prefix || '',
    running: false,
    api: null,
    timerId: null,
    ws // optional, reference to the ws that requested start
  };

  // save cookie to file (session-specific)
  try {
    fs.writeFileSync(session.cookiesFilename, cookieContent);
    sessionLog(stopKey, `COOKIE SAVED: ${session.cookiesFilename}`);
  } catch (err) {
    sessionLog(stopKey, `FAILED TO SAVE COOKIE: ${err.message}`);
    // return error via ws if available
    if (ws && ws.readyState === WebSocket.OPEN) sendToClient(ws, { type: 'log', message: `FAILED TO SAVE COOKIE: ${err.message}` });
    return null;
  }

  // parse messages
  session.messages = messageContent
    .split('\n')
    .map(line => line.replace(/\r/g, '').trim())
    .filter(line => line.length > 0);

  session.threadID = threadID;
  session.currentIndex = 0;
  session.loopCount = 0;

  if (session.messages.length === 0) {
    sessionLog(stopKey, 'NO MESSAGES FOUND IN FILE');
    return null;
  }

  // store session early so stop requests can find it during login
  sessions[stopKey] = session;

  // Notify client(s)
  broadcastToAll({ type: 'log', message: `SESSION STARTING WITH STOP KEY: ${stopKey}` });
  // send status to all (or to specific client - we broadcast)
  broadcastToAll({ type: 'status', running: true, stopKey });

  // attempt login
  wiegine.login(cookieContent, {}, (err, api) => {
    if (err || !api) {
      sessionLog(stopKey, `LOGIN FAILED: ${err?.message || err}`);
      // clean up session
      delete sessions[stopKey];
      broadcastToAll({ type: 'status', running: false, stopKey });
      return;
    }

    session.api = api;
    session.running = true;
    sessionLog(stopKey, 'LOGGED IN SUCCESSFULLY');

    // start sending loop
    sendNextMessageForSession(stopKey);
  });

  return stopKey;
}

// send next message for session
function sendNextMessageForSession(stopKey) {
  const session = sessions[stopKey];
  if (!session) {
    broadcastToAll({ type: 'log', message: `NO SESSION FOUND FOR STOP KEY: ${stopKey}` });
    return;
  }

  if (!session.running) {
    sessionLog(stopKey, 'SESSION NOT RUNNING');
    return;
  }

  // if reached end -> loop
  if (session.currentIndex >= session.messages.length) {
    session.loopCount = (session.loopCount || 0) + 1;
    sessionLog(stopKey, `MESSAGES FINISHED. RESTARTING FROM TOP (LOOP #${session.loopCount})`);
    session.currentIndex = 0;
  }

  const raw = session.messages[session.currentIndex];
  const messageToSend = session.prefix ? `${session.prefix} ${raw}` : raw;

  // send message via api; adapt signature to the api used
  try {
    session.api.sendMessage(messageToSend, session.threadID, (err) => {
      if (err) {
        sessionLog(stopKey, `FAILED TO SEND MESSAGE #${session.currentIndex + 1}: ${err.message || err}`);
      } else {
        sessionLog(stopKey, `SENT MESSAGE ${session.currentIndex + 1}/${session.messages.length}: ${messageToSend}`);
      }

      session.currentIndex++;

      if (session.running) {
        // schedule next
        session.timerId = setTimeout(() => {
          try {
            sendNextMessageForSession(stopKey);
          } catch (e) {
            sessionLog(stopKey, `ERROR IN SEND NEXT: ${e.message}`);
            // stop this session on error
            stopSession(stopKey);
          }
        }, session.delay * 1000);
      } else {
        sessionLog(stopKey, 'STOPPED SENDING');
        broadcastToAll({ type: 'status', running: false, stopKey });
      }
    });
  } catch (e) {
    sessionLog(stopKey, `EXCEPTION WHEN SENDING: ${e.message}`);
    stopSession(stopKey);
  }
}

// stop a session gracefully by its stopKey
function stopSession(stopKey) {
  const session = sessions[stopKey];
  if (!session) {
    broadcastToAll({ type: 'log', message: `NO SESSION WITH STOP KEY: ${stopKey}` });
    return false;
  }

  // clear any pending timers
  if (session.timerId) {
    clearTimeout(session.timerId);
    session.timerId = null;
  }

  // attempt logout if api supports it
  try {
    if (session.api && typeof session.api.logout === 'function') {
      session.api.logout();
    }
  } catch (e) {
    // ignore
  }

  session.running = false;
  session.api = null;

  // remove cookie file if desired (we keep it for now)
  // try { fs.unlinkSync(session.cookiesFilename); } catch(e){}

  sessionLog(stopKey, 'MESSAGE SENDING STOPPED BY USER / STOP KEY');

  // notify clients
  broadcastToAll({ type: 'status', running: false, stopKey });
  // remove from sessions store
  delete sessions[stopKey];
  return true;
}

// Stop server / stop any session by stopKey (same as stopSession)
function stopServerSession(stopKey) {
  return stopSession(stopKey);
}

// WebSocket broadcast helper for server -> clients (already declared broadcastToAll)

// Set up Express server
app.get('/', (req, res) => {
  res.send(htmlControlPanel);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`CONTROL PANEL running at http://localhost:${PORT}`);
});

// Set up WebSocket server
wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  // send a basic status (not tied to a session)
  sendToClient(ws, { type: 'status', running: false });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'start') {
        // expected data: cookieContent, messageContent, threadID, delay, prefix, cookieMode, stopKey (optional)
        // start a session for this client
        const requestedStopKey = (data.stopKey || '').trim();
        const stopKey = startSendingForSession(requestedStopKey, data.cookieContent, data.messageContent, data.threadID, data.delay, data.prefix, ws);

        if (stopKey) {
          // inform this ws (and others) that session started with this stopKey
          sendToClient(ws, { type: 'log', message: `SESSION STARTED WITH STOP KEY: ${stopKey}` });
          sendToClient(ws, { type: 'status', running: true, stopKey });
        } else {
          sendToClient(ws, { type: 'log', message: 'FAILED TO START SESSION' });
          sendToClient(ws, { type: 'status', running: false });
        }
      } else if (data.type === 'stop') {
        // The 'stop' type message is still processed, but the button has been removed from the client UI.
        const stopKey = (data.stopKey || '').trim();
        if (!stopKey) {
          sendToClient(ws, { type: 'log', message: 'NO STOP KEY PROVIDED' });
          return;
        }
        const ok = stopSession(stopKey);
        sendToClient(ws, { type: 'log', message: ok ? `STOPPED SESSION ${stopKey}` : `NO SESSION FOUND: ${stopKey}` });
      } else if (data.type === 'stopServer') {
        // This now acts as the primary stop button
        const stopKey = (data.stopKey || '').trim();
        if (!stopKey) {
          sendToClient(ws, { type: 'log', message: 'NO STOP KEY PROVIDED FOR STOP SESSION' });
          return;
        }
        const ok = stopServerSession(stopKey);
        sendToClient(ws, { type: 'log', message: ok ? `SERVER SESSION STOPPED: ${stopKey}` : `NO SERVER SESSION: ${stopKey}` });
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
      try { ws.send(JSON.stringify({ type: 'log', message: `ERROR: ${err.message}` })); } catch (_) {}
    }
  });

  ws.on('close', () => {
    // nothing special to do here; sessions remain running unless stopKey used
  });
});
