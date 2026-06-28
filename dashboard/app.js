// API Configuration
const API_BASE = 'http://pa-service:8000';
const POLL_INTERVAL = 5000; // 5 seconds

// App State
const appState = {
  currentTab: 'dashboard',
  unreadEmails: 0,
  unreadMessages: 0,
  tasks: [],
  notes: [],
  services: {},
  notifications: 0
};

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
  startPolling();
});

function initializeApp() {
  console.log('🚀 Initializing Martin PA Dashboard...');
  
  // Load theme preference
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);
  
  // Fetch initial data
  loadDashboardData();
  checkServiceHealth();
  loadEmails();
  loadChats();
  loadTasks();
  loadMemory();
}

// ==================== Event Listeners ====================
function setupEventListeners() {
  // Tab Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', switchTab);
  });

  // Dashboard Quick Assistant
  const sendBtn = document.getElementById('sendBtn');
  const quickInput = document.getElementById('quickInput');
  
  if (sendBtn) sendBtn.addEventListener('click', () => processCommand(quickInput.value, 'dashboard'));
  if (quickInput) quickInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') processCommand(quickInput.value, 'dashboard');
  });

  // AI Chat Tab
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatInput = document.getElementById('chatInput');
  
  if (chatSendBtn) chatSendBtn.addEventListener('click', () => sendChatMessage(chatInput.value));
  if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage(chatInput.value);
  });

  // Email Actions
  const refreshEmailBtn = document.getElementById('refreshEmailBtn');
  if (refreshEmailBtn) refreshEmailBtn.addEventListener('click', loadEmails);

  // WhatsApp Actions
  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn) newChatBtn.addEventListener('click', () => showModal('newChatModal'));

  // Task Actions
  const newTaskBtn = document.getElementById('newTaskBtn');
  if (newTaskBtn) newTaskBtn.addEventListener('click', () => showModal('newTaskModal'));

  // Memory Actions
  const newNoteBtn = document.getElementById('newNoteBtn');
  if (newNoteBtn) newNoteBtn.addEventListener('click', () => showModal('newNoteModal'));

  // Filter Buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      filterTasks(e.target.dataset.filter);
    });
  });

  // Settings
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => showModal('settingsModal'));

  // Search
  const memorySearch = document.getElementById('memorySearch');
  if (memorySearch) memorySearch.addEventListener('input', (e) => searchMemory(e.target.value));
}

// ==================== Tab Navigation ====================
function switchTab(e) {
  // Remove active from all nav items and tabs
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

  // Add active to clicked item
  e.currentTarget.classList.add('active');
  
  // Get tab name and update title
  const tabName = e.currentTarget.dataset.tab;
  appState.currentTab = tabName;
  
  const tabTitles = {
    'dashboard': 'Dashboard',
    'email': 'Office 365 Email',
    'whatsapp': 'WhatsApp Messaging',
    'tasks': 'Task Management',
    'memory': 'Memory & Notes',
    'ai-chat': 'AI Chat',
    'integrations': 'Integrations'
  };

  document.getElementById('pageTitle').textContent = tabTitles[tabName];

  // Show corresponding tab
  const tabElement = document.getElementById(`${tabName}-tab`);
  if (tabElement) {
    tabElement.classList.add('active');
  }

  // Load data for this tab
  loadTabData(tabName);
}

function loadTabData(tabName) {
  switch(tabName) {
    case 'email':
      loadEmails();
      break;
    case 'whatsapp':
      loadChats();
      break;
    case 'tasks':
      loadTasks();
      break;
    case 'memory':
      loadMemory();
      break;
    case 'integrations':
      checkServiceHealth();
      break;
  }
}

// ==================== Dashboard ====================
async function loadDashboardData() {
  try {
    // Fetch PA status
    const response = await fetch(`${API_BASE}/status`);
    const data = await response.json();

    // Update stats
    document.getElementById('statEmails').textContent = appState.unreadEmails;
    document.getElementById('statMessages').textContent = appState.unreadMessages;
    document.getElementById('statTasks').textContent = appState.tasks.length;
    document.getElementById('statMemory').textContent = appState.notes.length;

    // Add activity log
    addActivity('Dashboard initialized');
  } catch (error) {
    console.error('Error loading dashboard:', error);
    addActivity('Failed to load dashboard data');
  }
}

