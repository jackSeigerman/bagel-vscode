const vscode = require("vscode")

/**
 * Bagel's section of the Explorer sidebar: a small web page where she lives.
 * VS Code creates it when the section opens and throws it away when it's
 * collapsed; the page saves where she was, so she picks up from there.
 */
class BagelViewProvider {
  constructor(extensionUri) {
    this.extensionUri = extensionUri
  }

  resolveWebviewView(view) {
    const media = vscode.Uri.joinPath(this.extensionUri, "media")
    view.webview.options = { enableScripts: true, localResourceRoots: [media] }
    view.webview.html = page(view.webview, media)
  }
}

function page(webview, media) {
  const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("")
  const script = webview.asWebviewUri(vscode.Uri.joinPath(media, "main.js"))
  const style = webview.asWebviewUri(vscode.Uri.joinPath(media, "bagel.css"))
  // Scripts only from the extension's own folder; the entry one by nonce, its
  // imports by source. Inline styles are how her pixels are drawn.
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
  ].join("; ")
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${style}">
<title>Bagel</title>
</head>
<body>
<div class="stage" id="stage"></div>
<script type="module" nonce="${nonce}" src="${script}"></script>
</body>
</html>`
}

function activate(context) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("bagel.view", new BagelViewProvider(context.extensionUri))
  )
}

function deactivate() {}

module.exports = { activate, deactivate }
