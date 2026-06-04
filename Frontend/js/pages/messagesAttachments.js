// Shared helpers for attachment sending in message UIs.
// Currently unused directly; kept for future extraction.

export function getAttachmentInputs() {
  return {
    messageTextInput: document.getElementById('messageText'),
    attachmentsInput: document.getElementById('attachmentsInput'),
  };
}

