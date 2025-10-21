const { contextBridge, ipcRenderer } = require('electron');

console.log('🌉 [PRELOAD] กำลังตั้งค่า Native APIs...');

contextBridge.exposeInMainWorld('nativeAPI', {
  // 📁 File Operations
  openFile: () => {
    console.log('📁 [PRELOAD] เปิดไฟล์...');
    return ipcRenderer.invoke('open-file');
  },

  saveFile: (content, fileName) => {
    console.log('💾 [PRELOAD] บันทึกไฟล์...');
    return ipcRenderer.invoke('save-file', { content, fileName });
  },

  // 🔔 Notifications
  showNotification: (title, body, urgent = false) => {
    console.log('🔔 [PRELOAD] แสดง notification:', title);
    return ipcRenderer.invoke('show-notification', { title, body, urgent });
  },

  notifyAgentEvent: (agentName, eventType, details = {}) => {
    console.log('📢 [PRELOAD] Agent event:', agentName, eventType);
    return ipcRenderer.invoke('notify-agent-event', { agentName, eventType, details });
  },

  // 🖱️ System Tray Events
  onStatusChangedFromTray: (callback) => {
    console.log('🖱️ [PRELOAD] ลงทะเบียน tray status listener');
    ipcRenderer.on('status-changed-from-tray', (event, data) => callback(data));
  },

  hideToTray: () => {
    console.log('🖱️ [PRELOAD] ซ่อนไป tray');
    ipcRenderer.send('hide-to-tray');
  },

  showApp: () => {
    console.log('🖱️ [PRELOAD] แสดง app จาก tray');
    ipcRenderer.send('show-app');
  }
});

console.log('✅ [PRELOAD] Native APIs พร้อมใช้งาน');