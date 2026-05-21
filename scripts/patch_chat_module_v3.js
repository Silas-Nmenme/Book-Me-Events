const fs=require('fs');
const p='Frontend/js/pages/chat.js';
let t=fs.readFileSync(p,'utf8');

// 1) insert activeRequestIdModule declaration after toast import
const marker = "import { toast } from '../ui.js';\n\nfunction qs(name)";
if (t.includes(marker) && !t.includes('activeRequestIdModule')) {
  t = t.replace(marker, "import { toast } from '../ui.js';\n\n// currently active request id for the chat page (mutable)\nlet activeRequestIdModule = '';\n\nfunction qs(name)");
}

// 2) replace const activeRequestId declaration
const oldDecl = "const myId = me?._id || me?.id;\n  const activeRequestId = requestId || '';";
if (t.includes(oldDecl)) {
  t = t.replace(oldDecl, "const myId = me?._id || me?.id;\n  activeRequestIdModule = requestId || '';" );
}

// 3) replace send handler that still references activeRequestId
const oldSend = `btnSendMessage?.addEventListener('click', async () => {\n    const text = messageText.value.trim();\n    if (!text) {\n      toast({ title: 'Empty message', message: 'Type a message before sending.', variant: 'warning' });\n      return;\n    }\n\n    try {\n      await sendMessageByRequestId({ requestId: activeRequestId, messageContent: text });\n      messageText.value = '';\n      await loadConversation(activeRequestId, myId, messagesList);\n      await loadUnread();\n      toast({ title: 'Sent', message: 'Message delivered.', variant: 'success' });\n    } catch (err) {\n      toast({ title: 'Send failed', message: err?.message || 'Try again.', variant: 'danger' });\n    }\n  });`;

const newSend = `btnSendMessage?.addEventListener('click', async () => {\n    const text = messageText.value.trim();\n    if (!text) {\n      toast({ title: 'Empty message', message: 'Type a message before sending.', variant: 'warning' });\n      return;\n    }\n\n    btnSendMessage.setAttribute('disabled', 'disabled');\n    try {\n      await sendMessageByRequestId({ requestId: activeRequestIdModule, messageContent: text });\n      messageText.value = '';\n      await loadConversation(activeRequestIdModule, myId, messagesList);\n      await loadUnread();\n      toast({ title: 'Sent', message: 'Message delivered.', variant: 'success' });\n    } catch (err) {\n      toast({ title: 'Send failed', message: err?.message || 'Try again.', variant: 'danger' });\n    } finally {\n      btnSendMessage.removeAttribute('disabled');\n    }\n  });`;

if (t.includes(oldSend)) t = t.replace(oldSend, newSend);

fs.writeFileSync(p, t, 'utf8');
console.log('patched v3', p);
