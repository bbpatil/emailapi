import ensureAuth from '~/src/middleware/ensureAuth';

const { fetchAttachment } = require('~/src/gmail');

async function handle(req, res, resolve) {
  const { attachmentId, messageId } = req.body;
  const base64Encoded = await fetchAttachment({
    attachmentId,
    messageId,
    refreshToken: req.refresh_token,
  });
  res.json({ base64: base64Encoded });
  resolve();
}

export default ensureAuth(handle);
