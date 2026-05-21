const fs=require('fs');
const p='Frontend/js/pages/chat.js';
let t=fs.readFileSync(p,'utf8');

// 1) ensure declaration exists - add after toast import
const toastLine = "import { toast } from '../ui.js';";
if (t.includes(toastLine) && !t.includes('let activeRequestIdModule')) {
  t = t.replace(toastLine, toastLine + "\n\n// currently active request id for the chat page (mutable)\nlet activeRequestIdModule = '';\n");
}

// 2) replace occurrences of activeRequestId use in send handler
if (t.includes("sendMessageByRequestId({ requestId: activeRequestId")) {
  t = t.replace(/await sendMessageByRequestId\(\{ requestId: activeRequestId, messageContent: text \}\);/, "await sendMessageByRequestId({ requestId: activeRequestIdModule, messageContent: text });");
}

// 3) update loadConversation calls likewise
if (t.includes("await loadConversation(activeRequestId, myId, messagesList);")) {
  t = t.replace(/await loadConversation\(activeRequestId, myId, messagesList\);/g, 'await loadConversation(activeRequestIdModule, myId, messagesList);');
}

// 4) update activeRequestLabel and partnerName usage: replace activeRequestId variable where needed earlier
if (t.includes('const activeRequestId = requestId || \'')) {
  t = t.replace("const activeRequestId = requestId || '';", "activeRequestIdModule = requestId || '';\n");
}

fs.writeFileSync(p, t, 'utf8');
console.log('patched v4', p);
