const { app, BrowserWindow, ipcMain, dialog, Notification, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let tray = null;
let mainWindow = null;

// ==============================
// 🪟 CREATE WINDOW
// ==============================
function createWindow() {
  console.log('🚀 [MAIN] กำลังสร้าง window...');

  if (mainWindow) {
    console.warn('⚠️ [MAIN] mainWindow มีอยู่แล้ว — จะไม่สร้างใหม่');
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.webContents.openDevTools();

  // ปิด -> ซ่อนใน tray
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      new Notification({
        title: 'Agent Wallboard',
        body: 'แอปยังทำงานอยู่ใน system tray\nคลิกขวาที่ icon เพื่อเปิดเมนู'
      }).show();
    }
  });

  mainWindow.on('closed', () => {
    console.log('❌ [MAIN] Window ถูกปิด');
    mainWindow = null;
  });

  console.log('✅ [MAIN] Window พร้อมแล้ว');

  createTray();
}

// ==============================
// 🖱️ TRAY
// ==============================
function createTray() {
  console.log('🖱️ [MAIN] สร้าง system tray...');
  try {
    let trayIcon;
    try {
      trayIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
      if (trayIcon.isEmpty()) throw new Error('Icon file not found');
    } catch {
      trayIcon = nativeImage.createEmpty();
    }

    if (process.platform === 'darwin') {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
      trayIcon.setTemplateImage(true);
    }

    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '📊 แสดง Wallboard',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      {
        label: '🔄 เปลี่ยนสถานะ',
        submenu: [
          { label: '🟢 Available', click: () => changeAgentStatusFromTray('Available') },
          { label: '🔴 Busy', click: () => changeAgentStatusFromTray('Busy') },
          { label: '🟡 Break', click: () => changeAgentStatusFromTray('Break') }
        ]
      },
      { type: 'separator' },
      {
        label: '❌ ออกจากโปรแกรม',
        click: () => {
          console.log('❌ [TRAY] ออกจากโปรแกรม');
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('Agent Wallboard - Desktop App');

    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    console.log('✅ [MAIN] System tray พร้อมแล้ว');
  } catch (error) {
    console.error('❌ [MAIN] Error สร้าง tray:', error);
  }
}

function changeAgentStatusFromTray(status) {
  console.log('🔄 [TRAY] เปลี่ยนสถานะเป็น:', status);
  if (!mainWindow) return;

  mainWindow.webContents.send('status-changed-from-tray', {
    newStatus: status,
    timestamp: new Date().toISOString()
  });

  new Notification({
    title: 'สถานะเปลี่ยนแล้ว',
    body: `เปลี่ยนสถานะเป็น ${status} แล้ว`,
    icon: path.join(__dirname, 'assets', 'notification.png')
  }).show();
}

// ==============================
// 📁 FILE SYSTEM
// ==============================
ipcMain.handle('open-file', async () => {
  console.log('📂 [MAIN] เปิด file dialog...');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt', 'json', 'csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (canceled || !filePaths[0]) return { success: false, cancelled: true };

  const content = await fs.readFile(filePaths[0], 'utf8');
  return {
    success: true,
    fileName: path.basename(filePaths[0]),
    filePath: filePaths[0],
    content,
    size: content.length
  };
});

ipcMain.handle('save-file', async (event, { content, fileName = 'export.txt' }) => {
  console.log('💾 [MAIN] บันทึกไฟล์...');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: fileName,
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });
  if (canceled || !filePath) return { success: false, cancelled: true };

  await fs.writeFile(filePath, content, 'utf8');
  return {
    success: true,
    fileName: path.basename(filePath),
    filePath
  };
});

// ==============================
// 🔔 NOTIFICATIONS
// ==============================
ipcMain.handle('show-notification', (event, { title, body, urgent = false }) => {
  console.log('🔔 [MAIN] แสดง notification:', title);
  try {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'assets', 'notification.png'),
      urgency: urgent ? 'critical' : 'normal'
    });

    notification.show();
    return { success: true };
  } catch (err) {
    console.error('❌ [MAIN] show-notification error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notify-agent-event', (event, { agentName, eventType, details }) => {
  console.log('📢 [MAIN] Agent Event:', agentName, eventType);
  const eventMessages = {
    login: `🟢 ${agentName} เข้าสู่ระบบแล้ว`,
    logout: `🔴 ${agentName} ออกจากระบบแล้ว`,
    status_change: `🔄 ${agentName} เปลี่ยนสถานะเป็น ${details?.newStatus || '-'}`,
    call_received: `📞 ${agentName} รับสายใหม่`,
    call_ended: `📞 ${agentName} จบการโทร (${details?.duration || '?'} วินาที)`
  };

  const notification = new Notification({
    title: 'Agent Wallboard Update',
    body: eventMessages[eventType] || `${agentName}: ${eventType}`,
    icon: path.join(__dirname, 'assets', 'notification.png')
  });

  notification.show();
  return { success: true };
});

// ==============================
// ⚙️ APP EVENTS
// ==============================
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  // ไม่ปิดแอปเพื่อให้ tray ทำงานต่อ
});

app.on('before-quit', () => {
  app.isQuiting = true;
});

function playSound() {
  const audio = new Audio('./assets/alert.mp3');
  audio.play().catch(() => {});
}

window.nativeAPI.onStatusChangedFromTray((data) => {
  console.log('🎧 Status changed from tray:', data);
  const { newStatus } = data;
  window.nativeAPI.showNotification('สถานะเปลี่ยนแล้ว', `สถานะใหม่: ${newStatus}`);
  playSound();
});


function updateTrayTooltip() {
  const availableCount = agents.filter(a => a.status === 'Available').length;
  tray.setToolTip(`Agent Wallboard - ${availableCount} available`);
}

// ตัวอย่างการ sync จาก renderer
ipcMain.on('agent-status-updated', (event, updatedAgents) => {
  agents = updatedAgents;
  updateTrayTooltip();
});