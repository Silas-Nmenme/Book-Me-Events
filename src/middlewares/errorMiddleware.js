const errorHandler = (err, req, res, next) => {
  const statusCode =
    res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;

  const isServerError = statusCode >= 500;
  const safeMessage = isServerError
    ? 'Internal server error'
    : (typeof err?.message === 'string' ? err.message : 'Request failed');

  if (isServerError) {
    console.error('Unhandled request error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
  });
};

module.exports = { errorHandler };