function addActivity(text) {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  const item = document.createElement('div');
  item.className = 'activity-item';
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  item.innerHTML = `
    <span class="activity-time">${timeStr}</span>
    <span class="activity-text">${text}</span>
  `;

  feed.insertBefore(item, feed.firstChild);

  // Keep only 10 items
  while (feed.children.length > 10) {
    feed.removeChild(feed.lastChild);
  }
}

// ==================== Email Integration ====================
async function loadEmails() {
  try {
    const emailList = document.getElementById('emailList');
    if (!emailList) return;

    // Mock data - replace with actual Office 365 API call
    const mockEmails = [
      {
        id: 1,
        from: 'Dr. Jansen',
        subject: 'Ergonomic Loupes Trial Feedback',
        time: '31 May 2026',
        body: 'Hi Martin,\n\nThank you for providing the trial. The ergonomic loupes have significantly improved our workflow...'
      },
      {
        id: 2,
        from: 'Admetec Support',
        subject: 'Shipment Update – Order #A452',
        time: '30 May 2026',
        body: 'Your order #A452 has been shipped. Tracking number: DHL123456789...'
      }
    ];

    emailList.innerHTML = '';

    mockEmails.forEach(email => {
      const emailEl = document.createElement('div');
      emailEl.className = 'email-item';
      emailEl.innerHTML = `
        <div class="email-from">${email.from}</div>
        <div class="email-subject">${email.subject}</div>
        <div class="email-time">${email.time}</div>
      `;

      emailEl.addEventListener('click', () => displayEmail(email));
      emailList.appendChild(emailEl);
    });

    appState.unreadEmails = mockEmails.length;
    updateBadges();
    addActivity(`Loaded ${mockEmails.length} emails`);
  } catch (error) {
    console.error('Error loading emails:', error);
    addActivity('Failed to load emails');
  }
}

