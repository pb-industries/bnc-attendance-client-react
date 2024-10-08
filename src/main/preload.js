const fs = require('fs');
const Tail = require('@logdna/tail-file');
const split2 = require('split2');

const { contextBridge, ipcRenderer } = require('electron');
const produce = require('./producer');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    myPing() {
      ipcRenderer.send('ipc-example', 'ping');
    },
    on(channel, func) {
      const validChannels = ['ipc-example'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    once(channel, func) {
      const validChannels = ['ipc-example'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      }
    },
  },
  send: (channel, data) => {
    console.log('sending', channel, data);
    ipcRenderer.send(channel, data);
  },
  onRollGenerated: (callback) => {
    return ipcRenderer.on('update-current-roll', callback);
  },
  onRangeGenerated: (callback) => {
    return ipcRenderer.on('update-roll-range', callback);
  },
  onFetchRollRange: (callback) => {
    return ipcRenderer.on('fetching-roll-range', callback);
  },
  onItemLooted: (callback) => {
    return ipcRenderer.on('item-looted', callback);
  },
  onItemAssigned: (callback) => {
    return ipcRenderer.on('item-assigned', callback);
  },
  onAppVersionChanged: (callback) => {
    return ipcRenderer.on('app_version', callback);
  },
  onBoxMapChanged: (callback) => {
    return ipcRenderer.on('box-map-changed', callback);
  },
});

let currTail = null;

contextBridge.exposeInMainWorld('ipc', {
  readdir: fs.promises.readdir,
  stopTail: async () => {
    if (currTail) {
      await currTail.quit();
      console.log('stopped tailing');
    }
  },
  tail: async (filePath, callback) => {
    currTail = new Tail(filePath, { encoding: 'utf8' });
    currTail
      .on('tail_error', (err) => {
        console.error('TailFile had an error!', err);
      })
      .start()
      .catch((err) => {
        console.error('Cannot start.  Does the file exist?', err);
      });

    // Data won't start flowing until piping
    currTail.pipe(split2()).on('data', (line) => {
      callback(line);
    });
  },
  baseUrl: 'https://mango-attendance.fly.dev',
  recordLoot: async (messages) => {
    await produce('loot-mango', messages);
    return messages.length;
  },
});

function refreshClickableElements() {
  const clickableElements = document.getElementsByClassName('clickable');
  const listeningAttr = 'listeningForMouse';
  for (const ele of clickableElements) {
    // If the listeners are already set up for this element, skip it.
    if (ele.getAttribute(listeningAttr)) {
      continue;
    }
    ele.addEventListener('mouseenter', () => {
      ipcRenderer.invoke('set-ignore-mouse-events', false);
    });
    ele.addEventListener('mouseleave', () => {
      ipcRenderer.invoke('set-ignore-mouse-events', true, { forward: true });
    });
    ele.setAttribute(listeningAttr, true);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  refreshClickableElements();
});

window.addEventListener('DOMNodeInserted', () => {
  refreshClickableElements();
});
