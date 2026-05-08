const asyncHandler = require('express-async-handler');

// Placeholder controller if you want to expand uploads later.
// Current implementation uploads directly inside uploadRoutes.

exports.health = asyncHandler(async (req, res) => {
  res.json({ success: true });
});