function displayEmail(email) {
  const preview = document.getElementById('emailPreview');
  if (!preview) return;

  preview.innerHTML = `
    <div>
      <h3>${email.subject}</h3>
      <p style="font-size: 12px; color: #cbd5e1; margin: 10px 0;">From: ${email.from}</p>
      <p style="font-size: 12px; color: #cbd5e1; margin: 10px 0;">${email.time}</p>
      <hr style="margin: 20px 0; border-color: #475569;">
      <p style="white-space: pre-wrap;">${email.body}</p>
    </div>
  `;

  // Mark email as active
  document.querySelectorAll('.email-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

// ==================== WhatsApp Integration ====================
async function loadChats() {
  try {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;

    // Mock data - replace with WAHA API call
    const mockChats = [
      {
        id: '1',
        contact: 'John Doe',
        lastMessage: 'Hey, how are you?',
        time: '10:30 AM',
        messages: [
          { type: 'user', text: 'Hi John!' },
          { type: 'bot', text: 'Hey, how are you?' }
        ]
      },
      {
        id: '2',
        contact: 'Team Group',
        lastMessage: 'Meeting at 3 PM',
        time: '9:15 AM',
        messages: [
          { type: 'bot', text: 'Meeting at 3 PM' }
        ]
      }
    ];

    chatList.innerHTML = '';

    mockChats.forEach(chat => {
      const chatEl = document.createElement('div');
      chatEl.className = 'chat-item';
      chatEl.innerHTML = `
        <div class="chat-contact">${chat.contact}</div>
        <div class="chat-preview-text">${chat.lastMessage}</div>
        <div class="email-time">${chat.time}</div>
      `;

      chatEl.addEventListener('click', () => displayChat(chat));
      chatList.appendChild(chatEl);
    });

    appState.unreadMessages = mockChats.length;
    updateBadges();
    addActivity(`Loaded ${mockChats.length} chats`);
  } catch (error) {
    console.error('Error loading chats:', error);
    addActivity('Failed to load chats');
  }
}

function displayChat(chat) {
  const messageArea = document.getElementById('messageArea');
  if (!messageArea) return;

  let messagesHTML = '<div class="messages">';
  
  chat.messages.forEach(msg => {
    const className = msg.type === 'user' ? 'user-message' : 'message';
    messagesHTML += `
      <div class="message ${className}">
        <div class="message-bubble">${msg.text}</div>
      </div>
    `;
  });

  messagesHTML += '</div>';
  messagesHTML += `
    <div class="message-input-group">
      <input type="text" placeholder="Type a message..." id="waInput">
      <button class="btn-primary" onclick="sendWhatsApp('${chat.id}')">Send</button>
    </div>
  `;

  messageArea.innerHTML = messagesHTML;

  // Mark chat as active
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

async function sendWhatsApp(chatId) {
  const input = document.getElementById('waInput');
  if (!input || !input.value.trim()) return;

  try {
    const message = input.value.trim();

    // Call PA service
    const response = await fetch(`${API_BASE}/tools/send_whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message: message
      })
    });

    if (response.ok) {
      addActivity(`WhatsApp message sent to ${chatId}`);
      input.value = '';
      
      // Add to chat UI
      const messageArea = document.getElementById('messageArea');
      if (messageArea) {
        const newMsg = document.createElement('div');
        newMsg.className = 'message user-message';
        newMsg.innerHTML = `<div class="message-bubble">${message}</div>`;
        messageArea.querySelector('.messages').appendChild(newMsg);
      }
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    addActivity('Failed to send message');
  }
}

// ==================== Task Management ====================
async function loadTasks() {
  try {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    const mockTasks = [
      { id: 1, title: 'Review Q3 proposal', status: 'pending', dueDate: 'Today' },
      { id: 2, title: 'Follow up with Dr. Jansen', status: 'pending', dueDate: 'Tomorrow' },
      { id: 3, title: 'Update inventory', status: 'completed', dueDate: 'Yesterday' }
    ];

    appState.tasks = mockTasks;
    renderTasks(mockTasks);
    updateBadges();
  } catch (error) {
    console.error('Error loading tasks:', error);
    addActivity('Failed to load tasks');
  }
}

function renderTasks(tasks) {
  const taskList = document.getElementById('taskList');
  if (!taskList) return;

  taskList.innerHTML = '';

  tasks.forEach(task => {
    const taskEl = document.createElement('div');
    taskEl.className = 'task-item';
    
    const isCompleted = task.status === 'completed';
    
    taskEl.innerHTML = `
      <div class="task-checkbox" style="background: ${isCompleted ? 'var(--success-color)' : 'transparent'}; border: ${isCompleted ? 'none' : ''};">
        ${isCompleted ? '✓' : ''}
      </div>
      <div class="task-content">
        <div class="task-title" style="text-decoration: ${isCompleted ? 'line-through' : 'none'};">${task.title}</div>
        <div class="task-meta">Due: ${task.dueDate}</div>
      </div>
    `;

    taskEl.addEventListener('click', () => toggleTaskStatus(task.id));
    taskList.appendChild(taskEl);
  });

  if (tasks.length === 0) {
    taskList.innerHTML = '<div class="placeholder">No tasks yet</div>';
  }
}

function toggleTaskStatus(taskId) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = task.status === 'pending' ? 'completed' : 'pending';
    renderTasks(appState.tasks);
    addActivity(`Task status updated`);
  }
}

function filterTasks(filter) {
  let filtered = appState.tasks;

  if (filter === 'pending') {
    filtered = appState.tasks.filter(t => t.status === 'pending');
  } else if (filter === 'completed') {
    filtered = appState.tasks.filter(t => t.status === 'completed');
  } else if (filter === 'today') {
    filtered = appState.tasks.filter(t => t.dueDate === 'Today');
  }

  renderTasks(filtered);
}

// ==================== Memory & Notes ====================
async function loadMemory() {
  try {
    const mockNotes = [
      { id: 1, title: 'Meeting Notes - Q3 Planning', text: 'Discussed quarterly targets...', date: '2026-05-31' },
      { id: 2, title: 'Product Ideas', text: 'New ergonomic features based on feedback...', date: '2026-05-30' }
    ];

    appState.notes = mockNotes;
    renderMemory(mockNotes);
    addActivity(`Loaded ${mockNotes.length} notes`);
  } catch (error) {
    console.error('Error loading memory:', error);
    addActivity('Failed to load memory');
  }
}

function renderMemory(notes) {
  const memoryList = document.getElementById('memoryList');
  if (!memoryList) return;

  memoryList.innerHTML = '';

  notes.forEach(note => {
    const noteEl = document.createElement('div');
    noteEl.className = 'memory-item';
    noteEl.innerHTML = `
      <div class="memory-title">${note.title}</div>
      <div class="memory-text">${note.text}</div>
      <div class="memory-date">${new Date(note.date).toLocaleDateString()}</div>
    `;

    noteEl.addEventListener('click', () => viewNote(note));
    memoryList.appendChild(noteEl);
  });

  if (notes.length === 0) {
    memoryList.innerHTML = '<div class="placeholder">No notes yet</div>';
  }
}

function searchMemory(query) {
  const filtered = appState.notes.filter(note =>
    note.title.toLowerCase().includes(query.toLowerCase()) ||
    note.text.toLowerCase().includes(query.toLowerCase())
  );
  renderMemory(filtered);
}

function viewNote(note) {
  showModal('noteViewModal');
  // Update modal content with note details
}

// ==================== AI Chat ====================
async function sendChatMessage(message) {
  if (!message.trim()) return;

  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');

  if (!chatMessages) return;

  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'message user-message';
  userMsg.innerHTML = `<p>${message}</p>`;
  chatMessages.appendChild(userMsg);

  chatInput.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    // Call Ollama via PA service
    const response = await fetch(`${API_BASE}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'query',
        content: message
      })
    });

    const data = await response.json();

    // Add bot response
    const botMsg = document.createElement('div');
    botMsg.className = 'message bot-message';
    botMsg.innerHTML = `<p>${data.response || 'No response'}</p>`;
    chatMessages.appendChild(botMsg);

    chatMessages.scrollTop = chatMessages.scrollHeight;
    addActivity('Chat message processed');
  } catch (error) {
    console.error('Error sending chat message:', error);
    
    const errorMsg = document.createElement('div');
    errorMsg.className = 'message bot-message';
    errorMsg.innerHTML = `<p>Error: ${error.message}</p>`;
    chatMessages.appendChild(errorMsg);
  }
}

