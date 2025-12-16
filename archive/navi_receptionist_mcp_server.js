#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createMcpExpressApp } = require('@modelcontextprotocol/sdk/server/express.js');
const express = require('express');
const { randomUUID } = require('node:crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_DIR = 'D:\\05_AGENTS-AI\\01_PRODUCTION\\INTAKE_COORDINATOR_NAVI';
const INBOX_DIR = 'D:\\04_PROJECTS-Active\\_INCOMING';
const MAIL_ROOM_DIR = 'D:\\04_PROJECTS-Active\\Mail Room';
const PROCESSING_DIR = path.join(MAIL_ROOM_DIR, 'PROCESSING');
const ARCHIVE_DIR = path.join(MAIL_ROOM_DIR, 'ARCHIVE');
const OUTPUTS_DIR = path.join(BASE_DIR, 'outputs');
const NAVI_MEMORY_PATH = 'D:\\05_AGENTS-AI\\Navi_Thompson\\memory';

// Ensure directories exist
[INBOX_DIR, PROCESSING_DIR, ARCHIVE_DIR, OUTPUTS_DIR, NAVI_MEMORY_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mail Room data structure
const MAIL_ROOM = {
    URGENT: [],
    HIGH_PRIORITY: [],
    MEDIUM_PRIORITY: [],
    LOW_PRIORITY: [],
    UNCLASSIFIED: []
};

// Sample mail items for demonstration
const SAMPLE_MAIL = [
    {
        id: '1',
        subject: 'Urgent: Server Maintenance Tonight',
        sender: 'IT Department',
        priority: 'URGENT',
        timestamp: new Date().toISOString(),
        status: 'unread',
        content: 'Server maintenance scheduled for tonight at 10 PM. All systems will be down for 2 hours.'
    },
    {
        id: '2',
        subject: 'Meeting Request: Q4 Planning',
        sender: 'CEO',
        priority: 'HIGH_PRIORITY',
        timestamp: new Date().toISOString(),
        status: 'unread',
        content: 'Please schedule a meeting to discuss Q4 planning objectives.'
    },
    {
        id: '3',
        subject: 'Weekly Status Report',
        sender: 'Project Manager',
        priority: 'MEDIUM_PRIORITY',
        timestamp: new Date().toISOString(),
        status: 'unread',
        content: 'Attached is the weekly status report for all active projects.'
    }
];

// Contacts database
let CONTACTS = [];
const CONTACTS_FILE = path.join(BASE_DIR, 'memory', 'contacts.json');

function loadContacts() {
    try {
        if (fs.existsSync(CONTACTS_FILE)) {
            const data = fs.readFileSync(CONTACTS_FILE, 'utf8');
            CONTACTS = JSON.parse(data);
            console.log(`✅ Loaded ${CONTACTS.length} contacts from ${CONTACTS_FILE}`);
        } else {
            console.log('⚠️ Contacts file not found, using empty list.');
            CONTACTS = [];
        }
    } catch (error) {
        console.error('❌ Error loading contacts:', error);
        CONTACTS = [];
    }
}

// Load contacts on startup
loadContacts();

// Calendar/appointments
let CALENDAR = [];
const CALENDAR_FILE = path.join('D:\\05_AGENTS-AI\\01_PRODUCTION\\MONEY_PENNY\\memory', 'schedule.json');

function loadCalendar() {
    try {
        if (fs.existsSync(CALENDAR_FILE)) {
            const data = fs.readFileSync(CALENDAR_FILE, 'utf8');
            CALENDAR = JSON.parse(data);
            console.log(`✅ Loaded ${CALENDAR.length} appointments from ${CALENDAR_FILE}`);
        } else {
            console.log('⚠️ Calendar file not found, using empty list.');
            CALENDAR = [];
        }
    } catch (error) {
        console.error('❌ Error loading calendar:', error);
        CALENDAR = [];
    }
}

// Load calendar on startup
loadCalendar();

// Task Management (Kanban)
let TASKS = { todo: [], in_progress: [], done: [] };
const TASKS_FILE = path.join('D:\\05_AGENTS-AI\\01_PRODUCTION\\MONEY_PENNY\\memory', 'tasks.json');

function loadTasks() {
    try {
        if (fs.existsSync(TASKS_FILE)) {
            const data = fs.readFileSync(TASKS_FILE, 'utf8');
            TASKS = JSON.parse(data);
            console.log(`✅ Loaded tasks from ${TASKS_FILE}`);
        } else {
            console.log('⚠️ Tasks file not found, using empty board.');
            TASKS = { todo: [], in_progress: [], done: [] };
        }
    } catch (error) {
        console.error('❌ Error loading tasks:', error);
        TASKS = { todo: [], in_progress: [], done: [] };
    }
}

function saveTasks() {
    try {
        fs.writeFileSync(TASKS_FILE, JSON.stringify(TASKS, null, 4));
        console.log('💾 Tasks saved to disk.');
    } catch (error) {
        console.error('❌ Error saving tasks:', error);
    }
}

// Load tasks on startup
loadTasks();

// Office information
const OFFICE_INFO = {
    address: '123 Business Ave, Suite 100, Business City, BC 12345',
    phone: '555-0123',
    hours: 'Monday-Friday 8:00 AM - 6:00 PM',
    emergency_contact: 'Security: 555-0911',
    conference_rooms: ['Room A', 'Room B', 'Room C'],
    parking: 'Free parking available in lot B'
};

// Messages/notes storage
const MESSAGES = [];

// Initialize mail room with sample data
SAMPLE_MAIL.forEach(mail => {
    MAIL_ROOM[mail.priority].push(mail);
});

function getMailRoomStatus() {
    const status = {
        URGENT: 0,
        HIGH_PRIORITY: 0,
        MEDIUM_PRIORITY: 0,
        LOW_PRIORITY: 0,
        UNCLASSIFIED: 0,
        PROCESSING: 0
    };

    try {
        // Check priority folders
        ['URGENT', 'HIGH_PRIORITY', 'MEDIUM_PRIORITY', 'LOW_PRIORITY', 'UNCLASSIFIED', 'PROCESSING'].forEach(folder => {
            const folderPath = path.join(MAIL_ROOM_DIR, folder);
            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath);
                status[folder] = files.filter(f => fs.statSync(path.join(folderPath, f)).isFile()).length;
            }
        });
    } catch (error) {
        console.error('Error getting mail room status:', error);
    }
    return status;
}

