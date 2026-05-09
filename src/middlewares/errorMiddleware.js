const errorHandler = (err, req, res, next) => {
  const statusCode =
    res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;

  const safeMessage = (() => {
    const m = err?.message ?? 'Internal server error';
    return typeof m === 'string' ? m : JSON.stringify(m);
  })();

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    stack:
      process.env.NODE_ENV !== 'production'
        ? err?.stack
        : undefined,
  });
};

module.exports = { errorHandler };