// ==================== Command Processing ====================
async function processCommand(command, source) {
  if (!command.trim()) return;

  try {
    addActivity(`Processing command: ${command.substring(0, 50)}...`);

    const response = await fetch(`${API_BASE}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'command',
        intent: 'auto',
        content: command,
        source: source
      })
    });

    const data = await response.json();

    if (source === 'dashboard') {
      const preview = document.getElementById('chatPreview');
      if (preview) {
        preview.innerHTML = `<p style="color: #10b981;">✓ ${data.response || 'Command processed'}</p>`;
        document.getElementById('quickInput').value = '';
      }
    }

    addActivity('Command executed successfully');
  } catch (error) {
    console.error('Error processing command:', error);
    addActivity('Failed to process command');
  }
}

// ==================== Service Health ====================
async function checkServiceHealth() {
  try {
    const services = ['ollama', 'openwebui', 'n8n', 'postgres', 'office365', 'waha', 'chroma', 'minio'];

    for (const service of services) {
      try {
        const statusEl = document.querySelector(`[data-service="${service}"]`);
        const integrationEl = document.getElementById(`integration-${service}`);

        // Simulate health check
        const isHealthy = Math.random() > 0.2; // 80% success rate for demo

        if (statusEl) {
          statusEl.classList.toggle('ready', isHealthy);
          statusEl.style.color = isHealthy ? '#10b981' : '#f59e0b';
        }

        if (integrationEl) {
          integrationEl.className = `integration-status ${isHealthy ? 'ready' : 'checking'}`;
          integrationEl.textContent = isHealthy ? '✓ Ready' : '⟳ Checking...';
        }

        appState.services[service] = isHealthy;
      } catch (e) {
        console.warn(`Error checking ${service}:`, e);
      }
    }
  } catch (error) {
    console.error('Error checking service health:', error);
  }
}

// ==================== Utilities ====================
function updateBadges() {
  document.getElementById('emailBadge').textContent = appState.unreadEmails;
  document.getElementById('whatsappBadge').textContent = appState.unreadMessages;
  document.getElementById('taskBadge').textContent = appState.tasks.filter(t => t.status === 'pending').length;
  document.getElementById('notifCount').textContent = appState.notifications;
}

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function saveSettings() {
  const office365Key = document.getElementById('office365ApiKey').value;
  const whatsappPhone = document.getElementById('whatsappPhone').value;
  const theme = document.getElementById('themeSelect').value;

  localStorage.setItem('office365_api_key', office365Key);
  localStorage.setItem('whatsapp_phone', whatsappPhone);
  applyTheme(theme);

  closeModal('settingsModal');
  addActivity('Settings saved');
}

function startPolling() {
  setInterval(() => {
    if (appState.currentTab === 'dashboard') {
      loadDashboardData();
    }
  }, POLL_INTERVAL);
}

// Close modals on background click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

console.log('🤖 Martin PA Dashboard ready!');