function listInbox() {
    try {
        if (!fs.existsSync(INBOX_DIR)) {
            return [];
        }
        
        const files = fs.readdirSync(INBOX_DIR);
        const inboxFiles = [];
        
        for (const file of files) {
            const filePath = path.join(INBOX_DIR, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                inboxFiles.push({
                    id: file, // Use filename as ID
                    subject: file,
                    filename: file,
                    sender: 'Unknown', // File system doesn't know sender
                    priority: 'UNCLASSIFIED',
                    timestamp: stats.mtime.toISOString(),
                    size_kb: stats.size / 1024,
                    status: 'unread',
                    path: filePath
                });
            }
        }
        return inboxFiles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('Error listing inbox:', error);
        return [];
    }
}

function processMail(mailId) {
    let foundMail = null;
    let sourceFolder = null;

    // Find the mail item
    for (const [folder, mails] of Object.entries(MAIL_ROOM)) {
        const mail = mails.find(m => m.id === mailId);
        if (mail) {
            foundMail = mail;
            sourceFolder = folder;
            break;
        }
    }

    if (!foundMail) {
        return { error: 'Mail not found' };
    }

    // Mark as processed
    foundMail.status = 'processed';
    foundMail.processedAt = new Date().toISOString();

    return {
        success: true,
        mail: foundMail,
        message: `Mail "${foundMail.subject}" has been processed and moved to archive.`
    };
}

// ============================================================
// NEW TOOL IMPLEMENTATIONS
// ============================================================

function classifyFileContent(filename, content) {
    try {
        const contentLower = content.toLowerCase();
        let priority = "MEDIUM";
        let gtd_category = "@Reference";
        let confidence = 0.60;
        
        // Check for URGENT markers
        const urgentMarkers = ["urgent", "asap", "immediately", "critical", "deadline today"];
        if (urgentMarkers.some(marker => contentLower.includes(marker))) {
            priority = "URGENT";
            gtd_category = "@NextAction";
            confidence = 0.95;
        }
        // Check for HIGH priority markers
        else if (["high priority", "important", "approval needed"].some(marker => contentLower.includes(marker))) {
            priority = "HIGH";
            gtd_category = "@NextAction";
            confidence = 0.85;
        }
        // Check for action items
        else if (["action", "todo", "next step"].some(marker => contentLower.includes(marker))) {
            priority = "HIGH";
            gtd_category = "@NextAction";
            confidence = 0.80;
        }
        // Check for project files
        else if (["project", "initiative", "proposal"].some(marker => contentLower.includes(marker))) {
            gtd_category = "@Project";
            confidence = 0.75;
        }
        
        return {
            filename,
            priority,
            gtd_category,
            confidence
        };
    } catch (error) {
        console.error('Error classifying file:', error);
        return { filename, priority: 'MEDIUM', gtd_category: '@Reference', confidence: 0.0, error: error.message };
    }
}

function extractEntities(filename, content) {
    try {
        const entities = {
            emails: [],
            dates: [],
            amounts: [],
            action_items: []
        };
        
        // Extract emails
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = content.match(emailPattern);
        if (emails) entities.emails = [...new Set(emails)];
        
        // Extract amounts
        const amountPattern = /\$\s*[\d,]+(?:\.\d{2})?/g;
        const amounts = content.match(amountPattern);
        if (amounts) entities.amounts = [...new Set(amounts)];
        
        // Extract action items (simple lines starting with - )
        const actionPattern = /(?:^|\n)\s*-\s*(.+?)(?=\n|$)/g;
        let match;
        while ((match = actionPattern.exec(content)) !== null) {
            if (entities.action_items.length < 5) {
                entities.action_items.push(match[1]);
            }
        }
        
        return { filename, entities };
    } catch (error) {
        return { filename, error: error.message };
    }
}

function logDecision(filename, decisionData) {
    try {
        const logFile = path.join(NAVI_MEMORY_PATH, "decisions_log.json");
        let logData = { decisions: [], total_decisions: 0 };
        
        if (fs.existsSync(logFile)) {
            logData = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        }
        
        const newDecision = {
            id: `decision_${new Date().toISOString().replace(/[:.]/g, '')}`,
            timestamp: new Date().toISOString(),
            filename,
            ...decisionData
        };
        
        logData.decisions.push(newDecision);
        logData.total_decisions += 1;
        
        fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
        return { success: true, logged: true };
    } catch (error) {
        return { error: error.message };
    }
}

