const fs = require('fs');
const p = 'Frontend/js/pages/chat.js';
let t = fs.readFileSync(p, 'utf8');

// Insert module-level var after import of toast
const importMarker = "import { toast } from '../ui.js';\n";
if (t.includes(importMarker) && !t.includes('activeRequestIdModule')) {
  t = t.replace(importMarker, importMarker + "\n// currently active request id for the chat page (mutable)\nlet activeRequestIdModule = '';\n\n");
}

// Append activeRequestIdModule set and history.replaceState after enabling buttons in applyRequestSelection
const enableButtons = "btnSendMessage?.removeAttribute('disabled');\n  messageText?.removeAttribute('disabled');";
if (t.includes(enableButtons) && !t.includes('history.replaceState')) {
  t = t.replace(enableButtons, enableButtons + "\n  // set module-level active request id so socket filtering and send handlers use the current request\n  activeRequestIdModule = requestId;\n  // update URL so the selection persists / is shareable\n  try { window.history.replaceState(null, '', `?requestId=${encodeURIComponent(requestId)}`); } catch (e) {}\n");
}

// Replace activeRequestId declaration
const activeDecl = "const myId = me?._id || me?.id;\n  const activeRequestId = requestId || '';";
if (t.includes(activeDecl)) {
  t = t.replace(activeDecl, "const myId = me?._id || me?.id;\n  activeRequestIdModule = requestId || '';\n");
}

// Replace the send handler block (exact match)
const sendBlockOld = `btnSendMessage?.addEventListener('click', async () => {\n    const text = messageText.value.trim();\n    if (!text) {\n      toast({ title: 'Empty message', message: 'Type a message before sending.', variant: 'warning' });\n      return;\n    }\n\n    try {\n      await sendMessageByRequestId({ requestId: activeRequestId, messageContent: text });\n      messageText.value = '';\n      await loadConversation(activeRequestId, myId, messagesList);\n      await loadUnread();\n      toast({ title: 'Sent', message: 'Message delivered.', variant: 'success' });\n    } catch (err) {\n      toast({ title: 'Send failed', message: err?.message || 'Try again.', variant: 'danger' });\n    }\n  });`;

const sendBlockNew = `btnSendMessage?.addEventListener('click', async () => {\n    const text = messageText.value.trim();\n    if (!text) {\n      toast({ title: 'Empty message', message: 'Type a message before sending.', variant: 'warning' });\n      return;\n    }\n\n    // disable while sending to prevent duplicates\n    btnSendMessage.setAttribute('disabled', 'disabled');\n    try {\n      await sendMessageByRequestId({ requestId: activeRequestIdModule, messageContent: text });\n      messageText.value = '';\n      await loadConversation(activeRequestIdModule, myId, messagesList);\n      await loadUnread();\n      toast({ title: 'Sent', message: 'Message delivered.', variant: 'success' });\n    } catch (err) {\n      toast({ title: 'Send failed', message: err?.message || 'Try again.', variant: 'danger' });\n    } finally {\n      btnSendMessage.removeAttribute('disabled');\n    }\n  });`;

if (t.includes(sendBlockOld)) {
  t = t.replace(sendBlockOld, sendBlockNew);
}

// Replace socket request check
const socketCheckOld = "if (!payload?.request || payload.request?.toString() !== activeRequestId?.toString()) {";
const socketCheckNew = "if (!payload?.request || payload.request?.toString() !== activeRequestIdModule?.toString()) {";
if (t.includes(socketCheckOld)) {
  t = t.replace(socketCheckOld, socketCheckNew);
}

fs.writeFileSync(p, t, 'utf8');
console.log('patched v2', p);
