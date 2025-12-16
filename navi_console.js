const readline = require('readline');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuration
const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MCP_BASE_URL = 'http://localhost:3002/mcp/navi';
const MODEL = 'llama3.1:8b'; // Ensure this model is pulled

// Tools Definition (The "Wiring")
const tools = [
    {
        type: 'function',
        function: {
            name: 'list_inbox',
            description: 'List files in the inbox',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Read the content of a file',
            parameters: {
                type: 'object',
                properties: {
                    filename: { type: 'string', description: 'Name of the file to read' }
                },
                required: ['filename']
            }
        }
    }
];

// Chat History
let history = [
    { role: 'system', content: 'You are Navi, an efficient office receptionist agent. You have access to real tools. When asked to check files or inbox, YOU MUST USE THE TOOLS. Do not hallucinate file contents.' }
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.clear();
console.log("====================================================");
console.log("🤖 NAVI CONSOLE (VS Code Edition)");
console.log("====================================================");
console.log(`🔌 Connected to: ${MODEL}`);
console.log(`🛠️  Tools Wired: list_inbox, read_file`);
console.log("----------------------------------------------------");
console.log("Type your request below (or 'exit' to quit)");
console.log("");

function askQuestion() {
    rl.question('You: ', async (input) => {
        if (input.toLowerCase() === 'exit') {
            rl.close();
            return;
        }

        history.push({ role: 'user', content: input });
        await processChat();
        askQuestion();
    });
}

async function processChat() {
    process.stdout.write("Navi: ⏳ Thinking...");

    try {
        // 1. Send to Ollama
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                messages: history,
                tools: tools,
                stream: false
            })
        });

        const data = await response.json();
        
        if (!data.message) {
            console.log("\n❌ Error: No message from model. Is Ollama running?");
            return;
        }

        const message = data.message;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);

        // 2. Check for Tool Calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            history.push(message); // Add the "intent" to history

            for (const tool of message.tool_calls) {
                const fnName = tool.function.name;
                const fnArgs = tool.function.arguments;
                
                console.log(`Navi: 🛠️  Using tool: ${fnName}...`);

                // Execute Tool
                let result = null;
                if (fnName === 'list_inbox') {
                    const res = await fetch(`${MCP_BASE_URL}/list_inbox`);
                    result = await res.json();
                } else if (fnName === 'read_file') {
                    const res = await fetch(`${MCP_BASE_URL}/read_file`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(fnArgs)
                    });
                    result = await res.json();
                }

                console.log(`      ✅ Tool Result: ${JSON.stringify(result).substring(0, 100)}...`);

                // Add result to history
                history.push({
                    role: 'tool',
                    content: JSON.stringify(result),
                    name: fnName
                });
            }

            // 3. Get Final Response
            const finalRes = await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: MODEL,
                    messages: history,
                    stream: false
                })
            });
            const finalData = await finalRes.json();
            console.log(`Navi: ${finalData.message.content}`);
            history.push(finalData.message);

        } else {
            // No tool used
            console.log(`Navi: ${message.content}`);
            history.push(message);
        }

    } catch (error) {
        console.log(`\n❌ Error: ${error.message}`);
    }
    console.log("-".repeat(50));
}

askQuestion();