function updateMetrics(success = true) {
    try {
        const metricsFile = path.join(NAVI_MEMORY_PATH, "performance_metrics.json");
        let metrics = { tracking_start: new Date().toISOString(), metrics: [] };
        
        if (fs.existsSync(metricsFile)) {
            metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
        }
        
        const today = new Date().toISOString().split('T')[0];
        let todayEntry = metrics.metrics.find(m => m.date === today);
        
        if (!todayEntry) {
            todayEntry = {
                date: today,
                tasks_completed: 0,
                success_count: 0,
                success_rate: 0
            };
            metrics.metrics.push(todayEntry);
        }
        
        todayEntry.tasks_completed += 1;
        if (success) todayEntry.success_count += 1;
        todayEntry.success_rate = todayEntry.success_count / todayEntry.tasks_completed;
        
        fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
        return { 
            success: true, 
            tasks_completed: todayEntry.tasks_completed, 
            success_rate: todayEntry.success_rate 
        };
    } catch (error) {
        return { error: error.message };
    }
}

// Function to create a new MCP server instance
function createServer() {
    const server = new McpServer({
        name: 'navi-receptionist-mcp',
        version: '1.0.0'
    });

    // Register list_inbox tool
    server.registerTool('list_inbox', {
        description: 'List all mail items in the inbox organized by priority',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    }, async () => {
        // Safety delay to prevent rapid-fire loops
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const inbox = listInbox();
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(inbox, null, 2)
            }]
        };
    });

    // Register get_mail_room_status tool
    server.registerTool('get_mail_room_status', {
        description: 'Get the current status of all mail room folders',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    }, async () => {
        const status = getMailRoomStatus();
        const total = Object.values(status).reduce((sum, count) => sum + count, 0);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    total_messages: total,
                    folders: status,
                    last_updated: new Date().toISOString()
                }, null, 2)
            }]
        };
    });

    // Register process_mail tool
    server.registerTool('process_mail', {
        description: 'Process a specific mail item by ID',
        inputSchema: {
            type: 'object',
            properties: {
                mail_id: {
                    type: 'string',
                    description: 'The ID of the mail item to process'
                }
            },
            required: ['mail_id']
        }
    }, async ({ mail_id }) => {
        const result = processMail(mail_id);

        if (result.error) {
            return {
                content: [{
                    type: 'text',
                    text: `Error: ${result.error}`
                }],
                isError: true
            };
        }

        return {
            content: [{
                type: 'text',
                text: result.message
            }]
        };
    });

    // Register get_mail_details tool
    server.registerTool('get_mail_details', {
        description: 'Get detailed information about a specific mail item',
        inputSchema: {
            type: 'object',
            properties: {
                mail_id: {
                    type: 'string',
                    description: 'The ID of the mail item to retrieve'
                }
            },
            required: ['mail_id']
        }
    }, async ({ mail_id }) => {
        const allMail = listInbox();
        const mail = allMail.find(m => m.id === mail_id);

        if (!mail) {
            return {
                content: [{
                    type: 'text',
                    text: 'Mail not found'
                }],
                isError: true
            };
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(mail, null, 2)
            }]
        };
    });

    // Register search_contacts tool
    server.registerTool('search_contacts', {
        description: 'Search for contacts by name, title, or department',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search term to find contacts'
                }
            },
            required: ['query']
        }
    }, async ({ query }) => {
        const results = CONTACTS.filter(contact =>
            contact.name.toLowerCase().includes(query.toLowerCase()) ||
            contact.title.toLowerCase().includes(query.toLowerCase()) ||
            contact.email.toLowerCase().includes(query.toLowerCase())
        );

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(results, null, 2)
            }]
        };
    });

    // Register check_calendar tool
    server.registerTool('check_calendar', {
        description: 'Check calendar for appointments. Can filter by specific date, or a date range. If no arguments provided, lists ALL appointments.',
        inputSchema: {
            type: 'object',
            properties: {
                date: {
                    type: 'string',
                    description: 'Optional: Specific date to check (YYYY-MM-DD)'
                },
                start_date: {
                    type: 'string',
                    description: 'Optional: Start of date range (YYYY-MM-DD)'
                },
                end_date: {
                    type: 'string',
                    description: 'Optional: End of date range (YYYY-MM-DD)'
                }
            },
            required: []
        }
    }, async (args) => {
        const { date, start_date, end_date } = args || {};
        console.log(`📅 check_calendar called with:`, args);

        // Reload calendar to ensure fresh data
        loadCalendar();
        
        let appointments = CALENDAR;
        
        if (date) {
            appointments = CALENDAR.filter(apt => apt.date === date);
        } else if (start_date && end_date) {
            appointments = CALENDAR.filter(apt => apt.date >= start_date && apt.date <= end_date);
        } else {
            // If no date, show all
            // Sort by date
            appointments.sort((a, b) => {
                const dateA = new Date(a.date + ' ' + a.time);
                const dateB = new Date(b.date + ' ' + b.time);
                return dateA - dateB;
            });
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(appointments, null, 2)
            }]
        };
    });

    // Register schedule_meeting tool
    server.registerTool('schedule_meeting', {
        description: 'Schedule a new meeting or appointment',
        inputSchema: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Meeting title'
                },
                date: {
                    type: 'string',
                    description: 'Date (YYYY-MM-DD)'
                },
                time: {
                    type: 'string',
                    description: 'Time (HH:MM AM/PM)'
                },
                duration: {
                    type: 'string',
                    description: 'Duration (e.g., "1 hour", "30 minutes")'
                },
                attendees: {
                    type: 'string',
                    description: 'Comma-separated list of attendees'
                }
            },
            required: ['title', 'date', 'time', 'attendees']
        }
    }, async ({ title, date, time, duration, attendees }) => {
        const newMeeting = {
            id: (CALENDAR.length + 1).toString(),
            title,
            date,
            time,
            duration: duration || '1 hour',
            attendees: attendees.split(',').map(a => a.trim()),
            location: 'TBD',
            status: 'pending'
        };

        CALENDAR.push(newMeeting);

        return {
            content: [{
                type: 'text',
                text: `Meeting scheduled: "${title}" on ${date} at ${time}. Confirmation pending.`
            }]
        };
    });

    // Register list_tasks tool
    server.registerTool('list_tasks', {
        description: 'List all tasks on the Kanban board',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    description: 'Filter by status (todo, in_progress, done). If omitted, lists all.'
                }
            },
            required: []
        }
    }, async (args) => {
        const { status } = args || {};
        if (status) {
            if (!TASKS[status]) {
                return { content: [{ type: 'text', text: `Invalid status: ${status}. Valid statuses are: todo, in_progress, done.` }] };
            }
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(TASKS[status], null, 2)
                }]
            };
        }
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(TASKS, null, 2)
            }]
        };
    });

    // Register add_task tool
    server.registerTool('add_task', {
        description: 'Add a new task to the Kanban board',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string', description: 'Task description' },
                priority: { type: 'string', description: 'Priority (high, medium, low)' }
            },
            required: ['title', 'description']
        }
    }, async ({ title, description, priority }) => {
        const newTask = {
            id: `t${Date.now()}`,
            title,
            description,
            priority: priority || 'medium',
            created_at: new Date().toISOString()
        };
        TASKS.todo.push(newTask);
        saveTasks();
        return {
            content: [{
                type: 'text',
                text: `Added task to TODO: "${title}" (ID: ${newTask.id})`
            }]
        };
    });

    // Register update_task_status tool
    server.registerTool('update_task_status', {
        description: 'Move a task to a different column (todo, in_progress, done)',
        inputSchema: {
            type: 'object',
            properties: {
                task_id: { type: 'string', description: 'The ID of the task to move' },
                new_status: { type: 'string', description: 'The new status (todo, in_progress, done)' }
            },
            required: ['task_id', 'new_status']
        }
    }, async ({ task_id, new_status }) => {
        if (!['todo', 'in_progress', 'done'].includes(new_status)) {
            return { content: [{ type: 'text', text: `Invalid status: ${new_status}` }] };
        }

        // Find and remove task from old list
        let task = null;
        for (const status of ['todo', 'in_progress', 'done']) {
            const index = TASKS[status].findIndex(t => t.id === task_id);
            if (index !== -1) {
                task = TASKS[status].splice(index, 1)[0];
                break;
            }
        }

        if (!task) {
            return { content: [{ type: 'text', text: `Task not found with ID: ${task_id}` }] };
        }

        // Add to new list
        TASKS[new_status].push(task);
        saveTasks();

        return {
            content: [{
                type: 'text',
                text: `Moved task "${task.title}" to ${new_status.toUpperCase()}`
            }]
        };
    });

    // Register take_message tool
    server.registerTool('take_message', {
        description: 'Take a message for someone who is unavailable',
        inputSchema: {
            type: 'object',
            properties: {
                for_person: {
                    type: 'string',
                    description: 'Person the message is for'
                },
                from_person: {
                    type: 'string',
                    description: 'Person leaving the message'
                },
                message: {
                    type: 'string',
                    description: 'The message content'
                },
                contact_info: {
                    type: 'string',
                    description: 'Contact information for callback'
                }
            },
            required: ['for_person', 'from_person', 'message']
        }
    }, async ({ for_person, from_person, message, contact_info }) => {
        const newMessage = {
            id: (MESSAGES.length + 1).toString(),
            for_person,
            from_person,
            message,
            contact_info: contact_info || 'No contact info provided',
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        MESSAGES.push(newMessage);

        return {
            content: [{
                type: 'text',
                text: `Message taken for ${for_person} from ${from_person}. They will be notified.`
            }]
        };
    });

    // Register get_office_info tool
    server.registerTool('get_office_info', {
        description: 'Get office information, hours, address, etc.',
        inputSchema: {
            type: 'object',
            properties: {
                category: {
                    type: 'string',
                    description: 'Type of information needed (address, hours, phone, emergency, parking, rooms)'
                }
            },
            required: []
        }
    }, async ({ category }) => {
        if (category) {
            const info = OFFICE_INFO[category];
            return {
                content: [{
                    type: 'text',
                    text: info || `No information available for ${category}`
                }]
            };
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(OFFICE_INFO, null, 2)
            }]
        };
    });

    // Register check_messages tool
    server.registerTool('check_messages', {
        description: 'Check for pending messages that need to be delivered',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    }, async () => {
        const pendingMessages = MESSAGES.filter(msg => msg.status === 'pending');

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(pendingMessages, null, 2)
            }]
        };
    });

    // Register read_file tool
    server.registerTool('read_file', {
        description: 'Read the content of a file from the inbox or processing area',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string', description: 'Name of the file to read' }
            },
            required: ['filename']
        }
    }, async ({ filename }) => {
        const possiblePaths = [
            path.join(INBOX_DIR, filename),
            path.join(PROCESSING_DIR, filename)
        ];
        
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, 'utf8');
                return { content: [{ type: 'text', text: content }] };
            }
        }
        return { content: [{ type: 'text', text: 'File not found' }], isError: true };
    });

    // Register archive_file tool
    server.registerTool('archive_file', {
        description: 'Move a file to the archive folder',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string', description: 'Name of the file to archive' }
            },
            required: ['filename']
        }
    }, async ({ filename }) => {
        const src = path.join(PROCESSING_DIR, filename);
        const dest = path.join(ARCHIVE_DIR, filename);
        if (fs.existsSync(src)) {
            fs.renameSync(src, dest);
            return { content: [{ type: 'text', text: `Archived ${filename}` }] };
        }
        return { content: [{ type: 'text', text: 'File not found in processing' }], isError: true };
    });

    // Register move_to_processing tool
    server.registerTool('move_to_processing', {
        description: 'Move a file from inbox to processing folder',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string', description: 'Name of the file to move' }
            },
            required: ['filename']
        }
    }, async ({ filename }) => {
        const src = path.join(INBOX_DIR, filename);
        const dest = path.join(PROCESSING_DIR, filename);
        if (fs.existsSync(src)) {
            fs.renameSync(src, dest);
            return { content: [{ type: 'text', text: `Moved ${filename} to processing` }] };
        }
        return { content: [{ type: 'text', text: 'File not found in inbox' }], isError: true };
    });

    // Register classify_file tool
    server.registerTool('classify_file', {
        description: 'Classify a file with a specific category and priority based on content',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string' },
                content: { type: 'string', description: 'Optional content to analyze. If not provided, tries to read file.' }
            },
            required: ['filename']
        }
    }, async ({ filename, content }) => {
        let fileContent = content;
        if (!fileContent) {
            // Try to read file
            const possiblePaths = [
                path.join(INBOX_DIR, filename),
                path.join(PROCESSING_DIR, filename)
            ];
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    fileContent = fs.readFileSync(p, 'utf8');
                    break;
                }
            }
        }
        
        if (!fileContent) {
             return { content: [{ type: 'text', text: 'Could not read file content for classification.' }], isError: true };
        }

        const result = classifyFileContent(filename, fileContent);
        return { 
            content: [{ 
                type: 'text', 
                text: JSON.stringify(result, null, 2) 
            }] 
        };
    });

    // Register move_to_priority_folder tool
    server.registerTool('move_to_priority_folder', {
        description: 'Move file to priority-specific folder in Mail Room',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string' },
                priority: { type: 'string', enum: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] }
            },
            required: ['filename', 'priority']
        }
    }, async ({ filename, priority }) => {
        const priorityFolders = {
            "URGENT": "URGENT",
            "HIGH": "HIGH_PRIORITY",
            "MEDIUM": "MEDIUM_PRIORITY",
            "LOW": "LOW_PRIORITY"
        };
        
        const folderName = priorityFolders[priority] || "UNCLASSIFIED";
        const destDir = path.join(MAIL_ROOM_DIR, folderName);
        
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        
        const src = path.join(INBOX_DIR, filename);
        const dest = path.join(destDir, filename);
        
        if (fs.existsSync(src)) {
            fs.renameSync(src, dest);
            return { content: [{ type: 'text', text: `Moved ${filename} to ${folderName}` }] };
        }
        return { content: [{ type: 'text', text: `File ${filename} not found in inbox` }], isError: true };
    });

    // Register extract_entities tool
    server.registerTool('extract_entities', {
        description: 'Extract important entities from file content',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string' },
                content: { type: 'string' }
            },
            required: ['filename', 'content']
        }
    }, async ({ filename, content }) => {
        const result = extractEntities(filename, content);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });

    // Register log_decision tool
    server.registerTool('log_decision', {
        description: 'Log decision to memory',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string' },
                decision_data: { type: 'object' }
            },
            required: ['filename', 'decision_data']
        }
    }, async ({ filename, decision_data }) => {
        const result = logDecision(filename, decision_data);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });

    // Register update_metrics tool
    server.registerTool('update_metrics', {
        description: 'Update performance metrics',
        inputSchema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                processing_time: { type: 'number' }
            },
            required: []
        }
    }, async ({ success }) => {
        const result = updateMetrics(success);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });

    // Register create_summary tool
    server.registerTool('create_summary', {
        description: 'Create a summary file for a processed document',
        inputSchema: {
            type: 'object',
            properties: {
                original_filename: { type: 'string' },
                summary_content: { type: 'string' }
            },
            required: ['original_filename', 'summary_content']
        }
    }, async ({ original_filename, summary_content }) => {
        const summaryFile = path.join(OUTPUTS_DIR, `${original_filename}.summary.md`);
        fs.writeFileSync(summaryFile, `# Summary: ${original_filename}\n\n${summary_content}`);
        return { content: [{ type: 'text', text: `Created summary at ${summaryFile}` }] };
    });

    // Register route_to_agent tool
    server.registerTool('route_to_agent', {
        description: 'Route a task or file to another agent',
        inputSchema: {
            type: 'object',
            properties: {
                agent_name: { type: 'string' },
                task_description: { type: 'string' },
                priority: { type: 'string' }
            },
            required: ['agent_name', 'task_description']
        }
    }, async ({ agent_name, task_description, priority }) => {
        console.log(`Routing to ${agent_name}: ${task_description} (${priority})`);
        
        let routingMessage = `Routed task to ${agent_name}`;

        // 1. Route to Money Penny (Add to Task Board)
        if (agent_name.toLowerCase().includes('money') || agent_name.toLowerCase().includes('penny') || agent_name.toLowerCase().includes('secretary')) {
            const newTask = {
                id: `t${Date.now()}`,
                title: `From Navi: ${task_description.substring(0, 30)}...`,
                description: `Routed from Intake: ${task_description}`,
                priority: priority || 'medium',
                created_at: new Date().toISOString()
            };
            TASKS.todo.push(newTask);
            saveTasks();
            routingMessage += " (Added to Money Penny's Task Board)";
        }
        
        // 2. Route to Navi (Add to Inbox)
        else if (agent_name.toLowerCase().includes('navi') || agent_name.toLowerCase().includes('receptionist')) {
            const filename = `routed_task_${Date.now()}.txt`;
            const content = `FROM: External Agent\nPRIORITY: ${priority || 'normal'}\n\n${task_description}`;
            fs.writeFileSync(path.join(INBOX_DIR, filename), content);
            routingMessage += " (Added to Navi's Inbox)";
        }

        // Log to a routing file
        const logEntry = `[${new Date().toISOString()}] TO: ${agent_name} | PRIORITY: ${priority} | TASK: ${task_description}\n`;
        fs.appendFileSync(path.join(OUTPUTS_DIR, 'routing_log.txt'), logEntry);
        
        return { content: [{ type: 'text', text: routingMessage }] };
    });

    // Register update_status tool
    server.registerTool('update_status', {
        description: 'Update the processing status of a file or task',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                status: { type: 'string' }
            },
            required: ['id', 'status']
        }
    }, async ({ id, status }) => {
        console.log(`Status update for ${id}: ${status}`);
        return { content: [{ type: 'text', text: `Updated status of ${id} to ${status}` }] };
    });

    // Register generate_report tool
    server.registerTool('generate_report', {
        description: 'Generate a report based on processed items',
        inputSchema: {
            type: 'object',
            properties: {
                report_type: { type: 'string' },
                content: { type: 'string' }
            },
            required: ['report_type', 'content']
        }
    }, async ({ report_type, content }) => {
        const reportFile = path.join(OUTPUTS_DIR, `${report_type}_report_${Date.now()}.md`);
        fs.writeFileSync(reportFile, `# ${report_type} Report\n\n${content}`);
        return { content: [{ type: 'text', text: `Generated report: ${reportFile}` }] };
    });

    // Register searchKnowledgeBase tool
    server.registerTool('searchKnowledgeBase', {
        description: 'Search the VBoarder Knowledge Base for information',
        inputSchema: {
            type: 'object',
            properties: {
                query: { 
                    type: 'string',
                    description: 'The text string to search for in the knowledge base'
                }
            },
            required: ['query']
        }
    }, async ({ query }) => {
        const kbDir = 'D:\\08_KNOWLEDGE-Base';
        if (!fs.existsSync(kbDir)) {
            return { content: [{ type: 'text', text: 'Knowledge Base directory not found.' }] };
        }

        const results = [];
        try {
            const files = fs.readdirSync(kbDir);
            for (const file of files) {
                if (file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.json')) {
                    const content = fs.readFileSync(path.join(kbDir, file), 'utf8');
                    if (content.toLowerCase().includes(query.toLowerCase())) {
                        // Extract a snippet
                        const index = content.toLowerCase().indexOf(query.toLowerCase());
                        const start = Math.max(0, index - 50);
                        const end = Math.min(content.length, index + 150);
                        const snippet = content.substring(start, end).replace(/\n/g, ' ');
                        results.push(`File: ${file}\nSnippet: ...${snippet}...`);
                    }
                }
            }
        } catch (err) {
            return { content: [{ type: 'text', text: `Error searching knowledge base: ${err.message}` }], isError: true };
        }

        if (results.length === 0) {
            return { content: [{ type: 'text', text: `No results found for "${query}" in Knowledge Base.` }] };
        }

        return { content: [{ type: 'text', text: results.join('\n\n') }] };
    });

    return server;
}

