const fs = require('fs');
const p = 'Frontend/js/pages/chat.js';
let t = fs.readFileSync(p, 'utf8');

// 1) insert module-level activeRequestIdModule after imports
if (!t.includes("let activeRequestIdModule")) {
  t = t.replace("import { toast } from '../ui.js';\n", "import { toast } from '../ui.js';\n\n// currently active request id for the chat page (mutable)\nlet activeRequestIdModule = '';\n");
}

// 2) append activeRequestIdModule set and URL replace in applyRequestSelection
t = t.replace(/(btnSendMessage\?\.removeAttribute\('disabled'\);\n\s*messageText\?\.removeAttribute\('disabled'\);\n)(\s*\})/, "$1  // set module-level active request id so socket filtering and send handlers use the current request\n  activeRequestIdModule = requestId;\n  // update URL so the selection persists / is shareable\n  try { window.history.replaceState(null, '', `?requestId=${encodeURIComponent(requestId)}`); } catch (e) {}\n\n$2");

// 3) replace const activeRequestId assignment
t = t.replace(/const myId = me\?\._id \|\| me\?\.id;\n\s*const activeRequestId = requestId \|\| '';/, "const myId = me?._id || me?.id;\n  activeRequestIdModule = requestId || '';\n");

// 4) replace send handler to use activeRequestIdModule and disable button
t = t.replace(/btnSendMessage\?\.addEventListener\('\\click', async \(\) => \{[\s\S]*?\}\);\n\n  messageText\?\.addEventListener\('keydown'/, `btnSendMessage?.addEventListener('click', async () => {\n    const text = messageText.value.trim();\n    if (!text) {\n      toast({ title: 'Empty message', message: 'Type a message before sending.', variant: 'warning' });\n      return;\n    }\n\n    // disable while sending to prevent duplicates\n    btnSendMessage.setAttribute('disabled', 'disabled');\n    try {\n      await sendMessageByRequestId({ requestId: activeRequestIdModule, messageContent: text });\n      messageText.value = '';\n      await loadConversation(activeRequestIdModule, myId, messagesList);\n      await loadUnread();\n      toast({ title: 'Sent', message: 'Message delivered.', variant: 'success' });\n    } catch (err) {\n      toast({ title: 'Send failed', message: err?.message || 'Try again.', variant: 'danger' });\n    } finally {\n      btnSendMessage.removeAttribute('disabled');\n    }\n  });\n\n  messageText?.addEventListener('keydown'`);

// 5) replace socket payload check to use activeRequestIdModule
t = t.replace(/if \(!payload\?\.request \|\| payload.request\?\.toString\(\) !== activeRequestId\?\.toString\(\)\) \{\n\s*return;\n\s*\}/, `if (!payload?.request || payload.request?.toString() !== activeRequestIdModule?.toString()) {\n          return;\n        }`);

fs.writeFileSync(p, t, 'utf8');
console.log('patched', p);