async function main() {
    const PORT = 3005;
    const server = createServer();
    const app = express();

    // CORS Middleware
    app.use((req, res, next) => {
        const origin = req.headers.origin || '*';
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Private-Network', 'true');
        
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    // Middleware
    app.use(express.json());

    // Handle MCP requests
    app.post('/mcp', async (req, res) => {
        console.log(`📥 Received request: ${JSON.stringify(req.body).substring(0, 200)}...`);
        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined  // Stateless mode
            });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
            res.on('close', () => {
                transport.close();
            });
        } catch (error) {
            console.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error'
                    },
                    id: null
                });
            }
        }
    });

    // Handle GET requests (friendly message for browser users)
    app.get('/', (req, res) => {
        res.send(`<h1>✅ Navi Receptionist MCP Server is Running</h1><p>This is an MCP server endpoint. Configure LobeChat to use: <code>http://localhost:${PORT}/mcp</code></p>`);
    });

    // Handle GET requests (not supported in stateless mode)
    app.get('/mcp', async (req, res) => {
        res.send(`<h1>⚠️ MCP Endpoint</h1><p>This URL (<code>/mcp</code>) is for <b>LobeChat</b> to connect to, not for viewing in a browser.</p><p>✅ <b>The server is working correctly!</b></p><p>👉 Go to LobeChat Settings -> Tool Extensions and enter: <code>http://localhost:${PORT}/mcp</code></p>`);
    });

    // Serve the OpenAPI Manifest (Support both GET and POST for compatibility)
    const serveManifest = (req, res) => {
        const manifestPath = path.join(__dirname, 'tool_manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            // Ensure the URL is correct dynamically
            manifest.servers = [{ url: `http://localhost:${PORT}` }];
            res.json(manifest);
        } else {
            res.status(404).json({ error: 'Manifest not found' });
        }
    };

    app.get('/openapi.json', serveManifest);
    app.post('/openapi.json', serveManifest);

    // Serve LobeChat Plugin Manifest
    app.get('/manifest.json', (req, res) => {
        res.json({
            "identifier": "navi-tools",
            "author": "VBoarder",
            "createdAt": new Date().toISOString().split('T')[0],
            "meta": {
                "avatar": "📂",
                "title": "Navi File System Tools",
                "description": "Access local files, inbox, and office management tools",
                "tags": ["files", "office", "mcp"]
            },
            "version": "1.0.0",
            "homepage": `http://localhost:${PORT}`,
            "schema": `http://localhost:${PORT}/openapi.json`
        });
    });

    // ==========================================
    // REST API Endpoints for OpenAPI Compatibility
    // ==========================================

    app.post('/list_inbox', async (req, res) => {
        console.log('REST: list_inbox');
        // Safety delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        const inbox = listInbox();
        res.json(inbox);
    });

    app.post('/get_mail_room_status', async (req, res) => {
        console.log('REST: get_mail_room_status');
        const status = getMailRoomStatus();
        res.json({
            total_messages: Object.values(status).reduce((a, b) => a + b, 0),
            folders: status,
            last_updated: new Date().toISOString()
        });
    });

    app.post('/process_mail', async (req, res) => {
        console.log('REST: process_mail', req.body);
        const { mail_id } = req.body;
        if (!mail_id) return res.status(400).json({ error: 'mail_id is required' });
        const result = processMail(mail_id);
        res.json(result);
    });

    app.post('/get_mail_details', async (req, res) => {
        console.log('REST: get_mail_details', req.body);
        const { mail_id } = req.body;
        const allMail = listInbox();
        const mail = allMail.find(m => m.id === mail_id);
        if (!mail) return res.status(404).json({ error: 'Mail not found' });
        res.json(mail);
    });

    app.post('/search_contacts', async (req, res) => {
        console.log('REST: search_contacts', req.body);
        const { query } = req.body;
        if (!query) return res.json([]);
        const results = CONTACTS.filter(contact =>
            contact.name.toLowerCase().includes(query.toLowerCase()) ||
            contact.title.toLowerCase().includes(query.toLowerCase()) ||
            contact.email.toLowerCase().includes(query.toLowerCase())
        );
        res.json(results);
    });

    app.post('/check_calendar', async (req, res) => {
        console.log('REST: check_calendar', req.body);
        loadCalendar();
        const { date, start_date, end_date } = req.body || {};
        let appointments = CALENDAR;
        if (date) {
            appointments = CALENDAR.filter(apt => apt.date === date);
        } else if (start_date && end_date) {
            appointments = CALENDAR.filter(apt => apt.date >= start_date && apt.date <= end_date);
        }
        res.json(appointments);
    });

    app.post('/list_tasks', async (req, res) => {
        console.log('REST: list_tasks', req.body);
        const { status } = req.body || {};
        if (status && TASKS[status]) {
            res.json(TASKS[status]);
        } else {
            res.json(TASKS);
        }
    });

    app.post('/searchKnowledgeBase', async (req, res) => {
        console.log('REST: searchKnowledgeBase', req.body);
        const { query, max_results = 3, min_relevance = 0.0, section_filter } = req.body;
        if (!query) return res.status(400).json({ error: 'Missing query' });

        const kbDir = 'D:\\08_KNOWLEDGE-Base';
        if (!fs.existsSync(kbDir)) {
            return res.status(404).json({ error: 'Knowledge Base directory not found' });
        }

        let results = [];
        try {
            const files = fs.readdirSync(kbDir);
            for (const file of files) {
                if (file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.json')) {
                    const filePath = path.join(kbDir, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    const lowerContent = content.toLowerCase();
                    const lowerQuery = query.toLowerCase();
                    
                    if (lowerContent.includes(lowerQuery)) {
                        let pos = lowerContent.indexOf(lowerQuery);
                        
                        // Extract context
                        const start = Math.max(0, pos - 100);
                        const end = Math.min(content.length, pos + 200);
                        let snippet = content.substring(start, end).replace(/\n/g, ' ');
                        
                        // Find section title (look backwards for #)
                        const preceedingText = content.substring(0, pos);
                        const headerMatch = preceedingText.match(/(?:^|\n)#{1,3}\s+(.*?)(?:\n|$)/g);
                        let sectionTitle = "General";
                        let sectionId = "0.0";
                        
                        if (headerMatch && headerMatch.length > 0) {
                            const lastHeader = headerMatch[headerMatch.length - 1].trim();
                            sectionTitle = lastHeader.replace(/#{1,3}\s+/, '');
                            const numMatch = sectionTitle.match(/^(\d+(?:\.\d+)*)/);
                            if (numMatch) {
                                sectionId = numMatch[1];
                            }
                        }

                        if (section_filter && !sectionId.startsWith(section_filter)) {
                            continue;
                        }

                        results.push({
                            section: sectionId,
                            title: sectionTitle,
                            content: `...${snippet}...`,
                            relevance_score: 0.95,
                            source: file
                        });
                    }
                }
            }
            
            results = results.slice(0, max_results);
            res.json(results);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/add_task', async (req, res) => {
        console.log('REST: add_task', req.body);
        const { title, description, priority } = req.body;
        if (!title || !description) return res.status(400).json({ error: 'Missing title or description' });
        const newTask = {
            id: `t${Date.now()}`,
            title,
            description,
            priority: priority || 'medium',
            created_at: new Date().toISOString()
        };
        TASKS.todo.push(newTask);
        saveTasks();
        res.json({ message: 'Task added', task: newTask });
    });

    app.post('/update_task_status', async (req, res) => {
        console.log('REST: update_task_status', req.body);
        const { task_id, new_status } = req.body;
        if (!['todo', 'in_progress', 'done'].includes(new_status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        let task = null;
        for (const status of ['todo', 'in_progress', 'done']) {
            const index = TASKS[status].findIndex(t => t.id === task_id);
            if (index !== -1) {
                task = TASKS[status].splice(index, 1)[0];
                break;
            }
        }
        if (!task) return res.status(404).json({ error: 'Task not found' });
        TASKS[new_status].push(task);
        saveTasks();
        res.json({ message: 'Task moved', task });
    });

    // ============================================================
    // LobeChat Specific REST Endpoints (as requested by user)
    // ============================================================

    app.get('/mcp/navi/list_inbox', async (req, res) => {
        console.log('REST: /mcp/navi/list_inbox');
        const inbox = listInbox();
        res.json({
            success: true,
            file_count: inbox.length,
            files: inbox
        });
    });

    app.post('/mcp/navi/get_mail_room_status', async (req, res) => {
        console.log('REST: /mcp/navi/get_mail_room_status');
        const status = getMailRoomStatus();
        res.json({
            total_messages: Object.values(status).reduce((a, b) => a + b, 0),
            folders: status,
            last_updated: new Date().toISOString()
        });
    });

    app.post('/mcp/navi/read_file', async (req, res) => {
        console.log('REST: /mcp/navi/read_file', req.body);
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'filename is required' });

        const possiblePaths = [
            path.join(INBOX_DIR, filename),
            path.join(PROCESSING_DIR, filename)
        ];
        
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, 'utf8');
                const ext = path.extname(filename);
                return res.json({
                    success: true,
                    filename,
                    content,
                    file_type: ext
                });
            }
        }
        res.status(404).json({ error: `File not found: ${filename}` });
    });

    app.post('/mcp/navi/classify_file', async (req, res) => {
        console.log('REST: /mcp/navi/classify_file', req.body);
        const { filename, content } = req.body;
        if (!filename) return res.status(400).json({ error: 'filename is required' });
        
        let fileContent = content;
        if (!fileContent) {
             const possiblePaths = [
                path.join(INBOX_DIR, filename),
                path.join(PROCESSING_DIR, filename)
            ];
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    fileContent = fs.readFileSync(p, 'utf8');
                    break;
                }
            }
        }
        
        if (!fileContent) return res.status(400).json({ error: 'Content not provided and file not found' });

        const result = classifyFileContent(filename, fileContent);
        res.json({ success: true, ...result });
    });

    app.post('/mcp/navi/move_to_priority', async (req, res) => {
        console.log('REST: /mcp/navi/move_to_priority', req.body);
        const { filename, priority } = req.body;
        if (!filename || !priority) return res.status(400).json({ error: 'filename and priority are required' });

        const priorityFolders = {
            "URGENT": "URGENT",
            "HIGH": "HIGH_PRIORITY",
            "MEDIUM": "MEDIUM_PRIORITY",
            "LOW": "LOW_PRIORITY"
        };
        
        const folderName = priorityFolders[priority] || "UNCLASSIFIED";
        const destDir = path.join(MAIL_ROOM_DIR, folderName);
        
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        
        const src = path.join(INBOX_DIR, filename);
        const dest = path.join(destDir, filename);
        
        if (fs.existsSync(src)) {
            fs.renameSync(src, dest);
            res.json({
                success: true,
                filename,
                priority,
                destination: dest,
                status: `moved to ${folderName}`
            });
        } else {
            res.status(404).json({ error: `File ${filename} not found in inbox` });
        }
    });

    app.post('/mcp/navi/extract_entities', async (req, res) => {
        console.log('REST: /mcp/navi/extract_entities', req.body);
        const { filename, content } = req.body;
        if (!filename || !content) return res.status(400).json({ error: 'filename and content are required' });
        
        const result = extractEntities(filename, content);
        res.json({ success: true, ...result });
    });

    app.post('/mcp/navi/log_decision', async (req, res) => {
        console.log('REST: /mcp/navi/log_decision', req.body);
        const { filename, decision_data } = req.body;
        if (!filename || !decision_data) return res.status(400).json({ error: 'filename and decision_data are required' });
        
        const result = logDecision(filename, decision_data);
        res.json(result);
    });

    app.post('/mcp/navi/update_metrics', async (req, res) => {
        console.log('REST: /mcp/navi/update_metrics', req.body);
        const { success } = req.body;
        const result = updateMetrics(success);
        res.json(result);
    });

    console.log('🚀 Starting Navi Receptionist MCP Server...');
    console.log('📧 Mail Room Status:');
    const status = getMailRoomStatus();
    Object.entries(status).forEach(([folder, count]) => {
        console.log(`   ${folder}: ${count} items`);
    });
    console.log(`🌐 Server will listen on port ${PORT}`);
    console.log(`🔗 Configure LobeChat to use: http://localhost:${PORT}/mcp`);
    console.log('🛠️  Available tools: list_inbox, get_mail_room_status, process_mail, get_mail_details, search_contacts, check_calendar, schedule_meeting, list_tasks, add_task, update_task_status, take_message, get_office_info, check_messages');

    app.listen(PORT, '0.0.0.0', (error) => {
        if (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
        console.log('✅ MCP server connected and ready!');
        console.log(`🚀 Server is listening on http://localhost:${PORT}/mcp`);
    });

    // Keep process alive
    setInterval(() => {
        // Heartbeat
    }, 10000);
}

main().catch(error => {
    console.error('❌ Server error:', error);
    fs.writeFileSync('server.error.log', `Error: ${error}\nStack: ${error.stack}\n`);
    // process.exit(1); // Don't exit immediately to see if we can debug
});